# Repository map

## Application entry points

- `src/app/layout.tsx`: root layout and metadata.
- `src/app/page.tsx`: public deal-discovery home page.
- `src/app/api/deals/route.ts`: mock-deal enrichment endpoint.
- `src/app/api/track-click/route.ts`: validated click analytics endpoint.
- `src/app/auth/callback/route.ts`: validated provider code-exchange callback.
- `src/app/staff/sign-in`: minimal staff sign-in page and server action.
- `src/app/staff`: protected staff landing and sign-out action.
- `src/app/staff/properties`: protected bounded Property list, create, detail/edit, and lifecycle Server Components/Actions.
- `src/app/staff/property-access`: protected minimum-field membership scope list and access-mode/grant administration.
- `proxy.ts`: QA route protection, normalized wildcard-subdomain extraction, trusted tenant-header overwrite, and optimistic auth-cookie refresh.

## Major areas

- `src/app`: Next.js App Router transport and pages.
- `src/components`: legacy travel-deal presentation components.
- `src/internal/qa`: internal QA dashboard UI; hidden in production unless enabled.
- `src/lib`: legacy mock data, affiliate integration, Supabase server/proxy clients, formatting, and UI helpers.
- `src/modules/tenancy`: host parsing, tenant lookup, context, and tenant-scoped repository helpers.
- `src/modules/identity`: provider-verified subject port/adapter, authentication configuration, safe staff redirects, role catalog, membership authorization, Property permission/scope contracts, bound cursors, server-only repository, and scope-administration service.
- `src/modules/properties`: Property schemas/domain rules, DTOs, cursors, catalog service, server-only Prisma repository, and transactional application services.
- `src/modules/audit`: narrow Phase 2 audit actions/metadata contract and server-only append adapter; no audit query or mutation-after-append API.
- `src/shared/database`: server-only Prisma client lifecycle.
- `prisma`: PostgreSQL schema, initial tenancy migration, and additive Phase 2 Property/authorization-integrity migration.
- `supabase/schema.sql`: legacy click-analytics table definition.
- `tests/unit`: tenancy, identity/authentication, Proxy session, staff action/route, Property/scope/audit schemas and domain rules, authorization order, DTO minimization, cursor binding, and validation tests.
- `tests/integration`: disposable-PostgreSQL tenancy and Phase 2 migration/catalog/constraint/isolation/OCC/atomic-audit tests; five individually invoked files passed 29/29 on PostgreSQL 16 at the current checkpoint.
- `tests/e2e`: legacy browser checks plus a tenant-host staff flow covering authentication denial, permission denial, selected-Property isolation, create validation, stale conflicts, and minimum-field scope administration. Focused real tenant-host authentication and missing-permission scenarios passed; the complete seven-scenario Property rerun is still incomplete.
- `docs`, `openspec`, `AGENTS.md`: repository-owned engineering memory.

The Phase 2 PostgreSQL integration evidence is local and disposable, not staging, production, or remote CI evidence. The focused browser results are not evidence that the complete Property E2E suite passes. There is no separate backend service, worker, webhook receiver, scheduled job, storage module, room/inventory/pricing module, payment module, booking engine, or public Property/booking route. Next.js Server Actions, Route Handlers, and Server Components remain the application/transport boundaries.
