"""Stage 1 — Fetch (NOT IMPLEMENTED in Phase 1).

Phase 2: plain HTTP first (httpx); fall back to a headless browser (Playwright)
when prices render in JS. Store the raw file/HTML untouched in Supabase Storage
(the raw layer), returning a raw_documents row + content_hash for dedup level 1.
"""


def fetch(source: dict) -> None:
    raise NotImplementedError("fetch stage lands in the 'one source end-to-end' pass")
