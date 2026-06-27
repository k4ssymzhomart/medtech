"""Stage 1 — Fetch. Two paths, automatic fallback:

  fetch        — cookie-aware static httpx (fast; persists cookies across redirects,
                 which clears KDL's cookie-gated 302).
  fetch_rendered — headless Chromium via Playwright; loads the page, runs its JS, and
                 returns the RENDERED HTML. For JS-only price lists static fetch can't see.
  fetch_smart  — try static first; if it returns no priced content (no ₸/〒/тг), retry
                 with Playwright. This is what the pipeline uses. No API, no paid keys.
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 MedServicePriceBot/0.1"
)

# A price token: digits (space/nbsp/thin grouping) then ₸/〒/тг/тенге/KZT. `\s` covers
# nbsp/thin-space in Python 3 str regex.
_PRICE_RE = re.compile(r"\d[\d\s.,]{0,9}\s*(?:₸|〒|тг|тенге|тнг|kzt)", re.IGNORECASE)


@dataclass
class Fetched:
    url: str
    body: str
    status: int
    mime: str
    content_hash: str


def _hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8", "ignore")).hexdigest()


_CURRENCY_WORD = re.compile(r"тенге|\bтг\b|\bkzt\b|₸|〒", re.IGNORECASE)
_BIG_NUMBER = re.compile(r"\d[\d  ]{2,}\d")  # grouped number (covers nbsp/thin space)


def _has_price_content(body: str) -> bool:
    if not body:
        return False
    if "₸" in body or "〒" in body or _PRICE_RE.search(body):
        return True
    # Tables that put the currency in a header ("Стоимость, тенге") and bare numbers in
    # cells: treat as priced if a currency word AND grouped numbers are both present.
    return bool(_CURRENCY_WORD.search(body)) and bool(_BIG_NUMBER.search(body))


def fetch(url: str, *, timeout: float = 45.0) -> Fetched:
    """Static cookie-aware fetch."""
    with httpx.Client(
        follow_redirects=True,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "ru,en;q=0.8"},
    ) as client:
        r = client.get(url)
        body = r.text
    return Fetched(
        url=str(r.url),
        body=body,
        status=r.status_code,
        mime=r.headers.get("content-type", ""),
        content_hash=_hash(body),
    )


def fetch_rendered(url: str, *, timeout_ms: int = 35000, settle_ms: int = 2000) -> Fetched:
    """Headless Chromium render. Blocks images/fonts/media for speed; waits for the
    network to settle and nudges lazy content, then returns the rendered DOM HTML."""
    from playwright.sync_api import sync_playwright

    body, status = "", 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            ctx = browser.new_context(
                user_agent=USER_AGENT, locale="ru-RU", viewport={"width": 1366, "height": 900}
            )
            ctx.set_default_timeout(timeout_ms)
            page = ctx.new_page()
            # speed: don't download images/fonts/media
            page.route(
                "**/*",
                lambda route: route.abort()
                if route.request.resource_type in ("image", "font", "media")
                else route.continue_(),
            )
            try:
                resp = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                status = resp.status if resp else 0
            except Exception:
                status = 0
            for step in (
                lambda: page.wait_for_load_state("networkidle", timeout=8000),
                lambda: page.mouse.wheel(0, 24000),       # trigger lazy loads
                lambda: page.wait_for_timeout(settle_ms),
            ):
                try:
                    step()
                except Exception:
                    pass
            try:
                body = page.content()
            except Exception:
                body = ""
        finally:
            browser.close()
    return Fetched(url=url, body=body, status=status or (200 if body else 0),
                   mime="text/html", content_hash=_hash(body))


def fetch_interactive(url: str, *, timeout_ms: int = 40000, settle_ms: int = 1500) -> Fetched:
    """Like fetch_rendered, but INTERACTS before reading: expand <details>, open
    accordions/collapses, click every tab (accumulating each panel's HTML), scroll for
    lazy content. Unlocks price lists hidden behind tabs / accordions / 'show price'.
    All actions are bounded and best-effort — a stuck click never aborts the page."""
    from playwright.sync_api import sync_playwright

    htmls: list[str] = []
    status = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            ctx = browser.new_context(
                user_agent=USER_AGENT, locale="ru-RU", viewport={"width": 1366, "height": 1200}
            )
            ctx.set_default_timeout(timeout_ms)
            page = ctx.new_page()
            page.route(
                "**/*",
                lambda r: r.abort()
                if r.request.resource_type in ("image", "font", "media")
                else r.continue_(),
            )
            try:
                resp = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                status = resp.status if resp else 0
            except Exception:
                status = 0
            try:
                page.wait_for_load_state("networkidle", timeout=6000)
            except Exception:
                pass

            # 1) force-open collapsible structures via the DOM (no clicks needed)
            try:
                page.evaluate(
                    """() => {
                      document.querySelectorAll('details').forEach(d => d.open = true);
                      document.querySelectorAll('.collapse,.accordion-collapse,.panel-collapse,.accordion__content')
                        .forEach(e => { e.classList.add('show','in','active','open'); e.style.height='auto'; e.style.display='block'; });
                      document.querySelectorAll('[hidden]').forEach(e => e.removeAttribute('hidden'));
                      document.querySelectorAll('[aria-expanded="false"]').forEach(e => e.setAttribute('aria-expanded','true'));
                    }"""
                )
            except Exception:
                pass

            # 2) click accordion/expander triggers (bounded)
            for sel in (
                ".accordion-button", ".accordion-header", ".accordion__head", "[data-toggle='collapse']",
                "[data-bs-toggle='collapse']", ".spoiler-title", ".collapsed", ".js-accordion",
                ".toggle", "summary",
            ):
                try:
                    for el in page.query_selector_all(sel)[:60]:
                        try:
                            el.click(timeout=700)
                        except Exception:
                            pass
                except Exception:
                    pass

            # 3) tabs: click each, accumulate the resulting HTML (price lists split by tab)
            for sel in ("[role=tab]", ".nav-tabs a", ".nav-link", ".tabs a", ".tab-link",
                        ".tabs__item", ".tab-title", ".js-tab"):
                try:
                    tabs = page.query_selector_all(sel)
                except Exception:
                    tabs = []
                if tabs:
                    for t in tabs[:40]:
                        try:
                            t.click(timeout=700)
                            page.wait_for_timeout(350)
                            htmls.append(page.content())
                        except Exception:
                            pass
                    break

            # 4) scroll for lazy content
            try:
                for _ in range(8):
                    page.mouse.wheel(0, 12000)
                    page.wait_for_timeout(250)
            except Exception:
                pass
            try:
                page.wait_for_timeout(settle_ms)
                htmls.append(page.content())
            except Exception:
                pass
        finally:
            browser.close()
    body = "\n".join(h for h in htmls if h)
    return Fetched(url=url, body=body, status=status or (200 if body else 0),
                   mime="text/html", content_hash=_hash(body))


# Price-list PDF link in an HTML page (hospitals often link a preiskurant.pdf).
_PRICE_WORD = re.compile(r"прайс|price|прейскурант|preiskurant|цен|стоимост|тариф|услуг|платн", re.IGNORECASE)


def _pdf_to_html(pdf_bytes: bytes) -> str:
    """Render a price PDF as HTML the table-aware extractor understands: real tables
    become <table>, and 'name .... 5000' text lines become single-row tables."""
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:80]:  # bound huge documents
            try:
                for tbl in page.extract_tables() or []:
                    rows = "".join(
                        "<tr>" + "".join(f"<td>{(c or '').strip()}</td>" for c in row) + "</tr>"
                        for row in tbl
                    )
                    if rows:
                        parts.append(f"<table>{rows}</table>")
            except Exception:
                pass
            try:
                txt = page.extract_text() or ""
            except Exception:
                txt = ""
            # text lines "<name> ... <number>" -> a price row (number >= 200)
            line_rows = []
            for ln in txt.splitlines():
                m = re.match(r"^(.{4,160}?)\s+([\d  .,]{3,})\s*(?:₸|тг|тенге)?\s*$", ln.strip())
                if m and re.search(r"[А-Яа-яЁё]", m.group(1)) and re.search(r"\d{3}", m.group(2)):
                    line_rows.append(f"<tr><td>{m.group(1).strip()}</td><td>{m.group(2).strip()}</td></tr>")
            if line_rows:
                parts.append("<table><tr><th>Наименование</th><th>Цена</th></tr>" + "".join(line_rows) + "</table>")
    return "\n".join(parts)


def fetch_pdf(url: str, *, timeout: float = 60.0) -> Fetched:
    with httpx.Client(follow_redirects=True, timeout=timeout, headers={"User-Agent": USER_AGENT}) as client:
        r = client.get(url)
        data = r.content
        status = r.status_code
    if status >= 400 or not data:
        return Fetched(url=url, body="", status=status, mime="application/pdf", content_hash=_hash(""))
    try:
        html = _pdf_to_html(data)
    except Exception:
        html = ""
    return Fetched(url=url, body=html, status=status, mime="application/pdf", content_hash=_hash(html))


def _find_pdf_link(html: str, base: str) -> str | None:
    """Absolute URL of a PDF whose link text or href looks like a price list."""
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+\.pdf[^"\']*)["\'][^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL):
        href, text = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
        if _PRICE_WORD.search(text) or _PRICE_WORD.search(href):
            return urljoin(base, href)
    return None


def fetch_smart(url: str, *, timeout: float = 45.0, interactive: bool = True) -> Fetched:
    """Tiered fetch, returns the first tier that yields priced content:
      0. direct .pdf URL -> PDF parse
      1. static httpx
      2. PDF price-list linked from the static page
      3. headless render
      4. PDF linked from the rendered page
      5. interactive render (expand tabs/accordions) — the expensive last resort
    """
    def _pdf(u: str) -> Fetched | None:
        try:
            f = fetch_pdf(u)
            return f if _has_price_content(f.body) else None
        except Exception:
            return None

    if url.lower().split("?")[0].endswith(".pdf"):
        f = _pdf(url)
        if f:
            return f

    static: Fetched | None = None
    try:
        static = fetch(url, timeout=timeout)
        if static.status < 400 and _has_price_content(static.body):
            return static
    except Exception:
        static = None

    if static and static.body:
        link = _find_pdf_link(static.body, static.url or url)
        if link:
            f = _pdf(link)
            if f:
                return f

    rendered: Fetched | None = None
    try:
        rendered = fetch_rendered(url)
        if _has_price_content(rendered.body):
            return rendered
    except Exception:
        rendered = None

    if rendered and rendered.body:
        link = _find_pdf_link(rendered.body, url)
        if link:
            f = _pdf(link)
            if f:
                return f

    if interactive:
        try:
            inter = fetch_interactive(url)
            if _has_price_content(inter.body):
                return inter
        except Exception:
            pass

    # Nothing found prices — return best available so the caller logs "no prices".
    return rendered or static or Fetched(url=url, body="", status=0, mime="", content_hash=_hash(""))
