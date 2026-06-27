"""Stage 4 — Normalize, two-stage (NOT IMPLEMENTED in Phase 1).

Phase 2:
  (a) Deterministic: trigram fuzzy match (pg_trgm) against catalog synonyms.
  (b) Semantic: embed the raw name, cosine-match against catalog embeddings (pgvector).
High-confidence -> auto-link to a services_catalog row. Below threshold -> drop
into unmatched_queue with the AI best guess + confidence for one-click review.
"""


def normalize(raw_extraction: dict) -> None:
    raise NotImplementedError("normalize stage lands in the 'one source end-to-end' pass")
