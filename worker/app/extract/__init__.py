"""Stage 3 — LLM structured extraction (Anthropic, structured outputs).

Hands the cleaned text to Claude with a strict JSON schema and gets back every
service as {name, price, currency, unit, duration}. This is what lets us hit many
sources without writing per-site scrapers.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import anthropic

# Structured-output schema (additionalProperties:false + required, per the API).
_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["services"],
    "properties": {
        "services": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "price", "currency", "unit", "duration"],
                "properties": {
                    "name": {"type": "string"},
                    "price": {"type": "number"},
                    "currency": {"type": "string"},  # "KZT" | "USD" | ...
                    "unit": {"type": "string"},       # "" if none
                    "duration": {"type": "string"},   # e.g. "1 день", "" if none
                },
            },
        }
    },
}

_SYSTEM = (
    "Ты извлекаешь медицинские услуги и их цены из текста прайс листа клиники в "
    "Казахстане. Возвращай только реальные услуги с ценой. Цена это число без "
    "пробелов и символов валюты. Валюта обычно KZT (тенге), иногда USD. Поле "
    "duration это срок выполнения если он указан (например 1 день), иначе пустая "
    "строка. unit это единица если указана (например за услугу), иначе пустая "
    "строка. Не придумывай услуги которых нет в тексте."
)


@dataclass
class RawService:
    name: str
    price: float
    currency: str
    unit: str
    duration: str


def extract(text: str, *, model: str, api_key: str, max_chars: int = 40000) -> list[RawService]:
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model,
        max_tokens=8000,
        system=_SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
        messages=[
            {
                "role": "user",
                "content": "Извлеки все услуги с ценами из этого прайс листа:\n\n"
                + text[:max_chars],
            }
        ],
    )
    payload = next((b.text for b in resp.content if b.type == "text"), "{}")
    data = json.loads(payload)
    out: list[RawService] = []
    for s in data.get("services", []):
        try:
            out.append(
                RawService(
                    name=str(s["name"]).strip(),
                    price=float(s["price"]),
                    currency=(str(s.get("currency") or "KZT").strip().upper() or "KZT"),
                    unit=str(s.get("unit") or "").strip(),
                    duration=str(s.get("duration") or "").strip(),
                )
            )
        except (KeyError, ValueError, TypeError):
            continue
    return out
