# Current architecture

## Runtime

Lelungo is a Next.js 16 App Router application on React 19 and strict TypeScript. Node.js 22 is the supported baseline and npm is the only package manager. The frontend and server route handlers deploy as one unit.

## Request paths

```text
Public request
-> Next.js Proxy tenant-host normalization
-> App Router page/API
-> legacy library or domain module

Protected staff request
-> Next.js Proxy tenant-host normalization and optimistic Supabase cookie refresh
-> Server Component, Server Action, or Route Handler
-> authoritative Supabase auth.getUser()
-> trusted tenant resolution
-> ACTIVE same-tenant membership, explicit permission, and Property access mode/grant
-> module application service
-> tenant-leading Prisma/PostgreSQL transaction plus required audit evidence
```

The Proxy always overwrites or removes an incoming `x-lelungo-tenant-subdomain` value from the actual hostname. Its cookie refresh is optimistic session maintenance, not proof of identity or tenant authority. Server code resolves the normalized subdomain through `TenantRepository`; only a UUID subject returned by authoritative provider verification can be composed with an active same-tenant membership. The client cannot establish tenant authority by submitting a tenant or actor ID.

## Implemented boundaries

- Presentation: Server and Client Components under `src/app` and `src/components`.
- Transport: Next.js route handlers.
- Domain foundation: `src/modules/tenancy`, `src/modules/identity`, and `src/modules/properties`.
- Accountability boundary: the narrow `src/modules/audit` append-only write contract used by Phase 2 mutations.
- Persistence: Prisma for tenancy and RBAC records; Supabase SDK for staff authentication and legacy click analytics.
- Validation: Zod at external boundaries plus typed tenancy/RBAC rules.
- Authentication: request-bound Supabase sign-in, code exchange, cookie refresh, authoritative subject verification, and sign-out.
- Authorization: trusted tenant context and active same-tenant membership, explicit permission, and explicit `ALL_PROPERTIES` or same-tenant `SELECTED_PROPERTIES` grant before protected Property repository work. Property creation and scope administration require organization-wide access.
- Property application: strict create/update/lifecycle/list/public-resolution contracts, canonical IANA timezone and catalog validation, optimistic versions, purpose-specific DTO projections, and transaction-scoped repositories.
- Staff transport: protected Property list/create/detail/edit/lifecycle routes under `/staff/properties` and minimum-field Property-scope administration under `/staff/property-access`. Server Actions repeat authentication, tenant resolution, permission, and scope checks.

Authentication and staff Property paths use private/no-store responses. The Phase 2 source and forward migration are present in the working tree. Five individually invoked integration files passed 29/29 tests (`9 + 8 + 2 + 8 + 2`) against disposable PostgreSQL 16, covering the tenancy baseline plus Phase 2 migration, constraint, isolation, optimistic-concurrency, catalog, and audit behavior. Focused real tenant-host authentication and missing-permission Chromium scenarios also passed after the Proxy/Host normalization correction. The complete seven-scenario Property E2E rerun has not completed, so the focused browser results are not a full-suite pass.

Live-provider production configuration, registration/invitation, MFA, password recovery, tenant selection across hostnames, a recognizable staff directory, rooms/units, inventory, pricing, reservations, guests, payments, housekeeping, media, custom domains, public marketplace routes, and broad audit browsing remain deferred or unverified.
