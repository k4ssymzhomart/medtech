"""2gis enrichment (Playwright, no API key) — rating, phone, structured hours per clinic.

Flow per clinic: search 2gis -> pick the best-matching FIRM from the map markers
(building results filtered out; Latin DB names aliased to Cyrillic for chains) -> open
its firm page -> read the byid JSON (schedule + contacts). Stores onto clinics.rating /
clinics.phone / clinics.working_hours (the per-day schedule jsonb). Best-effort and
resumable: clinics already carrying any of the three are skipped.

  PYTHONPATH=<repo>/worker <repo>/worker/.venv/bin/python worker/scripts/enrich_2gis.py [limit]

Bypasses the 2gis "update browser" interstitial once per session (cookie persists).
"""
import json
import re
import sys
import time
from urllib.parse import quote

from rapidfuzz import fuzz

from app.supabase_client import get_client

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

CITY_SLUG = {
    "Алматы": "almaty", "Астана": "astana", "Шымкент": "shymkent", "Караганда": "karaganda",
    "Актобе": "aktobe", "Атырау": "atyrau", "Усть-Каменогорск": "oskemen", "Семей": "semey",
    "Костанай": "kostanay", "Кызылорда": "kyzylorda", "Павлодар": "pavlodar", "Тараз": "taraz",
    "Уральск": "uralsk", "Петропавловск": "petropavl", "Кокшетау": "kokshetau",
    "Талдыкорган": "taldykorgan", "Темиртау": "temirtau", "Туркестан": "turkestan",
    "Экибастуз": "ekibastuz", "Рудный": "rudny", "Жезказган": "zhezkazgan", "Актау": "aktau",
    "Казахстан": "almaty",
}
ALIAS = {"invitro": "инвитро", "kdl": "кдл олимп", "olymp": "олимп", "helix": "хеликс",
         "gemotest": "гемотест", "immunotest": "иммунотест", "euromed": "евромед"}
BUILDING = re.compile(r"квартал|микрорайон|\bжк\b|\bдом\b|улица|проспект|шоссе|бизнес.?центр|\bтрц\b|\bтц\b", re.I)


def _clean_name(name: str) -> str:
    n = re.sub(r"\([^)]*\)", " ", name)  # drop "(MDI)" etc.
    n = re.sub(r"\s+(лаборатория|консультации|general catalog|rehab MC|servis|—.*)$", "", n, flags=re.I)
    return re.sub(r"\s+", " ", n).strip() or name


def pick_firm(links: list[dict], clinic_name: str) -> dict | None:
    """links: [{id, name}] from the results panel DOM. Pick the best name match."""
    nm = clinic_name.lower()
    aliases = [nm] + [v for k, v in ALIAS.items() if k in nm]
    seen, best, best_score = set(), None, 0
    for l in links:
        fid, fn = l.get("id"), (l.get("name") or "").lower()
        if not fid or fid in seen or not fn or BUILDING.search(fn):
            continue
        seen.add(fid)
        sc = max(fuzz.token_set_ratio(a, fn) for a in aliases)
        if sc > best_score:
            best, best_score = {"id": fid, "name": l["name"]}, sc
    return best if best_score >= 45 else None


def phones_from(contact_groups) -> str | None:
    for g in contact_groups or []:
        for c in g.get("contacts", []):
            if c.get("type") == "phone":
                return c.get("value") or c.get("text")
    return None


def _skip_interstitial(page) -> None:
    try:
        if "браузер" in page.inner_text("body")[:120].lower():
            page.click("text=Пропустить", timeout=2500)
            page.wait_for_timeout(1500)
    except Exception:
        pass


def _is_byid(r) -> bool:
    return "catalog.api.2gis" in r.url and "items/byid" in r.url


def enrich_one(ctx, slug: str, clinic_name: str) -> dict:
    page = ctx.new_page()
    q = _clean_name(clinic_name)
    out: dict = {}
    try:
        page.goto(f"https://2gis.kz/{slug}/search/{quote(q)}", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(1200)
        _skip_interstitial(page)
        try:
            page.wait_for_selector("a[href*='/firm/']", timeout=12000)
        except Exception:
            pass
        page.wait_for_timeout(1200)
        links = page.eval_on_selector_all(
            "a[href*='/firm/']",
            "els => els.map(e => ({id:(e.getAttribute('href')||'').split('/firm/')[1]?.split('?')[0]?.split('/')[0],"
            "name:(e.textContent||'').trim().slice(0,60)})).filter(x=>x.id && x.name)",
        )
        firm = pick_firm(links, clinic_name)
        if firm:
            out["matched"] = firm["name"]
            firm_url = f"https://2gis.kz/{slug}/firm/{firm['id']}"
            d = None
            for _attempt in range(2):
                try:
                    with page.expect_response(_is_byid, timeout=14000) as ri:
                        page.goto(firm_url, wait_until="domcontentloaded", timeout=45000)
                        _skip_interstitial(page)
                    d = (ri.value.json().get("result", {}) or {}).get("items", [None])[0]
                except Exception:
                    d = None
                if d:
                    break
                page.wait_for_timeout(1500)
            if d:
                out["schedule"] = d.get("schedule")
                out["phone"] = phones_from(d.get("contact_groups"))
                if d.get("reviews"):
                    out["rating"] = d["reviews"].get("general_rating")
    except Exception as e:  # noqa: BLE001
        out["error"] = type(e).__name__
    finally:
        page.close()
    return out


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    sb = get_client()
    clinics = sb.table("clinics").select("id, name, city, rating, phone, working_hours").eq("is_active", True).execute().data
    todo = [c for c in clinics if not (c.get("rating") or c.get("phone") or c.get("working_hours"))]
    if limit:
        todo = todo[:limit]
    print(f"{len(clinics)} clinics, {len(todo)} to enrich")

    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    b = p.chromium.launch(channel="chromium", headless=True,
                          args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"])

    def new_ctx():
        c = b.new_context(user_agent=UA, locale="ru-RU", timezone_id="Asia/Almaty", viewport={"width": 1440, "height": 1000})
        c.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        return c

    ctx = new_ctx()
    got_hours = got_rating = got_phone = unmatched = 0
    try:
        for i, c in enumerate(todo, 1):
            if i > 1 and i % 20 == 1:  # recycle context to avoid cumulative rate-limiting
                try:
                    ctx.close()
                except Exception:
                    pass
                ctx = new_ctx()
            slug = CITY_SLUG.get(c.get("city") or "", "almaty")
            r = enrich_one(ctx, slug, c["name"])
            upd: dict = {}
            if r.get("rating") is not None:
                upd["rating"] = r["rating"]; got_rating += 1
            if r.get("phone"):
                upd["phone"] = r["phone"]; got_phone += 1
            if r.get("schedule"):
                upd["working_hours"] = r["schedule"]; got_hours += 1
            if upd:
                try:
                    sb.table("clinics").update(upd).eq("id", c["id"]).execute()
                except Exception:
                    pass
            else:
                unmatched += 1
            print(f"  [{i}/{len(todo)}] {c['name'][:30]:30} [{c.get('city','')[:12]:12}] "
                  f"-> {r.get('matched','—')[:28]:28} r={r.get('rating')} ph={'Y' if r.get('phone') else '-'} hrs={'Y' if r.get('schedule') else '-'}", flush=True)
            time.sleep(3.0)  # politeness
    finally:
        b.close(); p.stop()

    print(f"\n=== 2GIS ENRICH RESULT ===")
    print(f"processed   : {len(todo)}")
    print(f"got hours   : {got_hours}")
    print(f"got rating  : {got_rating}")
    print(f"got phone   : {got_phone}")
    print(f"unmatched   : {unmatched}")


if __name__ == "__main__":
    main()
