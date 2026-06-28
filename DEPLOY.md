# Deploy — MedServicePrice.kz

**What deploys:** the Next.js app in `web/` → Vercel, pointing at the already-live Supabase
project (`eyeberctvlwgtlptuzru`). The DB is live and populated, so **no migration or data
step is needed** to go live. The Python `worker/` (parser + Playwright + 2gis) is a local
data pipeline — it is NOT deployed; its output already lives in Supabase.

Repo: `github.com/k4ssymzhomart/medtech` (branch `main`). The app is monorepo-style — the
deployable project is the `web/` subdirectory.

---

## Fastest path — Vercel dashboard (~3 min, no local CLI)

1. vercel.com → **Add New → Project → Import Git Repository** → pick `k4ssymzhomart/medtech`.
2. **Root Directory: `web`** (click Edit, choose `web`). Framework auto-detects **Next.js**.
3. Add the **Environment Variables** below (Production scope) — paste the values you already
   have (they're in `web/.env.local` and the Supabase dashboard → Project Settings → API).
4. **Deploy.** Done — Vercel gives you the live URL.

### CLI alternative
```bash
cd web
npx vercel login        # interactive
npx vercel --prod       # set Root Directory = . when prompted, add env vars
```

---

## Environment variables (set these on Vercel)

| Variable | Value (from your Supabase keys) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Project URL (`https://eyeberctvlwgtlptuzru.supabase.co`) |
| `SUPABASE_URL` | same Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable / anon** key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret / service_role** key (`sb_secret_…`) — server-only, never exposed to the browser |
| `FX_USD_KZT` | `470` (USD→KZT rate used on write/resolve) |

These mirror `web/.env.local` exactly (which already works locally). The service key is read
only in server code (`lib/supabase/server.ts`); `NEXT_PUBLIC_*` are safe for the browser.

---

## After deploy
- Verify: open `/poisk?q=Глюкоза` (ranked clinics), `/` (landing), a clinic page, `/admin`.
- **Rotate the keys** once the demo is done — they were shared over chat. Supabase dashboard →
  Project Settings → API → roll keys, then update the Vercel env vars.
- (Optional) Supabase CLI is only needed to manage migrations, not to run the site:
  `supabase login && supabase link --project-ref eyeberctvlwgtlptuzru`. The schema is already
  applied; re-applying is unnecessary (and `supabase/apply_all.sql` is idempotent if you do).
