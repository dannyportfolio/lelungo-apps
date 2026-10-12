# ADR 0015: Reservation and inventory consistency

Status: Accepted

## Context

Double booking is a critical business failure. Availability checks performed only in application code, UI, or cache can race, and private-unit inventory differs from pooled room-type inventory.

## Decision

Keep reservation and inventory confirmation within one PostgreSQL consistency boundary while they share the modular-monolith database. Model a physical unit assignment with a half-open occupancy range and enforce non-overlap for blocking reservation states through a PostgreSQL exclusion constraint. Model pooled inventory by property-local stay date with capacity, held, confirmed, and blocked quantities updated atomically under a constraint that prevents negative or excess availability.

Inventory holds have an explicit expiry and idempotency key. Confirmation revalidates and converts the hold atomically; expiration, cancellation, and payment callbacks are idempotent state transitions. Stale cache is never authoritative for sale.

## Alternatives

- Check then insert in application code: rejected because concurrent transactions can both observe availability.
- Distributed locks: rejected while one PostgreSQL boundary can enforce the invariant more reliably.
- A single unit-overlap model for all accommodation: rejected because pooled and assigned inventory have different correctness mechanisms.

## Consequences

Critical migrations require reviewed PostgreSQL SQL and concurrency integration tests. Reservation and inventory have strong consistency for holds/confirmation, while notifications, analytics, search, and channel projections remain eventual.

## Migration Impact

Introduce inventory and reservation tables additively in later approved phases, backfill no legacy affiliate data automatically, add constraints before enabling writes, and run concurrent reservation scenarios on disposable PostgreSQL. Service extraction cannot separate these writes until an equivalent consistency design is accepted.
