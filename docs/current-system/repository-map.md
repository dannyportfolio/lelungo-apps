# Repository map

## Application entry points

- `src/app/layout.tsx`: root layout and metadata.
- `src/app/page.tsx`: public deal-discovery home page.
- `src/app/api/deals/route.ts`: mock-deal enrichment endpoint.
- `src/app/api/track-click/route.ts`: validated click analytics endpoint.
- `proxy.ts`: QA route protection and normalized wildcard-subdomain extraction.

## Major areas

- `src/app`: Next.js App Router transport and pages.
- `src/components`: legacy travel-deal presentation components.
- `src/internal/qa`: internal QA dashboard UI; hidden in production unless enabled.
- `src/lib`: legacy mock data, affiliate integration, Supabase clients, formatting, and UI helpers.
- `src/modules/tenancy`: host parsing, tenant lookup, context, and tenant-scoped repository helpers.
- `src/modules/identity`: initial role catalog and permission checks.
- `src/shared/database`: server-only Prisma client lifecycle.
- `prisma`: PostgreSQL schema and additive tenancy migration.
- `supabase/schema.sql`: legacy click-analytics table definition.
- `tests/unit`: tenancy, authorization, and validation tests.
- `tests/e2e`: browser checks for the legacy home page.
- `docs`, `openspec`, `AGENTS.md`: repository-owned engineering memory.

There is no separate backend service, worker, webhook receiver, scheduled job, storage module, payment module, booking engine, or PMS UI. Next.js route handlers are the current backend boundary.
