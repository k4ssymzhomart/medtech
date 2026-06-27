"""Stage 2 — Parse to compact, price-focused text (HTML for v1; bs4).

Big lab catalogs render long descriptions that bloat LLM input. `price_lines`
keeps only lines that carry a price (₸ / тг / тенge / KZT), pairing a bare price
with the preceding name line — generic, no per-site logic. Cuts tokens ~10x.
`html_to_text` is the full-text fallback.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

# ₸ U+20B8, 〒 U+3012, plus textual variants. Digits may use spaces / nbsp.
PRICE_RE = re.compile(r"\d[\d\s ]{1,9}\s*(?:₸|〒|тг|тенге|тнг|kzt)", re.IGNORECASE)


def _strip(soup: BeautifulSoup) -> BeautifulSoup:
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
        tag.decompose()
    return soup


def html_to_text(html: str) -> str:
    soup = _strip(BeautifulSoup(html, "html.parser"))
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if cells:
            tr.replace_with("\n" + " | ".join(cells) + "\n")
    return "\n".join(ln.strip() for ln in soup.get_text("\n").splitlines() if ln.strip())


def price_lines(html: str) -> str:
    """Compact 'name ... price' lines — only rows that carry a price."""
    soup = _strip(BeautifulSoup(html, "html.parser"))
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if cells:
            tr.replace_with("\n" + " | ".join(cells) + "\n")

    out: list[str] = []
    seen: set[str] = set()
    prev = ""
    for raw in soup.get_text("\n").splitlines():
        ln = re.sub(r"\s+", " ", raw).strip()
        if not ln:
            continue
        has_price = "₸" in ln or PRICE_RE.search(ln)
        if has_price:
            # If the line is basically just the price, attach the preceding name.
            row = (prev + " " + ln).strip() if len(ln) < 28 and prev else ln
            row = row[:240]
            if row not in seen:
                seen.add(row)
                out.append(row)
        prev = ln
    return "\n".join(out)
