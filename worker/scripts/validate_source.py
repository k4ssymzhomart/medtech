"""Read-only single-source validation of the code-only pipeline (NO API, NO DB writes).

Mirrors pipeline.run_source (fetch -> extract -> match) but writes nothing. Use it to
preview what a source would link / queue / drop before running it for real.

  PYTHONPATH=<repo>/worker <repo>/worker/.venv/bin/python \
    worker/scripts/validate_source.py [URL]

Default URL: Invitro Almaty.
"""
import sys
import time
from collections import Counter

from app.extract import extract_offers
from app.fetch import fetch
from app.normalize.match import AUTO_LINK_SCORE, QUEUE_FLOOR, CatalogIndex
from app.supabase_client import get_client

URL = sys.argv[1] if len(sys.argv) > 1 else "https://invitro.kz/analizes/for-doctors/almaty/"


def main() -> None:
    sb = get_client()
    print(f"URL: {URL}  (read-only, no API, no DB writes)")

    t0 = time.time()
    fetched = fetch(URL)
    print(f"[fetch]   HTTP {fetched.status}  {len(fetched.body):,} bytes  {time.time()-t0:.1f}s")
    if fetched.status >= 400:
        print("ABORT: HTTP error")
        return

    services = extract_offers(fetched.body, URL)
    print(f"[extract] {len(services)} priced services")
    for s in services[:5]:
        print(f"            {s.price:>10,} {s.currency} {('['+s.duration+']') if s.duration else '':14} {s.name[:54]}")
    if not services:
        print("ABORT: no priced services extracted")
        return

    catalog = (sb.table("services_catalog").select("id, canonical_name, slug, synonyms")
               .eq("is_active", True).execute().data)
    index = CatalogIndex(catalog)
    slug = {c["id"]: c["slug"] for c in catalog}

    tier = Counter()
    linked, queued = [], []
    for s in services:
        sid, conf, how = index.match(s.name)
        if sid and conf >= AUTO_LINK_SCORE:
            tier[f"link/{how}"] += 1
            linked.append((conf, how, slug.get(sid), s.name, s.price))
        elif sid and conf >= QUEUE_FLOOR:
            tier["queue"] += 1
            queued.append((conf, slug.get(sid), s.name))
        else:
            tier["drop"] += 1

    print(f"\n[normalize] {dict(tier)}")
    print(f"            auto-linked={len(linked)} ({len({l[2] for l in linked})} distinct services)  "
          f"queued={len(queued)}  dropped(off-catalog)={tier['drop']}")
    print("\n  AUTO-LINKED (audit for false positives):")
    for conf, how, sl, name, price in sorted(linked)[:25]:
        print(f"    {conf:.2f} {how:7} [{sl or '?':22}] <- {name[:48]}  ({price:,})")
    print("\n  QUEUED (near-miss, suggestion):")
    for conf, sl, name in sorted(queued, reverse=True)[:12]:
        print(f"    {conf:.2f} ~{sl or '?':20} <- {name[:54]}")
    print(f"\nSUMMARY: {len(services)} extracted, {len(linked)} linked, {len(queued)} queued, "
          f"{tier['drop']} off-catalog  {time.time()-t0:.1f}s  (NO DB WRITES)")


if __name__ == "__main__":
    main()
