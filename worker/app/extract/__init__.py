"""Stage 3 — deterministic extraction (NO LLM, no API key needed).

Per-source DOM parsers for the backbone catalogs (these render priced rows server
side, so a few CSS selectors give 100% reliable name+price pairs), plus a generic
price-node fallback for everything else. Pure HTML parsing with BeautifulSoup.

  invitro.kz    div.item_card -> .analyzes-item__title + .analyzes-item__total--sum
  kdlolymp.kz   a.analysis    -> .title + .price (+ .duration)
  <fallback>    innermost node that is a price -> climb to its row -> read the name

Python 3 `re` `\\s` already matches Unicode whitespace (nbsp U+00A0, thin space
U+2009), so price grouping needs no special-character classes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

# A price token: grouped digits (space/nbsp/thin-space/comma/dot) then ₸/〒/тг/тенге/KZT.
_PRICE_TOKEN = re.compile(r"\d[\d.,\s]{0,9}\s*(?:₸|〒|тг|тенге|тнг|kzt)", re.IGNORECASE)
# First number in a string (with thousands grouping); non-digits are stripped after.
_PRICE_NUM = re.compile(r"\d[\d.,\s]*\d|\d")
_DUR = re.compile(r"\d+\s*(?:календарн\w*|рабоч\w*\s*)?(?:дн\w+|день|сут\w*)", re.IGNORECASE)
# Boilerplate that is never a service name (cart buttons, headers, surcharges, UI chrome).
_NAME_NOISE = re.compile(
    r"в корзину|корзина|добавить|подробнее|количество товара|взятие (?:крови|мазка|биоматериала)"
    r"|доступно с выездом|акци|скидк|^№|^от\s|к оплате|^срок|^цена|стоимост|^итого|заказать"
    r"|записаться|^выбрать|купить|визит в|койко|ведение больного|пребывани|^услуга$|^наименование",
    re.IGNORECASE,
)
_CYR = re.compile(r"[А-Яа-яЁё]")
_MAX_GENERIC = 3000  # cap generic extraction per page (we only need the ~78 catalog rows)


@dataclass
class RawService:
    name: str
    price: float
    currency: str
    unit: str
    duration: str


def _clean(s: str) -> str:
    return " ".join((s or "").split())


_DECIMAL_TAIL = re.compile(r"[.,]\d{2}$")  # Russian decimal "11 200,00" -> drop the ,00


def _to_price(text: str) -> int | None:
    m = _PRICE_NUM.search(text or "")
    if not m:
        return None
    s = _DECIMAL_TAIL.sub("", m.group().strip())  # strip trailing 2-digit decimal
    d = re.sub(r"\D", "", s)
    return int(d) if d else None


def _has_price(text: str) -> bool:
    return bool(_PRICE_TOKEN.search(text or ""))


# ---------------------------------------------------------------------------
# Per-source parsers
# ---------------------------------------------------------------------------
def _parse_invitro(soup: BeautifulSoup) -> list[RawService]:
    out: list[RawService] = []
    for card in soup.select("div.item_card"):
        title = card.select_one(".analyzes-item__title")
        total = card.select_one(".analyzes-item__total--sum")
        if not title or not total:
            continue
        name = _clean(title.get_text())
        price = _to_price(total.get_text())
        if not (name and price):
            continue
        dur = ""
        for li in card.select(".analyzes-item__add--list-item"):
            t = _clean(li.get_text())
            if _DUR.search(t):
                dur = t
                break
        out.append(RawService(name=name, price=price, currency="KZT", unit="", duration=dur))
    return out


def _parse_kdl(soup: BeautifulSoup) -> list[RawService]:
    out: list[RawService] = []
    for row in soup.select("a.analysis"):
        title = row.select_one(".title")
        price_el = row.select_one(".price")
        if not title or not price_el:
            continue
        name = _clean(title.get_text())
        price = _to_price(price_el.get_text())
        if not (name and price):
            continue
        dur_el = row.select_one(".duration")
        out.append(RawService(name=name, price=price, currency="KZT", unit="",
                              duration=_clean(dur_el.get_text()) if dur_el else ""))
    return out


# ---------------------------------------------------------------------------
# Generic fallback: each innermost price node -> nearest ancestor with a name.
# ---------------------------------------------------------------------------
def _name_like(t: str) -> bool:
    """A service-name-ish text node: Cyrillic, reasonable length, not a price, not UI
    boilerplate, not a full sentence (ends with . or :), not a paragraph."""
    if not (6 <= len(t) <= 120) or not _CYR.search(t):
        return False
    if _has_price(t) or _NAME_NOISE.search(t):
        return False
    if t.endswith(":") or t.endswith("."):
        return False
    return len(t.split()) <= 14


def _name_from_container(container: Tag, price_text: str) -> str | None:
    """Best name candidate in a row: the longest NAME-LIKE Cyrillic text node (most
    specific), skipping the price, UI chrome and sentence-like blurbs."""
    pt = _clean(price_text)
    best = ""
    for node in container.find_all(string=True):
        t = _clean(str(node))
        if t and t != pt and _name_like(t) and len(t) > len(best):
            best = t
    return best or None


_PRICE_HEADER = re.compile(r"цена|стоимост|тариф|прайс|тенге|сумма|₸", re.IGNORECASE)
_NAME_HEADER = re.compile(r"наименован|услуг|название|описание|анализ|исследован", re.IGNORECASE)


def _pricey_cell(x: str) -> bool:
    p = _to_price(x)
    return p is not None and p >= 200 and bool(re.search(r"\d", x))


def _parse_tables(soup: BeautifulSoup) -> list[RawService]:
    """Parse <table> price lists where the currency lives in a column HEADER
    ('Стоимость, тенге') and cells are bare numbers — the dominant KZ clinic/hospital
    format that the price-node path misses. Finds the price column (by header, else by
    numeric density) and the name column (by header, else longest Cyrillic text)."""
    out: list[RawService] = []
    for table in soup.find_all("table"):
        matrix = [
            [_clean(c.get_text(" ", strip=True)) for c in tr.find_all(["td", "th"])]
            for tr in table.find_all("tr")
        ]
        matrix = [r for r in matrix if r]
        if len(matrix) < 3:
            continue
        ncol = max(len(r) for r in matrix)
        if ncol < 2:
            continue
        header = matrix[0]
        pcol = next((i for i, h in enumerate(header) if _PRICE_HEADER.search(h)), None)
        nmcol = next((i for i, h in enumerate(header) if _NAME_HEADER.search(h)), None)
        body_rows = matrix[1:]
        if pcol is None:  # numeric-density fallback
            score = [sum(1 for r in body_rows if i < len(r) and _pricey_cell(r[i])) for i in range(ncol)]
            pcol = max(range(ncol), key=lambda i: score[i])
            if score[pcol] < 3:
                continue
        if nmcol is None:  # longest Cyrillic text column, excluding the price column
            tlen = [
                sum(len(r[i]) for r in body_rows if i < len(r) and _CYR.search(r[i])) if i != pcol else -1
                for i in range(ncol)
            ]
            nmcol = max(range(ncol), key=lambda i: tlen[i])
        for r in body_rows:
            if max(pcol, nmcol) >= len(r):
                continue
            name, price = r[nmcol], _to_price(r[pcol])
            if (price and name and _CYR.search(name) and not _has_price(name)
                    and not _NAME_NOISE.search(name) and 4 <= len(name) <= 160):
                out.append(RawService(name=name[:160], price=price, currency="KZT", unit="", duration=""))
    return out


def _parse_generic(soup: BeautifulSoup) -> list[RawService]:
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
        tag.decompose()
    # innermost price nodes: text carries a price token, but no child does (handles
    # WooCommerce <bdi>30 300<span>₸</span></bdi> where amount/symbol are split).
    price_nodes = [
        el for el in soup.find_all(True)
        if _has_price(el.get_text(" ", strip=True))
        and len(el.get_text(" ", strip=True)) < 40
        and not any(_has_price(c.get_text(" ", strip=True)) for c in el.find_all(True))
    ]
    out: list[RawService] = []
    for leaf in price_nodes:
        if len(out) >= _MAX_GENERIC:  # bound audit bloat on giant hospital tables
            break
        price = _to_price(leaf.get_text(" ", strip=True))
        if not price:
            continue
        # Climb to the smallest ancestor that also carries a name. Grid layouts
        # (Elementor/WooCommerce) keep the name in a SIBLING widget, so the common
        # product container can be several levels up — but stop at the first hit to
        # avoid spilling into a neighbouring product.
        name = None
        node: Tag | None = leaf
        for _ in range(9):
            node = node.parent if node else None
            if node is None:
                break
            name = _name_from_container(node, leaf.get_text(" ", strip=True))
            if name:
                break
        if name:
            out.append(RawService(name=name, price=price, currency="KZT", unit="", duration=""))
    return out


_PARSERS = {
    "invitro.kz": _parse_invitro,
    "kdlolymp.kz": _parse_kdl,
}


def extract_offers(html: str, url: str) -> list[RawService]:
    """Deterministically extract (name, price) offers from a price-list page. Tries the
    per-source parser for the URL's host, then the generic fallback. Dedupes (name, price)."""
    soup = BeautifulSoup(html, "html.parser")
    host = (urlparse(url).hostname or "").removeprefix("www.")
    parser = _PARSERS.get(host)
    services = parser(soup) if parser else []
    if not services:
        # Table-aware first (handles "Стоимость, тенге" header tables); fall back to the
        # price-node climb for card/grid layouts when tables yield little.
        services = _parse_tables(soup)
        if len(services) < 5:
            services += _parse_generic(soup)

    seen: set[tuple[str, int]] = set()
    out: list[RawService] = []
    for s in services:
        key = (s.name.lower(), round(s.price))
        if s.name and s.price > 0 and key not in seen:
            seen.add(key)
            out.append(s)
        if len(out) >= _MAX_GENERIC:  # bound audit/normalization on giant hospital tables
            break
    return out
