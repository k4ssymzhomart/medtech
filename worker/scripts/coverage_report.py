"""Full data-coverage report: brands, offers per category, catalog coverage, cross-city
comparability, queue, and the skip list grouped by failure reason. Read-only.

  PYTHONPATH=<repo>/worker <repo>/worker/.venv/bin/python worker/scripts/coverage_report.py
"""
import os
import re
from collections import Counter, defaultdict

from app.supabase_client import get_client

sb = get_client()
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def fa(t, sel, **eq):
    rows, frm = [], 0
    while True:
        q = sb.table(t).select(sel)
        for k, v in eq.items():
            q = q.eq(k, v)
        r = q.range(frm, frm + 999).execute().data
        rows += r
        if len(r) < 1000:
            break
        frm += 1000
    return rows


offers = fa("price_offers", "clinic_id,service_id", is_active=True)
svcs = fa("services_catalog", "id,canonical_name,category_id", is_active=True)
cats = {c["id"]: c["name"] for c in fa("service_categories", "id,name")}
clinics = {c["id"]: c for c in fa("clinics", "id,name,city,lat", is_active=True)}
sid = {s["id"]: s for s in svcs}
CATS = ["Лаборатория", "Приём врача", "Диагностика", "Процедура"]

clinic_ids = {o["clinic_id"] for o in offers}
brands = sorted({clinics[c]["name"] for c in clinic_ids if c in clinics})
cities = {clinics[c]["city"] for c in clinic_ids if c in clinics}

print("=" * 60)
print(f"TOTAL active offers       : {len(offers)}")
print(f"distinct clinics w/offers : {len(clinic_ids)}")
print(f"distinct clinic BRANDS    : {len(brands)}")
print(f"distinct cities           : {len(cities)}")
geocoded = sum(1 for c in clinic_ids if c in clinics and clinics[c].get("lat") is not None)
print(f"clinics geocoded          : {geocoded}/{len(clinic_ids)}")

print(f"\nBRANDS ({len(brands)}):")
for b in brands:
    print("   -", b)

print("\nOFFERS PER CATEGORY:")
pc = defaultdict(int)
for o in offers:
    s = sid.get(o["service_id"])
    pc[cats.get(s["category_id"], "?") if s else "?"] += 1
for k in CATS:
    print(f"   {k:14} {pc[k]}")

covered = defaultdict(set)
total_by = defaultdict(int)
for s in svcs:
    total_by[cats.get(s["category_id"], "?")] += 1
for o in offers:
    s = sid.get(o["service_id"])
    if s:
        covered[cats.get(s["category_id"], "?")].add(o["service_id"])
print("\nCATALOG COVERAGE (services with >=1 offer / total):")
allc = sum(len(covered[k]) for k in CATS)
for k in CATS:
    print(f"   {k:14} {len(covered[k])}/{total_by[k]}")
print(f"   {'TOTAL':14} {allc}/{len(svcs)}")

svc_cities = defaultdict(set)
for o in offers:
    if o["service_id"] and o["clinic_id"] in clinics:
        svc_cities[o["service_id"]].add(clinics[o["clinic_id"]]["city"])
c5 = sorted(((sid[s]["canonical_name"], len(cc)) for s, cc in svc_cities.items() if len(cc) >= 5),
            key=lambda x: -x[1])
print(f"\nCOMPARABLE IN >=5 CITIES : {len(c5)}")

print("\nQUEUE:")
for st in ("pending", "resolved", "ignored"):
    n = sb.table("unmatched_queue").select("id", count="exact", head=True).eq("status", st).execute().count
    print(f"   {st:9} {n}")

# skip list grouped by reason (latest block per source from skipped_sources.txt)
skip_path = os.path.join(_ROOT, "skipped_sources.txt")
if os.path.exists(skip_path):
    latest = {}  # name -> reason (last occurrence wins)
    for ln in open(skip_path, encoding="utf-8"):
        m = re.match(r"^(no_price|error[^|]*|js_required)\s*\|\s*([^|]+)\|", ln)
        if m:
            latest[m.group(2).strip()] = m.group(1).split(":")[0].strip()
    # only sources NOT currently loaded (no offers) count as real skips
    loaded_names = brands
    reasons = Counter(r for n, r in latest.items())
    print(f"\nSKIP LOG reasons (raw tallies): {dict(reasons)}")
