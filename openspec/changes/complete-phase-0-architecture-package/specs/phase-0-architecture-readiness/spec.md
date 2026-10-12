## Purpose

Defines the evidence, status-labeling, decision-traceability, verification, and readiness-gate contract for Lelungo's Phase 0 architecture package.

## ADDED Requirements

### Requirement: Repository-backed current-state audit

The Phase 0 package SHALL describe the current application, data model, dependencies, integrations, UI, tests, automation, environments, security boundaries, and legacy product assumptions using evidence from the current repository state. Unknown or environment-dependent facts MUST be labeled as unknown or blocked rather than inferred as implemented.

#### Scenario: Current capability is documented

- **WHEN** the package describes an implemented capability
- **THEN** it identifies repository evidence for that capability and its known verification status

#### Scenario: Evidence is unavailable

- **WHEN** a requested audit conclusion cannot be established from repository evidence or an available check
- **THEN** the package records the limitation and does not present the conclusion as verified

### Requirement: Implemented and target behavior separation

Every Phase 0 target architecture artifact SHALL clearly distinguish implemented behavior from proposed, deferred, or future behavior. Planned PMS bounded contexts, entities, contracts, services, infrastructure, and workflows MUST NOT be represented as running system capabilities.

#### Scenario: Planned domain is described

- **WHEN** an artifact describes Property, Inventory, Pricing, Reservation, Payment, Operations, Distribution, Search, Analytics, or another unimplemented PMS domain
- **THEN** the artifact labels it as target behavior and identifies its intended implementation phase

### Requirement: Explicit architecture decisions

Every material recommendation SHALL state the decision, rationale, alternatives considered, reason alternatives were not selected, whether the choice applies now or later, and its migration path. ADRs MUST preserve historical decisions and supersede rather than silently rewrite accepted incompatible choices.

#### Scenario: Technology or boundary is recommended

- **WHEN** the package recommends an architecture style, persistence technology, communication mode, broker, service boundary, or reliability pattern
- **THEN** the recommendation includes the required decision rationale and lifecycle information

### Requirement: Bounded-context and data-ownership catalog

The target architecture SHALL define each accepted bounded context's responsibility, owned entities and tables, public commands and queries, emitted and consumed events, dependencies, transaction boundaries, and evidence-based future extraction considerations. Cross-context data access MUST occur through intentional application contracts or events rather than direct access to another context's repositories.

#### Scenario: A bounded context is reviewed

- **WHEN** a reviewer inspects any bounded context in the catalog
- **THEN** all required ownership, contract, dependency, transaction, and extraction fields are present

### Requirement: Critical correctness strategies

The package SHALL define target invariants and failure handling for reservation lifecycle, physical-unit overlap prevention, pooled inventory, inventory holds, pricing reconstruction, monetary representation, payment idempotency, tenant isolation, scoped authorization, privacy, and auditability. Database-enforceable correctness MUST be preferred over frontend or cache assumptions.

#### Scenario: Concurrent sale of a physical unit is analyzed

- **WHEN** two reservation attempts overlap for the same physical unit
- **THEN** the documented target strategy identifies the authoritative database constraint or transactional control that prevents both attempts from succeeding

#### Scenario: A reservation total is audited

- **WHEN** a reservation price must be explained after booking
- **THEN** the target strategy preserves currency, integer monetary amounts, input versions, line items, rules, taxes, discounts, and the final immutable pricing snapshot needed to reconstruct the total

### Requirement: Incremental migration and rollback planning

The package SHALL classify legacy artifacts as KEEP, REFACTOR, MIGRATE, DEPRECATE, REMOVE, or INVESTIGATE and SHALL define incremental phases with dependencies, security considerations, acceptance criteria, and rollback strategy. It MUST NOT authorize destructive migration, production deployment, or a big-bang rewrite.

#### Scenario: Legacy artifact is proposed for removal

- **WHEN** the package classifies an artifact as REMOVE
- **THEN** it identifies its replacement or confirmed lack of use, a safe deprecation sequence, data-preservation considerations, and a separately approved execution step

### Requirement: Honest verification and readiness gate

The change SHALL record the exact validation commands and outcomes for the architecture artifacts. The final readiness report MUST declare either `READY FOR PHASE 1` or `NOT READY FOR PHASE 1`, list the evidence and unresolved blockers supporting that conclusion, define the recommended Phase 1 scope, and stop without beginning implementation.

#### Scenario: A required check cannot run

- **WHEN** a required validation or audit is unavailable in the current environment
- **THEN** the verification record names the command or workflow, its actual failure or blocker, and its effect on the readiness decision

#### Scenario: Phase 0 documentation is delivered

- **WHEN** all Phase 0 artifacts and available validations are complete
- **THEN** the handoff contains the readiness decision and no Phase 1 runtime code, schema, dependency, infrastructure, or deployment change has been made
