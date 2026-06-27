"""Stage 3 — LLM structured extraction (NOT IMPLEMENTED in Phase 1).

Phase 2: hand the cleaned text to an LLM with a strict schema — extract every
service as {name, price, currency, unit}, JSON only. Store rows in raw_extractions.
This is what lets us hit 3+ sources without writing 3 custom scrapers.
"""


def extract(parsed_text: str) -> None:
    raise NotImplementedError("extract stage lands in the 'one source end-to-end' pass")
