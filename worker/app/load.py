"""Production loader: drives the pipeline over sources.txt.

Order: STAGE 1 = big multi-city labs (category=lab, static) for the overlap
backbone; STAGE 2 = everything else static. JS-only / no-price / errors are logged
to skipped_sources.txt and skipped — one source never blocks the others. Keeps
every row (no cleanup). Clinics are deduped by (name, city).

  python -m app.load stage1   # backbone first
  python -m app.load stage2   # fan-out
  python -m app.load all
"""

from __future__ import annotations

import os
import random
import re
import sys
import time
from datetime import datetime, timezone

from .pipeline import NoPriceFound, run_source
from .supabase_client import get_client

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCES = os.path.join(_ROOT, "sources.txt")
SKIPPED = os.path.join(_ROOT, "skipped_sources.txt")

CITY_RU = {
    "almaty": "Алматы", "astana": "Астана", "shymkent": "Шымкент", "aktobe": "Актобе",
    "pavlodar": "Павлодар", "semey": "Семей", "ust-kamenogorsk": "Усть-Каменогорск",
    "aktau": "Актау", "karaganda": "Караганда", "kokshetau": "Кокшетау",
    "kostanay": "Костанай", "atyrau": "Атырау", "ekibastuz": "Экибастуз",
    "kyzylorda": "Кызылорда", "taldykorgan": "Талдыкорган", "taraz": "Тараз",
    "temirtau": "Темиртау", "uralsk": "Уральск", "zhezkazgan": "Жезказган",
    "rudny": "Рудный", "turkestan": "Туркестан", "petropavlovsk": "Петропавловск",
    "multi": "Казахстан",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_sources() -> list[dict]:
    rows = []
    with open(SOURCES, encoding="utf-8") as f:
        header = f.readline().strip().split("|")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            vals = line.split("|")
            if len(vals) < len(header):
                continue
            rows.append(dict(zip(header, vals)))
    return rows


def clinic_name(name: str, slug: str) -> str:
    n = name.strip()
    norm = lambda x: x.lower().replace("-", " ").strip()
    cs = norm(slug)
    if cs and norm(n).endswith(cs):
        n = n[: len(n) - len(cs)].strip(" -")
    return n or name.strip()


def _get_or_create(sb, table, match: dict, payload: dict) -> dict:
    q = sb.table(table).select("*")
    for k, v in match.items():
        q = q.eq(k, v)
    found = q.limit(1).execute().data
    return found[0] if found else sb.table(table).insert(payload).execute().data[0]


def process(sb, row: dict) -> tuple[str, str]:
    city = CITY_RU.get(row.get("city", ""), row.get("city") or "Казахстан")
    cname = clinic_name(row["name"], row.get("city", ""))
    stype = row.get("format", "html")
    if stype not in ("html", "pdf", "docx", "xlsx"):
        stype = "html"

    clinic = _get_or_create(sb, "clinics", {"name": cname, "city": city},
                            {"name": cname, "city": city, "website_url": row["url"], "is_active": True})
    source = _get_or_create(sb, "sources", {"url": row["url"]},
                            {"name": row["name"], "url": row["url"], "source_type": stype,
                             "default_clinic_id": clinic["id"], "is_active": True})
    run = sb.table("parse_runs").insert(
        {"source_id": source["id"], "status": "running", "trigger": "scheduled", "started_at": _now()}
    ).execute().data[0]

    try:
        counters = run_source(sb, run["id"], source)
        sb.table("parse_runs").update({"status": "success", "finished_at": _now(), **counters}).eq("id", run["id"]).execute()
        sb.table("sources").update({"last_run_at": _now(), "consecutive_failures": 0}).eq("id", source["id"]).execute()
        return "ok", f"{counters['rows_inserted']} linked / {counters['rows_unmatched']} queued / {counters['rows_found']} found"
    except NoPriceFound as e:
        sb.table("parse_runs").update({"status": "failed", "finished_at": _now(), "error_summary": f"no_price: {e}"}).eq("id", run["id"]).execute()
        return "no_price", str(e)
    except Exception as e:  # noqa: BLE001
        sb.table("parse_runs").update({"status": "failed", "finished_at": _now(), "error_summary": str(e)[:400]}).eq("id", run["id"]).execute()
        return "error", str(e)[:200]


def select_rows(stage: str, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (to_process, js_skipped). With the Playwright fallback in fetch_smart, the
    `all` stage now PROCESSES the js_required sources too (rendered headless) — they are no
    longer pre-skipped. stage1/stage2 keep the old static-only split for targeted runs."""
    js = [r for r in rows if r.get("js_required") == "yes"]
    static = [r for r in rows if r.get("js_required") != "yes"]
    lab = [r for r in static if r.get("category") == "lab"]
    rest = [r for r in static if r.get("category") != "lab"]
    if stage == "stage1":
        return lab, js
    if stage == "stage2":
        return rest, []
    return lab + rest + js, []  # all/full — everything, JS sources via Playwright


def main() -> None:
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    resume = "resume" in sys.argv[2:]
    sb = get_client()
    rows = parse_sources()
    to_process, js_skipped = select_rows(stage, rows)

    if resume:  # skip sources that already have a successful run (restart after interruption)
        done_sids = {r["source_id"] for r in
                     sb.table("parse_runs").select("source_id").eq("status", "success").execute().data}
        done_urls = {s["url"] for s in sb.table("sources").select("id, url").execute().data
                     if s["id"] in done_sids}
        before = len(to_process)
        to_process = [r for r in to_process if r["url"] not in done_urls]
        print(f"[resume] skipping {before - len(to_process)} already-loaded sources")

    print(f"[{stage}] {len(to_process)} sources to process, {len(js_skipped)} js-skipped")

    skip_lines = [f"js_required | {r['name']} | {r['url']}" for r in js_skipped]
    ok = noprice = err = 0
    for i, row in enumerate(to_process, 1):
        try:
            status, detail = process(sb, row)
        except Exception as e:  # noqa: BLE001 — never let one source stop the run
            status, detail = "error", str(e)[:200]
        tag = {"ok": "OK", "no_price": "NOPRICE", "error": "ERROR"}[status]
        print(f"  [{i}/{len(to_process)}] {tag:7} {row['name'][:42]:42} {detail}", flush=True)
        if status == "ok":
            ok += 1
        elif status == "no_price":
            noprice += 1
            skip_lines.append(f"no_price | {row['name']} | {row['url']}")
        else:
            err += 1
            skip_lines.append(f"error: {detail} | {row['name']} | {row['url']}")
        time.sleep(random.uniform(1.5, 3.5))  # polite crawl-delay + jitter

    with open(SKIPPED, "a", encoding="utf-8") as f:
        f.write(f"\n# {stage} @ {_now()}\n" + "\n".join(skip_lines) + "\n")
    print(f"\n[{stage}] done: {ok} ok, {noprice} no_price, {err} error. skips -> {SKIPPED}")


if __name__ == "__main__":
    main()
