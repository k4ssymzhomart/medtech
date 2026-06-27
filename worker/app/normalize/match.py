"""Stage 4 — deterministic normalization (NO LLM, no API key needed).

Maps a raw service name to a catalog service_id, in order of decreasing certainty:

  1. exact   — normalized raw == a canonical name or a learned synonym         (conf 1.0)
  2. prefix  — the raw name STARTS WITH a catalog name/synonym, i.e. the catalog term is
               the HEAD and the rest is just a qualifier/translation:
               "Глюкоза (в крови) (Glucose)" -> Глюкоза. This is the precise alternative
               to mid-string containment, which false-linked panels that merely MENTION a
               test ("Стероидный профиль ... кортизол ..." -> кортизол). Panels (профиль/
               панель/комплекс/пакет/интерпретация/...) and combos ("Витамин D и К") are
               excluded -> they go to the queue, not auto-linked.               (conf 0.95)
  3. fuzzy   — rapidfuzz for typos/spacing. token_set_ratio gives the best catalog GUESS
               (used as the queue suggestion); it only reaches auto-link when it is also
               near-identical length-wise (token_sort_ratio high) and not a panel.

The pipeline auto-links conf >= AUTO_LINK_SCORE, queues QUEUE_FLOOR..AUTO_LINK as
near-misses for the admin, and drops the rest as off-catalog (kept in raw_extractions).
Resolving a queue item appends the raw name to the service's synonyms array, so it
becomes an `exact` hit on every future run, in every city — the manual-markup feature.
"""

from __future__ import annotations

import re

from rapidfuzz import fuzz, process

AUTO_LINK_SCORE = 0.90   # exact (1.0) + prefix (0.95) + guarded fuzzy >= 0.90 auto-link
QUEUE_FLOOR = 0.72       # below this: off-catalog, not even queued (still in raw_extractions)
_MIN_PREFIX_CHARS = 3    # 3-char abbrevs (СОЭ/ТТГ/ФСГ/ХГЧ/МРТ/ЭКГ) may head-match; 2-char exact-only
_MAX_REMAINDER_TOKENS = 3  # head match links only if the trailing qualifier is short (a
#                            translation/note), not a long derived test ("Резус-фактор ПЛОДА…")
_FUZZY_SORT_MIN = 75     # token_sort_ratio floor for a fuzzy match to be allowed to auto-link

_PUNCT = re.compile(r"[^0-9a-zа-яё ]")
_WS = re.compile(r"\s+")
# Names that bundle several tests — never auto-link these to a single catalog service.
_PANEL = re.compile(r"профил|панел|комплекс|пакет|программ|чекап|check|скрининг|интерпретац|соотношен")
# Top-level combo connectors ("Витамин D, К и йод", "ОАК + СРБ") detected AFTER stripping
# parentheticals — translations like "(HbA1С, Glycated Hemoglobin)" must not count.
_PARENS = re.compile(r"\([^)]*\)|\[[^\]]*\]|«[^»]*»")
_TOP_COMBO = re.compile(r",\s*\S|\s(?:и|с|плюс)\s+\S|[+/&]\s*\S", re.IGNORECASE)


def _looks_combo(raw: str) -> bool:
    return bool(_TOP_COMBO.search(_PARENS.sub(" ", (raw or "").lower())))


def norm_key(s: str) -> str:
    s = (s or "").lower().replace("ё", "е")
    s = _PUNCT.sub(" ", s)
    return _WS.sub(" ", s).strip()


class CatalogIndex:
    """Prebuilt lookup over the catalog (canonical names + synonyms). Build once per run."""

    def __init__(self, catalog: list[dict]):
        self.exact: dict[str, str] = {}
        self._variants: list[tuple[str, str]] = []  # (sid, key)
        for c in catalog:
            for v in [c["canonical_name"], *(c.get("synonyms") or [])]:
                k = norm_key(v)
                if not k:
                    continue
                self.exact.setdefault(k, c["id"])
                self._variants.append((c["id"], k))
        self._keys = [v[1] for v in self._variants]

    def match(self, raw: str) -> tuple[str | None, float, str]:
        """Return (service_id|None, confidence 0..1, how)."""
        k = norm_key(raw)
        if not k:
            return None, 0.0, "empty"
        # `core` drops parenthetical translations/notes so a head match sees only the real
        # remainder: "Глюкоза (в крови) (Glucose)" -> core "глюкоза".
        core = norm_key(_PARENS.sub(" ", raw))
        if k in self.exact:
            return self.exact[k], 1.0, "exact"
        if core and core in self.exact:
            return self.exact[core], 1.0, "exact"

        # Head/prefix match: the raw name begins with a catalog name and only a SHORT
        # qualifier follows. Longest matching head wins. Panels/combos and long remainders
        # (a different, derived test) are excluded -> they go to the queue.
        panel = bool(_PANEL.search(k)) or _looks_combo(raw)
        best: tuple[int, str, int] | None = None  # (len, sid, remainder_tokens)
        for sid, vk in self._variants:
            if len(vk) >= _MIN_PREFIX_CHARS and (core == vk or core.startswith(vk + " ")):
                if best is None or len(vk) > best[0]:
                    best = (len(vk), sid, len(core[len(vk):].split()))
        if best and not panel and best[2] <= _MAX_REMAINDER_TOKENS:
            return best[1], 0.95, "prefix"

        # Fuzzy: best catalog guess (token_set_ratio). Only allowed to auto-link when it
        # is also near-identical length-wise (token_sort_ratio) and not a panel; otherwise
        # capped below the auto-link line so it lands in the queue as a suggestion.
        hit = process.extractOne(k, self._keys, scorer=fuzz.token_set_ratio)
        if not hit:
            return None, 0.0, "none"
        _, ts, idx = hit
        sid, vk = self._variants[idx]
        conf = ts / 100.0
        if conf >= AUTO_LINK_SCORE and (panel or fuzz.token_sort_ratio(k, vk) < _FUZZY_SORT_MIN):
            conf = 0.85  # demote to queue
        return sid, conf, "fuzzy"
