# Target architecture

## Decision

Lelungo will use a modular monolith: one deployable Next.js application with explicit domain modules and one transactional PostgreSQL database. This minimizes operational complexity while preserving boundaries that can be extracted only when scaling or isolation evidence justifies it.

```text
CDN / Edge
  -> Next.js UI and route handlers
    -> validation / authentication / authorization / tenant context
      -> application services
        -> domain logic
          -> Prisma repositories / PostgreSQL
            -> events to bounded external adapters
```

The UI and transport layers coordinate but do not own business rules. Modules own data access and behavior. Shared infrastructure cannot import domain modules.

## Boundaries

- Identity: external authentication subject, staff membership, roles, permissions.
- Tenancy: tenants, domains, trusted tenant context, isolation policy.
- Properties: tenant-owned profile, structured address, canonical timezone, classification/amenities, lifecycle, safe published identity, and optimistic concurrency. This foundation is implemented in the Phase 2 working tree.
- Accommodation: RoomType and Unit/room identity. This remains a Phase 3 obligation and is not represented by Phase 2 Property fields.
- Reservations and Guests: booking lifecycle and guest profiles with restricted exposure.
- Operations: stays, housekeeping, maintenance.
- Finance: payments, invoices, expenses; no billing/subscription work in the foundation.
- Integrations: booking channels, notifications, storage, webhooks through adapters.
- Reporting and Audit: read models and immutable security/business history. Phase 2 implements only the narrow append contract required by Property and Property-authority mutations; browsing, export, retention management, and broader domain coverage remain planned.

Microservices are rejected until independent scaling, security isolation, deployment ownership, or extreme workload separation is demonstrated.

## Current transition checkpoint

The current working tree now follows this target for Tenancy, verified staff identity, tenant RBAC, Property, Property-scope authorization, and narrow audit writes. Five individually invoked integration files for the additive Phase 2 PostgreSQL foundation passed 29/29 tests on disposable PostgreSQL 16. Focused real tenant-host authentication and missing-permission browser scenarios passed, but the complete seven-scenario Property E2E rerun, staging migration, live-provider, and remote-CI evidence remain open. RoomType, Unit, inventory, pricing, entitlements, reservations, guests, finance, operations, distribution, reporting, and public booking remain target-only.
