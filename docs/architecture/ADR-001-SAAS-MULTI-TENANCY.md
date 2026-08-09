# ADR-001: Tenant-Scoped Modular Monolith

- Status: Accepted
- Date: 2026-08-08
- Decision owners: Lelungo engineering

## Context

Lelungo must serve independent accommodation businesses through tenant subdomains while preserving strict data isolation. The existing repository is a single Next.js frontend with a small Supabase schema and no tenant boundary. The target includes platform administration, PMS operations, public booking, self check-in, billing, and asynchronous integrations.

## Decision

Use a shared PostgreSQL database with a mandatory `tenant_id` on every tenant-owned operational record, resolved server-side from the request host and authenticated membership context. Build as a Next.js modular monolith with Prisma migrations, a service layer, and tenant-safe repository helpers.

Tenant context is derived from one of:

- resolved tenant subdomain plus authorized staff membership;
- an explicitly authorized platform-admin support/impersonation context; or
- an opaque, expiring, reservation-scoped guest check-in token.

It is never accepted from a browser request as an authoritative ID. Platform-level records are distinct and may be unscoped only where intentionally global. Database RLS is used as defense in depth where appropriate, but application authorization and repository scoping remain mandatory because privileged server clients may bypass RLS.

## Consequences

Positive:

- One deployable system supports the product’s current complexity and minimizes operational overhead.
- Shared services, UI primitives, migrations, logging, and integrations remain consistent.
- Tenant isolation is testable at application and database layers.
- Booking, subscription, and operational workflows can use database transactions without distributed coordination.

Costs:

- Every new repository and query must preserve tenant context.
- Global/platform reporting requires carefully authorized cross-tenant access.
- Shared-database performance and noisy-neighbor behavior must be observed as the platform grows.
- Database migration discipline becomes a critical operating practice.

## Alternatives rejected

1. Separate database per tenant: stronger physical separation but disproportionate provisioning, migration, reporting, backup, and support complexity at this stage.
2. Schema per tenant: similar lifecycle complexity and weaker ecosystem support for Prisma/database tooling.
3. Microservices per business domain: adds network, deployment, transactional, and observability complexity before an operational bottleneck justifies it.
4. Client-selected tenant IDs guarded only by RLS: unsafe when server/service-role code exists and too easy to misuse.

## Enforcement

- New tenant-owned tables require `tenant_id NOT NULL`, foreign key, appropriate composite indexes, and migration review.
- Repositories take `TenantContext`; unscoped tenant queries are prohibited by convention, code review, and tests.
- All public/admin routes use route-level authorization; services repeat sensitive checks.
- Cross-tenant integration tests are required before releasing a new tenant-owned module.
- Platform impersonation requires explicit authorization, a visible active warning, start/end audit events, and no credential disclosure.
