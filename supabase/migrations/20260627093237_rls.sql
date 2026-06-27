-- MedServicePrice.kz — Phase 1 — Row Level Security (§8 Auth / RLS)
-- Public (anon) can read non-archived catalog / clinics / offers / history.
-- Everything operational is admin-only (authenticated).
-- The worker and admin server actions use the service_role key, which BYPASSES
-- RLS entirely, so these policies only gate the public anon/authenticated paths.

-- Enable RLS everywhere (default-deny once enabled).
alter table service_categories enable row level security;
alter table services_catalog   enable row level security;
alter table clinics            enable row level security;
alter table sources            enable row level security;
alter table parse_runs         enable row level security;
alter table parse_logs         enable row level security;
alter table raw_documents      enable row level security;
alter table raw_extractions    enable row level security;
alter table price_offers       enable row level security;
alter table price_history      enable row level security;
alter table unmatched_queue    enable row level security;

-- ---------------------------------------------------------------------------
-- PUBLIC READ (anon + authenticated) — only non-archived rows
-- ---------------------------------------------------------------------------
drop policy if exists "public read categories" on service_categories;
create policy "public read categories"
  on service_categories for select to anon, authenticated using (true);

drop policy if exists "public read active services" on services_catalog;
create policy "public read active services"
  on services_catalog for select to anon, authenticated using (is_active);

drop policy if exists "public read active clinics" on clinics;
create policy "public read active clinics"
  on clinics for select to anon, authenticated using (is_active);

drop policy if exists "public read active offers" on price_offers;
create policy "public read active offers"
  on price_offers for select to anon, authenticated using (is_active);

-- Price history powers the public per-service sparkline (prices only, no PII).
drop policy if exists "public read price history" on price_history;
create policy "public read price history"
  on price_history for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- ADMIN READ (authenticated) — operational surfaces
-- ---------------------------------------------------------------------------
drop policy if exists "admin read sources" on sources;
create policy "admin read sources"
  on sources for select to authenticated using (true);
drop policy if exists "admin read parse_runs" on parse_runs;
create policy "admin read parse_runs"
  on parse_runs for select to authenticated using (true);
drop policy if exists "admin read parse_logs" on parse_logs;
create policy "admin read parse_logs"
  on parse_logs for select to authenticated using (true);
drop policy if exists "admin read raw_documents" on raw_documents;
create policy "admin read raw_documents"
  on raw_documents for select to authenticated using (true);
drop policy if exists "admin read raw_extractions" on raw_extractions;
create policy "admin read raw_extractions"
  on raw_extractions for select to authenticated using (true);
drop policy if exists "admin read unmatched_queue" on unmatched_queue;
create policy "admin read unmatched_queue"
  on unmatched_queue for select to authenticated using (true);

-- NOTE: all writes (worker pipeline + admin mutations) go through the
-- service_role key server-side, which bypasses RLS. Granular authenticated
-- write policies arrive when admin auth is wired in a later phase.
