# Local development

1. Install Node.js 22+ and npm.
2. Run `npm install`.
3. Copy `.env.example` to ignored `.env.local` and set only required local values.
4. Run `npm run prisma:generate`; a database is optional only while using public prototype flows.
5. To use staff Property flows, point `DATABASE_URL` at an isolated local PostgreSQL database and apply committed migrations with `node ./node_modules/prisma/build/index.js migrate deploy`. Do not use `db push` as a migration substitute.
6. Run `npm run dev` and open `http://localhost:3000`.

Public prototype routes can run without authentication configuration when both public Supabase variables are absent. `/auth/*` and `/staff*` require a valid `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY`; partial or malformed configuration fails closed. Provider URLs require HTTPS except for localhost/loopback development.

For local tenant staff flows, enable `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS`, use `<tenant>.localhost:3000/staff`, and provide a migrated Prisma `DATABASE_URL` containing the matching Tenant, domain, active membership, same-Tenant role assignment, explicit Property access mode, and scope version. Sign-in verifies provider identity but never creates or activates a membership. `/staff/properties` and `/staff/property-access` reauthorize on the server; route/form identifiers never establish Tenant or Property authority. Do not weaken production host rules.

For database integration tests, create a disposable database whose name contains a standalone test marker, set it only as `TEST_DATABASE_URL`, and run `npm run test:integration`. The suite maps that validated URL into its own process, applies committed migrations, and cleans only exact test-owned records. Never reuse the normal `DATABASE_URL` or any deployed database. The Phase 2 Property E2E fixture also needs the migrated disposable target. Before handoff run format, Prisma/OpenSpec validation, lint, typecheck, relevant unit/integration/E2E tests, and build.
