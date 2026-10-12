# ADR 0011: Bounded contexts and data ownership

Status: Accepted

## Context

A shared process and database simplify transactions, but they can also hide coupling. Future service extraction is possible only when each domain owns behavior and data before distribution.

## Decision

Organize the modular monolith into the explicit bounded contexts cataloged by the Phase 0 package: Identity & Access; Organization & Tenancy; Property; Inventory; Pricing; Reservation; Guest; Payment; Finance; Operations; Notification; Search; Review; Promotion; Distribution / Channel Manager; Analytics; Audit; and Platform Billing. Identity & Access plus Organization & Tenancy contain the only partial PMS foundation today; every other listed context is target-only.

Each context owns its tables, repositories, commands, queries, and emitted event schemas. Another context uses a public application contract, stable identifier, read model, or domain event; it does not import repository internals or mutate the owner's tables. Shared infrastructure owns no business data.

## Alternatives

- A generic shared service/repository layer: rejected because ownership and invariants become ambiguous.
- One microservice and database per context now: rejected because it adds operational and consistency costs without measured need.
- Layer-only folders without domain ownership: rejected because dependencies would remain unconstrained.

## Consequences

Module APIs and data ownership require deliberate design and architecture checks. Some cross-context reads need explicit projections, while transactions that protect one invariant remain owned and coordinated by one context.

## Migration Impact

Keep the current `src/app`, `src/modules`, and `src/shared` shape. Add or restructure a module only with an approved vertical slice, expose public contracts, and move legacy access behind adapters incrementally. Do not scaffold empty planned modules. When the catalog changes, update this ADR through a superseding record and reconcile the bounded-context and data-ownership diagrams; do not retain silent merged aliases.
