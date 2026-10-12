# Lelungo Incremental Refactor Plan

## Guiding decisions

- Preserve the stable Next.js, TypeScript, Tailwind, component, and test foundations.
- Replace the affiliate product domain behind a modular-monolith architecture; do not disguise mock affiliate data as PMS data.
- Use npm and Node.js LTS in CI/production. Do not add Ollama, WSL, pnpm, Yarn, or local AI runtimes.
- Make database changes additive and versioned. Never put tenant identity under browser control.
- Stop for review after every phase; the current repository is at the end of Phase 0.

## Phase 0 — completed audit

Outputs: `CODEBASE_AUDIT.md`, this plan, target architecture, and ADR-001. Quality baseline: lint/typecheck/build passed when invoked through direct Node entry points; isolated E2E: 7 passed and 1 flaky test that passed on retry. No production code or schema changed.

## Phase 1 — SaaS foundation (first safe batch)

Deliverables:

1. Introduce a repository-standard Prisma/PostgreSQL migration workflow and environment validation.
2. Add `Tenant`, `TenantDomain`, platform user type, `StaffMembership`, `Role`, `Permission`, `RolePermission`, `ProvisioningJob`, and immutable `AuditLog`.
3. Implement canonical subdomain normalization/reserved-name validation and server-side host resolution.
4. Introduce an authenticated `ActorContext` and `TenantContext`; every tenant query must consume the latter rather than a client-supplied tenant ID.
5. Implement permission checks in page, action/route, service, and repository layers; add protected platform-admin route shells.
6. Add idempotent tenant provisioning that creates only the initial tenant/default configuration, records an audit log, and can safely retry.

Acceptance criteria:

- Cross-tenant reads and mutations are rejected in integration tests.
- Platform roles and tenant roles cannot be substituted through request input.
- The host resolver rejects malformed/reserved domains and handles localhost development explicitly.
- Audit events redact secrets and identifiers designated sensitive.

Review gate: migration review, tenant-isolation tests, lint, typecheck, unit/integration tests, production build, and a commit recommendation.

## Phase 2 — subscription business model

Build `SubscriptionPlan`, `Subscription`, setup-fee and recurring `SubscriptionInvoice`, `SubscriptionPayment`, grace period, suspension, reactivation, and tenant billing screens. Keep all models and invoice sequences separate from guest accommodation revenue. Start with manual payment confirmation and an adapter-ready boundary—no untested payment gateway claims.

## Phase 3 — PMS core

Add `Property`, building/floor, `RoomType`, `RoomUnit`, `Guest`, booking aggregate, rate plans/rules, availability, room assignments, and the tape chart. Implement service-level state machines and transactions before the visual calendar. Database constraints and locking/availability holds must prevent the final-room race condition.

## Phase 4 — operations

Add front desk workflows, check-in/out, guest payments/invoices/refunds, housekeeping, maintenance, and tenant operational reporting. Checkout must atomically release a room and set housekeeping state to dirty. Restrict housekeeping data access by permission.

## Phase 5 — public booking engine

Create tenant-branded public pages resolved from the same inventory/pricing services used by PMS. Add availability search, server-calculated price review, booking creation, guest-payment adapters, confirmation, and booking lookup. Do not create a second inventory source.

## Phase 6 — guest self check-in

Use an expiring reservation-scoped token, secondary verification, privacy-aware arrival data, acceptance records, and status. Keep identity files in private storage behind signed, short-lived URLs, strict MIME/size validation, retention policies, and audit access records.

## Phase 7 — integrations and automation

Create provider-agnostic notification and smart-lock adapter interfaces, idempotent background jobs, delivery/command tracking, webhooks with signature verification, retries, failure queues, and manual fallback. Implement a provider only when real credentials, documentation, and tests are available.

## Phase 8 — production hardening

Complete CSP/secure headers, CSRF/rate limiting, file security, observability, error monitoring, backups/restores, recovery drills, migration safety checks, tenancy performance checks, CI deployment gates, and all required product/security/operations documentation.

## Dependency order

```text
tenant context + RBAC + audit + migrations
  -> subscription boundary
  -> property / inventory / availability / booking state machine
  -> front desk / payments / housekeeping / reporting
  -> public booking
  -> self check-in
  -> integrations
  -> production hardening
```

## Explicit non-goals for Phase 1

- No migration of mock affiliate data to booking data.
- No direct booking/payment UI detached from server-side inventory.
- No identity uploads, smart-lock PINs, WhatsApp credentials, external OTAs, or payment provider implementation.
- No tenant impersonation until platform roles, explicit authorization, visible warning, and audit events exist.

## Risk controls

| Risk | Control |
| --- | --- |
| Database drift | Baseline deployed schema, additive migrations, staging rehearsal, backup and forward-fix plan. |
| Tenant leakage | Mandatory tenant context in repository APIs, explicit selects/DTOs, RLS as defense in depth, cross-tenant tests. |
| Scope expansion | Review gate after each phase and retain the old affiliate UI until a deliberate product-retirement decision. |
| Payment liability | Separate bounded contexts, numbering, ledgers, credentials, and provider adapters. |
| Migration rollback | Expand/contract changes; never destructive migration in automatic deployment. |

## Phase 1 implementation status

The tenant foundation is implemented and awaiting review. It adds an additive Prisma migration, server-derived wildcard subdomain resolution, tenant-context and tenant-scope helpers, staff memberships, and the initial platform/tenant RBAC catalog. Subscription billing, booking, smart locks, WhatsApp, and self check-in remain intentionally out of scope.
