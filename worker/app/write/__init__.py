"""Stage 5 — Write: upsert + dedup + archive lifecycle.

price_offers.price is ALWAYS KZT. USD is converted on write via the configured FX
rate; the source value is kept in original_price/original_currency. Upsert keys on
unique (clinic_id, service_id, source_id): new -> insert (+ price_history); price
changed -> update (+ price_history); unchanged -> bump last_seen_at. Offers this
source stopped listing -> archived (reason='not_in_latest_parse').
"""

from __future__ import annotations

import re
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_duration_days(duration: str) -> int | None:
    if not duration:
        return None
    m = re.search(r"(\d+)", duration)
    return int(m.group(1)) if m else None


def to_kzt(price: float, currency: str, fx_usd_kzt: float) -> tuple[float, float | None, str | None]:
    """Return (kzt_price, original_price, original_currency)."""
    cur = (currency or "KZT").upper()
    if cur == "USD":
        return round(price * fx_usd_kzt), price, "USD"
    return price, None, None


def upsert_offer(
    sb,
    *,
    clinic_id: str,
    service_id: str,
    source_id: str,
    raw_name: str,
    price: float,
    currency: str,
    unit: str,
    duration: str,
    source_url: str,
    fx_usd_kzt: float,
    run_id: str | None,
) -> tuple[str, str | None]:
    """Returns (action, offer_id) where action is inserted|updated|unchanged."""
    kzt, orig_price, orig_cur = to_kzt(price, currency, fx_usd_kzt)
    duration_days = parse_duration_days(duration)

    existing = (
        sb.table("price_offers")
        .select("id, price")
        .eq("clinic_id", clinic_id)
        .eq("service_id", service_id)
        .eq("source_id", source_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        row = (
            sb.table("price_offers")
            .insert(
                {
                    "clinic_id": clinic_id,
                    "service_id": service_id,
                    "source_id": source_id,
                    "price": kzt,
                    "currency": "KZT",
                    "original_price": orig_price,
                    "original_currency": orig_cur,
                    "duration_days": duration_days,
                    "price_unit": unit or None,
                    "raw_service_name": raw_name,
                    "source_url": source_url,
                    "is_active": True,
                }
            )
            .execute()
        )
        offer_id = row.data[0]["id"]
        sb.table("price_history").insert(
            {"price_offer_id": offer_id, "price": kzt, "currency": "KZT", "parse_run_id": run_id}
        ).execute()
        return "inserted", offer_id

    offer = existing.data[0]
    offer_id = offer["id"]
    if float(offer["price"]) != float(kzt):
        sb.table("price_offers").update(
            {
                "price": kzt,
                "original_price": orig_price,
                "original_currency": orig_cur,
                "duration_days": duration_days,
                "price_unit": unit or None,
                "raw_service_name": raw_name,
                "source_url": source_url,
                "is_active": True,
                "last_seen_at": _now(),
                "last_changed_at": _now(),
                "archived_at": None,
                "archive_reason": None,
            }
        ).eq("id", offer_id).execute()
        sb.table("price_history").insert(
            {"price_offer_id": offer_id, "price": kzt, "currency": "KZT", "parse_run_id": run_id}
        ).execute()
        return "updated", offer_id

    sb.table("price_offers").update(
        {"last_seen_at": _now(), "is_active": True, "archived_at": None, "archive_reason": None}
    ).eq("id", offer_id).execute()
    return "unchanged", offer_id


def archive_missing(sb, *, source_id: str, seen_offer_ids: list[str]) -> int:
    """Archive active offers from this source that were not seen in this parse."""
    active = (
        sb.table("price_offers")
        .select("id")
        .eq("source_id", source_id)
        .eq("is_active", True)
        .execute()
    )
    seen = set(seen_offer_ids)
    stale = [o["id"] for o in (active.data or []) if o["id"] not in seen]
    for offer_id in stale:
        sb.table("price_offers").update(
            {"is_active": False, "archived_at": _now(), "archive_reason": "not_in_latest_parse"}
        ).eq("id", offer_id).execute()
    return len(stale)
