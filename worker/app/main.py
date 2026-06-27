"""Worker entrypoint: the job-queue poll loop.

THE LOOP (per architecture §3): the admin panel never calls the worker. "Run now"
inserts a parse_runs row with status='queued'. This worker polls Supabase, claims
queued jobs, processes them, and writes results back. Outbound HTTPS only.

Phase 2: a claimed job runs the full pipeline (fetch -> parse -> extract ->
normalize -> write) via app.pipeline.run_source, then writes status + counters back.
"""

from __future__ import annotations

import logging
import signal
import time
from datetime import datetime, timezone

from .config import settings
from .pipeline import run_source
from .supabase_client import get_client

log = logging.getLogger("worker")

_running = True


def _stop(*_args) -> None:
    global _running
    _running = False
    log.info("shutdown signal received; finishing current cycle")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def claim_next_job(sb):
    """Atomically claim the oldest queued run (queued -> running)."""
    res = (
        sb.table("parse_runs")
        .select("id, source_id")
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not res.data:
        return None

    job = res.data[0]
    # Guard with .eq("status","queued") so a concurrent worker cannot double-claim.
    claimed = (
        sb.table("parse_runs")
        .update({"status": "running", "started_at": _now_iso()})
        .eq("id", job["id"])
        .eq("status", "queued")
        .execute()
    )
    if not claimed.data:
        return None
    return claimed.data[0]


def process_job(sb, job) -> None:
    """Run the full pipeline for a claimed run: fetch -> parse -> extract ->
    normalize -> write. Updates parse_runs status + counters; logs failures."""
    run_id = job["id"]
    log.info("claimed run %s (source %s)", run_id, job.get("source_id"))

    source = (
        sb.table("sources").select("*").eq("id", job["source_id"]).single().execute().data
    )
    try:
        counters = run_source(sb, run_id, source)
        sb.table("parse_runs").update(
            {"status": "success", "finished_at": _now_iso(), **counters}
        ).eq("id", run_id).execute()
        sb.table("sources").update(
            {"last_run_at": _now_iso(), "consecutive_failures": 0}
        ).eq("id", source["id"]).execute()
        log.info("run %s OK %s", run_id, counters)
    except Exception as e:  # noqa: BLE001 — record the failure, keep the loop alive
        log.exception("pipeline failed for run %s", run_id)
        sb.table("parse_logs").insert(
            {"run_id": run_id, "source_id": source["id"], "level": "error", "message": str(e)}
        ).execute()
        sb.table("parse_runs").update(
            {"status": "failed", "finished_at": _now_iso(), "error_summary": str(e)[:500]}
        ).eq("id", run_id).execute()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(name)s  %(message)s",
    )
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    sb = get_client()
    # Connectivity check — fail fast if the DB / keys are wrong.
    sb.table("parse_runs").select("id").limit(1).execute()
    log.info(
        "connected to Supabase; polling parse_runs every %ss",
        settings.poll_interval,
    )

    while _running:
        try:
            job = claim_next_job(sb)
            if job is not None:
                process_job(sb, job)
                continue  # drain the queue without sleeping
            time.sleep(settings.poll_interval)
        except Exception:  # noqa: BLE001 — keep the loop alive on transient errors
            log.exception("poll cycle failed; backing off")
            time.sleep(settings.poll_interval)

    log.info("worker stopped")


if __name__ == "__main__":
    main()
