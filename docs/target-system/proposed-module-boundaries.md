# Proposed module boundaries

```text
src/modules/
  tenancy/
  identity/
  properties/
  rooms/
  inventory/
  reservations/
  guests/
  stays/
  payments/
  housekeeping/
  maintenance/
  notifications/
  reporting/
  audit/
src/shared/
  database/ validation/ errors/ logging/ security/ config/
src/infrastructure/
  integrations/ jobs/ observability/
```

This is a target map, not permission to scaffold empty modules. Add a module only with an approved OpenSpec change. Each module should expose application services and public types; its repository and provider adapters remain internal.

Dependencies flow inward from Next.js routes to application services and domain logic. External SDK types terminate at adapters. Transactions are coordinated by the module owning the invariant; cross-module workflows use an explicit orchestrator and durable events/outbox when asynchronous delivery is required.

## Implemented Phase 2 subset

- `tenancy` owns trusted host resolution and Tenant request context.
- `identity` owns verified membership permission, explicit Property access mode/grants, Property authorization composition, and scope administration.
- `properties` owns Property profile, catalogs, lifecycle, purpose-specific projections, repository, and application services.
- `audit` owns only the narrow append contract and adapter required by accepted Phase 2 mutations.
- `src/app/staff` owns transport/composition and UI only; it does not call Prisma directly or establish authority from route/form identifiers.

`rooms`, `inventory`, `reservations`, `guests`, `stays`, `payments`, `housekeeping`, `maintenance`, `notifications`, and `reporting` remain unimplemented. Phase 3 must consume the trusted published Property context, canonical timezone/classification/lifecycle predicates, Property-scope authorization, and audit append contract rather than recreating them.
