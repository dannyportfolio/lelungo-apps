## Why

Lelungo has an approved multi-tenant PMS direction and an initial tenancy/RBAC foundation, but its Phase 0 evidence is spread across partial current-state and target-state documents and does not yet provide one complete, reviewable readiness gate for later PMS development. This change completes the repository-backed audit and architecture package before any additional PMS feature work begins.

## Context

The repository is a brownfield Next.js travel-deal prototype with an implemented but not yet production-proven tenancy, tenant-resolution, staff-membership, and initial authorization foundation. Planned Property, Inventory, Pricing, Reservation, Payment, Operations, Distribution, Search, Analytics, and other PMS domains are not implemented and must remain described as targets only.

The master Phase 0 brief requests a repository audit, future domain and service boundaries, reservation and financial correctness strategies, migration and infrastructure evolution, architecture decisions, diagrams, risks, roadmap, and an explicit Phase 1 readiness decision. Existing documentation is authoritative input and must be reconciled rather than replaced blindly.

## Goals

- Produce an evidence-backed current-system audit covering code, data, dependencies, integrations, UI, tests, CI/CD, environments, security boundaries, and legacy product assumptions.
- Define a modular-monolith target with explicit bounded contexts, data ownership, public contracts, transaction boundaries, and evidence-based future extraction criteria.
- Specify reservation, inventory, pricing, payment, tenancy, RBAC, privacy, reliability, observability, infrastructure, and incremental migration strategies without implementing those domains.
- Record major decisions as ADRs and provide Mermaid diagrams, a risk register, a phased roadmap, and a single architecture-readiness report.
- State actual verification results and blockers, then stop before Phase 1 implementation.

## Non-goals

- Implementing or scaffolding Property, Inventory, Pricing, Reservation, Payment, marketplace, channel, operations, analytics, AI, or other planned product features.
- Creating microservices, protobuf-generated code, an event broker, Redis, PostGIS, search infrastructure, background workers, or provider integrations.
- Changing production data, editing an applied migration, deploying infrastructure, upgrading dependencies, or deleting legacy code.
- Treating proposed architecture, entities, routes, events, or services as implemented behavior.

## What Changes

- Reconcile and extend `docs/current-system/`, `docs/target-system/`, architecture documents, ADRs, runbooks, and OpenSpec context into a complete Phase 0 package adapted to existing repository conventions.
- Add an auditable repository map, classification of legacy code/data/dependencies, explicit bounded-context catalog, domain/data model, reservation and pricing/inventory correctness designs, communication and service-extraction strategy, security and observability design, migration roadmap, and risk register.
- Add Mermaid diagrams for system context, containers, bounded contexts, reservation flow, data ownership, future services, and deployment evolution.
- Add ADRs for the major product, modular-monolith, bounded-context, API/RPC/event, PostgreSQL, reservation-consistency, multi-tenancy, payment-abstraction, and observability decisions while preserving and reconciling the existing tenancy ADR.
- Add a Phase 0 readiness report with evidence, unresolved decisions, and an explicit `READY FOR PHASE 1` or `NOT READY FOR PHASE 1` conclusion.
- Update `docs/runbooks/session-handoff.md` and record exact documentation/OpenSpec verification results.

## Capabilities

### New Capabilities

- `phase-0-architecture-readiness`: Evidence, traceability, completeness, current-versus-target labeling, verification, and readiness-gate requirements for the Phase 0 architecture package.

### Modified Capabilities

None. The existing tenancy and staff-authorization behavior requirements do not change in this documentation-only effort.

## Impact

- **Documentation:** `docs/current-system`, `docs/target-system`, `docs/architecture`, `docs/adr`, `docs/diagrams`, relevant runbooks, and a consolidated readiness report.
- **OpenSpec:** one new planning/governance capability and the proposal, design, tasks, and verification record for this change.
- **Code and APIs:** no runtime code, API, UI, schema, or migration behavior changes.
- **Dependencies and infrastructure:** no package, lockfile, service, environment, or deployment changes.
- **Review surface:** architecture claims must be traceable to repository evidence, and all proposed behavior must be labeled as target or deferred.

## Risks

- A large document set can drift or duplicate existing sources; designate canonical documents, cross-link supporting detail, and validate terminology and claims mechanically where possible.
- Planned domains can be mistaken for delivered product behavior; every target artifact must carry an implementation-status legend and the readiness report must list the exact implemented foundation.
- Architecture can overfit an aspirational microservice model; keep the modular monolith as the approved initial deployment and require evidence before extraction.
- Security conclusions can be overstated when automated or environment-dependent checks are unavailable; record the exact blocker and never convert an incomplete scan into a passing result.
- Repository state may evolve while the package is written; capture evidence against the current working tree and re-run consistency checks before handoff.

## Migration impact

This change performs no data or runtime migration. It defines an incremental strangler-style migration plan and classifies existing artifacts as KEEP, REFACTOR, MIGRATE, DEPRECATE, REMOVE, or INVESTIGATE, but executing any migration requires a later, separately approved OpenSpec change.

## Rollback

The change is documentation-only and can be rolled back by reverting its documentation and OpenSpec files. No database, external system, dependency, or production state needs reversal. If later implementation relies on an accepted ADR, changing that decision requires a superseding ADR rather than silently deleting the historical record.
