# Environment inventory

Never record values here.

| Variable | Required | Purpose | Used by |
| --- | --- | --- | --- |
| `DATABASE_URL` | For Prisma runtime/migrations | PostgreSQL connection | Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | For Supabase paths | Public project URL | Supabase clients/API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For browser/session helper | Public anon key | Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | For click persistence | Privileged server key | track-click/server client |
| `TRAVELOKA_BASE_URL` | For affiliate fetch | Server API base URL | travel API helper |
| `TRAVELOKA_APP_KEY` | For affiliate fetch | Server credential | travel API helper |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical public URL | root layout |
| `NEXT_PUBLIC_APP_ENV` | Optional | Public environment label | application config |
| `NEXT_PUBLIC_ENABLE_QA` | Optional | Exposes internal QA route | proxy/QA page |
| `LELUNGO_ROOT_DOMAIN` | Production tenancy | Wildcard root domain | proxy |
| `LELUNGO_LOCAL_ROOT_DOMAIN` | Optional | Local tenant root | proxy |
| `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS` | Optional | Allow local subdomain parsing | proxy |
| `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` | Vercel-provided | Metadata base URL fallback | root layout |
| `BASE_URL` | E2E only | Browser test target | Playwright |

Agent gateway variables live only in `config/agentic/env.example`; they are not application runtime configuration.
