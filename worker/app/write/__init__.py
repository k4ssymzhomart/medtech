"""Stage 5 — Write: upsert + dedup + archive (NOT IMPLEMENTED in Phase 1).

Phase 2: upsert into price_offers on the unique (clinic_id, service_id, source_id).
New -> insert. Price changed -> update + append a price_history row. Unchanged ->
bump last_seen_at. Anything the source stopped listing -> archive
(reason='not_in_latest_parse'). Update parse_runs counters; log to parse_logs.
"""


def write(normalized_offer: dict) -> None:
    raise NotImplementedError("write stage lands in the 'one source end-to-end' pass")
