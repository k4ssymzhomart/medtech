"""Worker entrypoint: the job-queue poll loop.

THE LOOP (per architecture §3): the admin panel never calls the worker. "Run now"
inserts a parse_runs row with status='queued'. This worker polls Supabase, claims
queued jobs, processes them, and writes results back. Outbound HTTPS only.

Phase 1: claiming works end to end against the live DB, but there is NO parsing.
A claimed job is marked failed with a clear skeleton message. The real pipeline
(fetch -> parse -> extract -> normalize -> write) plugs into process_job() in the
"one source end-to-end" pass.
"""

from __future__ import annotations

import logging
import signal
import time
from datetime import datetime, timezone

from .config import settings
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
    """Phase 1 skeleton: no parser yet. Log it and fail the run cleanly.

    Phase 2 replaces this body with:
        fetch -> parse -> LLM extract -> normalize (trgm + pgvector) -> write.
    """
    run_id = job["id"]
    log.info("claimed run %s (source %s)", run_id, job.get("source_id"))

    sb.table("parse_logs").insert(
        {
            "run_id": run_id,
            "source_id": job.get("source_id"),
            "level": "warn",
            "message": "Phase 1 skeleton: no parser implemented for this source.",
        }
    ).execute()

    sb.table("parse_runs").update(
        {
            "status": "failed",
            "finished_at": _now_iso(),
            "error_summary": "Phase 1 skeleton: parser not implemented",
        }
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
