# Environment setup

Use `.env.example` as the variable inventory, never as a credential store. Local values go in ignored `.env.local`; CI/staging/production use scoped secret stores. Keep separate database and provider credentials per environment. Service-role keys are server-only and must be rotated if exposed.

Validate required configuration at startup of the relevant integration. Do not invent placeholder production credentials or copy production data into development. Agent model-routing variables are development tooling and belong outside application deployment configuration.

Phase 2 reuses `DATABASE_URL` for Property, Property-scope, catalog, and audit persistence and adds no application secret. `/auth/*` and `/staff*` still require both public Supabase variables, while the built-in Property integration/E2E fixtures require a separately named disposable `TEST_DATABASE_URL`. Its database name must contain a standalone test marker and must not resolve to the same host/port/database target as `DATABASE_URL`. Never expose either database URL through a `NEXT_PUBLIC_*` variable.
