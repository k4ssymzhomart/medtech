-- MedServicePrice.kz — Phase 3 delta — geolocation + feature flags
-- Apply by pasting this whole file into the Supabase SQL Editor (non-443 ports are
-- blocked, so psql / db push do not work from here). Safe to run more than once.

-- ---------------------------------------------------------------------------
-- GEOLOCATION: plain lat/lng on clinics.
-- The schema already has a PostGIS `geo geography` column, but PostgREST can't
-- round-trip it cleanly for client-side haversine, so we keep simple numeric
-- lat/lng that the worker fills via a FREE geocoder (Nominatim / OpenStreetMap),
-- falling back to city-centre coordinates when a clinic has no street address.
-- ---------------------------------------------------------------------------
alter table clinics add column if not exists lat double precision;
alter table clinics add column if not exists lng double precision;

-- ---------------------------------------------------------------------------
-- FEATURE FLAGS: admin-toggleable switches so experimental features can be built
-- but shipped OFF, then flipped ON from the admin panel when solid.
-- ---------------------------------------------------------------------------
create table if not exists feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  label       text,
  description text,
  updated_at  timestamptz not null default now()
);

insert into feature_flags (key, enabled, label, description) values
  ('distance_sort',       false, 'Сортировка по расстоянию',
   'Геолокация пользователя и сортировка клиник по расстоянию (XX км)'),
  ('price_subscriptions', false, 'Подписка на снижение цены',
   'Уведомления, когда цена услуги падает'),
  ('clinic_ratings',      false, 'Рейтинги и отзывы клиник',
   'Показ рейтинга клиники (данных пока нет — включать при наличии бесплатного источника)')
on conflict (key) do nothing;

-- RLS: service_role (worker + admin server actions) bypasses RLS; allow anon read so
-- public product pages can honour flags too.
alter table feature_flags enable row level security;
do $$ begin
  create policy "public read feature flags"
    on feature_flags for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
