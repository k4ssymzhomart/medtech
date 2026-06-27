# MedServicePrice.kz — Phase 3: Data Acquisition & Enrichment

> **Document for:** the implementation agent (Claude Code).
> **Depends on:** `PHASE_1_ARCHITECTURE.md` + `PHASE_2_BUILD_SEQUENCE.md`. The pipeline, schema, admin, and `/poisk` results page already exist and work. This is an execution pass, not a re-architecture.
> **How to run it:** four ordered steps with a **hard checkpoint after each**. Do one step, report, wait. Do not run ahead.

---

## The problem this pass solves (read first)

The database has **725 offers but only ~2 clinic brands** — Invitro and KDL, repeated across cities as branches. A price-comparison product where every search returns the same two companies is a price list, not a comparison. **This is the single biggest gap in the product and it loses both the Data-quality (25%) and Market-coverage (15%) score.**

The reason the other ~90 validated URLs in `sources.txt` never loaded: most are **JavaScript-rendered**, so the static `httpx` fetch saw no prices and skip-logged them. The unlock is a **real headless browser (Playwright)** that loads the page, runs its JS, and then reads the rendered HTML. The same tool solves 2gis enrichment (2gis is heavily JS-based). It is free — no Anthropic API, no paid keys.

---

## Cardinal rules (carry over, still binding)

1. **No Anthropic API in parsing.** Extraction is code (HTML parse + regex for name / ₸ price / duration). Normalization is code (exact + synonym table + rapidfuzz ≥ 90; the rest → unmatched queue).
2. **Keep all rows.** No "cleanup," no deletion. This is production data.
3. **Do not touch Git.** Attribution cleanup is parked until the demo is ready.
4. **Design law still on** — monochrome + single accent (`#0070F3`), sharp corners, no shadows, lucide-react, Russian, no emoji, no hyphens.
5. **Per-source fault tolerance + politeness.** One source failing never halts the rest. Respect robots.txt, crawl-delay, real User-Agent, paced requests.
6. **Checkpoint after every step.** Report the numbers, then wait for go.

---

## Step 1 — Playwright fetcher + full re-load  ← DO THIS FIRST, then STOP and report

**Goal:** turn ~2 clinic brands into many distinct brands across all four categories, by parsing the sources that were skip-logged as JS-only.

**Architecture**
- Add a **headless-browser fetch path** (Playwright + Chromium) to the worker `fetch` module.
- **Automatic fallback:** try the existing static `httpx` fetch first; if it returns no priced content (no ₸ / `&#8376;` / U+20B8 matches), retry the URL with Playwright — load the page, wait for network-idle or the price content selector, then return the **rendered** HTML.
- Feed the rendered HTML into the **same code-only extraction + normalization** already built. No new LLM calls.
- **Re-run the loader over the FULL `sources.txt`** — Stage 1 *and* Stage 2, all ~90 sources (use the existing `resume`/dedupe logic so already-loaded sources aren't re-processed and audit tables don't bloat).
- **Time-box ~20 min per source.** If a source still yields nothing, cookie-loops, or has no prices, log it to `skipped_sources.txt` with the reason and move on. Do not battle any single site.
- **Dedupe clinics by name + city** so the same clinic from two URLs is one row.

**Final Result:** the DB holds many distinct clinic brands (multi-profile clinics, diagnostic centers, regional clinics) on top of the lab backbone, across cities and categories — so a search returns genuinely different companies to compare.

**Definition of Done**
- [ ] Playwright fallback works on at least 3 previously-skip-logged JS sources
- [ ] Full `sources.txt` re-loaded (both stages), all rows kept, failures logged
- [ ] Clinics deduped by name + city

**CHECKPOINT — report before doing anything else:**
- distinct clinic **names** (not just count) — the variety number
- clinics-per-city breakdown
- offers-per-**category** (Лаборатория / Приём врача / Диагностика / Процедура)
- how many of the 78 catalog services now have ≥ 1 offer, and which are comparable in 5+ cities
- the skipped-sources list with reasons

Then stop. Do not start Step 2 until the variety is confirmed.

---

## Step 2 — 2gis enrichment (Playwright)

**Goal:** add the operational metadata that makes the product feel real and unlocks the route + open-now features: **working hours, rating, phone**.

**Architecture**
- For each clinic (match by **name + city**), look it up on **2gis** and capture: **working hours**, **rating**, **phone**.
- Use **Playwright** (2gis is JS-heavy). Pace requests, be polite, real UA.
- **Parse working hours into a structured form** (per-day open/close) so "open now" is computable — not just a display string.
- Store onto the existing `clinics` columns (`working_hours jsonb`, `rating`, `phone`). Capture the clinic's 2gis URL too if available (for the route button).
- **Matching is best-effort:** if a clinic isn't found or the match is ambiguous, leave the fields null and move on. Do not block the run on unmatched clinics.

**Final Result:** most clinics carry structured hours, a rating, and a phone number; unmatched ones are simply null.

**Definition of Done**
- [ ] Hours stored structured enough to compute open/closed against current time (Astana tz)
- [ ] Rating + phone populated where found; nulls where not
- [ ] Run is paced and fault-tolerant; unmatched clinics don't halt it

**CHECKPOINT:** report how many clinics got hours / rating / phone, and how many were unmatched. Then wait.

---

## Step 3 — Features the enriched data unlocks

**Goal:** surface the Step 2 data as real user features.

**Architecture**
- **«Маршрут» button** — a deep link to 2gis directions using the clinic's coordinates (already geocoded) or its 2gis URL. No scraping; just a link.
- **«Работает сейчас» filter** on `/poisk` — computed from the structured hours + current time (Astana tz). Add to the filter rail.
- Show **working hours**, **rating**, and **phone** (a `tel:` call button) on the clinic card and, where it fits, on result rows.

**Final Result:** a user can filter to clinics open right now, see hours/rating, tap to call, and tap «Маршрут» to navigate.

**Definition of Done**
- [ ] Route button opens 2gis directions to the clinic
- [ ] Open-now filter works against real hours
- [ ] Hours / rating / call button visible on the clinic card

**CHECKPOINT:** confirm the three features work on real data. Then wait.

---

## Step 4 — Google OAuth (additive, behind a flag)

**Goal:** add optional Google sign-in without making it required, as groundwork for account-synced favorites.

**Architecture**
- **Credentials live in the Supabase dashboard, never in the repo.** The operator enables Authentication → Providers → Google in Supabase and pastes the Client ID + Secret there. The Google Console redirect URI is already set to the Supabase auth callback. **Do not put the client secret in any code, env file, or committed file** — Supabase stores it.
- App-side: `supabase.auth.signInWithOAuth({ provider: 'google' })`, handle the redirect/session in the layout, add sign-in / sign-out UI and a **Settings page**.
- **Browsing and search work fully WITHOUT login.** Auth is additive only.
- Put the whole thing behind a **`google_auth` feature flag** (toggle in `/admin/funkcii`) so it can be switched off for the demo.
- **Favorites:** localStorage now; when a user is logged in, favorites can sync to their account (build the localStorage version this pass; account-sync is a later nicety).

**Final Result:** an optional "Sign in with Google" that can be toggled on/off from admin, with a Settings page, and never blocks anonymous use.

**Definition of Done**
- [ ] Google sign-in + sign-out works; session persists
- [ ] Search/browse fully usable while logged out
- [ ] Gated behind the `google_auth` flag; Settings page exists
- [ ] No client secret anywhere in the repo

**CHECKPOINT:** confirm sign-in works and the flag toggles it. Done with the pass.

---

## Deferred this pass (do NOT build now)

- **In-clinic search** — polish on the clinic page; later.
- **Dark mode** — low priority, kept on the backlog. The design law currently forbids it; the founder will update `CLAUDE.md` first if/when we do it. **Do not implement until then.**
- **Trilingual (kaz/ru/eng)** — skipped; the parsed data is Russian, so the payoff is low for now.

---

## After this pass

Once Step 1 lands and the clinic variety is real, the product has genuine head-to-head comparison across many companies — the thing that wins on data quality and coverage. Map view, price-history sparklines, and queue resolution are the remaining upsides; we sequence those next.
