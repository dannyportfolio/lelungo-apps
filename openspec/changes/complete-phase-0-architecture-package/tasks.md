## 1. Evidence inventory and source reconciliation

- [x] 1.1 Inventory tracked source, configuration, schema, migrations, tests, automation, documentation, and environment-variable names; verify the inventory with `rg --files`, targeted `rg`, and `git status --short`.
- [x] 1.2 Read all `docs/current-system/`, `docs/target-system/`, relevant architecture/ADR/runbook documents, OpenSpec context/specs/active changes, Prisma schema/migrations, and implemented module patterns; record contradictions and unknowns in the audit working notes.
- [x] 1.3 Capture package and lockfile evidence for runtime and development dependencies without upgrading them; verify with `npm ls --depth=0` and record unresolved/advisory checks separately.

## 2. Current-system and legacy audit

- [x] 2.1 Create the Phase 0 current-system audit and repository map covering framework, language, package manager, database/ORM, authentication status, backend/API boundaries, deployment, build, tests, CI/CD, directory responsibilities, and data-access locations; cross-check every implemented claim against a repository path.
- [x] 2.2 Classify legacy product code, routes, components, data objects, integrations, and dependencies as KEEP, REFACTOR, MIGRATE, DEPRECATE, REMOVE, or INVESTIGATE with a safe migration or evidence requirement; verify no legacy file is deleted or edited.
- [x] 2.3 Document UI reuse fitness, critical testing gaps, environment isolation, deployment/rollback gaps, and the exact blocked or unavailable checks; review the final diff for current-versus-target labeling.

## 3. Target product, domain, and ownership design

- [x] 3.1 Define the two product surfaces, actor/system context, modular-monolith containers, terminology, and domain model for organizations, properties, accommodation classifications, room types, physical units, inventory, reservations, stays, guests, pricing, payments, operations, and distribution; validate model terminology against all target documents.
- [x] 3.2 Produce the bounded-context catalog with responsibility, owned entities/tables, commands, queries, events emitted/consumed, dependencies, transaction boundaries, consistency expectations, and extraction criteria for every accepted context; run a completeness matrix check for all required fields.
- [x] 3.3 Define tenant ownership, property-scoped authorization, RBAC plus scoped permissions, explicit DTO/data-exposure rules, privacy classes, and append-oriented audit ownership; reconcile the design with ADR-001 and existing tenancy/staff-authorization specs.

## 4. Reservation, inventory, pricing, and financial correctness

- [x] 4.1 Specify reservation and stay state machines with actors, transition guards, inventory/payment interactions, cancellation/no-show behavior, side effects, and emitted events; validate that terminal, payment, and operational states are not conflated.
- [x] 4.2 Specify separate physical-unit and pooled-inventory anti-double-booking strategies using PostgreSQL constraints and transactions, plus hold TTL, expiration, cleanup, idempotency, and callback-race handling; review all concurrency scenarios in the readiness spec.
- [x] 4.3 Specify deterministic pricing snapshots, restrictions, fees, taxes, promotions, integer minor-unit money, payment intent/transaction/refund/settlement/payout ownership, provider isolation, and ledger/audit expectations; verify no JavaScript floating-point monetary design remains.

## 5. Communication, reliability, and platform evolution

- [x] 5.1 Define REST/BFF external contracts, in-process modular contracts now, future gRPC/protobuf governance, domain-event envelopes, synchronous-versus-eventual consistency, and simple choreography/orchestration criteria; inspect for cascading synchronous chains.
- [x] 5.2 Compare NATS JetStream, RabbitMQ, Kafka, and Redis Streams against Lelungo's expected workload; record one primary recommendation, adoption trigger, alternatives, and why broker deployment is deferred or required.
- [x] 5.3 Define transactional outbox, idempotency, retries/backoff, dead letters, optimistic concurrency, timeouts, circuit breakers/bulkheads, request/correlation IDs, structured logs, metrics, and tracing as now/later decisions; validate every pattern has placement and justification.
- [x] 5.4 Define background jobs, search/PostGIS evolution, caching boundaries, object-storage abstraction, environment isolation, minimum MVP infrastructure, deployment, rollback, and evidence-based service-extraction ranking; check availability never relies on stale cache.

## 6. Decisions, diagrams, risks, roadmap, and readiness

- [x] 6.1 Add an index to the canonical `docs/adr/` series, append the missing decisions using the next available identifiers, cross-link the legacy tenancy ADR without renumbering it, and cover product architecture, modular monolith, bounded contexts, external/internal communication, event communication, PostgreSQL, reservation consistency, payment abstraction, and observability; validate each new Phase 0 ADR contains Status, Context, Decision, Alternatives, Consequences, and Migration Impact.
- [x] 6.2 Add Mermaid source for context, container, domain map, reservation sequence, data ownership, future-service, and deployment diagrams; perform a text-level Mermaid fence and node-reference check.
- [x] 6.3 Add the risk register with likelihood, impact, severity, mitigation, owner domain, trigger, and status for all critical Phase 0 risks; cross-check it against the migration and readiness documents.
- [x] 6.4 Define phased implementation roadmap entries with goal, scope, dependencies, domain/database/API/UI/infrastructure changes, security, tests, acceptance criteria, and rollback; confirm later phases do not masquerade as implemented work.
- [x] 6.5 Produce the Lelungo Architecture Readiness Report with findings, decisions, debt, risks, unresolved decisions, recommended next scope, actual check outcomes, and an explicit readiness verdict; verify the stop condition contains no Phase 1 implementation.

## 7. Documentation verification and handoff

- [x] 7.1 Run the available security-audit workflow; if preflight or tooling blocks it, record the exact command/result and effect on readiness without claiming coverage.
- [x] 7.2 Validate internal Markdown links, status labels, required headings, bounded-context matrix completeness, ADR structure, Mermaid fences, and OpenSpec deltas using repository-local scripts/commands and `npm run spec:validate`.
- [x] 7.3 Run `npm run format:check`, `npm run prisma:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` as non-mutating regression gates; record exact exit codes and any environment blockers in `verification.md`.
- [x] 7.4 Update `docs/runbooks/session-handoff.md` with changed documentation, actual verification, risks, unresolved decisions, rollback/no-migration impact, and the explicit next-step boundary; inspect `git diff --check`, `git diff --stat`, and `git status --short` before handoff.
