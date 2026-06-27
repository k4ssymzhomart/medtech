"""Production coverage report from the live DB.
Run: PYTHONPATH=<repo>/worker <repo>/worker/.venv/bin/python worker/scripts/db_report.py
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.supabase_client import get_client  # noqa: E402

sb = get_client()


def fetchall(table, sel, **eq):
    rows, frm, step = [], 0, 1000
    while True:
        q = sb.table(table).select(sel)
        for k, v in eq.items():
            q = q.eq(k, v)
        r = q.range(frm, frm + step - 1).execute().data
        rows += r
        if len(r) < step:
            break
        frm += step
    return rows


offers = fetchall("price_offers", "clinic_id,service_id", is_active=True)
clinics = fetchall("clinics", "id,city,name", is_active=True)
services = fetchall("services_catalog", "id,canonical_name", is_active=True)
cid_city = {c["id"]: c["city"] for c in clinics}
sid_name = {s["id"]: s["canonical_name"] for s in services}

clinic_ids = {o["clinic_id"] for o in offers}
cities = {cid_city.get(c) for c in clinic_ids if cid_city.get(c)}
print(f"TOTAL active offers      : {len(offers)}")
print(f"distinct clinics w/offers: {len(clinic_ids)}")
print(f"distinct cities          : {len(cities)}")

city_clinics = defaultdict(set)
for c in clinic_ids:
    city_clinics[cid_city.get(c)].add(c)
print("\nCLINICS PER CITY:")
for city, cl in sorted(city_clinics.items(), key=lambda x: -len(x[1])):
    print(f"  {city or '?':22} {len(cl)}")

svc_ids = {o["service_id"] for o in offers if o["service_id"]}
print(f"\nCATALOG COVERAGE: {len(svc_ids)} / {len(services)} services have >=1 offer")

svc_cities = defaultdict(set)
for o in offers:
    if o["service_id"]:
        svc_cities[o["service_id"]].add(cid_city.get(o["clinic_id"]))
common5 = sorted(((sid_name.get(s, "?"), len(cs)) for s, cs in svc_cities.items() if len(cs) >= 5),
                 key=lambda x: -x[1])
print(f"\nCOMMON TESTS IN >=5 CITIES: {len(common5)}")
for name, n in common5:
    print(f"  {name:34} {n} cities")
