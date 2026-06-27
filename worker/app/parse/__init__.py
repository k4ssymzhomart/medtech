"""Stage 2 — Parse to clean text. HTML for v1 (bs4); PDF/DOCX/XLSX land later.

Strips scripts/styles and collapses whitespace into readable lines + tables so
the LLM sees the price list, not markup.
"""

from __future__ import annotations

from bs4 import BeautifulSoup


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]):
        tag.decompose()
    # Render table rows as "cell | cell" so price/name pairs stay on one line.
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if cells:
            tr.replace_with("\n" + " | ".join(cells) + "\n")
    text = soup.get_text("\n")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)
