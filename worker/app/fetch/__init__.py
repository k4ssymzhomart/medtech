"""Stage 1 — Fetch. Plain HTTP (httpx). Playwright fallback is a later addition.

Returns the raw body + a content hash (dedup level 1) and HTTP metadata.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import httpx

USER_AGENT = "MedServicePriceBot/0.1 (+https://medserviceprice.kz)"


@dataclass
class Fetched:
    url: str
    body: str
    status: int
    mime: str
    content_hash: str


def fetch(url: str, *, timeout: float = 30.0) -> Fetched:
    r = httpx.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "ru,en"},
        timeout=timeout,
        follow_redirects=True,
    )
    body = r.text
    digest = hashlib.sha256(body.encode("utf-8", "ignore")).hexdigest()
    return Fetched(
        url=url,
        body=body,
        status=r.status_code,
        mime=r.headers.get("content-type", ""),
        content_hash=digest,
    )
