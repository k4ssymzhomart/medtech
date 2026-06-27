"""Semantic normalization via the LLM (one batched call).

The rapidfuzz scorer in __init__ matches on shared tokens, which false-positives
badly on Russian medical names (e.g. any "...исследование крови" collides with
"Общий анализ крови"). This maps each raw name to a catalog slug by MEANING and
returns "" when there is no genuine catalog match — so unrelated services land in
the queue instead of being mis-linked. High precision over recall by design.
"""

from __future__ import annotations

import json
import re

import anthropic

AUTO_LINK_THRESHOLD = 0.70
_BATCH = 60  # names per LLM call (keeps output under max_tokens)


def _loads_matches(payload: str) -> list[dict]:
    try:
        return json.loads(payload).get("matches", [])
    except json.JSONDecodeError:
        out = []
        for chunk in re.findall(r"\{[^{}]*\}", payload):
            try:
                out.append(json.loads(chunk))
            except json.JSONDecodeError:
                pass
        return out

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["matches"],
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["raw", "slug", "confidence"],
                "properties": {
                    "raw": {"type": "string"},
                    "slug": {"type": "string"},      # catalog slug, or "" if no match
                    "confidence": {"type": "number"},
                },
            },
        }
    },
}

_SYSTEM = (
    "Ты сопоставляешь сырые названия медицинских услуг с каноническим каталогом. "
    "Для каждого сырого названия верни slug канонической услуги ТОЛЬКО если это та "
    "же самая услуга по смыслу. Если точного соответствия в каталоге нет, верни "
    "пустую строку. Не угадывай по общим словам (кровь, анализ, исследование): "
    "лучше пустой slug, чем неверное сопоставление. confidence от 0 до 1."
)


def llm_match_batch(
    raw_names: list[str], catalog: list[dict], *, model: str, api_key: str
) -> dict[str, tuple[str | None, float]]:
    """Returns {raw_name: (service_id|None, confidence)}."""
    uniq = sorted({(n or "").strip() for n in raw_names if (n or "").strip()})
    if not uniq:
        return {}

    slug_to_id = {c["slug"]: c["id"] for c in catalog}
    listing = "\n".join(f"{c['slug']} = {c['canonical_name']}" for c in catalog)
    client = anthropic.Anthropic(api_key=api_key)
    out: dict[str, tuple[str | None, float]] = {n: (None, 0.0) for n in uniq}

    for i in range(0, len(uniq), _BATCH):
        names = "\n".join(f"- {n}" for n in uniq[i : i + _BATCH])
        resp = client.messages.create(
            model=model,
            max_tokens=8000,
            system=_SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
            messages=[
                {
                    "role": "user",
                    "content": f"КАТАЛОГ (slug = название):\n{listing}\n\n"
                    f"СЫРЫЕ НАЗВАНИЯ:\n{names}\n\n"
                    "Верни сопоставление для каждого сырого названия.",
                }
            ],
        )
        payload = next((b.text for b in resp.content if b.type == "text"), "{}")
        for m in _loads_matches(payload):
            raw = str(m.get("raw", "")).strip()
            slug = str(m.get("slug", "")).strip()
            try:
                conf = float(m.get("confidence", 0.0))
            except (TypeError, ValueError):
                conf = 0.0
            if raw in out:
                sid = slug_to_id.get(slug)
                out[raw] = (sid, conf) if sid else (None, conf)
    return out
