"""Supabase client for the worker.

Uses the service_role key (bypasses RLS) over HTTPS only — the worker never needs
inbound access or a direct Postgres connection.
"""

from __future__ import annotations

from functools import lru_cache

import httpx
from supabase import Client, create_client

from .config import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    # Generous PostgREST timeout — big paginated reads and long write loops over a flaky
    # network otherwise hit the short default and abort mid-run. Set on the httpx session
    # directly (ClientOptions shape varies across supabase-py versions).
    try:
        client.postgrest.session.timeout = httpx.Timeout(120.0)
    except Exception:
        pass
    return client
