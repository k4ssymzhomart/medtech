"""STEP A — drain unmatched_queue by linking ALREADY-extracted services. No fetch, no API.

1. Add new catalog services for recurring doctor/diagnostic items not in the 78.
2. Resolve each queued raw name to a catalog service via medical-equivalent RULES
   (specialty of a consultation; organ of an ultrasound; imaging modality) + a fuzzy
   fallback for lab variants. Junk ("Услуга 12", "Профили") -> ignored.
3. For every resolved name, create offers from raw_extractions across ALL clinics that
   extracted it, and append the raw name as a synonym so future runs auto-link it.
Keep all rows. Idempotent: re-running only adds what's missing.
"""
import re
from collections import defaultdict
from datetime import datetime, timezone

from rapidfuzz import fuzz

from app.config import settings
from app.normalize.match import CatalogIndex, norm_key
from app.supabase_client import get_client
from app.write import upsert_offer

CAT_PRIEM = "994000c7-9ed2-4932-be6f-5924f2b978ab"
CAT_DIAG = "c9ef3947-2a34-4e75-9123-f12950cba082"

NEW_DOCTORS = [
    ("priem-akushera-ginekologa", "Приём акушера-гинеколога", ["акушер-гинеколог", "акушера-гинеколога", "акушер"]),
    ("priem-stomatologa", "Приём стоматолога", ["стоматолог", "дантист"]),
    ("priem-onkologa", "Приём онколога", ["онколог", "онко-дерматолог"]),
    ("priem-travmatologa", "Приём травматолога-ортопеда", ["травматолог", "ортопед", "травматолог-ортопед"]),
    ("priem-nefrologa", "Приём нефролога", ["нефролог"]),
    ("priem-infekcionista", "Приём инфекциониста", ["инфекционист"]),
    ("priem-psihoterapevta", "Приём психотерапевта", ["психотерапевт", "психиатр"]),
    ("priem-psihologa", "Приём психолога", ["психолог"]),
    ("priem-mammologa", "Приём маммолога", ["маммолог"]),
    ("priem-gematologa", "Приём гематолога", ["гематолог"]),
    ("priem-pulmonologa", "Приём пульмонолога", ["пульмонолог"]),
    ("priem-revmatologa", "Приём ревматолога", ["ревматолог"]),
    ("priem-allergologa", "Приём аллерголога-иммунолога", ["аллерголог", "иммунолог"]),
    ("priem-proktologa", "Приём проктолога", ["проктолог", "колопроктолог"]),
    ("priem-sosud-hirurga", "Приём сосудистого хирурга", ["флеболог", "ангиохирург", "сосудистый хирург", "сосудистого хирурга"]),
    ("priem-neyrohirurga", "Приём нейрохирурга", ["нейрохирург"]),
    ("priem-genetika", "Приём генетика", ["генетик"]),
    ("priem-fizioterapevta", "Приём физиотерапевта", ["физиотерапевт"]),
    ("priem-reabilitologa", "Приём реабилитолога", ["реабилитолог"]),
    ("priem-reproduktologa", "Приём репродуктолога", ["репродуктолог"]),
    ("priem-dietologa", "Приём диетолога", ["диетолог", "нутрициолог"]),
    ("priem-androloga", "Приём андролога", ["андролог"]),
    ("priem-logopeda", "Приём логопеда", ["логопед"]),
    ("priem-chlh", "Приём челюстно-лицевого хирурга", ["челюстно-лицевой хирург", "челюстно-лицевого хирурга"]),
]
NEW_DIAGNOSTICS = [
    ("uzi-moshonki", "УЗИ органов мошонки", ["узи мошонки", "мошонки"]),
    ("uzi-prostaty", "УЗИ предстательной железы", ["узи простаты", "предстательной железы"]),
    ("uzi-sustavov", "УЗИ суставов", ["узи суставов"]),
    ("uzi-myagkih-tkaney", "УЗИ мягких тканей", ["узи мягких тканей"]),
    ("densitometriya", "Денситометрия", ["денситометрия"]),
    ("neyrosonografiya", "Нейросонография", ["нейросонография", "нсг"]),
    ("rentgenografiya", "Рентгенография", ["рентгенография", "рентген"]),
]

# Specialty stems -> slug, SPECIFIC compounds before generic (ангиохирург before хирург).
SPEC = [
    ("акушер", "priem-akushera-ginekologa"), ("челюстно", "priem-chlh"),
    ("нейрохирург", "priem-neyrohirurga"), ("ангиохирург", "priem-sosud-hirurga"),
    ("флеболог", "priem-sosud-hirurga"), ("сосудист", "priem-sosud-hirurga"),
    ("травматолог", "priem-travmatologa"), ("ортопед", "priem-travmatologa"),
    ("онко", "priem-onkologa"), ("стоматолог", "priem-stomatologa"),
    ("психотерапевт", "priem-psihoterapevta"), ("психиатр", "priem-psihoterapevta"),
    ("психолог", "priem-psihologa"), ("нефролог", "priem-nefrologa"),
    ("инфекционист", "priem-infekcionista"), ("маммолог", "priem-mammologa"),
    ("гематолог", "priem-gematologa"), ("пульмонолог", "priem-pulmonologa"),
    ("ревматолог", "priem-revmatologa"), ("аллерголог", "priem-allergologa"),
    ("иммунолог", "priem-allergologa"), ("проктолог", "priem-proktologa"),
    ("генетик", "priem-genetika"), ("физиотерапевт", "priem-fizioterapevta"),
    ("реабилитолог", "priem-reabilitologa"), ("репродуктолог", "priem-reproduktologa"),
    ("диетолог", "priem-dietologa"), ("нутрициолог", "priem-dietologa"),
    ("андролог", "priem-androloga"), ("логопед", "priem-logopeda"),
    ("эндокринолог", "priem-endokrinologa"), ("гастроэнтеролог", "priem-gastroenterologa"),
    ("гинеколог", "priem-ginekologa"), ("дерматолог", "priem-dermatologa"),
    ("кардиолог", "priem-kardiologa"), ("невролог", "priem-nevrologa"),
    ("невропатолог", "priem-nevrologa"), ("оториноларинголог", "priem-lor"),
    ("отоларинголог", "priem-lor"), ("лор", "priem-lor"),
    ("офтальмолог", "priem-oftalmologa"), ("окулист", "priem-oftalmologa"),
    ("педиатр", "priem-pediatra"), ("терапевт", "priem-terapevta"),
    ("уролог", "priem-urologa"), ("хирург", "priem-hirurga"),
]

_CONSULT = re.compile(r"при[её]м|прием|консультац|осмотр")
_UZI = re.compile(r"\bузи|ультразвук")
UZI_ORGAN = [
    ("брюшн", "uzi-bryushnoy-polosti"), ("молочн", "uzi-molochnyh-zhelez"),
    ("щитовид", "uzi-shchitovidnoy"), ("малого таза", "uzi-malogo-taza"),
    ("омт", "uzi-malogo-taza"), ("трансвагинал", "uzi-malogo-taza"), ("матки", "uzi-malogo-taza"),
    ("почек", "uzi-pochek"), ("почки", "uzi-pochek"), ("беременн", "uzi-beremennost"),
    ("плода", "uzi-beremennost"), ("сердца", "ehokardiografiya"), ("эхо", "ehokardiografiya"),
    ("сосуд", "uzdg-sosudov"), ("допплер", "uzdg-sosudov"), ("дуплекс", "uzdg-sosudov"),
    ("брахиоцеф", "uzdg-sosudov"), ("мошонк", "uzi-moshonki"), ("предстательн", "uzi-prostaty"),
    ("простат", "uzi-prostaty"), ("суставов", "uzi-sustavov"), ("мягких тканей", "uzi-myagkih-tkaney"),
]


def is_junk(raw: str) -> bool:
    s = raw.strip().lower()
    if len(s) < 4:
        return True
    if re.fullmatch(r"(услуга|услуги|профил\w*|test|прочее|разное|наименование)\s*\d*", s):
        return True
    if not re.search(r"[а-яёa-z]", s):  # no letters at all
        return True
    return False


def imaging(n: str) -> str | None:
    if _UZI.search(n):
        for kw, slug in UZI_ORGAN:
            if kw in n:
                return slug
        return None  # generic ultrasound -> leave
    if re.search(r"\bмрт|магнитно.резонанс", n):
        return "mrt"
    if re.search(r"\bкт\b|\bмскт\b|компьютерн\w*\s+томограф", n):
        return "kt"
    if "маммограф" in n:
        return "mammografiya"
    if "флюорограф" in n:
        return "rentgen-grudnoy-kletki"
    if re.search(r"рентген\w*\s+\w*(грудн|огк|легк|клетк)", n):
        return "rentgen-grudnoy-kletki"
    if "денситометр" in n:
        return "densitometriya"
    if re.search(r"нейросонограф|\bнсг\b", n):
        return "neyrosonografiya"
    if "рентген" in n:
        return "rentgenografiya"
    if re.search(r"фгдс|эгдс|гастроскоп|эзофагогастро", n):
        return "gastroskopiya"
    if re.search(r"колоноскоп|\bфкс\b", n):
        return "kolonoskopiya"
    if "холтер" in n:
        return "holter-ekg"
    if re.search(r"\bэкг\b|электрокардиограф", n):
        return "ekg"
    return None


def main() -> None:
    sb = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # ---- 1. add new catalog services ----
    existing = sb.table("services_catalog").select("id, slug, synonyms").eq("is_active", True).execute().data
    slug2id = {s["slug"]: s["id"] for s in existing}
    syn_now = {s["id"]: list(s.get("synonyms") or []) for s in existing}

    to_insert = []
    for slug, name, syns in NEW_DOCTORS:
        if slug not in slug2id:
            to_insert.append({"canonical_name": name, "slug": slug, "category_id": CAT_PRIEM, "synonyms": syns})
    for slug, name, syns in NEW_DIAGNOSTICS:
        if slug not in slug2id:
            to_insert.append({"canonical_name": name, "slug": slug, "category_id": CAT_DIAG, "synonyms": syns})
    if to_insert:
        ins = sb.table("services_catalog").insert(to_insert).execute().data
        for r in ins:
            slug2id[r["slug"]] = r["id"]
            syn_now[r["id"]] = list(next((s for sl, n, s in NEW_DOCTORS + NEW_DIAGNOSTICS if sl == r["slug"]), []))
    print(f"new catalog services added: {len(to_insert)} (total now {len(slug2id)})")

    # expanded index for the lab fuzzy fallback
    full = sb.table("services_catalog").select("id, canonical_name, slug, synonyms").eq("is_active", True).execute().data
    idx = CatalogIndex(full)

    def decide(raw: str) -> str | None:
        n = raw.lower()
        if is_junk(raw):
            return "__junk__"
        if _CONSULT.search(n):
            for stem, slug in SPEC:
                if stem in n:
                    return slug
        slug = imaging(n)
        if slug:
            return slug
        sid, conf, _ = idx.match(raw)  # lab/other fuzzy fallback (lowered acceptance)
        if sid and conf >= 0.86:
            return next((sl for sl, i in slug2id.items() if i == sid), None)
        return None

    # ---- 2. group raw_extractions by name -> {source_id: (price, currency, duration)} ----
    print("loading raw_extractions...")
    rx_by_name: dict[str, dict[str, tuple]] = defaultdict(dict)
    frm = 0
    while True:
        rows = sb.table("raw_extractions").select(
            "source_id, raw_service_name, raw_price, raw_currency, raw_duration"
        ).range(frm, frm + 999).execute().data
        for rx in rows:
            nm, sid = rx.get("raw_service_name"), rx.get("source_id")
            if nm and sid and rx.get("raw_price") and sid not in rx_by_name[nm]:
                rx_by_name[nm][sid] = (float(rx["raw_price"]), (rx.get("raw_currency") or "KZT"),
                                       rx.get("raw_duration") or "")
        if len(rows) < 1000:
            break
        frm += 1000
    print(f"  {len(rx_by_name)} distinct raw names across raw_extractions")

    sources = {s["id"]: s for s in sb.table("sources").select("id, default_clinic_id, url").execute().data}

    # ---- 3. resolve queue ----
    queue = []
    frm = 0
    while True:
        rows = sb.table("unmatched_queue").select("id, raw_service_name").eq("status", "pending").range(frm, frm + 999).execute().data
        queue += rows
        if len(rows) < 1000:
            break
        frm += 1000
    before = len(queue)
    print(f"pending queue before: {before}")

    new_syn: dict[str, set] = defaultdict(set)
    ins = upd = resolved = ignored = left = 0
    for qi in queue:
        raw = qi["raw_service_name"] or ""
        slug = decide(raw)
        if slug == "__junk__":
            sb.table("unmatched_queue").update({"status": "ignored", "resolved_at": now}).eq("id", qi["id"]).execute()
            ignored += 1
            continue
        sid = slug2id.get(slug) if slug else None
        if not sid:
            left += 1
            continue
        new_syn[sid].add(raw)
        for src_id, (price, cur, dur) in rx_by_name.get(raw, {}).items():
            s = sources.get(src_id)
            if not s or not s.get("default_clinic_id"):
                continue
            action, _ = upsert_offer(
                sb, clinic_id=s["default_clinic_id"], service_id=sid, source_id=src_id,
                raw_name=raw, price=price, currency=cur, unit="", duration=dur,
                source_url=s.get("url"), fx_usd_kzt=settings.fx_usd_kzt, run_id=None)
            if action == "inserted":
                ins += 1
            elif action == "updated":
                upd += 1
        sb.table("unmatched_queue").update(
            {"status": "resolved", "resolved_service_id": sid, "resolved_at": now}
        ).eq("id", qi["id"]).execute()
        resolved += 1

    # ---- 4. persist learned synonyms (so future runs auto-link) ----
    for sid, syns in new_syn.items():
        have = {x.lower() for x in syn_now.get(sid, [])}
        merged = syn_now.get(sid, []) + [s for s in syns if s.lower() not in have]
        if len(merged) != len(syn_now.get(sid, [])):
            sb.table("services_catalog").update({"synonyms": merged}).eq("id", sid).execute()

    print(f"\n=== STEP A RESULT ===")
    print(f"queue before -> after : {before} -> {before - resolved - ignored}")
    print(f"resolved (linked)     : {resolved}")
    print(f"ignored (junk)        : {ignored}")
    print(f"left pending          : {left}")
    print(f"offers inserted/updated: {ins} / {upd}")


if __name__ == "__main__":
    main()
