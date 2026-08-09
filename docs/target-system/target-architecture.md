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
- Properties and Rooms: property structure and room inventory identity.
- Reservations and Guests: booking lifecycle and guest profiles with restricted exposure.
- Operations: stays, housekeeping, maintenance.
- Finance: payments, invoices, expenses; no billing/subscription work in the foundation.
- Integrations: booking channels, notifications, storage, webhooks through adapters.
- Reporting and Audit: read models and immutable security/business history.

Microservices are rejected until independent scaling, security isolation, deployment ownership, or extreme workload separation is demonstrated.
