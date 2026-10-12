# Microservice evolution

> **Current implementation:** One Next.js deployment contains the affiliate-deal prototype plus the implemented tenancy, tenant-resolution, staff-membership, and initial RBAC foundation. No PMS business microservice, broker, worker, or service-owned database is implemented.
>
> **Target state:** A disciplined modular monolith is the default deployment. A module may be extracted only after measured operational or organizational evidence satisfies the gates in this document.
>
> **Decision status:** Target architecture decision; extraction candidates and rankings are planning hypotheses, not approved implementations.
>
> **Last verified:** 2026-08-09

> **Target-only boundary:** Every extraction, service, broker, worker, RPC, and independently owned store below is future design unless the current-evidence section says otherwise.

## Decision

Lelungo will keep business capabilities in one deployable Next.js modular monolith and one transactional PostgreSQL database for the near term. Modules own their application contracts, domain rules, and tables even while physically co-located. `src/app` composes transport concerns; module application/domain code owns behavior; shared infrastructure owns no business data. A module must not import another module's repository or mutate another module's tables.

Microservices are an evolution option, not the target topology for Phase 1. Independent services, gRPC, a broker, per-service persistence, Kubernetes, and distributed workflow infrastructure are all **target-only and deferred**. Creating any of them requires a later accepted ADR and OpenSpec change.

This decision preserves local transactions for the correctness-sensitive reservation, inventory, pricing, and payment seams while the product and operating model are still being established. It also creates extraction seams without paying network, deployment, observability, and distributed-consistency costs before evidence exists.

## Extraction gates

An extraction proposal must answer every gate with repository or production evidence. A strong bounded context alone is necessary but insufficient.

| Gate                    | Required evidence before extraction                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workload isolation      | Measured CPU, memory, I/O, latency, throughput, or burst profile cannot be scaled economically with the monolith. Include baselines and a capacity model.              |
| Fault isolation         | Incidents in the candidate repeatedly threaten unrelated critical workflows, and process-level isolation would materially reduce the blast radius.                     |
| Deployment independence | The capability has a demonstrably different release cadence or rollback need that is harmed by the shared deployment.                                                  |
| Ownership               | A stable team owns the capability, its on-call rotation, contracts, data, runbooks, security posture, and cost. A service without an operator is not extractable.      |
| Data ownership          | Owned tables, invariants, migration plan, retention, backup, restore, and cross-context reads are explicit. Direct access to the old shared tables has a removal plan. |
| Contract maturity       | Commands, queries, errors, event schemas, idempotency, compatibility policy, and consumer inventory are versioned and tested.                                          |
| Consistency feasibility | The extraction does not weaken a required database invariant. Synchronous and eventual-consistency consequences, compensation, and degraded behavior are accepted.     |
| Operational readiness   | Per-service logs, metrics, traces, health checks, alerts, SLOs, dashboards, capacity limits, and incident/rollback runbooks exist.                                     |
| Security and compliance | Tenant, property, actor, privacy, secret, network, and audit boundaries survive the network hop and are independently tested.                                          |
| Economic value          | Expected reliability, scale, or delivery benefit exceeds added compute, managed-service, engineering, support, and cognitive cost.                                     |

Extraction is rejected or postponed when a modular boundary, background worker, query optimization, database index, read model, deployment tuning, or team ownership change addresses the evidence more simply.

## Candidate ranking

Ranks describe the likely relative order **if and when extraction becomes justified**. `EARLY` does not mean Phase 1, and `NEVER / UNNECESSARY` means the default is to keep the capability in-process unless materially new evidence appears.

The owned-context inventory remains canonical in [03-bounded-contexts.md](03-bounded-contexts.md). Media processing is listed here as an extractable worker capability under the Property/storage boundary, not as a new bounded context.

| Capability                         | Rank                                                                                  | Why this rank                                                                                                                                                                   | Adoption trigger specific to the capability                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Notification delivery              | EARLY                                                                                 | Outbound email/WhatsApp-style delivery is asynchronous, provider-dependent, retry-heavy, and naturally isolated from core transactions.                                         | Sustained delivery backlog, multiple delivery providers, independent retry/rate-limit needs, or provider failures affecting request latency. Start with an outbox and worker before a business microservice. |
| Marketplace search                 | EARLY                                                                                 | Search has a read-heavy, index-specific workload and can tolerate an eventually consistent projection, while authoritative availability remains elsewhere.                      | PostgreSQL/PostGIS query latency or index/storage pressure misses an agreed SLO after measured query/index tuning, or ranking requires a dedicated engine.                                                   |
| Distribution / channel manager     | MEDIUM                                                                                | Connectors have external rate limits, reconciliation, mapping, and failure isolation needs, but require stable reservation and inventory contracts first.                       | Multiple active channels, sustained sync backlog, connector release cadence, or provider incidents justify independent deployment.                                                                           |
| Payment adapters                   | MEDIUM                                                                                | Provider webhooks, reconciliation, secret isolation, and compliance can justify a boundary, but payment and reservation correctness must first be proven in the monolith.       | A compliance boundary, multiple providers/regions, independent on-call ownership, or workload/fault evidence outweighs distributed workflow cost.                                                            |
| Analytics pipeline                 | MEDIUM                                                                                | Aggregation and replay are asynchronous and workload-heavy, but an initial tenant-scoped read model can remain in PostgreSQL.                                                   | Analytical workloads harm OLTP, event volume/replay requires separate storage, or a dedicated data team owns the pipeline.                                                                                   |
| Finance                            | MEDIUM                                                                                | Settlement, payout, ledger, and financial reporting workloads can acquire separate compliance, retention, or ownership needs after Payment and Reservation facts stabilize.     | A dedicated finance team/compliance boundary, materially different retention/query load, or OLTP interference justifies independent operation with reconciled event contracts.                               |
| Media processing capability        | MEDIUM                                                                                | CPU-heavy image/document transformations and untrusted-file isolation can scale separately without owning a PMS aggregate; it remains a Property/storage worker capability.     | Processing backlog, compute profile, or sandboxing requirements exceed the managed job/worker boundary.                                                                                                      |
| Reservation                        | LATE                                                                                  | It owns a critical aggregate and may need independent scaling, but extracting it introduces coordination with inventory, pricing, payment, guest, and distribution.             | Clear team ownership plus proven contracts and a design that preserves booking invariants under partial network failure.                                                                                     |
| Inventory                          | LATE                                                                                  | Availability is latency- and concurrency-sensitive and tightly coupled to reservation acceptance. A local PostgreSQL transaction is the simplest safe starting point.           | Inventory load dominates the monolith and an atomic hold/commit service contract is proven under concurrency and failure tests.                                                                              |
| Pricing                            | LATE                                                                                  | Pricing can become compute-heavy, but confirmation needs a deterministic snapshot and immediate validation.                                                                     | Independently scaling calculation load and mature versioned input/snapshot contracts justify a service without changing accepted totals.                                                                     |
| Identity                           | LATE                                                                                  | Provider verification can be adapter-backed in-process; membership and tenant authorization currently benefit from the same PostgreSQL boundary.                                | Regulatory isolation, a dedicated identity team, or many consuming applications require an independently operated identity service.                                                                          |
| Guest / stay operations            | LATE                                                                                  | Guest, stay, front-desk, and property operations change together and initially need simple transactional coordination.                                                          | Independent ownership and workload/fault evidence emerge after the operating workflows are stable.                                                                                                           |
| Platform billing                   | LATE                                                                                  | Lelungo subscription billing is a distinct context, but expected initial volume is low and its entitlement dependency makes premature extraction an availability risk.          | Multiple products or regions, a dedicated commercial platform team, compliance isolation, or independent deployment needs outweigh the entitlement-call failure cost.                                        |
| Property catalog                   | NEVER / UNNECESSARY by default                                                        | Property configuration is central but normally low-throughput and cohesive with the PMS. Module boundaries and read projections are sufficient.                                 | Reconsider only for a separately owned global catalog with demonstrated independent scale or multi-product consumers.                                                                                        |
| Tenancy directory and RBAC catalog | NEVER / UNNECESSARY by default                                                        | These are small cross-cutting authority boundaries. A network service would add a critical availability dependency before it adds value.                                        | Reconsider only when multiple independently deployed products require one centrally operated authority with accepted failure semantics.                                                                      |
| Promotion                          | NEVER / UNNECESSARY by default                                                        | Deterministic promotion evaluation is cohesive with Pricing and redemption with Reservation; a network hop would expand the price-acceptance failure surface.                   | Reconsider only for a separately owned, high-change campaign platform serving multiple products with stable versioned eligibility/benefit contracts.                                                         |
| Review                             | NEVER / UNNECESSARY by default                                                        | Review volume and moderation needs are expected to fit an owned module plus asynchronous Search projection without independent deployment.                                      | Reconsider only when moderation/safety operations, public scale, or independent ownership materially exceed the modular boundary.                                                                            |
| Audit ownership                    | NEVER / UNNECESSARY as a command service; MEDIUM for the asynchronous projection only | Each owning transaction must record audit/outbox evidence locally. Central analysis may consume a projection, but a remote synchronous audit dependency would weaken mutations. | Extract only the asynchronous storage/analysis projection if retention or query volume requires it; never make core mutation success depend on that remote projection.                                       |

## Evolution stages

### Stage 0 - current evidence

- One Next.js application is deployed as a unit.
- Only tenancy and initial identity/RBAC module foundations exist under `src/modules`.
- Prisma models the PostgreSQL tenancy foundation; no deployed PostgreSQL instance was verified by Phase 0.
- Supabase click analytics is a separate legacy persistence path, not a PMS service.
- No durable domain-event relay, worker, broker, service mesh, gRPC endpoint, or dedicated search system is implemented.

### Stage 1 - bounded modular monolith

This is the approved target for the next implementation phases. Each module exposes named application commands/queries and public types. Cross-module mutation occurs through those contracts. Correctness-sensitive operations use PostgreSQL transactions owned by the module that owns the invariant. External side effects begin only after commit, using an outbox when durable delivery is required.

The first safe Phase 1 slice is the existing `add-authenticated-membership-foundation` change: authoritative server authentication, active same-tenant membership resolution, explicit permission checks, and disposable PostgreSQL boundary tests. It does **not** add Property or any other PMS business domain.

### Stage 2 - asynchronous workload isolation

Run delivery, reconciliation, expiry, image processing, and aggregation work outside HTTP requests through a managed worker or queue appropriate to the measured workload. The application transaction still writes authoritative data and an outbox record atomically. The worker remains part of the same product deployment/ownership model; creating a worker does not by itself create a microservice.

### Stage 3 - first service extraction

Choose one capability that passes all extraction gates, normally an asynchronous candidate such as notification delivery or search projection. Use an expand-and-contract sequence:

1. Freeze and test the module's public contract and data ownership.
2. Add metrics and shadow/dual-read comparison where it is safe; avoid dual authoritative writes.
3. Publish through a transactional outbox and build an idempotent consumer.
4. Backfill the new service-owned store and reconcile counts/checksums.
5. Route a small, reversible traffic cohort to the new boundary.
6. Remove direct old-store access only after all consumers have migrated and rollback windows have closed.

### Stage 4 - selective distributed system

Only extracted capabilities receive independent deployment, scaling, SLOs, and data stores. The remainder stays in the modular monolith. gRPC is the preferred future internal request/response protocol where immediate answers are required; durable events handle decoupled propagation. There is no goal to extract every module.

## Future topology, not a deployed diagram

```text
Browser / mobile client
        |
        v
REST / HTTP BFF in the Next.js application
        |
        +---------------- modular-monolith modules ----------------+
        |                 |                   |                    |
        v                 v                   v                    v
  PostgreSQL         outbox relay       object storage       background worker
                            |
                            v
                 future durable event broker
                            |
                 +----------+-----------+
                 |                      |
                 v                      v
       extracted notification     extracted search
             service                 projection
```

This diagram is deliberately hybrid. A future service owns its private persistence and contract; it must not query the monolith's Prisma tables. The BFF remains the browser boundary, and gRPC is never exposed directly to browsers.

## Rejected alternatives

- **Immediate domain-per-service split:** rejected because most PMS domains do not exist and their invariants have not been exercised.
- **One shared database for independently deployed services:** rejected as a steady state because it preserves hidden coupling, shared migrations, and cross-service table mutation.
- **Database per tenant:** rejected for the current scale because provisioning, migrations, backup, reporting, and support cost outweigh physical isolation benefits.
- **Kubernetes as a prerequisite:** rejected because no current workload or deployment topology requires cluster orchestration.
- **Extract reservation first:** rejected because it is the highest-consistency boundary and would maximize distributed coordination before correctness is established.

## Governance

Every extraction requires a separately accepted ADR and OpenSpec change containing the gate evidence, contract and data migration, security analysis, load/concurrency/failure tests, observability, cost estimate, rollout cohorts, rollback, and owner/on-call acceptance. If production evidence no longer supports the extraction, the default decision remains the modular monolith.
