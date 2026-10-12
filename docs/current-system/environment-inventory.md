# Environment inventory

Never record values here.

| Variable                                       | Required                                            | Purpose                                                                                         | Used by                   |
| ---------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| `DATABASE_URL`                                 | For Prisma runtime/migrations                       | PostgreSQL connection                                                                           | Prisma                    |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Auth/protected paths; optional for public prototype | Public project URL; HTTPS except loopback development                                           | Supabase clients/API      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                | With Supabase URL                                   | Public anon/publishable key                                                                     | Supabase clients          |
| `SUPABASE_SERVICE_ROLE_KEY`                    | For legacy click persistence only                   | Privileged server key; never used for staff authentication                                      | track-click/server client |
| `TEST_DATABASE_URL`                            | Integration tests only                              | Dedicated disposable PostgreSQL with a test-marked database name, different from `DATABASE_URL` | Vitest integration setup  |
| `TRAVELOKA_BASE_URL`                           | For affiliate fetch                                 | Server API base URL                                                                             | travel API helper         |
| `TRAVELOKA_APP_KEY`                            | For affiliate fetch                                 | Server credential                                                                               | travel API helper         |
| `NEXT_PUBLIC_SITE_URL`                         | Optional                                            | Canonical public URL                                                                            | root layout               |
| `NEXT_PUBLIC_APP_ENV`                          | Optional                                            | Public environment label                                                                        | application config        |
| `NEXT_PUBLIC_ENABLE_QA`                        | Optional                                            | Exposes internal QA route                                                                       | proxy/QA page             |
| `LELUNGO_ROOT_DOMAIN`                          | Production tenancy                                  | Wildcard root domain                                                                            | proxy                     |
| `LELUNGO_LOCAL_ROOT_DOMAIN`                    | Optional                                            | Local tenant root                                                                               | proxy                     |
| `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS`            | Optional                                            | Allow local subdomain parsing                                                                   | proxy                     |
| `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` | Vercel-provided                                     | Metadata base URL fallback                                                                      | root layout               |
| `BASE_URL`                                     | E2E only                                            | Browser test target                                                                             | Playwright                |
| `E2E_SUPABASE_URL`                             | Optional E2E override                               | External test auth endpoint; built-in local fake is the default                                 | Playwright                |
| `E2E_SUPABASE_PUBLIC_KEY`                      | With E2E override                                   | Public test-provider key                                                                        | Playwright                |
| `PLAYWRIGHT_SKIP_WEBSERVER`                    | Optional E2E                                        | Target already-running app/auth servers                                                         | Playwright                |
| `PLAYWRIGHT_USE_PRODUCTION_SERVER`             | Optional E2E                                        | Use a prebuilt `next start` server instead of `next dev`                                        | Playwright                |

Agent gateway variables live only in `config/agentic/env.example`; they are not application runtime configuration.

Phase 2 introduces no new secret or infrastructure variable. Property staff routes and the server-side published-identity resolver require the existing PostgreSQL `DATABASE_URL`; integration and built-in Property E2E fixtures require the separately validated disposable `TEST_DATABASE_URL`. A configured Supabase provider remains required for `/auth/*` and `/staff*`. Do not place either database URL or a service-role key in `NEXT_PUBLIC_*`.
