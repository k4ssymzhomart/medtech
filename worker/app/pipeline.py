"""Pipeline orchestration: fetch -> parse -> extract -> normalize -> write.

Called by main.process_job for each claimed parse_runs job. Writes raw_documents,
raw_extractions, price_offers (+ price_history), unmatched_queue, parse_logs, and
returns the parse_runs counters.
"""

from __future__ import annotations

from .config import settings
from .extract import extract
from .fetch import fetch
from .normalize import AUTO_LINK_THRESHOLD, best_match
from .parse import html_to_text
from .write import archive_missing, upsert_offer


def _log(sb, run_id, source_id, level, message, detail=None) -> None:
    sb.table("parse_logs").insert(
        {"run_id": run_id, "source_id": source_id, "level": level, "message": message, "detail": detail}
    ).execute()


def run_source(sb, run_id: str, source: dict) -> dict:
    source_id = source["id"]
    clinic_id = source.get("default_clinic_id")
    if not clinic_id:
        raise RuntimeError("source has no default_clinic_id; cannot attach offers")

    counters = {"rows_found": 0, "rows_inserted": 0, "rows_updated": 0, "rows_unmatched": 0}

    # 1. Fetch + record raw document (dedup level 1 via content_hash).
    fetched = fetch(source["url"])
    _log(sb, run_id, source_id, "info", f"fetched HTTP {fetched.status} {source['url']}")
    rawdoc = (
        sb.table("raw_documents")
        .insert(
            {
                "source_id": source_id,
                "run_id": run_id,
                "content_hash": fetched.content_hash,
                "http_status": fetched.status,
                "mime_type": fetched.mime,
            }
        )
        .execute()
        .data[0]
    )

    # 2. Parse + 3. LLM extract.
    text = html_to_text(fetched.body)
    services = extract(text, model=settings.anthropic_model, api_key=settings.anthropic_api_key)
    _log(sb, run_id, source_id, "info", f"LLM extracted {len(services)} services")

    catalog = (
        sb.table("services_catalog")
        .select("id, canonical_name, synonyms")
        .eq("is_active", True)
        .execute()
        .data
    )

    # 4. Normalize + 5. Write.
    seen_offer_ids: list[str] = []
    for s in services:
        counters["rows_found"] += 1
        ext = (
            sb.table("raw_extractions")
            .insert(
                {
                    "raw_document_id": rawdoc["id"],
                    "run_id": run_id,
                    "source_id": source_id,
                    "raw_service_name": s.name,
                    "raw_price": s.price,
                    "raw_currency": s.currency,
                    "raw_duration": s.duration or None,
                }
            )
            .execute()
            .data[0]
        )

        match = best_match(s.name, catalog)
        if match.service_id and match.confidence >= AUTO_LINK_THRESHOLD:
            action, offer_id = upsert_offer(
                sb,
                clinic_id=clinic_id,
                service_id=match.service_id,
                source_id=source_id,
                raw_name=s.name,
                price=s.price,
                currency=s.currency,
                unit=s.unit,
                duration=s.duration,
                source_url=source["url"],
                fx_usd_kzt=settings.fx_usd_kzt,
                run_id=run_id,
            )
            if offer_id:
                seen_offer_ids.append(offer_id)
            if action == "inserted":
                counters["rows_inserted"] += 1
            elif action == "updated":
                counters["rows_updated"] += 1
        else:
            counters["rows_unmatched"] += 1
            sb.table("unmatched_queue").insert(
                {
                    "raw_extraction_id": ext["id"],
                    "source_id": source_id,
                    "raw_service_name": s.name,
                    "suggested_service_id": match.service_id,
                    "confidence": match.confidence,
                    "status": "pending",
                }
            ).execute()

    archived = archive_missing(sb, source_id=source_id, seen_offer_ids=seen_offer_ids)
    if archived:
        _log(sb, run_id, source_id, "info", f"archived {archived} offers (not_in_latest_parse)")

    return counters
