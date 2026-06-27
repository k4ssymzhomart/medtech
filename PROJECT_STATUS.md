# MedServicePrice.kz — Project Status & Handoff

> Handoff for a fresh session. Single source of truth for what exists, what works,
> what's next, and the rules in force. Architecture details: `PHASE_1_ARCHITECTURE.md`,
> `PHASE_2_BUILD_SEQUENCE.md`. Design law: `DESIGN.md`.

## 1. What it is
A price aggregator for medical services across Kazakhstan — "Aviasales, but for
medicine." A patient searches one service (анализ, приём врача, УЗИ, диагностика)
and sees every clinic offering it, ranked by price. Hackathon project. Winning
thesis: real parsed data + a comparison UX + operational maturity (admin + archive).

## 2. Stack & layout
- **web/** — Next.js 16 (App Router, TS, Tailwind v4). Landing + product + admin.
- **worker/** — Python parsing engine. fetch → parse → extract → normalize → write.
  Talks to Supabase over HTTPS only.
- **supabase/** — Postgres (source of truth) + migrations + seed.
- Design law (`DESIGN.md`): light only, monochrome + ONE accent `#0070F3`, sharp
  corners (≤2px), borders not shadows, **Manrope** + **JetBrains Mono** (Cyrillic),
  100% Russian, lucide-react icons, no emoji, no hyphens in UI copy.

## 3. Infrastructure & access
- **Supabase** project ref `eyeberctvlwgtlptuzru` (live). Schema applied, RLS on,
  catalog seeded: **78 services across exactly 4 categories** — Лаборатория, Приём
  врача, Диагностика, Процедура.
- **Keys** live in gitignored env files (NOT in git): `web/.env.local`,
  `worker/.env`. Service-role key works over PostgREST/443; Anthropic key
  (`claude-sonnet-4-6`) for extraction; `FX_USD_KZT=470` (worker converts USD→KZT).
- **Connectivity constraint (important):** this network blocks non-443 ports, so
  `psql` / direct Postgres / `supabase db push` do NOT work. DDL must go via the
  Supabase **SQL Editor** (paste `supabase/apply_all.sql`) or the Management API
  with an `sbp_` token. Data reads/writes work fine via PostgREST + service key.
- **Worker venv:** `worker/.venv` is **python3.12** (3.14 lacks some wheels).
  `config.py` loads `worker/.env` by path, so the worker runs from any directory.

## 4. What's built and working
**Phase 1 (committed, pushed to GitHub `k4ssymzhomart/medtech`):**
- Full Next.js app: design system + 10 UI primitives; **landing page fully built**
  (verified rendering — Cyrillic + design law all correct); product/admin route
  shells; **`/poisk` catalog autocomplete wired live to Supabase**.
- Supabase: migrations (extensions `pg_trgm`/`vector`/`postgis`; full schema with
  archive lifecycle `is_active/archived_at/archive_reason` + unique
  `(clinic_id, service_id, source_id)`; RLS), seed (78 services), hand-written TS
  types. `supabase/apply_all.sql` is the one-paste apply file.

**Phase 2 worker pipeline (on disk, NOT committed — git is parked):**
- **Extract:** Anthropic `claude-sonnet-4-6`, structured JSON output, **chunked**
  (13k chars/chunk, max 16 chunks, max_tokens 12000) with a **salvage parser** that
  recovers complete objects if a response is truncated.
- **Normalize:** rapidfuzz line pre-filter (catalog relevance) → **LLM semantic
  confirm** (batched 60/call, salvage). High precision: off-catalog names dropped,
  near-misses queued. (Replaced an earlier fuzzy matcher that false-positived.)
- **Fetch:** cookie-aware `httpx.Client` (clears KDL's cookie-gated 302).
- **Parse:** full visible text + **±2-line window** around catalog-relevant lines
  (preserves name↔price pairing whatever the page order); covers the whole page,
  not a sample.
- **Loader** `worker/app/load.py`: drives `sources.txt`, dedupes clinics by
  (name, city), Russian city names, stage ordering, **skip-logging**
  (`skipped_sources.txt`), fault-tolerant per source, **keeps every row**.

Pipeline verified end-to-end on real data (mdi.kz, Invitro Almaty): extraction
correct, USD→KZT conversion correct, normalization precise.

## 5. Data sources (`sources.txt` — 114 validated URLs, 68 domains, 22 cities)
- **Invitro** (`invitro.kz/analizes/for-doctors/{city}/`) — CLEANEST: pure SSR,
  full catalog in static HTML, ₸ prices, no cookie. **Primary backbone.**
- **KDL Olymp** (`kdlolymp.kz/pricelist/{city}`) — static ₸ prices but needs a
  cookie (302) and SSR-renders mostly bundled *profiles* (low individual-test yield).
- **mdi.kz** — clean static but a specialized lab (low overlap with the 78 catalog).
- Prices render as **₸ (U+20B8 / `&#8376;` entity)**, NOT the text "тг" — grep for ₸.
- 18 sources are JS-only → skip-log and move on. `sources_summary.txt` has the breakdown.

## 6. Current DB state (as of this handoff)
**~4 offers, 3 clinics, 1 city (Алматы).** The production load has NOT successfully
completed — Stage 1 hit a JSON-truncation bug (now fixed in code) and then the
session restarted. Catalog (78) is seeded; queue/raw layers have a few test rows.

## 7. NEXT STEPS (priority order)
This is the active task: **run the production data load, then build the product UI.**
1. **Re-validate** the truncation fix on one Invitro city (interrupted by restart):
   `PYTHONPATH=worker worker/.venv/bin/python scratchpad/validate_inv.py` — expect
   ~10+ correct links, no JSON errors.
2. **Stage 1 backbone** (all cities, big labs):
   `PYTHONPATH=/Users/k4ssym/Documents/medtech/worker worker/.venv/bin/python -m app.load stage1`
   (~30–40 min, ~$15–30 on the Anthropic key). **Keep all rows.**
3. **Stage 2 fan-out:** `... -m app.load stage2` (mixed/diagnostic/clinic sources).
4. **Report coverage** (`scratchpad/db_report.py`): total offers, distinct clinics,
   distinct cities, **clinics-per-city**, catalog coverage, common tests in 5+ cities.
5. **Patient product UI** (web, on real data): `/poisk` ranked results (cheapest
   first, best-price + freshness badges, filters, sort, 30-day current rule),
   `/klinika/[id]` clinic card + price-history, `/sravnenie` compare, Leaflet map.
6. **Admin UI:** sources + Run now (insert queued `parse_runs`) + logs +
   normalization queue (already has real items) + archive.

## 8. Rules in force (set by the user — honor these)
- **Production load:** go WIDE (18+ cities, MULTIPLE clinics per city, not one lab
  ×18), **KEEP ALL ROWS / no deletion** (the data is the deliverable), dedupe
  clinics by name+city, time-box each source ~20 min, skip-log JS/no-price/errors
  and move on, fault-tolerant (one source never stops the rest).
- **Git: PARKED** — do not touch git/attribution until there's a working demo.
- **Attribution:** the GitHub repo must show **only `k4ssymzhomart`** as
  contributor — no Claude / AI-IDE signs. Already done: history rewritten,
  `CLAUDE.md`/`.claude/` removed → `DESIGN.md`, force-pushed clean. Future commits:
  no co-author trailers, authored as the user. (The worker's use of the Anthropic
  API is legitimate product tech and stays.)
- **Design law** (`DESIGN.md`) is non-negotiable.

## 9. Key files
- Worker: `worker/app/{fetch,parse,extract,normalize/llm,write,pipeline,load,config,main}.py`
- DB: `supabase/apply_all.sql`, `supabase/migrations/`, `supabase/seed/seed.sql`,
  `web/lib/supabase/types.ts`
- Web: `web/app/**`, `web/components/**`, `web/lib/**`
- Data: `sources.txt`, `sources_summary.txt`, `skipped_sources.txt`
- Scratch scripts (not in repo): `db_report.py`, `validate_inv.py`, `run_mdi.py`

## 10. Useful commands
```bash
WORKER=/Users/k4ssym/Documents/medtech/worker
# coverage report
PYTHONPATH=$WORKER $WORKER/.venv/bin/python /path/to/scratchpad/db_report.py
# load
PYTHONPATH=$WORKER $WORKER/.venv/bin/python -m app.load stage1   # then stage2
# web dev
cd web && npm run dev      # http://localhost:3000
```
