# Architecture decision record index

`docs/adr/` is the canonical location for new Lelungo architecture decisions. Records are append-only history: incompatible decisions are superseded by a later ADR rather than silently rewritten or renumbered.

Last reviewed: 2026-08-09

| ADR                                                       | Status   | Decision                                                       |
| --------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| [0001](0001-use-modular-monolith.md)                      | Accepted | Use a modular monolith                                         |
| [0002](0002-repository-is-source-of-truth.md)             | Accepted | Repository is the source of truth                              |
| [0003](0003-use-npm-as-package-manager.md)                | Accepted | Use npm as package manager                                     |
| [0004](0004-validation-at-system-boundaries.md)           | Accepted | Validate at system boundaries                                  |
| [0005](0005-role-and-permission-strategy.md)              | Accepted | Permission-based authorization                                 |
| [0006](0006-database-migration-policy.md)                 | Accepted | Immutable forward migrations and expand-contract               |
| [0007](0007-observability-and-structured-logging.md)      | Accepted | Structured, redacted observability with separate audit records |
| [0008](0008-agentic-development-workflow.md)              | Accepted | Repository-governed agentic workflow                           |
| [0009](0009-model-routing-strategy.md)                    | Proposed | Provider-neutral development model routing                     |
| [0010](0010-hospitality-platform-product-architecture.md) | Accepted | PMS and direct-booking marketplace product architecture        |
| [0011](0011-bounded-context-and-data-ownership.md)        | Accepted | Explicit bounded contexts and data ownership                   |
| [0012](0012-http-external-and-future-grpc-internal.md)    | Accepted | HTTP externally, in-process now, gRPC after extraction         |
| [0013](0013-cross-domain-event-communication.md)          | Accepted | Events for non-blocking cross-domain effects                   |
| [0014](0014-postgresql-primary-transactional-database.md) | Accepted | PostgreSQL as transactional authority                          |
| [0015](0015-reservation-inventory-consistency.md)         | Accepted | Database-enforced reservation/inventory consistency            |
| [0016](0016-payment-and-money-abstraction.md)             | Accepted | Integer money and provider-isolated payments                   |

The accepted [tenant-scoped modular-monolith ADR](../architecture/ADR-001-SAAS-MULTI-TENANCY.md) predates this numbering series. It remains authoritative for tenant isolation and keeps its historical path and identifier.

The consolidated Phase 0 rationale and status are under [`docs/architecture/phase-0/`](../architecture/phase-0/README.md).
