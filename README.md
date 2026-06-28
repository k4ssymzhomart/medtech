# MedServicePrice.kz

Агрегатор цен на медицинские услуги по всему Казахстану. Пациент ищет одну услугу
и сразу видит все клиники, которые её предлагают, отсортированные по цене.
Концепция: Aviasales, но для медицины.

> Статус: продукт и пайплайн работают. База Supabase наполнена и используется
> сайтом вживую. Воркер парсит реальные источники (table-aware + PDF + Playwright,
> code-only, без платных LLM) и питается из очереди `parse_runs`.

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
Realtime) · Python worker (Docker) · Leaflet (карта) · lucide-react.

## Деплой на Render (прод)

Деплой воспроизводимый — Blueprint в корне репозитория: `render.yaml`. Секретов в
репозитории нет: все ключи помечены `sync: false` и вводятся **только** в дашборде
Render. База Supabase уже наполнена — миграции/сиды для запуска прода не нужны.

**Что создаётся:** один **WEB**-сервис (Next.js, `web/`). Python-**worker** описан в
`render.yaml`, но закомментирован — он **необязателен**: на демо воркер запускается
**локально** (минимум движущихся частей в облаке).

### Шаги (дашборд Render, ~3 мин)
1. Запушить репозиторий на GitHub (ветку, которую деплоите).
2. Render → **New → Blueprint** → подключить репозиторий. Render прочитает
   `render.yaml` и предложит создать сервис **medserviceprice-web**.
3. Ввести переменные веб-сервиса (значения из Supabase → Project Settings → API) —
   таблица ниже. Они помечены `sync: false`, поэтому Render запросит их при первом
   деплое.
4. **Apply / Deploy.** После сборки Render выдаст прод-URL вида
   `https://medserviceprice-web.onrender.com`.

### Env для WEB-сервиса (вставить в дашборде Render)
| Переменная | Значение |
|---|---|
| `SUPABASE_URL` | URL проекта Supabase (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **секретный** service_role ключ (`sb_secret_…`) — только сервер |
| `NEXT_PUBLIC_SUPABASE_URL` | тот же URL проекта |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | публичный anon/publishable ключ (`sb_publishable_…`) |
| `FX_USD_KZT` | `470` — уже задано значением в `render.yaml`, можно не вводить |
| `NODE_VERSION` | `20` — уже задано в `render.yaml` |

Минимум, чтобы сайт ожил: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Сайт читает
живой Supabase server-side; service_role остаётся на сервере (`import "server-only"`)
и в браузер не попадает. Тот же веб-сервис обслуживает админку, чьи операции записи
(`Run now`, переключение флагов, разбор очереди) требуют service_role — поэтому
ключ остаётся на веб-сервисе, а не переключается на anon.

### Воркер для демо — ЛОКАЛЬНО (облачный worker НЕ обязателен)
На очном демо «Run now» показывается с локально запущенным воркером:
```bash
cd worker
pip install -e .            # один раз
python -m app.main          # опрашивает очередь parse_runs в Supabase
```
В админке (`/admin/istochniki`) кнопка **Run now** вставляет задание в `parse_runs`;
локальный воркер забирает его и обрабатывает. Нужен `worker/.env` с `SUPABASE_URL` и
`SUPABASE_SERVICE_ROLE_KEY` (шаблон — `.env.example`). Воркер на старте **не** делает
массовый кравл и **не** грузит `sources.txt` — только опрашивает очередь.

Если нужен облачный воркер: раскомментируйте блок `worker` в `render.yaml` и введите
его env (ниже). Background workers на Render — платный тариф (Starter+).

| Env воркера (если в облако) | Значение |
|---|---|
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ |
| `WORKER_POLL_INTERVAL` | `60` (мягкий интервал; дефолт в коде тоже `60`) |
| `FX_USD_KZT` | `470` |

> `ANTHROPIC_*` не нужны — пайплайн code-only, путь LLM отключён (без вызовов).

### Важно для демо
- **Free-tier «засыпает».** Бесплатный веб-сервис Render останавливается при простое
  (~50 c холодный старт). Откройте URL за минуту до показа, чтобы прогреть, либо
  поднимите тариф до `starter`.
- **Регион.** В `render.yaml` стоит `frankfurt` (ближе всего к Казахстану). Если ваш
  проект Supabase в другом регионе — поставьте тот же регион веб-сервису, чтобы
  снизить задержку server-side запросов.
- **Секреты — только в дашборде.** В репозитории их нет. После демо обновите ключи
  (Supabase → Project Settings → API → Roll keys), если они где-то засветились.
- **`/admin` без авторизации.** Демо-сборка открывает админку без логина — осознанный
  компромисс ради дедлайна. Не публикуйте ссылку на `/admin`; закрыть её (пароль/
  Basic-Auth) имеет смысл после демо — это уже доработка, не финализация.

> Альтернатива (Vercel) описана в `DEPLOY.md`. Для Render используйте этот раздел.

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

## 4. Воркер (локальный поллер)
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
