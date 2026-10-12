## Context

See `proposal.md` for motivation and scope. Lelungo already separates current-state evidence under `docs/current-system/`, target-state proposals under `docs/target-system/`, architecture decisions and tenancy guidance under `docs/architecture/`, operational procedures under `docs/runbooks/`, and normative change requirements under `openspec/`. These sources predate the full Phase 0 brief and overlap in places, so the package needs a canonical navigation layer without discarding useful detail.

Only tenancy resolution, tenant-scoped server context, staff membership, and an initial RBAC catalog form the implemented PMS foundation. The remaining PMS domains and all distributed-system infrastructure are targets. The worktree may contain user-owned changes and all documentation edits must preserve them.

## Goals / Non-Goals

**Goals:**

- Make one reviewable Phase 0 package traceable to current repository evidence and existing decisions.
- Keep current-state facts, target-state decisions, and future options visibly distinct.
- Give later OpenSpec changes stable domain boundaries, invariants, migration constraints, and acceptance gates to reference.
- Preserve tenant isolation, deny-by-default authorization, explicit data ownership, and the dependency direction `app -> module application/domain -> shared/infrastructure` in every relevant design.

**Non-Goals:**

- Turn the architecture package into runtime scaffolding or generated contracts.
- Resolve provider selection, SLA, retention duration, or other business-policy choices that can safely wait for the phase that implements them.
- Replace focused existing documents with a single oversized document or renumber the accepted tenancy ADR.

## Decisions

### 1. Add a canonical Phase 0 package while retaining focused evidence documents

Create `docs/architecture/phase-0/` with the requested numbered package and a readiness report. The numbered documents are the cohesive review surface; they link to and reconcile detailed current/target documents rather than copying them verbatim. `docs/architecture/phase-0/README.md` defines the status legend, document ownership, and navigation.

Current facts remain owned by `docs/current-system/`; detailed future implementation guidance remains owned by `docs/target-system/`; accepted decisions remain in ADRs; the Phase 0 package synthesizes them and identifies conflicts. This prevents a future factual update from requiring edits in many narrative copies.

**Alternatives considered:**

- Replace `docs/current-system/` and `docs/target-system/` with the numbered files. Rejected because it would discard established conventions and create a noisy migration with little architectural value.
- Put everything in one readiness report. Rejected because domain, data, reservation, security, and migration concerns need independently reviewable ownership.

### 2. Use the existing ADR root and preserve the legacy tenancy decision

Repository inspection during apply confirmed that `docs/adr/` already contains ADR 0001–0009, while the accepted `docs/architecture/ADR-001-SAAS-MULTI-TENANCY.md` predates that canonical series. `docs/adr/` is therefore the canonical root for new decisions and receives the next available identifiers. The tenancy ADR keeps its historical path and identifier and is listed as an external legacy record in the ADR index; it is not copied, renumbered, or silently replaced. Each new Phase 0 ADR carries Status, Context, Decision, Alternatives, Consequences, and Migration Impact.

**Alternatives considered:**

- Renumber ADR-001 to make product architecture the first record. Rejected because identifiers are historical references and renumbering would break links and obscure prior decisions.
- Continue adding new ADRs under `docs/architecture/`. Rejected because it would extend the already-observed duplicate-root ambiguity.

### 3. Treat the modular monolith as the only approved near-term deployment

The target package defines module public contracts, owned data, commands, queries, and internal domain events inside one deployment. REST/HTTP remains the external client boundary. gRPC/protobuf and a durable broker are documented only as extraction-stage contracts; in-process calls and a transactional outbox-compatible event envelope are the initial seams.

Dependency direction remains `src/app -> src/modules/<context> application/domain -> src/shared/infrastructure`. A module cannot import another module's repository or mutate its tables. Tenant-owned operations receive only trusted server-resolved context, authenticate and authorize before data access, validate input at the transport boundary, and select explicit response DTO fields.

**Alternatives considered:**

- Create service folders, protobuf output, or broker adapters now. Rejected because no implemented domain or measured operational pressure justifies distributed complexity.
- Allow shared repositories while modules share a database. Rejected because physical co-location must not erase data ownership or future extraction paths.

### 4. Separate authoritative decisions from unresolved policy

Phase 0 resolves architecture choices needed to begin foundation work: bounded contexts, data ownership, database consistency, communication modes, migration sequencing, minimum infrastructure, and security boundaries. Choices such as payment provider, exact hold TTL, cancellation products, retention periods, notification vendors, and managed broker vendor are recorded as phase-specific open decisions with decision deadlines and owners rather than guessed.

**Alternatives considered:**

- Pick all providers and business policies during Phase 0. Rejected because those choices require commercial, regulatory, and operational input not present in the repository.
- Leave foundational architecture options unresolved. Rejected because Phase 1 work needs stable tenancy, authorization, module, persistence, and migration constraints.

### 5. Use explicit status and evidence annotations

Every package document begins with a status block containing `Current implementation`, `Target state`, `Decision status`, and `Last verified`. Repository facts cite file paths or link to the focused source document. Target entities, events, tables, APIs, infrastructure, and service extractions use future-tense labels. A terminology glossary distinguishes tenant/organization, property, sellable accommodation, room type, physical unit, inventory pool, reservation, and stay.

**Alternatives considered:**

- Rely on prose tense alone. Rejected because readers can easily mistake detailed target designs for implemented behavior.
- Embed line-number citations for every claim. Rejected because line numbers drift; use stable file paths in durable docs and line-level evidence during review/verification.

### 6. Make readiness evidence-based and conservative

The readiness report evaluates document completeness, unresolved architecture decisions, baseline repository health, authentication/authorization state, tenant-isolation evidence, database/migration readiness, security audit status, and verification results. An unavailable check is a blocker or explicit risk according to its importance; it is never reported as passed. Phase 1 entry means the narrowly defined next foundation change can begin, not that the PMS is production-ready.

**Alternatives considered:**

- Mark ready when documents exist. Rejected because repository health and security/data-boundary evidence affect whether even foundation implementation can proceed safely.
- Require production infrastructure before Phase 1. Rejected because Phase 1 is still incremental foundation work and must not force premature operations.

## Risks / Trade-offs

- **[Canonical synthesis can diverge from focused documents]** -> Add a source-of-truth matrix, links, terminology checks, and review duplicate claims before handoff.
- **[A documentation-only OpenSpec capability can be mistaken for runtime behavior]** -> Name it architecture readiness, scope requirements to artifacts/gates, and state that it adds no product endpoint or domain implementation.
- **[Detailed future table/event catalogs may encourage premature implementation]** -> Mark every catalog target-only and require a fresh OpenSpec change plus relevant business decisions before code or migrations.
- **[The complete package is large]** -> Keep numbered documents responsibility-focused, use tables for repeated bounded-context fields, and keep the readiness report concise.
- **[Security tooling or external environment checks may be unavailable]** -> Record exact failures, perform only clearly labeled repository observations, and lower readiness rather than infer a clean result.
- **[User-owned concurrent edits may overlap documentation]** -> Re-read files before patching, make narrow additions, inspect the final diff, and never revert unrelated work.

## Migration Plan

1. Inventory and reconcile current documents, source, schema, dependencies, tests, CI/CD, and environment declarations.
2. Build the numbered Phase 0 synthesis, supporting diagrams, risk register, ADR index, and additive ADRs without changing runtime code.
3. Cross-check terminology, bounded-context ownership, reservation/inventory invariants, phase dependencies, and current-versus-target labels.
4. Record the security-scan outcome and any environment blockers without overstating coverage.
5. Update session handoff, create `verification.md`, run OpenSpec/spec, formatting, link, Mermaid-text, and repository quality gates appropriate to a documentation-only change, and record actual outcomes.
6. Present the readiness decision and stop. Any execution of the roadmap requires a later explicit OpenSpec apply request.

Rollback is a documentation revert only. Accepted ADRs are never silently deleted after downstream use; supersede them with a new ADR if a later decision changes direction.

## Open Questions

- The exact authentication provider and production identity lifecycle remain owned by the existing `add-authenticated-membership-foundation` change and must be resolved before protected PMS surfaces ship.
- Exact inventory-hold TTL, payment provider, cancellation policy, tax treatment, retention schedule, and Indonesian compliance review are deferred to the implementing domain phases because they require product/legal/operations input.
- A managed broker vendor is not selected in Phase 0; the architecture recommends a protocol/operational profile and defers deployment until durable asynchronous workloads exist.
