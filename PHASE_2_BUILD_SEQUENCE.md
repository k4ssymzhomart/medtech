# MedServicePrice.kz — Phase 2: Build Sequence (v2, aligned to full TZ)

> **Document for:** the implementation agent (the engineering team).
> **Depends on:** `PHASE_1_ARCHITECTURE.md` (the blueprint) **plus the schema corrections in §A below** (from the complete TZ). Read the blueprint first; this document references its §5 design law, §8 schema, and §9 folder tree.
> **Format:** eight build phases. Each has **Architecture** (what to build), **Final Result** (the demonstrable end state), and **Definition of Done** (the completion bar). No code — implement from the spec.
> **What changed in v2:** the real weighted scoring rubric, the concrete target-source list, the four explicitly-named bonus features, the non-functional requirements as scored items, and three schema field corrections.

---

## A. Schema corrections from the full TZ (apply to migrations)

These amend blueprint §8. They are small but must be in the migrations.

1. **`price_offers.duration_days`** (int, nullable) — lab turnaround time in days. **`raw_extractions.raw_duration`** (text, nullable) so the LLM can capture «срок выполнения» before normalization.
2. **`service_categories` is a fixed four-value enum:** **лаборатория · приём врача · диагностика · процедура**. Seed only these four. УЗИ / рентген / МРТ / КТ → диагностика; ОАК / биохимия / глюкоза / ТТГ / ОАМ → лаборатория; приёмы → приём врача; инъекции / капельницы → процедура.
3. **Currency:** `price_offers.price` is always **KZT**. The worker converts USD → KZT on write using a single configurable FX rate in worker config. Keep `raw_extractions.raw_currency`; optionally store `original_price` + `original_currency` on the offer for transparency.

Non-migration rules (behavior the worker and queries must honor):
- **Freshness line:** offers with `last_seen_at` older than **30 days** must not be presented as current.
- **Raw retention:** do not delete `raw_documents` / `raw_extractions` before **90 days** (audit).
- `parsed_at` from the TZ data model maps to `price_offers.last_seen_at` — set it on every run.

---

## B. The real scoring rubric (drives all priorities)

| Weight | Criterion | What scores |
|---|---|---|
| **25%** | Качество данных — **Data quality** | freshness, number of sources, normalization correctness |
| **25%** | UX / поиск — **UX / search** | speed of finding a service (**≤ 3s**), readability of results |
| **20%** | Техническая реализация — **Technical** | code quality, architecture, **error handling** |
| **15%** | Охват рынка — **Market coverage** | number of **clinics and cities** |
| **15%** | Доп. функции — **Additional features** | **map, price history, comparison, subscriptions** |

**Strategic reading:**
- Data quality + UX = **50%**. These are the spine, as planned.
- **Market coverage is a real 15% axis** — breadth (clinics + cities) is rewarded. The all-cities decision is correct; we chase coverage actively. Reconcile with UX by *also* seeding the common-service set so comparisons stay rich (overlap), while maximizing clinic/city count through the admin panel.
- **All four bonus features are named** — build map + price history + comparison + subscriptions to capture the full 15%. Subscriptions is in scope, not optional.
- Technical 20% rewards **visible error handling** and a **scalable architecture** — our `parse_logs`, fault-tolerant per-source jobs, and generic pipeline land here.

---

## Cardinal rules (apply to every phase)

1. **Vertical slice, always shippable.** Each phase ends in a runnable, committable state.
2. **The worker is never called over HTTP.** "Run now" inserts a `parse_runs` row with `status='queued'`; the worker polls.
3. **The design law (§5) is always on.** White, sharp, monochrome + one accent (`#0070F3`), no shadows, lucide-react only, zero emoji, no hyphens in copy, Russian from first paint, Cyrillic-safe fonts (Manrope + JetBrains Mono).
4. **Honor the NFRs — they are scored.** Search ≤ 3s, no data older than 30 days shown as current, parser fault tolerance, raw retained ≥ 90 days, data refreshable at least daily.
5. **Do not invent scope.** Build what is specified, in order. Surface blockers.
6. **Two-person parallel tracks.** One de-risks the worker (Phase 3) while the other builds the design system + search (Phases 1, 4) against the seeded catalog and placeholder clinics.

---

## Build Phase 1 — Foundation & Design System

**Goal:** A running Next.js app that establishes the design law and the landing → product shell. No data yet.

**Architecture**
- Scaffold `web/` (Next.js App Router + TypeScript), `<html lang="ru">`.
- Fonts via `next/font/google`: **Manrope** (headings + body) + **JetBrains Mono** (prices/numbers). Load the **Cyrillic subset explicitly** and verify on rendered text.
- Design tokens: white background, near-black text, single accent `#0070F3`, `--radius: 2px`, hairline border `#EAEAEA`, **no shadow tokens**, no dark mode.
- `components/ui` primitives (blueprint §5): Button, SearchInput, Select, Badge (freshness + best-price), Card, Table, Tabs, Dialog, Toast, Skeleton — all sharp, border-based, monochrome + accent.
- Marketing landing (`/`): Hero (CTA «Начать поиск» → `/poisk`, optional inline search that deep-links), «Как это работает» (3 steps), coverage stat block (wired to real count later), footer CTA. Russian, no emoji, no hyphens.
- Product + admin route groups and shells (blueprint §6).
- Supabase project + `lib/supabase` clients from env. Enable `pg_trgm`, `pgvector`, `postgis`.

**Final Result:** `npm run dev` shows a polished, fully Russian landing page; the CTA routes to an empty `/poisk`; the design language is consistent and Cyrillic renders correctly. Deploys to Vercel.

**Definition of Done**
- [ ] Fonts render Cyrillic correctly (verified on rendered text)
- [ ] Zero box-shadows; radius ≤ 2px; no emoji or hyphens
- [ ] Landing CTA + inline search route into `/poisk`
- [ ] UI primitives exist and are responsive; deploys

**Scores:** UX/search (readability foundation), Technical (clean architecture).
**Watch out:** Many geometric Google Fonts are Latin-only — verify rendered Cyrillic, not just the import.

---

## Build Phase 2 — Data Backbone: Schema & Seed

**Goal:** The full Postgres schema (with the §A corrections) exists in Supabase with a seeded catalog. The database is the source of truth.

**Architecture**
- Migrations in `supabase/migrations` for every blueprint §8 table **plus §A corrections** (`duration_days`, `raw_duration`, four-value category enum, KZT-canonical price). Include the archive lifecycle columns and the dedup constraints (`raw_documents.content_hash`; `price_offers` unique `(clinic_id, service_id, source_id)`).
- RLS: public read on non-archived `clinics` / `services_catalog` / `price_offers`; admin-only on operational tables.
- **Indexes for the ≤3s UX target** (set up now, not later): GIN/trigram index for catalog autocomplete; indexes on `price_offers(service_id)`, `clinics(city)`, `services_catalog(category_id)`, and price for range/sort; PostGIS index on `clinics.geo` for distance.
- Seed `supabase/seed`: the **50+ canonical services** mapped into the four categories, using the common-service set for overlap, each with synonyms. A couple of placeholder clinics for parallel UI work.
- Generate TypeScript types into `lib/supabase/types`.

**Final Result:** Supabase holds the complete corrected schema with performance indexes; the catalog returns 50+ services across the four categories; types are available; tables browsable in the dashboard.

**Definition of Done**
- [ ] All tables, constraints, RLS, and the §A corrections are live
- [ ] 50+ catalog services seeded across the four categories with synonyms
- [ ] Autocomplete + filter + sort indexes present (for the ≤3s target)
- [ ] `embedding` column present; TS types generated

**Scores:** Data quality (normalization foundation), Technical, UX/search (index → speed).
**Watch out:** The unique constraint must exactly match the worker's upsert key, or re-parses duplicate. Archive columns nullable.

---

## Build Phase 3 — Parsing Engine: One Source End-to-End

**Goal:** The Dockerized Python worker pulls **one** real source through the full pipeline and writes normalized offers to Supabase. Riskiest phase — prove the slice before generalizing.

**Architecture**
- Scaffold `worker/` per blueprint §9: Dockerfile (Python + Playwright), `docker-compose.yml`, and `app/` modules — `main` (poller + **APScheduler** for the cron loop), `fetch` (http + playwright), `parse` (pdf/docx/xlsx/html), `extract` (LLM), `normalize` (trgm + embedding → queue), `write` (upsert/dedup/archive + **USD→KZT conversion**), `robots` (politeness), `supabase_client`.
- Worker authenticates to Supabase with the service key, **outbound only**.
- **Job loop:** poll `parse_runs` for `queued`, claim (set `running`), process, write `parse_logs` + counters, set terminal status.
- **Fault tolerance (NFR, scored):** each job is fully isolated in try/except; any source failure is caught, logged with source + reason, marks the run `failed`/`partial`, and **never halts the scheduler or other jobs**.
- **Generic pipeline** against ONE chosen source — start with the easiest clean source (see Appendix: **doq.kz** if its JSON API is usable, otherwise a clean lab like **Helix/KDL**):
  - Fetch (HTTP, fallback Playwright) → store raw to Storage + `raw_documents` with `content_hash`
  - Parse → LLM structured extraction (strict JSON, capturing name / price / currency / **duration**) → `raw_extractions`
  - Normalize: deterministic trigram match, then embed + `pgvector` cosine; below threshold → `unmatched_queue` with `suggested_service_id` + `confidence`
  - Write: **convert USD→KZT**, upsert `price_offers` (with `duration_days`), append `price_history` on change, bump `last_seen_at`
- Populate `services_catalog.embedding` once.
- Politeness: robots.txt + crawl-delay + jitter + real User-Agent.

**Final Result:** the worker parses the chosen source and populates `clinics` / `price_offers` (with duration, KZT) / `price_history`; some raw names land in the unmatched queue with AI suggestions; killing the source mid-run logs the failure without crashing the loop.

**Definition of Done**
- [ ] One source produces real KZT offers (with `duration_days` where applicable)
- [ ] Raw layer populated; re-run upserts without duplicates; price changes create history
- [ ] Low-confidence names land in the queue with suggestion + confidence
- [ ] A forced source failure is logged and does NOT halt other processing
- [ ] robots.txt respected

**Scores:** Data quality (sources + normalization), Technical (error handling, fault tolerance), Innovation.
**Watch out:** Force strict JSON from the LLM and validate/repair. Embedding dimension must match the `pgvector` column. Re-run must upsert.

---

## Build Phase 4 — The Aviasales Moment: Search & Results

**Goal:** The core public screen, fast and readable. A patient searches a service and sees real clinics ranked by price within the 3-second budget.

**Architecture**
- `lib/queries`: catalog autocomplete (canonical + synonyms); offers-by-service (joined clinic + price + freshness + **duration** for lab services) with filters (city, category, price range, rating, online booking, freshness) and sorts (price ↑/↓, distance via PostGIS, last updated). **Server-side filtering + pagination; lean on the Phase 2 indexes to hold ≤ 3s.**
- `/poisk`: SearchBar with autocomplete, city selector (all cities), popular-service chips, FilterRail, SortBar, results list of ResultCard — clinic, **price in monospace**, address, distance (if geo), rating, **freshness badge** («обновлено N дней назад»), **lab turnaround** («срок N дней» where present), online-booking flag, source link. **«Лучшая цена»** badge on cheapest. Skeleton + empty states.
- Wire the landing's inline search / CTA to deep-link into `/poisk`.
- Utilities: freshness state (fresh / stale / **>30d = not current**), `formatPrice` (KZT).
- Public reads honor RLS and the 30-day rule: offers older than 30 days are excluded from default results or clearly marked «данные устарели».

**Final Result:** searching a common service returns real ranked clinics from Phase 3 data, under 3 seconds; filters and sorts work; cheapest is highlighted; freshness and lab turnaround are visible; stale data is never shown as current.

**Definition of Done**
- [ ] Autocomplete from the catalog; results ranked cheapest-first with best-price badge
- [ ] All filters and sorts functional; **search returns in ≤ 3s** on the seeded dataset
- [ ] Freshness badges correct; 30-day rule enforced; lab turnaround shown
- [ ] Responsive; design law honored

**Scores:** UX/search (the biggest readability + speed axis), Data quality (freshness shown), Functionality.
**Watch out:** Comparison only feels rich with overlap — confirm parsed services hit the seeded common set so multiple clinics appear per search. Measure search latency on a realistic row count.

---

## Build Phase 5 — Admin: Sources, Run Now, Logs + the Coverage Push

**Goal:** The dynamic parsing control center — add a source, run it on demand, watch results appear — and the mechanism by which we drive **market coverage (15%)**: many sources, clinics, and cities.

**Architecture**
- Admin auth (Supabase Auth), admin layout, dashboard KPIs (sources, active offers, catalog size, last-run statuses, queue size, archived count, **distinct cities + clinics** — the coverage number) with Realtime where it adds life.
- `/admin/istochniki`: SourceTable (url, type, frequency, last run, next run, status) + AddSourceDialog (name, url, type, default clinic, parse_config, frequency) + per-row **Run now** (`/api` route inserts a `queued` `parse_runs` row), pause/resume, edit, view logs.
- Runs & logs view: `parse_runs` with counters; expandable `parse_logs` (level, message, source, reason) — the **error-handling visibility** that scores in Technical. Realtime updates.
- **Coverage push (scored 15%):** use the panel to onboard sources from the Appendix — doq.kz, KDL, Helix, Invitro, Olymp, MEDEL, MCK, Aksai, plus city/regional clinic sites — to maximize clinics and cities. The worker handles them generically; no new code per source. Enrich clinic address / working_hours / geo / rating from **2gis / Google Maps**.

**Final Result:** an admin adds a new clinic URL and hits Run now; a queued job appears, the local worker claims it, offers stream into the public feed, logs show success/errors live; the coverage number (clinics + cities) climbs well past the 3-source / 100-service minimum.

**Definition of Done**
- [ ] Admin auth gates `/admin`; Run now inserts a queued job (no direct worker call)
- [ ] Logs + run statuses visible and live (error handling on display)
- [ ] **≥ 3 sources and ≥ 100 offers**, with coverage pushed beyond the minimum (multiple cities)
- [ ] Clinic metadata enriched from 2gis/Google where possible

**Scores:** Market coverage (the 15% axis), Data quality (more sources), Technical (error handling), Innovation.
**Watch out:** Run now only inserts a queued row. Clean up Realtime subscriptions. Respect crawl-delays when onboarding many sources at once.

---

## Build Phase 6 — Normalization Queue (human-in-the-loop)

**Goal:** Make AI-assisted catalog matching visible and correctable — the core of the **Data quality (25%)** normalization score.

**Architecture**
- `/admin/ochered`: list `unmatched_queue` (raw name, source, AI `suggested_service_id`, `confidence`). Actions: confirm suggestion, assign to a different service, create a new catalog service (and add the raw name as a synonym), ignore. **Bulk-accept** high-confidence rows.
- On resolve: link the `raw_extraction` to the catalog service, create/update the `price_offer`, mark resolved, and **feed the resolution back as a synonym** so future parses auto-match.
- `/admin/katalog`: CRUD services + categories + synonyms.

**Final Result:** an admin clears unmatched services in a few clicks; the catalog grows; previously unmatched offers appear in search; resolving a name once teaches the system so it auto-matches next time.

**Definition of Done**
- [ ] Resolving creates offers + updates the catalog; bulk-accept works; resolved items leave the queue
- [ ] Catalog + synonym CRUD works without duplicates
- [ ] Search coverage visibly increases as the queue clears

**Scores:** Data quality (normalization correctness), Innovation, Technical.
**Watch out:** Resolution must be idempotent; a new synonym must not spawn a duplicate catalog entry.

---

## Build Phase 7 — The Four Bonus Features (the full 15%)

**Goal:** Build all four explicitly-named bonus features to capture the entire Additional-features bucket.

**Architecture**
- **Map** on `/poisk` (Leaflet): toggle list ↔ map, price pins, click pin → result; distance sort via PostGIS when geo allowed.
- **Comparison:** select 2–4 results → `/sravnenie` → CompareTable (price, address, hours, rating, booking, lab turnaround) side by side.
- **Price history:** clinic card `/klinika/[id]` shows all services, contacts, hours, map, website, and a **per-service PriceHistorySpark** from `price_history`.
- **Subscriptions** (now in scope, not optional): «Следить за ценой» on a service/clinic → capture email into `price_subscriptions` (service_id, optional clinic_id, target condition, email). For the MVP, a worker step flags subscriptions whose latest price dropped / changed and records a notification (email send can be stubbed/logged if SMTP isn't wired — the scored artifact is the working subscribe + change-detection loop).

**Final Result:** a patient can flip to a map, compare clinics head-to-head, open a clinic with price-trend sparklines, and subscribe to a price. All four named features are demonstrable.

**Definition of Done**
- [ ] Map toggle + pins + distance sort
- [ ] Compare table for 2–4 clinics
- [ ] Clinic card with full service list + price-history sparkline
- [ ] Subscribe flow stores a subscription and the worker detects a matching price change
- [ ] All on-brand and responsive

**Scores:** Additional features (the full 15%), UX/search, Innovation.
**Watch out:** Price history needs ≥ 2 parse runs to show a trend — run sources twice before the demo so sparklines aren't flat. If SMTP isn't ready, make change-detection visibly work and log the notification.

---

## Build Phase 8 — Archive, Polish & Demo

**Goal:** Close the data lifecycle, harden the experience, and prepare to win the room.

**Architecture**
- `/admin/arhiv`: tabs (offers / clinics / sources), each row reason + date, **one-click Restore**. Verify the lifecycle: offers not seen in the latest parse auto-archive; the public feed hides archived; **>30-day data is not shown as current**; history preserved; raw retained ≥ 90 days.
- Polish pass: empty/error/loading states; mobile QA; copy review (Russian, no hyphens, no emoji, no clutter); accent/contrast/sharp-corner audit; **README** with run instructions (TZ deliverable: `docker compose up` for the worker, env, Supabase setup).
- Demo prep: rehearse the narrative; clean dataset; pre-load two runs for history; keep a fresh clinic URL ready for the live Run-now moment. Optional: record the 1–3 minute demo video (TZ optional deliverable).
- **Deck (5–7 slides), mapped to the rubric:**
  1. Problem — the opaque market, manual site-by-site pain
  2. Solution — the Aviasales analogy + live demo pointer (UX 25%)
  3. Data quality — sources, normalization (AI + queue), freshness (Data 25%)
  4. Architecture — generic AI pipeline + job-queue loop + fault tolerance (Technical 20%)
  5. Coverage — clinics + cities, the admin onboarding flow (Coverage 15%)
  6. Bonus features — map, history, compare, subscriptions (Features 15%)
  7. Roadmap — more sources/cities, mobile app, clinic partnerships, online booking

**Final Result:** a complete, polished, lifecycle-honest MVP with a rehearsed demo and a rubric-mapped deck. Clean public feed, preserved history, restorable archive.

**Definition of Done**
- [ ] Archive + restore works; full lifecycle verified (30-day + 90-day rules)
- [ ] README runs the project from scratch
- [ ] All TZ deliverables met: 3+ sources, 100+ services, 50+ catalog, deck (+ optional video)
- [ ] Demo rehearsed on a clean dataset

**Scores:** all five axes.
**Watch out:** Never demo on a messy DB. Freeze scope 2–3 hours before judging; switch to rehearsal and bug-fixing.

---

## The demo script (on stage)

1. Open the **landing** — problem in one sentence.
2. Enter the **product**, search ОАК — real clinics rank by price, «Лучшая цена», freshness + turnaround visible, under 3 seconds. *The Aviasales moment.*
3. Flip to the **map**, **compare** two clinics, open a **clinic card** with price-history sparkline, **subscribe** to a price.
4. Pivot: "How does it stay fresh and how do you scale sources?" → **admin panel**, **add a new clinic URL live**, hit **Run now**, show the queue + logs + new prices appearing, and the **coverage number** climbing.
5. Show the **normalization queue** — AI suggestions with confidence, resolved in a click.
6. Close on the **archive** — clean feed, nothing lost — then coverage + roadmap.

---

## Appendix — Target sources (from TZ 2.1)

Onboard these through the admin panel. Annotated by format and strategic value.

| Source | Format (per TZ) | Use it for |
|---|---|---|
| **doq.kz** | HTML / JSON API | Clinic aggregator, doctor appointments. **If the JSON API is usable, start here — easiest, highest yield.** |
| **kdl.kz / kdlolymp.kz** | HTML, price lists | KDL lab. Big, clean, common analyses → **overlap for comparison**. |
| **helix.kz** | HTML | Helix lab. Same overlap value. Good Phase 3 candidate. |
| **invitro.kz** | HTML, PDF | Invitro lab. Tests the PDF path. High overlap. |
| **olymp.kz** | HTML, PDF | Olymp medcenter, wide range. |
| **medel.kz** | HTML | MEDEL multidisciplinary clinic. |
| **mck.kz** | HTML | MCK medical center. |
| **aksai-clinic.kz** | HTML | Regional clinics → **city coverage**. |
| City / regional clinic sites | HTML, PDF, DOCX | **Coverage breadth** (the 15% axis) + tests DOCX path. |
| **2gis.kz / Google Maps** | API / HTML | Enrich clinic **address, working_hours, geo, rating**; powers map + distance sort. Not a price source. |

**Sequencing:** Phase 3 proves one easy clean source end-to-end (doq.kz API or Helix/KDL). Phase 5 fans out across the labs (overlap → comparison + data quality) and the clinic/regional sites (breadth → coverage), enriching metadata from 2gis. Push past the 3-source minimum — coverage is scored.

---

## After Phase 8

The deck is outlined and rubric-mapped above; I can generate the actual `.pptx` as a separate deliverable on request. To drill into any single phase before the agent runs it, name the phase and I'll expand it to step level.
