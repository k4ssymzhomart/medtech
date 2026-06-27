# MedServicePrice.kz

Агрегатор цен на медицинские услуги по всему Казахстану. Пациент ищет одну услугу
и сразу видит все клиники, которые её предлагают, отсортированные по цене.
Концепция: Aviasales, но для медицины.

> Phase 1 foundation. The data pipeline (worker) is a runnable skeleton only;
> parsing of real sources lands in the next focused pass.

## Структура

```
medtech/
├── web/        Next.js (App Router, TS, Tailwind v4) — лендинг, продукт, админка
├── worker/     Python — движок парсинга (Docker). Только исходящий доступ к Supabase
├── supabase/   миграции схемы + сид каталога (50+ услуг)
└── PHASE_1_ARCHITECTURE.md   единый источник правды по архитектуре
```

## Стек
Next.js · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage +
Realtime) · Python worker (Docker) · Leaflet (карта, позже) · lucide-react.

## Требования
- Node.js 20+ и npm
- Python 3.11+ (для воркера) или Docker
- Аккаунт Supabase с расширениями `pg_trgm`, `vector`, `postgis`

## 1. Настройка окружения
Скопируйте `.env.example` и заполните ключами Supabase:
- `web/.env.local` — для веб приложения
- `worker/.env` — для воркера

## 2. База данных (Supabase)
Схема и сид лежат в `supabase/`. Сетевые порты Postgres (5432/6543) часто закрыты,
поэтому миграции применяются через Management API по HTTPS либо через SQL Editor.

**Вариант A — Management API (HTTPS, нужен personal access token `sbp_...`):**
```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx
export REF=YOUR-PROJECT-ref
for f in supabase/migrations/*.sql supabase/seed/seed.sql; do
  jq -Rs '{query: .}' "$f" \
    | curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" --data @- ;
done
```

**Вариант B — SQL Editor:** откройте дашборд Supabase, вставьте по очереди файлы
из `supabase/migrations/` (по возрастанию имени), затем `supabase/seed/seed.sql`.

**Вариант C — Supabase CLI (если доступны порты БД):**
```bash
supabase link --project-ref YOUR-PROJECT-ref
supabase db push
```

После применения сгенерируйте типы:
```bash
supabase gen types typescript --project-id YOUR-PROJECT-ref > web/lib/supabase/types.ts
```

## 3. Веб приложение
```bash
cd web
npm install
npm run dev   # http://localhost:3000
```
Маршруты: `/` (лендинг), `/poisk` (поиск), `/klinika/[id]`, `/sravnenie`, `/admin/*`.

## 4. Воркер (скелет)
```bash
cd worker
pip install -e .
python -m app.main          # опрашивает очередь parse_runs
# или через Docker:
docker compose up worker
```

## Дизайн
Светлая тема, монохром плюс один акцент `#0070F3`, острые углы, границы вместо
теней, Manrope плюс JetBrains Mono, 100% русский интерфейс. Полный свод правил:
`DESIGN.md`.
