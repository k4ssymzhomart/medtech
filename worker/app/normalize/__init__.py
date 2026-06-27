"""Stage 4 — Normalize. Deterministic fuzzy match against catalog synonyms.

Phase 2 v1 uses rapidfuzz over the in-memory catalog (78 rows) — the same idea
as pg_trgm, kept self-contained. The pgvector semantic fallback is a later add.
High confidence -> auto-link service_id. Below threshold -> unmatched_queue with
the best guess + score for one-click human review.
"""

from __future__ import annotations

from dataclasses import dataclass

from rapidfuzz import fuzz

AUTO_LINK_THRESHOLD = 0.82  # >= this -> auto-link; below -> queue


@dataclass
class Match:
    service_id: str | None
    confidence: float


def best_match(raw_name: str, catalog: list[dict]) -> Match:
    """catalog rows: {id, canonical_name, synonyms[]}."""
    raw = (raw_name or "").lower().strip()
    if not raw:
        return Match(None, 0.0)

    best_id: str | None = None
    best_score = 0.0
    for svc in catalog:
        candidates = [svc["canonical_name"], *(svc.get("synonyms") or [])]
        score = max(fuzz.WRatio(raw, c.lower()) for c in candidates) / 100.0
        if score > best_score:
            best_score, best_id = score, svc["id"]

    return Match(best_id, round(best_score, 3))
