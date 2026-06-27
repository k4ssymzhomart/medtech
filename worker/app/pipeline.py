"""Pipeline orchestration: fetch -> extract -> normalize -> write. NO LLM, no API key.

Production load keeps every row (no cleanup). Extraction is deterministic HTML parsing
(per-source DOM parsers + a generic fallback). Normalization is deterministic too:
exact/synonym -> head-prefix -> guarded fuzzy. Confident matches become offers; plausible
near-misses go to unmatched_queue for the admin to resolve (which grows the synonym table
and lifts recall on every future run); clearly off-catalog names are dropped from the
live layer but retained in raw_extractions for audit.
"""

from __future__ import annotations

from .config import settings
from .extract import extract_offers
from .fetch import fetch_smart
from .normalize.match import AUTO_LINK_SCORE, QUEUE_FLOOR, CatalogIndex
from .write import upsert_offer


class NoPriceFound(Exception):
    """Raised when a page yields no extractable priced services (skip-log)."""


def _log(sb, run_id, source_id, level, message, detail=None) -> None:
    sb.table("parse_logs").insert(
        {"run_id": run_id, "source_id": source_id, "level": level, "message": message, "detail": detail}
    ).execute()


def run_source(sb, run_id: str, source: dict) -> dict:
    source_id = source["id"]
    clinic_id = source.get("default_clinic_id")
    if not clinic_id:
        raise RuntimeError("source has no default_clinic_id")

    counters = {"rows_found": 0, "rows_inserted": 0, "rows_updated": 0, "rows_unmatched": 0}

    fetched = fetch_smart(source["url"])
    if fetched.status >= 400 or not fetched.body:
        raise NoPriceFound(f"HTTP {fetched.status}")
    rawdoc = (
        sb.table("raw_documents")
        .insert({"source_id": source_id, "run_id": run_id, "content_hash": fetched.content_hash,
                 "http_status": fetched.status, "mime_type": fetched.mime})
        .execute().data[0]
    )

    # Deterministic extraction (per-source DOM parser, else generic price-node fallback).
    services = extract_offers(fetched.body, source["url"])
    if not services:
        raise NoPriceFound("no priced services extracted")
    counters["rows_found"] = len(services)

    # Audit: keep EVERY extracted row (the data is the deliverable). Capture ids so a
    # queued near-miss can point back to its raw row (which carries the price).
    raw_id_by_name: dict[str, str] = {}
    rows = [{"raw_document_id": rawdoc["id"], "run_id": run_id, "source_id": source_id,
             "raw_service_name": s.name, "raw_price": s.price, "raw_currency": s.currency,
             "raw_duration": s.duration or None} for s in services]
    for i in range(0, len(rows), 100):
        inserted = sb.table("raw_extractions").insert(rows[i:i + 100]).execute().data
        for r in inserted:
            raw_id_by_name.setdefault(r["raw_service_name"], r["id"])

    catalog = (
        sb.table("services_catalog").select("id, canonical_name, slug, synonyms")
        .eq("is_active", True).execute().data
    )
    index = CatalogIndex(catalog)

    # Cross-run queue dedup: the same raw name recurs in every city (one template), so
    # queue each unique name ONCE. Resolving it adds a synonym -> every city auto-links.
    already_queued = {
        r["raw_service_name"]
        for r in sb.table("unmatched_queue").select("raw_service_name")
        .eq("status", "pending").range(0, 49999).execute().data
    }

    dropped = 0
    linked_this_run: set[str] = set()  # one offer per (service, clinic, source); first wins
    queue_rows: list[dict] = []
    for s in services:
        service_id, conf, _how = index.match(s.name)
        if service_id and conf >= AUTO_LINK_SCORE:
            if service_id in linked_this_run:
                continue  # a more standard variant already linked (e.g. skip "(динамика)")
            linked_this_run.add(service_id)
            action, _ = upsert_offer(
                sb, clinic_id=clinic_id, service_id=service_id, source_id=source_id,
                raw_name=s.name, price=s.price, currency=s.currency, unit=s.unit,
                duration=s.duration, source_url=source["url"],
                fx_usd_kzt=settings.fx_usd_kzt, run_id=run_id)
            if action == "inserted":
                counters["rows_inserted"] += 1
            elif action == "updated":
                counters["rows_updated"] += 1
        elif service_id and conf >= QUEUE_FLOOR:
            if s.name in already_queued:
                continue  # plausible near-miss already awaiting review (this or another city)
            already_queued.add(s.name)
            counters["rows_unmatched"] += 1
            queue_rows.append(
                {"raw_extraction_id": raw_id_by_name.get(s.name), "source_id": source_id,
                 "raw_service_name": s.name, "suggested_service_id": service_id,
                 "confidence": round(conf, 3), "status": "pending"})
        else:
            dropped += 1  # off-catalog: retained in raw_extractions, not in the live layer

    for i in range(0, len(queue_rows), 100):
        sb.table("unmatched_queue").insert(queue_rows[i:i + 100]).execute()

    _log(sb, run_id, source_id, "info",
         f"{len(services)} extracted -> {counters['rows_inserted']} new + "
         f"{counters['rows_updated']} updated linked, {counters['rows_unmatched']} queued, "
         f"{dropped} off-catalog")
    # Production first-load: keep every row, no archiving (lifecycle is for re-runs).
    return counters
