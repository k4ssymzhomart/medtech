"""Geocode clinics to lat/lng using the FREE Nominatim / OpenStreetMap geocoder.

NO paid keys. Clinics here are (lab, city) aggregates without a street address, so we
geocode the CITY centre (the sanctioned fallback) and cache one lookup per city. Run
AFTER applying supabase/migrations/20260628090000_geo_and_flags.sql (adds lat/lng).

  PYTHONPATH=<repo>/worker <repo>/worker/.venv/bin/python worker/scripts/geocode_clinics.py

Nominatim usage policy: <=1 request/sec, descriptive User-Agent. We sleep 1.1s/city.
"""
import sys
import time

import httpx

from app.supabase_client import get_client

UA = "MedServicePriceBot/0.1 (medical price aggregator; geocoding city centres)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"


def geocode_city(city: str) -> tuple[float, float] | None:
    r = httpx.get(
        NOMINATIM,
        params={"format": "json", "limit": 1, "q": f"{city}, Казахстан"},
        headers={"User-Agent": UA, "Accept-Language": "ru"},
        timeout=30.0,
    )
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


def main() -> None:
    sb = get_client()
    try:
        clinics = sb.table("clinics").select("id, name, city, lat, lng").execute().data
    except Exception as e:  # noqa: BLE001
        print("ERROR reading lat/lng — apply the migration first "
              "(supabase/migrations/20260628090000_geo_and_flags.sql):\n ", e)
        sys.exit(1)

    todo = [c for c in clinics if c.get("lat") is None and c.get("city")]
    print(f"{len(clinics)} clinics, {len(todo)} missing coordinates")

    cache: dict[str, tuple[float, float] | None] = {}
    updated = 0
    for c in todo:
        city = c["city"]
        if city not in cache:
            try:
                cache[city] = geocode_city(city)
            except Exception as e:  # noqa: BLE001
                cache[city] = None
                print(f"  geocode failed for {city!r}: {e}")
            time.sleep(1.1)  # politeness
        coords = cache[city]
        if coords:
            sb.table("clinics").update({"lat": coords[0], "lng": coords[1]}).eq("id", c["id"]).execute()
            updated += 1
    ok_cities = sum(1 for v in cache.values() if v)
    print(f"geocoded {updated} clinics across {ok_cities}/{len(cache)} cities")


if __name__ == "__main__":
    main()
