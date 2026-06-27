"""Worker configuration, loaded from the environment (worker/.env)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # reads worker/.env when run from the worker/ directory


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    poll_interval: float
    # Single configurable FX rate. price_offers.price is ALWAYS KZT; the write
    # stage converts USD -> KZT as `kzt = usd * fx_usd_kzt` and keeps the source
    # value in original_price / original_currency for transparency.
    fx_usd_kzt: float

    @staticmethod
    def from_env() -> "Settings":
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
                "(see worker/.env)."
            )
        interval = float(os.environ.get("WORKER_POLL_INTERVAL", "10"))
        fx = float(os.environ.get("FX_USD_KZT", "470"))
        return Settings(
            supabase_url=url,
            supabase_service_role_key=key,
            poll_interval=interval,
            fx_usd_kzt=fx,
        )


settings = Settings.from_env()
