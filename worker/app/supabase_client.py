"""Supabase client for the worker.

Uses the service_role key (bypasses RLS) over HTTPS only — the worker never needs
inbound access or a direct Postgres connection.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
