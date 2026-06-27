# MedServicePrice.kz — Phase 1: Architecture & Master Blueprint

> **Document for:** the implementation agent (the engineering team).
> **Author:** Architecture / PM lead.
> **Status:** Phase 1 — blueprint only. No build sequence yet. That arrives in Phase 2.
> **Instruction:** Read this top to bottom before writing a single line. This is the single source of truth for *what* we are building, the stack, the design law, the data model, and the folder layout. Phase 2 will give you the ordered *how*.

---

## 0. How to read this document

- This file is the **WHAT**, the **WHY**, and the **SHAPE**. Phase 2 is the **HOW** (ordered build steps).
- Wherever it says **must**, it is non-negotiable.
- **§5 (Design Law) is not optional and not a suggestion.** It is the difference between winning and looking like every other hackathon submission. Re-read it before building any UI.
- Do not invent scope. Do not silently substitute libraries. If something is genuinely blocked, surface it.

---

## 1. The Case

We are building **MedServicePrice.kz** — a price aggregator for medical services (анализы, приёмы врачей, диагностика, УЗИ) across Kazakhstan. The mental model: **Aviasales, but for medicine.** A patient searches one service and instantly sees every clinic that offers it, ranked by price.

**The problem we solve.** Today a patient who wants a blood test or a therapist appointment has to open dozens of clinic websites one by one to compare prices. The market is opaque. Prices are aggregated nowhere. We make them transparent and comparable in one place.

**Who it is for.** Patients in **all cities of Kazakhstan** — Алматы, Астана, Шымкент, Актобе, Павлодар and beyond. We do not restrict to a few cities; `city` is a first-class field and the product covers everything we can parse.

**The context.** This is a competitive hackathon. We do not win on a pretty search box — everyone has one. We win on three things:
1. **Real data** from real Kazakh clinics, normalized so the same test from five clinics actually lines up side by side.
2. **A comparison UX that lands** — the "Aviasales moment."
3. **Operational maturity** — a dynamic admin panel and a data-archive system that other teams will not have. This is our differentiator and our innovation story.

**The bar (from the TZ).** Working MVP + README; real parsed data (**min 3 sources, 100+ services**); a service catalog (**50+ normalized positions**); a 5–7 slide deck. Constraints: **public data only, respect robots.txt, no patient PII.** (Legal specifics are handled separately by the founder's lawyer — build to the robots.txt / public-only stance and move on.)

---

## 2. The Winning Thesis

The project has a trap: it is tempting to sink all the time into either a beautiful UI sitting on 12 hand-seeded rows, or a fragile scraper that breaks 20 minutes before judging. **The competition is decided in the data pipeline.** Effort is allocated accordingly:

- The **data pipeline + comparison UX** are the product.
- The **admin panel + archive** are the maturity story that separates us from the pack.
- We build maximum scope, but in a **ruthless order** (see §10). The core demo path is sacred and goes green end-to-end *first*; everything else climbs on top of it.

A product note that drives data quality: **comparison value comes from overlap, not volume.** 100 services with zero overlap across clinics means nothing to compare. So even though we cover all cities, **seed the catalog with the ~50 most common services first** (ОАК, биохимия крови, УЗИ брюшной полости, приём терапевта/гинеколога/ЛОРа, глюкоза, ТТГ, общий анализ мочи, etc.) and prioritize sources that publish those same services. We optimize for head-to-head matchups.

---

## 3. Tech Stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Frontend + Admin | **Next.js (App Router) + TypeScript** | Hosts landing, product, and admin. Deploy on Vercel (or run locally). |
| Data backbone | **Supabase** | Postgres (single source of truth), Auth (admin), Storage (raw files), Realtime (live admin UI). |
| Parsing engine | **Python worker, containerized with Docker** | Talks **only** to Supabase, outbound. Owns all fetching, parsing, extraction, normalization. |
| Maps | **Leaflet** | Free, no key friction. |
| Icons | **lucide-react** | Strictly. See §5. |

### Why not "Supabase only"

Supabase is the backbone, **not** the whole stack. Edge Functions (Deno) cannot run a headless browser, time out on a multi-page crawl plus multiple LLM calls in one invocation, and make PDF/DOCX/XLSX parsing painful. **The parsing engine belongs in Python.** Supabase still earns its place: free hosted Postgres with the exact extensions we need, plus Auth, Storage, and Realtime for the admin dashboard.

**Enable these Postgres extensions in Supabase:** `pg_trgm` (fuzzy name matching), `pgvector` (semantic catalog matching), `postgis` (distance sorting).

### The job-queue mechanism — READ THIS, it shapes the whole system

**The admin panel never calls the worker directly.** There is no inbound HTTP endpoint on the worker.

- "Run now" in the admin = **insert a `parse_runs` row with `status='queued'`.**
- The worker **polls Supabase** on a short interval, claims queued jobs, processes them, and writes results back.
- The scheduler does the same thing on a timer, based on each source's `next_run_at`.

**Consequence:** the worker only needs **outbound** access to one URL (Supabase). It can run on a laptop during the demo with zero deploy or networking pain, while still being fully driven by the deployed admin panel. Do not architect a request/response call from Next.js to the worker. Use the queue.

---

## 4. Architecture

```
Public sources  (clinic sites · PDF · XLSX)
       |
       |  fetch  (HTTP / Playwright)
       v
+--------------------- WORKER  (Docker · Python) ---------------------+
|  Fetch  ->  Parse  ->  LLM extract  ->  Normalize  ->  Write        |
|         (files & HTML)              (trgm + pgvector) (upsert+arch)  |
+--------------------------------------------------------------------+
       ^                                              |
       |  polls jobs + reads config                   |  writes raw + normalized rows
       |                                              v
+----------------------------- SUPABASE -----------------------------+
|  Postgres : raw  ·  catalog  ·  live  ·  archive                   |
|  Storage  : raw files     Auth : admin     Realtime : live admin   |
+--------------------------------------------------------------------+
       ^                                              |
       |  admin: writes config + inserts jobs         |  public: reads live data
       |                                              v
+----------------------------- NEXT.JS ------------------------------+
|  Landing  ->  Product (search · compare · map)   |   Admin panel    |
+--------------------------------------------------------------------+

LOOP:  admin inserts a job (parse_runs.status='queued')  ->  worker polls it
       ->  worker writes results  ->  public reads results.
       The worker only needs OUTBOUND access to Supabase.
```

### The parsing engine (generic for every source — NO per-site scrapers)

Writing a bespoke scraper per clinic is how hackathon teams die. The pipeline is **generic and AI-assisted** — identical for every source:

1. **Fetch.** Plain HTTP first; fall back to a headless browser (Playwright) if the page renders prices in JS. Store the raw file / HTML untouched in Supabase Storage → this is the **raw layer** the TZ requires.
2. **Parse to text/tables.** `pdfplumber` / `PyMuPDF` for PDF, `python-docx` for DOCX, `openpyxl` / `pandas` for Excel, readable text/tables for HTML.
3. **LLM structured extraction.** Hand the cleaned text to an LLM with a strict schema: *"extract every service as `{name, price, currency, unit}`, return JSON only."* This is what lets us hit 3+ sources and 100+ services **without** writing 3 custom scrapers. Store results in `raw_extractions`.
4. **Normalize (two-stage).** (a) Deterministic: trigram fuzzy match (`pg_trgm`) against catalog synonyms. (b) Semantic: embed the raw name and cosine-match against catalog embeddings (`pgvector`). High-confidence → auto-link. Below threshold → drop into `unmatched_queue` **with the AI's best guess and a confidence score**, for one-click human review.
5. **Write (upsert + dedup + archive).** Upsert into `price_offers`. New → insert. Price changed → update + append a `price_history` row. Unchanged → bump `last_seen_at`. Anything the source *stopped* listing → flip to archived (`reason='not_in_latest_parse'`). Log everything to `parse_logs`; update `parse_runs` counters.
6. **Schedule + be polite.** Scheduler claims sources where `next_run_at <= now` and `is_active`. The fetcher respects **robots.txt + crawl-delay**, adds jittered delays, sets a real User-Agent. This satisfies the TZ rules and gives us a "responsible data collection" talking point.

**Dedup happens at two levels:**
- `raw_documents.content_hash` — skip re-processing an identical re-fetch.
- `price_offers` **unique `(clinic_id, service_id, source_id)`** — re-parse becomes an upsert, never a duplicate.

---

## 5. Design Law (CRITICAL — from DESIGN.md, non-negotiable)

This is the founder's locked design system. Treat every line as a hard rule. Aesthetic: **minimalist, Vercel-native, high-design, corporate.** Zero visual clutter.

- **Theme: light only.** White background (`#FFFFFF`). **Do not implement dark mode or a theme toggle.** No `prefers-color-scheme`, no dark variants.
- **Color: monochrome + exactly ONE accent.** Black and white are the system. One accent color, used sparingly (primary buttons, the "best price" / active state). **No gradients. Ever.**
  - **Recommended accent:** `#0070F3` (Vercel blue) — matches the Vercel-native directive. *Single source for the accent; if the founder swaps it, change one token.*
- **Elevation: borders, not shadows.** **No `box-shadow`.** Separate surfaces with **1px hairline borders** (`#EAEAEA` / `#E5E5E5`). This is the Vercel look — flat surfaces, thin lines.
- **Corners: sharp.** `--radius` max **2px**. Elements are effectively square. **No pills, no rounded cards, no soft buttons.**
- **Typography: distinctive geometric Google Fonts.** **Do NOT use Roboto or Inter** (explicitly banned). Pick something stylish with strong geometry.
  - **HARD REQUIREMENT — CYRILLIC:** the entire site is in Russian. **Every chosen font MUST ship full Cyrillic glyphs.** A large share of trendy geometric Google Fonts are Latin-only and will silently break the UI into fallback fonts. **Verify Cyrillic coverage on Google Fonts before committing any font.**
  - **Recommended:** headings + body in **Manrope** (alternatives with verified Cyrillic: Onest, Golos Text). Render **all prices and numeric data in a monospace** (**JetBrains Mono** or Geist Mono) for tabular alignment and the "data" feel. Prices are the hero element — make them look like data.
- **Icons: strictly `lucide-react`.** No inline SVGs pulled from the web, no other icon sets, no emoji-as-icons.
- **Emojis: 0%.** None, anywhere — UI, copy, empty states, nothing.
- **Hyphens: none in UI copy.** Avoid dashes in interface text and headings. Write **"Онлайн запись"**, not "Онлайн-запись". Write "обновлено 2 дня назад", not "обновлено 2 дня". Keep copy clean of `-` and `—`.
- **Language: 100% Russian from first paint.** No language switcher needed for the MVP. All labels, buttons, empty states, errors — Russian.

**UI primitives to build** (`web/components/ui`, all sharp-cornered, monochrome + single accent, no shadows): `Button` (primary = accent, secondary = 1px outline), `SearchInput`, `Select`, `Badge` (freshness + best-price variants), `Card`, `Table`, `Tabs`, `Dialog`, `Toast`, `Skeleton`.

> Note: any "3D objects / react-three-fiber / illustration" patterns from other projects **do not apply here.** This product is flat, monochrome, and icon-light.

---

## 6. Information Architecture & Routing (landing → product)

The site is **landing first, product second.** The landing is a real marketing page that funnels into the product.

| Route | Surface | Purpose |
|---|---|---|
| `/` | **Landing** | Marketing entry. Sells the value prop. CTA into the product. |
| `/poisk` | **Product — Search** | The core screen: search + ranked results. |
| `/klinika/[id]` | **Product — Clinic card** | All services for one clinic + contacts + map + price history. |
| `/sravnenie` | **Product — Compare** | Table comparing 2–4 selected clinics. |
| `/admin` | **Admin — Dashboard** | System health KPIs. |
| `/admin/istochniki` | **Admin — Sources** | Add URL, set frequency, Run now, view logs. The live-demo screen. |
| `/admin/ochered` | **Admin — Queue** | Unmatched normalization queue. |
| `/admin/katalog` | **Admin — Catalog** | Services + categories + synonyms CRUD. |
| `/admin/arhiv` | **Admin — Archive** | Archived offers/clinics/sources + restore. |
| `/api/*` | Route handlers | Mutations, e.g. insert a queued job for "Run now". |

Route slugs are transliterated Russian to keep cohesion with the Russian-first site; this is a soft choice and can stay as-is.

---

## 7. UX Flows

### 7.1 Landing (`/`)

Minimal, monochrome + accent, Russian, no emojis, no hyphens, sharp corners. Sections:

- **Hero.** Headline (the value prop, e.g. «Цены на медицинские услуги по всему Казахстану в одном месте»), a one-line subhead, and a primary CTA **«Начать поиск»** → `/poisk`. Optionally an inline search field that deep-links into `/poisk` with the query prefilled.
- **Как это работает.** Three steps: Найдите услугу · Сравните цены · Выберите клинику.
- **Почему мы.** Transparency + savings, "цены обновляются автоматически", and a real coverage stat («N клиник · M городов») — pulled from live counts, never invented.
- **Footer CTA.** Repeat the entry into the product.

No fake data on the landing. If a number is shown, it is real.

### 7.2 Patient product — the Aviasales moment

- **Search (`/poisk`).** A fat search bar («Найдите анализ или услугу») with catalog autocomplete. A **city selector covering all cities**. Popular-service chips (ОАК · УЗИ брюшной полости · Приём терапевта).
- **Results.** A ranked list, **cheapest first**, with a **«Лучшая цена»** badge on the top result. Each row: clinic name, **price (monospace, prominent)**, address, distance (if geolocation allowed), rating, a **freshness badge** («обновлено N дней назад»), online-booking flag, source link.
  - **Filters rail:** city, category, price range, rating, online booking, freshness.
  - **Sort:** price ↑/↓, distance, last updated.
  - **Map toggle (Leaflet):** flip the list to price pins.
  - Select 2–4 clinics → **«Сравнить»**.
- **Compare (`/sravnenie`).** A table comparing price, address, hours, rating, and booking across the selected clinics.
- **Clinic card (`/klinika/[id]`).** All of that clinic's services, contacts, hours, map, website link, and a **per-service price-history sparkline**.
- **(Optional) Price alert.** «Следить за ценой» → email capture → notify on change.

The **freshness badge** does double duty: the TZ explicitly wants "date of last price update" shown for transparency, and it signals to judges that this is live data, not seeded.

### 7.3 Admin — operational maturity

- **Dashboard (`/admin`).** System KPIs that make it *feel* like an operating system: sources count, active offers, catalog size, last-run statuses, unmatched-queue size, archived count.
- **Sources (`/admin/istochniki`).** A table (url, type, frequency, last run, next run, status) with per-row **Run now / pause / edit / view logs**. An **Add source** modal (name, url, type, default clinic, parse config, frequency). **This is the headline live-demo screen:** add a brand-new clinic URL on stage, hit Run now, watch rows extract → normalize → appear in the public feed.
- **Runs & logs.** A list of runs with counts (found/inserted/updated/unmatched) and **expandable errors with source + reason** — satisfies the TZ logging requirement.
- **Queue (`/admin/ochered`).** Each unmatched raw name → AI suggestion + confidence → confirm / assign / create-new / ignore. Bulk-accept high-confidence suggestions.
- **Catalog (`/admin/katalog`).** CRUD on services + categories + synonyms.
- **Archive (`/admin/arhiv`).** Tabs for offers / clinics / sources; each row shows reason + date; **one-click Restore.**

---

## 8. Database Schema

Grouped by layer. Defaults: currency **KZT**. Types are hints (`uuid`, `text`, `numeric`, `timestamptz`, `bool`, `jsonb`, `vector`, `geography`). Build the actual migrations in Phase 2.

### Catalog (reference)
- **`service_categories`** — `id`, `name`, `slug`, `icon`, `sort_order`. (Анализы · Диагностика · Приёмы · УЗИ …)
- **`services_catalog`** — `id`, `canonical_name`, `category_id →`, `synonyms text[]`, `slug`, `embedding vector`, `is_active`. The «ОАК / CBC / Общий анализ крови» → one canonical service mapping. `embedding` powers semantic matching.

### Real-world entities
- **`clinics`** — `id`, `name`, `city`, `address`, `geo geography(point)`, `phone`, `website_url`, `rating numeric`, `reviews_count`, `has_online_booking bool`, `working_hours jsonb`, `logo_url`, `is_active`, `archived_at`, `archive_reason`.

### Source management (operational)
- **`sources`** — `id`, `name`, `default_clinic_id →`, `url`, `source_type` (`html|pdf|docx|xlsx`), `parse_config jsonb` (selectors / table mapping), `parse_frequency` (interval or cron), `is_active`, `last_run_at`, `next_run_at`, `consecutive_failures`, `created_by`, `created_at`. **This row IS the admin-panel entity** — add a URL + frequency and you have added a source.
- **`parse_runs`** — `id`, `source_id →`, `status` (`queued|running|success|partial|failed`), `trigger` (`manual|scheduled`), `started_at`, `finished_at`, `rows_found`, `rows_inserted`, `rows_updated`, `rows_unmatched`, `error_summary`. **Also the job queue** — inserting `status='queued'` is "Run now".
- **`parse_logs`** — `id`, `run_id →`, `source_id →`, `level`, `message`, `detail jsonb`, `created_at`. Satisfies "журналирование ошибок с указанием источника и причины".

### Raw layer (kept separate, per TZ)
- **`raw_documents`** — `id`, `source_id →`, `run_id →`, `storage_path`, `content_hash`, `http_status`, `mime_type`, `fetched_at`. `content_hash` = dedup level 1.
- **`raw_extractions`** — `id`, `raw_document_id →`, `run_id →`, `source_id →`, `raw_service_name`, `raw_price`, `raw_currency`, `raw_meta jsonb`, `extracted_at`. The structured-but-not-yet-normalized rows.

### Normalized / live
- **`price_offers`** — `id`, `clinic_id →`, `service_id →`, `source_id →`, `price numeric`, `currency` (default `KZT`), `price_unit`, `raw_service_name`, `source_url`, `is_active`, `first_seen_at`, `last_seen_at`, `last_changed_at`, `archived_at`, `archive_reason`. **Unique `(clinic_id, service_id, source_id)`** = dedup level 2; re-parse is an upsert.
- **`price_history`** — `id`, `price_offer_id →`, `price`, `currency`, `recorded_at`, `parse_run_id →`. The sparkline source. **Never deleted.**

### Normalization queue
- **`unmatched_queue`** — `id`, `raw_extraction_id →`, `source_id →`, `raw_service_name`, `suggested_service_id →`, `confidence numeric`, `status` (`pending|resolved|ignored`), `resolved_service_id →`, `resolved_by`, `created_at`, `resolved_at`.

### Archive system (founder requirement — a LIFECYCLE, not a delete)
Live entities (`price_offers`, `clinics`, `sources`) carry `is_active + archived_at + archive_reason`, and derive a freshness state from `last_seen_at`:

```
fresh  ->  stale  ->  archived  ->  (restored)
```

- Suggested thresholds (tunable): **fresh** `< 7 days`, **stale** `7–30 days`, **archived** = removed from source (`not_in_latest_parse`) or source dead after N failures.
- **Public feed shows only `is_active = true`.** `stale` still shows, with a warning badge. `archived` is hidden from the public feed.
- **`price_history` is never deleted** — full history is preserved.
- The Archive page lists archived rows by reason + date with **one-click Restore**. Clean feed, zero data loss.

### Auth / RLS
Supabase Auth for admins. RLS: public can read non-archived `clinics` / `services_catalog` / `price_offers`; everything operational (sources, runs, logs, raw, queue, archive) is admin-only.

---

## 9. Folder Structure

```
medservice/
├── README.md                         # run instructions (TZ deliverable)
├── DESIGN.md                          # design law (already authored)
├── docker-compose.yml                # local dev: worker (+ optional local postgres)
├── .env.example                      # SUPABASE_URL, keys, LLM key
│
├── web/                              # Next.js — landing + product + admin
│   ├── app/
│   │   ├── (marketing)/              # landing route group
│   │   │   ├── page.tsx              #  /
│   │   │   └── layout.tsx
│   │   ├── (product)/                # product route group
│   │   │   ├── poisk/page.tsx        #  /poisk  (search + results)
│   │   │   ├── klinika/[id]/page.tsx #  /klinika/[id]
│   │   │   ├── sravnenie/page.tsx    #  /sravnenie
│   │   │   └── layout.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx              #  /admin  (dashboard)
│   │   │   ├── istochniki/page.tsx   #  sources
│   │   │   ├── ochered/page.tsx      #  unmatched queue
│   │   │   ├── katalog/page.tsx      #  catalog
│   │   │   ├── arhiv/page.tsx        #  archive
│   │   │   └── layout.tsx
│   │   ├── api/                      # route handlers (insert queued job, mutations)
│   │   ├── layout.tsx                # root layout (fonts, html lang="ru")
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # Button, SearchInput, Badge, Card, Table, Tabs...
│   │   ├── marketing/                # Hero, HowItWorks, CoverageStat, CTA
│   │   ├── product/                  # SearchBar, ResultCard, FilterRail, SortBar,
│   │   │                             #   MapView, CompareTable, PriceHistorySpark
│   │   └── admin/                    # SourceTable, AddSourceDialog, RunLog,
│   │                                 #   QueueItem, CatalogEditor, ArchiveTable
│   ├── lib/
│   │   ├── supabase/                 # browser client, server client, generated types
│   │   ├── queries/                  # search, clinic, offers, catalog, admin
│   │   └── utils/                    # formatPrice (KZT), freshness state, etc.
│   ├── styles/                       # font config, design tokens
│   └── package.json
│
├── worker/                          # Python parsing engine (Docker)
│   ├── Dockerfile                    # Python + Playwright base
│   ├── pyproject.toml                # or requirements.txt
│   └── app/
│       ├── main.py                   # scheduler loop + job poller (claims queued runs)
│       ├── fetch/                    # http_fetcher, playwright_fetcher
│       ├── parse/                    # pdf, docx, xlsx, html parsers
│       ├── extract/                  # LLM structured extraction
│       ├── normalize/                # trgm match + embedding match -> queue
│       ├── write/                    # upsert + dedup + archive lifecycle
│       ├── robots/                   # robots.txt cache + crawl-delay + jitter
│       └── supabase_client.py
│
└── supabase/
    ├── migrations/                   # SQL schema migrations
    ├── seed/                         # catalog seed (50+ services, categories)
    └── config.toml
```

The two codebases are intentionally isolated: the worker talks only to Supabase, so the Python/TypeScript split costs almost nothing.

---

## 10. Scope Tiers (so we ship 100%)

We build maximum scope, in this order. The core is sacred and goes green end-to-end before anything else starts.

**Must-win core (the demo cannot exist without these):**
- Catalog 50+ and categories
- 3+ real sources parsed → 100+ live offers
- Landing → product flow
- Search + autocomplete + filters + sort
- Ranked results with price / freshness / source + clinic card
- Admin: add source + Run now + logs + unmatched queue + basic archive
- Fully responsive, fully Russian, design law honored

**Differentiators (high ROI, right after core):**
- Leaflet map view
- Compare table
- Price-history sparkline
- AI normalization with confidence scoring + human-in-the-loop queue

**If time remains:**
- Price alerts (email)
- 2GIS / Google route integration
- Breadth: push more cities and more sources

---

## 11. What Phase 2 Will Contain

The ordered build sequence — the eight-phase build spec, architecture-and-result format, no code dumps:

1. Scaffolding + design system (fonts with Cyrillic, tokens, UI primitives, white/sharp/mono)
2. Schema + seed (migrations, extensions, 50+ catalog seed)
3. Worker skeleton + **one source end-to-end** (fetch → parse → extract → normalize → write)
4. Search + results (the core screen)
5. Admin: sources + Run now + logs (the job-queue loop, live)
6. Normalization queue (AI suggestion + confidence + resolve)
7. Map + compare + price history
8. Archive + polish + the demo script

Say **"next phase"** and I will write it.
