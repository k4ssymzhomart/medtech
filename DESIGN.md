# Design System & Conventions — MedServicePrice.kz

Working notes for this repo. **§ Design Law is non-negotiable.**

## What this is
A price aggregator for medical services across Kazakhstan — "Aviasales, but for
medicine." A patient searches one service and sees every clinic that offers it,
ranked by price. Full architecture: `PHASE_1_ARCHITECTURE.md`.

## Stack
- **web/** — Next.js (App Router) + TypeScript + Tailwind v4. Landing, product, admin.
- **worker/** — Python parsing engine (Docker). Talks ONLY to Supabase, outbound.
- **supabase/** — Postgres (source of truth), Auth, Storage, Realtime.

## The job-queue rule
The admin panel NEVER calls the worker directly. "Run now" = insert a `parse_runs`
row with `status='queued'`. The worker polls Supabase, claims jobs, writes results
back. The worker needs only OUTBOUND access to one URL (Supabase).

---

## Design Law (CRITICAL — apply to every pixel)
Aesthetic: minimalist, Vercel-native, high-design, corporate. Zero visual clutter.

- **Theme: light only.** White background (`#FFFFFF`). No dark mode, no theme
  toggle, no `prefers-color-scheme`.
- **Color: monochrome + exactly ONE accent.** Black/white system. Accent
  `#0070F3` (Vercel blue), used sparingly (primary buttons, "best price" / active
  state). **No gradients. Ever.**
- **Elevation: borders, not shadows.** **No `box-shadow`.** Separate surfaces with
  1px hairline borders (`#EAEAEA`).
- **Corners: sharp.** `--radius` max **2px**. No pills, no rounded cards.
- **Typography:** **Manrope** (headings + body), **JetBrains Mono** (all prices and
  numeric data). **Roboto and Inter are banned.** Every font MUST ship full
  Cyrillic — the entire UI is Russian.
- **Icons: strictly `lucide-react`.** No inline web SVGs, no other icon sets.
- **Emojis: 0%.** None, anywhere.
- **Hyphens: none in UI copy.** Write "Онлайн запись", not "Онлайн-запись".
- **Language: 100% Russian from first paint.** No language switcher.

Design tokens live in `web/app/globals.css` (`@theme`). Change the accent in ONE
place. If a token can express it, use the token — never a raw hex in a component.

## Data access
Public reads (catalog, clinics, offers) go through Next.js server code using the
service-role key (`lib/supabase/server.ts`). Never import the service key into a
client component. RLS is enabled on all tables (see `supabase/migrations`).

## Scope discipline
Do not invent scope. Do not silently swap libraries. Build in the order set by the
architecture's scope tiers (§10): core demo path green end-to-end first.
