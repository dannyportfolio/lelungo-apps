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
