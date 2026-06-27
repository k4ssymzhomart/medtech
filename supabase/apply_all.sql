-- MedServicePrice.kz — combined apply (extensions + schema + rls + seed).
-- Paste into the Supabase SQL Editor and run, or apply via the Management API.

-- ============================================================
-- FILE: supabase/migrations/20260627093235_extensions.sql
-- ============================================================
-- MedServicePrice.kz — Phase 1 — Postgres extensions
-- Required by the architecture (§3): fuzzy name matching, semantic catalog
-- matching, and distance sorting for clinics.

-- Fuzzy name matching for the deterministic normalization stage (trigram).
create extension if not exists pg_trgm;

-- Semantic catalog matching (embeddings cosine search) for stage two.
create extension if not exists vector;

-- Distance sorting / geo for clinics (geography(point)).
create extension if not exists postgis;

-- ============================================================
-- FILE: supabase/migrations/20260627093236_schema.sql
-- ============================================================
-- MedServicePrice.kz — Phase 1 — Core schema (§8 of the architecture)
-- Layers: catalog (reference) · real-world entities · source management
--         (operational) · raw · normalized/live · normalization queue.
-- Defaults: currency KZT. UUID PKs via built-in gen_random_uuid() (PG13+).

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at fresh on UPDATE.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- CATALOG (reference)
-- ===========================================================================

create table service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  icon        text,                       -- lucide-react icon name
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- The «ОАК / CBC / Общий анализ крови» -> one canonical service mapping.
-- `embedding` powers semantic matching (stage two of normalization).
-- Dimension 1536 matches common text-embedding models; tune in the embedding pass.
create table services_catalog (
  id             uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  category_id    uuid references service_categories(id) on delete set null,
  synonyms       text[] not null default '{}',
  slug           text not null unique,
  embedding      vector(1536),
  is_active      bool not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index services_catalog_name_trgm
  on services_catalog using gin (canonical_name gin_trgm_ops);
create index services_catalog_synonyms_gin
  on services_catalog using gin (synonyms);
create index services_catalog_category
  on services_catalog (category_id);
-- Semantic search index (harmless on empty table; populated in the embedding pass).
create index services_catalog_embedding_hnsw
  on services_catalog using hnsw (embedding vector_cosine_ops);

create trigger services_catalog_set_updated_at
  before update on services_catalog
  for each row execute function set_updated_at();

-- ===========================================================================
-- REAL-WORLD ENTITIES
-- ===========================================================================

create table clinics (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  city               text not null,           -- first-class field: all cities
  address            text,
  geo                geography(point, 4326),   -- distance sorting (postgis)
  phone              text,
  website_url        text,
  rating             numeric(2,1),
  reviews_count      int not null default 0,
  has_online_booking bool not null default false,
  working_hours      jsonb,
  logo_url           text,
  -- archive lifecycle (fresh -> stale -> archived -> restored)
  is_active          bool not null default true,
  archived_at        timestamptz,
  archive_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index clinics_geo_gist on clinics using gist (geo);
create index clinics_city on clinics (city);
create index clinics_name_trgm on clinics using gin (name gin_trgm_ops);
create index clinics_active on clinics (is_active);

create trigger clinics_set_updated_at
  before update on clinics
  for each row execute function set_updated_at();

-- ===========================================================================
-- SOURCE MANAGEMENT (operational) — the admin-panel entities + the job queue
-- ===========================================================================

-- This row IS the admin-panel source entity: add a URL + frequency and you
-- have added a source.
create table sources (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  default_clinic_id    uuid references clinics(id) on delete set null,
  url                  text not null,
  source_type          text not null default 'html'
                         check (source_type in ('html','pdf','docx','xlsx')),
  parse_config         jsonb not null default '{}'::jsonb, -- selectors / table mapping
  parse_frequency      text,                                -- interval or cron expression
  is_active            bool not null default true,
  last_run_at          timestamptz,
  next_run_at          timestamptz,
  consecutive_failures int not null default 0,
  -- archive lifecycle (a dead source can be archived + restored)
  archived_at          timestamptz,
  archive_reason       text,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index sources_active_next_run on sources (is_active, next_run_at);

create trigger sources_set_updated_at
  before update on sources
  for each row execute function set_updated_at();

-- Also the JOB QUEUE: inserting status='queued' is "Run now". The worker polls
-- this table, claims queued rows, and writes counters/status back.
create table parse_runs (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid not null references sources(id) on delete cascade,
  status         text not null default 'queued'
                   check (status in ('queued','running','success','partial','failed')),
  trigger        text not null default 'manual'
                   check (trigger in ('manual','scheduled')),
  started_at     timestamptz,
  finished_at    timestamptz,
  rows_found     int not null default 0,
  rows_inserted  int not null default 0,
  rows_updated   int not null default 0,
  rows_unmatched int not null default 0,
  error_summary  text,
  created_at     timestamptz not null default now()
);

-- Queue polling: claim oldest queued first.
create index parse_runs_queue on parse_runs (status, created_at);
create index parse_runs_source on parse_runs (source_id);

-- Satisfies "журналирование ошибок с указанием источника и причины".
create table parse_logs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid references parse_runs(id) on delete cascade,
  source_id  uuid references sources(id) on delete set null,
  level      text not null default 'info'
               check (level in ('debug','info','warn','error')),
  message    text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index parse_logs_run on parse_logs (run_id);
create index parse_logs_level on parse_logs (level);

-- ===========================================================================
-- RAW LAYER (kept separate, per TZ)
-- ===========================================================================

-- content_hash = dedup level 1 (skip re-processing an identical re-fetch).
create table raw_documents (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete cascade,
  run_id       uuid references parse_runs(id) on delete set null,
  storage_path text,                       -- Supabase Storage path of the raw file
  content_hash text,
  http_status  int,
  mime_type    text,
  fetched_at   timestamptz not null default now()
);

create index raw_documents_hash on raw_documents (content_hash);
create index raw_documents_source on raw_documents (source_id);

-- Structured-but-not-yet-normalized rows from the LLM extraction stage.
create table raw_extractions (
  id              uuid primary key default gen_random_uuid(),
  raw_document_id uuid references raw_documents(id) on delete cascade,
  run_id          uuid references parse_runs(id) on delete set null,
  source_id       uuid references sources(id) on delete set null,
  raw_service_name text,
  raw_price       numeric,
  raw_currency    text default 'KZT',   -- source currency, before KZT conversion
  raw_duration    text,                 -- e.g. "срок: 1 день" (normalized on write)
  raw_meta        jsonb,
  extracted_at    timestamptz not null default now()
);

create index raw_extractions_run on raw_extractions (run_id);

-- AUDIT RETENTION RULE (enforced by the cleanup job, not a constraint):
-- do NOT delete raw_documents / raw_extractions before 90 days.

-- ===========================================================================
-- NORMALIZED / LIVE
-- ===========================================================================

create table price_offers (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  service_id      uuid references services_catalog(id) on delete set null,
  source_id       uuid references sources(id) on delete set null,
  -- price is ALWAYS KZT: the worker converts USD -> KZT on write using a single
  -- configurable FX rate (worker config). original_* keep the source value for
  -- transparency.
  price           numeric not null,
  currency        text not null default 'KZT',
  original_price  numeric,                      -- source price before conversion
  original_currency text,                       -- e.g. 'USD' when converted to KZT
  duration_days   int,                          -- lab turnaround time in days (nullable)
  price_unit      text,
  raw_service_name text,
  source_url      text,
  -- archive lifecycle: public feed shows only is_active=true
  is_active       bool not null default true,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  archived_at     timestamptz,
  archive_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- dedup level 2: re-parse becomes an upsert, never a duplicate.
  -- NOTE: NULL service_id rows (unmatched, awaiting the queue) are not deduped
  -- by this constraint, which is intended — they resolve via unmatched_queue.
  constraint price_offers_unique_offer unique (clinic_id, service_id, source_id)
);

create index price_offers_service on price_offers (service_id);
create index price_offers_clinic on price_offers (clinic_id);
create index price_offers_active on price_offers (is_active);
create index price_offers_price on price_offers (price);
create index price_offers_raw_name_trgm
  on price_offers using gin (raw_service_name gin_trgm_ops);

create trigger price_offers_set_updated_at
  before update on price_offers
  for each row execute function set_updated_at();

-- The sparkline source. NEVER hard-deleted (offers are archived, not deleted).
create table price_history (
  id             uuid primary key default gen_random_uuid(),
  price_offer_id uuid not null references price_offers(id) on delete cascade,
  price          numeric not null,
  currency       text not null default 'KZT',
  recorded_at    timestamptz not null default now(),
  parse_run_id   uuid references parse_runs(id) on delete set null
);

create index price_history_offer on price_history (price_offer_id, recorded_at);

-- ===========================================================================
-- NORMALIZATION QUEUE — human-in-the-loop for below-threshold matches
-- ===========================================================================

create table unmatched_queue (
  id                  uuid primary key default gen_random_uuid(),
  raw_extraction_id   uuid references raw_extractions(id) on delete cascade,
  source_id           uuid references sources(id) on delete set null,
  raw_service_name    text,
  suggested_service_id uuid references services_catalog(id) on delete set null,
  confidence          numeric,             -- AI best-guess confidence [0..1]
  status              text not null default 'pending'
                        check (status in ('pending','resolved','ignored')),
  resolved_service_id uuid references services_catalog(id) on delete set null,
  resolved_by         uuid,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index unmatched_queue_status on unmatched_queue (status, created_at);

-- ============================================================
-- FILE: supabase/migrations/20260627093237_rls.sql
-- ============================================================
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
create policy "public read categories"
  on service_categories for select to anon, authenticated using (true);

create policy "public read active services"
  on services_catalog for select to anon, authenticated using (is_active);

create policy "public read active clinics"
  on clinics for select to anon, authenticated using (is_active);

create policy "public read active offers"
  on price_offers for select to anon, authenticated using (is_active);

-- Price history powers the public per-service sparkline (prices only, no PII).
create policy "public read price history"
  on price_history for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- ADMIN READ (authenticated) — operational surfaces
-- ---------------------------------------------------------------------------
create policy "admin read sources"
  on sources for select to authenticated using (true);
create policy "admin read parse_runs"
  on parse_runs for select to authenticated using (true);
create policy "admin read parse_logs"
  on parse_logs for select to authenticated using (true);
create policy "admin read raw_documents"
  on raw_documents for select to authenticated using (true);
create policy "admin read raw_extractions"
  on raw_extractions for select to authenticated using (true);
create policy "admin read unmatched_queue"
  on unmatched_queue for select to authenticated using (true);

-- NOTE: all writes (worker pipeline + admin mutations) go through the
-- service_role key server-side, which bypasses RLS. Granular authenticated
-- write policies arrive when admin auth is wired in a later phase.

-- ============================================================
-- FILE: supabase/seed/seed.sql
-- ============================================================
-- MedServicePrice.kz — Phase 1 — Catalog seed
-- EXACTLY 4 categories (the canonical enum): Лаборатория · Приём врача ·
-- Диагностика · Процедура. 78 normalized services, each with Russian +
-- abbreviation synonyms to power trigram normalization. Above the TZ bar (50+).
-- Idempotent: safe to re-run (on conflict (slug) do nothing).

-- ===========================================================================
-- CATEGORIES (the four canonical values)
-- ===========================================================================
insert into service_categories (name, slug, icon, sort_order) values
  ('Лаборатория',  'laboratoriya', 'test-tube',    1),
  ('Приём врача',  'priem-vracha', 'stethoscope',  2),
  ('Диагностика',  'diagnostika',  'scan',         3),
  ('Процедура',    'procedura',    'syringe',      4)
on conflict (slug) do nothing;

-- ===========================================================================
-- ЛАБОРАТОРИЯ — анализы крови, гормоны, моча и кал, инфекции
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'laboratoriya'),
       v.synonyms
from (values
  -- анализы крови
  ('Общий анализ крови',                'oak',                     array['ОАК','CBC','клинический анализ крови','общий анализ крови']),
  ('Общий анализ крови с лейкоформулой','oak-leykoformula',        array['ОАК с лейкоцитарной формулой','клинический анализ крови развернутый']),
  ('Биохимический анализ крови',        'biohimiya-krovi',         array['биохимия крови','биохимия','BIO']),
  ('Глюкоза',                           'glyukoza',                array['сахар крови','глюкоза крови','glucose']),
  ('Гликированный гемоглобин',          'glikirovannyy-gemoglobin',array['HbA1c','гликогемоглобин']),
  ('Липидный профиль',                  'lipidnyy-profil',         array['липидограмма','холестерин общий','lipid panel']),
  ('Коагулограмма',                     'koagulogramma',           array['гемостазиограмма','свертываемость крови']),
  ('СОЭ',                               'soe',                     array['скорость оседания эритроцитов','ESR']),
  ('Группа крови и резус фактор',       'gruppa-krovi',            array['группа крови','резус фактор','blood type']),
  ('Ферритин',                          'ferritin',                array['ferritin']),
  ('Сывороточное железо',               'zhelezo',                 array['железо','iron','Fe']),
  ('Витамин D',                         'vitamin-d',               array['25-OH витамин D','витамин Д','25(OH)D']),
  ('Витамин B12',                       'vitamin-b12',             array['цианокобаламин','B12']),
  ('C реактивный белок',                'c-reaktivnyy-belok',      array['СРБ','CRP']),
  ('Печеночные пробы',                  'pechenochnye-proby',      array['АЛТ','АСТ','билирубин','печеночный профиль']),
  ('Электролиты крови',                 'elektrolity',             array['калий','натрий','хлор','electrolytes']),
  ('Креатинин',                         'kreatinin',               array['creatinine']),
  ('Мочевина',                          'mochevina',               array['urea']),
  -- гормоны
  ('ТТГ',                'ttg',           array['тиреотропный гормон','TSH','тиротропин']),
  ('Т4 свободный',       't4-svobodnyy',  array['свободный тироксин','FT4','тироксин свободный']),
  ('Т3 свободный',       't3-svobodnyy',  array['свободный трийодтиронин','FT3']),
  ('Пролактин',          'prolaktin',     array['prolactin']),
  ('Кортизол',           'kortizol',      array['cortisol']),
  ('Тестостерон общий',  'testosteron',   array['тестостерон','testosterone']),
  ('Эстрадиол',          'estradiol',     array['estradiol','E2']),
  ('Прогестерон',        'progesteron',   array['progesterone']),
  ('ФСГ',                'fsg',           array['фолликулостимулирующий гормон','FSH']),
  ('ЛГ',                 'lg',            array['лютеинизирующий гормон','LH']),
  ('ХГЧ',                'hgch',          array['хорионический гонадотропин','beta-HCG','ХГЧ бета']),
  ('Инсулин',            'insulin',       array['insulin']),
  ('Антитела к ТПО',     'at-tpo',        array['АТ-ТПО','anti-TPO','антитела к тиреопероксидазе']),
  -- моча и кал
  ('Общий анализ мочи',           'oam',                array['ОАМ','анализ мочи','urinalysis']),
  ('Анализ мочи по Нечипоренко',  'mocha-nechiporenko', array['проба Нечипоренко']),
  ('Суточный анализ мочи',        'mocha-sutochnaya',   array['суточная моча']),
  ('Копрограмма',                 'koprogramma',        array['анализ кала','общий анализ кала']),
  ('Кал на скрытую кровь',        'kal-skrytaya-krov',  array['скрытая кровь в кале','occult blood']),
  ('Соскоб на энтеробиоз',        'soskob-enterobioz',  array['энтеробиоз','яйца глист']),
  -- инфекции
  ('Анализ на ВИЧ',         'vich',           array['ВИЧ','HIV','anti-HIV']),
  ('Гепатит B (HBsAg)',     'gepatit-b',      array['HBsAg','гепатит B']),
  ('Гепатит C (anti-HCV)',  'gepatit-c',      array['anti-HCV','гепатит C']),
  ('Сифилис (RW)',          'sifilis-rw',     array['RW','реакция Вассермана','RPR','сифилис']),
  ('ПЦР на COVID 19',       'pcr-covid',      array['ПЦР коронавирус','SARS-CoV-2 ПЦР','covid тест']),
  ('Антитела к COVID 19',   'antitela-covid', array['IgG covid','антитела коронавирус'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ПРИЁМ ВРАЧА
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'priem-vracha'),
       v.synonyms
from (values
  ('Приём терапевта',         'priem-terapevta',        array['терапевт','консультация терапевта']),
  ('Приём гинеколога',        'priem-ginekologa',       array['гинеколог','консультация гинеколога']),
  ('Приём отоларинголога',    'priem-lor',              array['ЛОР','отоларинголог','лор врач']),
  ('Приём кардиолога',        'priem-kardiologa',       array['кардиолог']),
  ('Приём невролога',         'priem-nevrologa',        array['невролог','невропатолог']),
  ('Приём дерматолога',       'priem-dermatologa',      array['дерматолог','дерматовенеролог']),
  ('Приём уролога',           'priem-urologa',          array['уролог']),
  ('Приём эндокринолога',     'priem-endokrinologa',    array['эндокринолог']),
  ('Приём офтальмолога',      'priem-oftalmologa',      array['офтальмолог','окулист']),
  ('Приём хирурга',           'priem-hirurga',          array['хирург']),
  ('Приём педиатра',          'priem-pediatra',         array['педиатр','детский врач']),
  ('Приём гастроэнтеролога',  'priem-gastroenterologa', array['гастроэнтеролог'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ДИАГНОСТИКА — УЗИ, рентген, КТ, МРТ, ЭКГ, эндоскопия
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'diagnostika'),
       v.synonyms
from (values
  ('УЗИ брюшной полости',     'uzi-bryushnoy-polosti', array['УЗИ ОБП','узи живота']),
  ('УЗИ органов малого таза', 'uzi-malogo-taza',       array['УЗИ ОМТ','узи матки']),
  ('УЗИ щитовидной железы',   'uzi-shchitovidnoy',     array['УЗИ щитовидки']),
  ('УЗИ молочных желёз',      'uzi-molochnyh-zhelez',  array['УЗИ груди']),
  ('УЗИ почек',               'uzi-pochek',            array['узи почек и надпочечников']),
  ('Эхокардиография',         'ehokardiografiya',      array['УЗИ сердца','ЭхоКГ','echo']),
  ('УЗИ при беременности',    'uzi-beremennost',       array['скрининг беременности','фетометрия']),
  ('УЗДГ сосудов',            'uzdg-sosudov',          array['допплерография','УЗИ сосудов']),
  ('ЭКГ',                     'ekg',                   array['электрокардиография','ECG']),
  ('Холтер ЭКГ',              'holter-ekg',            array['суточное мониторирование ЭКГ','холтеровское мониторирование']),
  ('Рентген грудной клетки',  'rentgen-grudnoy-kletki',array['рентген ОГК','флюорография']),
  ('Маммография',             'mammografiya',          array['mammography']),
  ('КТ',                      'kt',                    array['компьютерная томография','CT']),
  ('МРТ',                     'mrt',                   array['магнитно резонансная томография','MRI']),
  ('Гастроскопия',            'gastroskopiya',         array['ФГДС','ФГС','эзофагогастродуоденоскопия']),
  ('Колоноскопия',            'kolonoskopiya',         array['colonoscopy','ФКС'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ПРОЦЕДУРА — инъекции, капельницы, манипуляции
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'procedura'),
       v.synonyms
from (values
  ('Внутримышечная инъекция', 'vnutrimyshechnaya-inekciya', array['укол внутримышечно','в/м инъекция','внутримышечный укол']),
  ('Внутривенная инъекция',   'vnutrivennaya-inekciya',     array['укол внутривенно','в/в инъекция','внутривенный укол']),
  ('Капельница',              'kapelnica',                  array['внутривенное капельное введение','в/в капельно','инфузия']),
  ('Забор крови из вены',     'zabor-krovi-iz-veny',        array['взятие крови','венепункция','забор венозной крови']),
  ('Перевязка',               'perevyazka',                 array['смена повязки']),
  ('Снятие швов',             'snyatie-shvov',              array['удаление швов']),
  ('Промывание уха',          'promyvanie-uha',             array['туалет уха','удаление серной пробки'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

