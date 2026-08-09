# Lelungo Phase 0 Codebase Audit

Audit date: 2026-08-08  
Scope: current working tree, no production-code changes.

## Executive summary

The repository is a small, frontend-first travel-deal affiliate prototype, not an accommodation PMS or booking engine. It has a sound baseline for a Next.js App Router UI (TypeScript strict mode, Tailwind, reusable visual components, Supabase client helpers, Playwright), but none of the required SaaS tenancy, booking, operations, billing, authorization, or secure guest-data capabilities exists. The correct path is an incremental replacement of the product domain behind a retained application shell—not an in-place extension of the affiliate-deal data model.

The first implementation batch should establish tenant resolution, authenticated platform/tenant staff context, role and permission primitives, an auditable tenant table, and a migration baseline. It must not yet expose tenant subdomains to public booking, process guest payments, or collect identity documents.

## Current-state architecture

| Area | Evidence | Current state |
| --- | --- | --- |
| Runtime and UI | `package.json`, `src/app` | Next.js 16.2.11 App Router, React 19.2.8, TypeScript strict, Tailwind 3, Framer Motion, Lucide, Recharts. Node 25.9.0 is installed locally; production CI specifies Node 22. |
| Routing | `src/app` | `/`, `/dashboard`, `/qa`, `/api/deals`, `/api/track-click`, plus generated Open Graph image. There are no dynamic tenant routes, admin routes, booking, check-in, or staff routes. |
| Data | `supabase/schema.sql` | Supabase PostgreSQL SQL bootstrap with `clicks`, `user_preferences`, and two analytics views. No Prisma, migration history, tenant, property, booking, invoice, payment, or operational data model. |
| API | `src/app/api` | `GET /api/deals` returns enriched hard-coded data. `POST /api/track-click` records affiliate click data via Supabase service role when configured. |
| Authentication and authorization | `src/lib/supabase/*` | Browser and server Supabase clients are present, but no sign-in flow, session validation, route guard, user profile, RBAC, tenant membership, or authorization check uses them. |
| Booking | `src/lib/mock-data.ts`, `src/components/DealCard.tsx` | Mock flight/hotel deals and outbound affiliate links only. “Book Now” opens external partner URLs; no inventory, availability, reservation, payment, or confirmation exists. |
| Deployment | `.github/workflows/*`, `next.config.js` | GitHub Actions build/lint workflow and Playwright workflow. No Vercel configuration, database migration deployment, environment separation, backup, monitoring, or health check. |

## Folder and reusable-module inventory

```text
src/app/                 App Router pages and two API handlers
src/components/          Landing-page UI, theme, cards, filters, primitives
src/internal/qa/         Mock QA dashboard and charts
src/lib/                 Mock deal engine, formatting, Supabase helpers, optional Traveloka wrapper
src/hooks/               Intersection-observer animation hook
tests/e2e/               8 Playwright UI tests
supabase/schema.sql      Manual SQL bootstrap script
.github/workflows/       CI and Playwright workflows
```

Retain and repurpose:

- `src/components/ui/button.tsx`, `badge.tsx`, theme provider/toggle, error boundary, hydration utilities, and `src/lib/format.ts` as candidate design-system foundations.
- The current App Router, strict TypeScript configuration, Tailwind setup, ESLint configuration, Playwright configuration, `.gitignore`, and GitHub Actions scaffolding.
- Supabase as a possible managed PostgreSQL and object-storage provider, provided migrations and server-only access patterns are introduced deliberately.

Deprecate from the product domain (retain only if a separate affiliate product remains in scope):

- `src/lib/mock-data.ts`, `src/lib/insight-engine.ts`, `src/lib/api/traveloka.ts`, `Deal*`, `FilterBar`, `SmartSearchBar`, `AIInsightFeed`, affiliate click tracking, and the current dashboard.
- `src/internal/qa` mock test-result dashboard; it represents data as if operational without a backing system.

## Product and blueprint gap analysis

| Blueprint capability | Status | Gap |
| --- | --- | --- |
| Multi-tenancy / subdomains | Missing | No tenant entity, resolver, host validation, subdomain routing, or tenant-scoped access. |
| Platform administration | Missing | No platform staff identities, plans, provisioning, billing, suspension, impersonation, or audit log. |
| Tenant PMS | Missing | No property, rooms, guests, bookings, prices, front desk, housekeeping, maintenance, reports, or integrations. |
| Public booking engine | Missing | Current UI links to OTAs; it has no direct booking or shared inventory. |
| Guest self check-in | Missing | No reservation tokens, identity workflow, private-file storage, or check-in state. |
| Financial separation | Missing | Neither subscription nor guest-payment models exist. |
| Security architecture | Missing | No tenant-aware authorization, DTO layer, rate limiting, CSRF strategy, webhook verification, audit logging, or private uploads. |

## Database and migration assessment

The SQL file is a manually executable bootstrap, not a versioned migration system. `clicks` uses an enum-like check and RLS, while `user_preferences` is owner-scoped through `auth.uid()`. The two analytic views are affiliate-specific.

Migration risks:

1. There is no Prisma schema or migration directory, so the deployed Supabase state may differ from the repository.
2. Converting an existing shared database directly to PMS tables would risk untracked production drift. Establish an introspected baseline and additive migrations first.
3. The current public `clicks` insert policy is intentionally broad and must remain isolated from future tenant-critical tables.
4. A tenant ID retrofit must be done with non-null constraints only after backfill and verification; never infer a tenant from browser input.

Proposed database model begins with `Tenant`, `TenantDomain`, `StaffMembership`, `Role`, `Permission`, `RolePermission`, `SubscriptionPlan`, `Subscription`, `ProvisioningJob`, and `AuditLog`. Phase 3 adds `Property`, `RoomType`, `RoomUnit`, `Guest`, `Booking`, `BookingRoom`, `RoomAssignment`, and availability-protection records. Guest accommodation finance and Lelungo subscription billing remain separate bounded contexts and tables.

## Security risks and controls gap

This was a source review; the full automated security-scan workflow could not run because neither `python` nor `py` is installed in this Windows environment. No secrets were printed or modified.

| Priority | Evidence | Risk | Required remediation phase |
| --- | --- | --- | --- |
| High | `src/lib/api/traveloka.ts` | The variable named `NEXT_PUBLIC_API_APP_KEY_TRAVELOKA_URL` is embedded in client-eligible environment space. If used with a real key, it would expose that credential to browsers. The module is currently unreferenced. | Phase 0.5 cleanup / Phase 1 configuration boundary |
| Medium | `src/app/api/track-click/route.ts`, `supabase/schema.sql` | Unauthenticated, unvalidated click ingestion permits arbitrary destination/deal/price data and unbounded event volume; direct Supabase anonymous inserts are also allowed by policy. This corrupts analytics and can create database spend. | Retire with affiliate feature or add strict Zod validation, bounds, rate limit, and server-side deal lookup |
| Medium | `src/lib/supabase/server.ts` | The service-role client bypasses RLS and lacks a `server-only` import or a repository/data-access boundary. Future accidental use in tenant routes could bypass isolation. | Phase 1 |
| Medium | `src/app/dashboard/page.tsx`, `src/app/qa/page.tsx` | Operational-looking dashboards are publicly reachable and unauthenticated. They currently expose mock data only, but creating real functionality in these routes would be an authorization regression. | Replace during Phase 1 |
| Medium | All routes | No authentication, RBAC, tenant scoping, rate limiting, CSRF/webhook verification, audit logging, or structured security logging exists. | Phase 1 onward |
| Low | `src/app/layout.tsx`, `src/lib/theme.ts` | Inline theme script is deliberate and currently derives from a static source, but requires a CSP strategy before production hardening. | Phase 8 |

There is no current cross-tenant leakage because there are no tenants or tenant data. The absence of isolation is nevertheless the central pre-production security blocker.

## Code quality, tests, and deployment findings

- `node_modules/.bin` contains the expected executables, but `npm run lint` and `npm run build` cannot resolve them in this local shell. Direct Node invocation passed lint and TypeScript: `node node_modules/eslint/bin/eslint.js .`, `next typegen`, then `tsc --noEmit`.
- The requested `npm run typecheck`, `npm run test`, and `npm run test:e2e` scripts are absent. The project instead has `type-check`, and Playwright must be invoked directly or through `npx`.
- Production build passed: Next.js 16.2.11 compiled, type-checked, and generated all eight static pages/routes.
- The first Playwright attempt was invalid because port 3000 belonged to an unrelated local application. An isolated port-3001 execution yielded 7 passing tests and 1 flaky rapid-click filter test (it timed out once, then passed on retry). The suite only tests the old affiliate UI.
- CI currently runs TypeScript via `npx tsc`, lint, build, and Playwright. It does not run a named unit-test command, migration check, security scan, typecheck script, or a reliable isolated test port. The Lighthouse step is non-blocking and points at a Next server build output rather than a served app.
- `README.md` is obsolete: it calls the app an AI travel affiliate platform, says Next.js 14, and permits Bun. Several source and README strings show mojibake, indicating an encoding-quality issue.

## Architecture recommendation

Adopt a modular monolith: one Next.js App Router application with route handlers/server actions, domain services, tenant-safe repositories, Prisma migrations over PostgreSQL, and bounded asynchronous adapters/jobs. See [TARGET_ARCHITECTURE.md](../architecture/TARGET_ARCHITECTURE.md) and [ADR-001-SAAS-MULTI-TENANCY.md](../architecture/ADR-001-SAAS-MULTI-TENANCY.md).

## Smallest safe implementation batch

1. Normalize scripts to `dev`, `lint`, `typecheck`, `test`, `test:e2e`, and `build`; fix the local npm-binary resolution separately from repository behavior.
2. Add Prisma and a non-destructive baseline migration process; do not alter existing Supabase tables yet.
3. Add tenant primitives, subdomain normalization/resolution, platform/tenant staff membership, permissions, audit log, and server-derived `TenantContext`.
4. Guard new `/admin` surfaces with authorization and add a safe local host-routing strategy.
5. Add focused tests for subdomain validation, tenant isolation helper behavior, and permission enforcement.

Files expected in that next batch: `package.json`, Prisma schema/migrations, `proxy.ts`, new `src/modules/{identity,tenancy,audit}`, new route layouts, `.env.example`, tests, and architecture/security documentation. Existing affiliate components and `supabase/schema.sql` should not be deleted in the first batch.

## Rollback approach

Use additive, reversible migrations, feature-gated routes, and separate staging/production databases. Each migration requires a pre-migration backup, an explicit down/forward-fix plan, and a verification query. Tenant suspension must be reversible and never delete operational or booking records. No production database has been changed by this audit.
