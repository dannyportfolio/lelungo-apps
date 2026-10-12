# RPC, event, and reliability strategy

> **Current implementation:** Browser traffic reaches unversioned Next.js pages and route handlers. Module calls are in-process TypeScript calls. No gRPC, protobuf contract, transactional outbox, event broker, durable consumer, retry queue, or dead-letter queue is implemented.
>
> **Target state:** External consumers use REST/HTTP through the Next.js BFF; modules use intentional in-process application contracts while co-located; extracted services may use governed gRPC/protobuf for immediate results and versioned durable events for asynchronous propagation.
>
> **Decision status:** REST and in-process boundaries are accepted near-term decisions. gRPC, protobuf files, broker deployment, and distributed workflow infrastructure are target-only and require later adoption triggers.
>
> **Last verified:** 2026-08-09

> **Target-only boundary:** Future PMS APIs, proto/RPC contracts, event envelopes, outbox/consumer behavior, broker topology, and workflow patterns below are specifications, not running capabilities.

## Communication decision

### External boundary: REST/HTTP and BFF

Browsers and mobile clients communicate with Lelungo through REST/HTTP routes or server-rendered BFF composition. gRPC is not exposed to browsers. Transport code validates external input, authenticates, resolves trusted tenant context, authorizes, and then calls an application service. It maps domain failures to stable generic client errors and returns an explicit DTO rather than Prisma or provider objects.

The current `/api/deals` and `/api/track-click` endpoints are legacy prototype boundaries, not the contract design for future PMS modules. A future PMS route is added only by its implementing OpenSpec change.

Public API versioning starts only when an independently consumed contract needs compatibility guarantees. Until then, additive route/DTO evolution is preferred over speculative `/v1` duplication. A breaking public change requires a new route or negotiated representation, a deprecation window, consumer inventory, and migration evidence.

### Internal boundary now: in-process module contracts

While Lelungo is a modular monolith, synchronous calls are named TypeScript application commands and queries exported intentionally by the owning module. A caller may use public service/types; it may not import the callee's repository, Prisma model, or provider adapter. The owning module validates its business invariant and controls its transaction.

An in-process call is appropriate when the caller needs an immediate result to decide whether its own command may continue. Keep call depth shallow. A request must not form a chain such as reservation -> payment -> notification -> analytics -> search -> channel. Optional side effects run after the authoritative transaction and do not extend client latency.

### Internal boundary after extraction: gRPC/protobuf

gRPC with Protocol Buffers is the preferred **future** service-to-service request/response protocol when a capability has passed the extraction gates in [07-microservice-evolution.md](07-microservice-evolution.md). It is appropriate for an immediate availability decision, invariant validation, or authoritative lookup where the caller must handle failure before continuing. It is not a substitute for domain events, a browser API, or a reason to extract a module.

Conceptual future operations include `CheckAvailability`, `HoldInventory`, `ReleaseInventory`, `CalculateReservationPrice`, `ValidateRatePlan`, and `GetProperty`. These names are design examples only; no RPC or proto file is approved by Phase 0.

Every synchronous network call must have a deadline, bounded response size, cancellation propagation, typed failure categories, tenant/actor authorization, correlation propagation, and an explicitly designed unavailable response. Cascading synchronous hops are rejected during review.

## Future protobuf governance

`contracts/proto/` is a reserved future location; Phase 0 does not create it or generate code. Once a service extraction is accepted:

- packages use a stable namespace such as `lelungo.<context>.v1`;
- the owning service owns source `.proto` files and compatibility decisions; consumers use published generated artifacts, not copied definitions;
- messages use domain-specific request/response DTOs and never mirror database rows or expose secrets/provider payloads;
- new fields are additive and optional under the relevant proto presence rules;
- existing field numbers and meanings never change; removed field names and numbers are `reserved` and never reused;
- enum zero values represent an explicit unspecified state; numeric enum values are never reassigned;
- breaking semantic or wire changes create a new package/version and a measured migration window;
- CI must lint and check backward compatibility against the released baseline before publishing generated artifacts;
- code generation is deterministic and pinned to reviewed tool versions; generated output ownership and release tags are explicit;
- tenant, request, correlation, causation, idempotency, and auth context travel through reviewed metadata, never through caller-selected authority fields in a business payload.

Internal in-process TypeScript contracts do not acquire protocol versions. They change atomically in the monolith and are protected by typecheck and tests. Versioning begins at independently deployed or durable boundaries.

## Synchronous and asynchronous consistency matrix

`Strong` means the business decision must be serialized or atomically validated by the authoritative owner before success is returned. It does not require all downstream projections to update in the same transaction.

| Cross-domain operation                                       | Interaction                                                              | Consistency                                 | Owner and failure rule                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication subject -> tenant membership/permissions      | Synchronous query                                                        | Strong for access decision                  | Identity verification and tenant-scoped membership must both succeed before protected data access. Missing, stale, inactive, or other-tenant authority denies.                                   |
| Property -> room type / physical unit ownership              | Synchronous validation, local transaction while co-located               | Strong                                      | The property/room owner rejects cross-tenant and cross-property references in the authoritative database.                                                                                        |
| Reservation -> physical-unit or pooled inventory hold/commit | Synchronous command                                                      | Strong                                      | Inventory atomically accepts or rejects a hold/commit. UI and cache results are advisory. Network uncertainty must not be interpreted as success.                                                |
| Reservation -> pricing snapshot                              | Synchronous calculation and persisted snapshot                           | Strong at acceptance                        | The reservation stores the accepted currency, integer amounts, versions, line items, taxes, fees, and discounts. Later pricing changes do not rewrite it.                                        |
| Reservation -> payment initiation                            | Synchronous creation of idempotent intent; provider outcome asynchronous | Strong local intent, eventual outcome       | Payment owns provider interaction. Reservation confirmation follows a durable, deduplicated outcome; timeout/unknown never becomes captured by assumption.                                       |
| Payment -> reservation status                                | Durable event or explicit workflow step                                  | Eventual with guarded transition            | Duplicate/out-of-order outcomes are idempotently reconciled. Reservation validates its own allowed transition and amount/reference.                                                              |
| Reservation -> notification                                  | Domain event                                                             | Eventual                                    | Notification failure cannot roll back a valid reservation. Retry, dead-letter, and operator replay are isolated.                                                                                 |
| Reservation -> analytics/reporting                           | Domain event / projection                                                | Eventual                                    | Projections may lag and must expose freshness; they never authorize or determine availability.                                                                                                   |
| Property publication -> marketplace search                   | Domain event / projection                                                | Eventual                                    | Search may lag within an agreed freshness SLO. Unpublished properties must be removed with higher priority than normal reindexing.                                                               |
| Reservation/inventory -> channel manager                     | Durable event plus reconciliation                                        | Eventual                                    | Local inventory remains authoritative; adapters use versions, idempotency, conflict queues, and periodic reconciliation.                                                                         |
| Guest checkout -> housekeeping task                          | Domain event                                                             | Eventual, prompt                            | Checkout succeeds independently; the task is created idempotently and alerting detects lag/failure. Room sellability follows an explicit operations/inventory rule, not a stale task projection. |
| Audit evidence for a state mutation                          | Same transaction or transactional outbox                                 | Strong capture, eventual central projection | Failure to capture required audit/outbox evidence fails the mutation. Central search/export can lag.                                                                                             |

## Domain event contract

Domain events describe accepted facts in the owning context. They are not generic row-change messages. Events are target behavior and none of the following envelope is currently implemented.

```text
event_id             globally unique identifier
event_type           stable past-tense name, for example reservation.confirmed
schema_version       positive integer
occurred_at           UTC timestamp assigned by the producer
producer              owning context/service and release
tenant_id             required for tenant-owned facts
property_id           included only when the fact is property-scoped
aggregate_type
aggregate_id
aggregate_version     supports ordering/deduplication where applicable
request_id
correlation_id
causation_id
actor                 minimal actor type/id; no provider token or broad profile
classification        payload privacy class
payload               explicit event DTO
```

Rules:

- `event_id` is the consumer deduplication key; business commands also carry their own idempotency key when caller retries can duplicate intent.
- Additive optional payload fields may retain a schema version. A required-field removal, type/meaning change, or semantic reinterpretation creates a new version or event type.
- Consumers ignore unknown additive fields, persist their processing result atomically with their own state where required, and never assume exactly-once delivery.
- Sensitive guest, credential, payment instrument, identity document, or private URL data is excluded. Events contain stable references and the minimum fields a declared consumer needs.
- Ordering is guaranteed only where explicitly partitioned by aggregate/key. Consumers compare aggregate version and handle duplicates, gaps, and late events.
- A registry records owner, schema, classification, retention, consumers, compatibility, and deprecation. Event deletion waits until all consumers and retained/replayable data have migrated.

## Reliability placement: now versus later

`Now` below means the rule applies to the next implementation that introduces the relevant boundary; it does not claim the mechanism already exists.

| Pattern                        | Placement and purpose                                                                                                                                                                                                                                          | Timing decision                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request/correlation IDs        | A trusted ingress creates or validates a bounded identifier, propagates it through context, logs, calls, jobs, and events, and returns a safe response header. The current tenant context has a correlation field, but trusted ingress handling is incomplete. | NOW for protected Phase 1 paths; full cross-process propagation when workers/services arrive.                                                                        |
| Transactional outbox           | The same PostgreSQL transaction writes the aggregate change and durable event record, eliminating a database-commit/publish gap.                                                                                                                               | NOW for the first business mutation that requires guaranteed cross-process side effects. Do not add empty infrastructure to the auth slice if it emits no such fact. |
| Idempotency key                | A unique `(tenant, operation, key)` record binds one external command to its canonical result and rejects payload reuse.                                                                                                                                       | NOW when introducing reservation, payment, webhook, channel, or other retried mutations; unnecessary for read-only commands.                                         |
| Idempotent consumer            | Inbox/deduplication state and side effect commit atomically; duplicate delivery returns the prior result.                                                                                                                                                      | NOW with the first durable worker or event consumer.                                                                                                                 |
| Retry/backoff/jitter           | Retry only classified transient failures, with an attempt/time budget and provider rate-limit respect. Validation, authorization, and permanent business failures do not retry.                                                                                | NOW for each external provider/worker boundary; centralized policy later if repetition appears.                                                                      |
| Dead-letter handling           | Exhausted events/jobs move to a quarantined stream/queue with reason, attempts, timestamps, correlation, alert, safe inspection, and controlled replay.                                                                                                        | LATER, when a durable queue/broker is deployed; a PostgreSQL job table may represent terminal failure before then.                                                   |
| Optimistic concurrency control | Aggregate version or conditional update prevents silent lost updates; unique/exclusion constraints protect stronger database invariants.                                                                                                                       | NOW for concurrency-sensitive aggregates as each domain is implemented. Never use OCC alone for anti-double-booking where a database constraint/lock is required.    |
| Timeouts/deadlines             | Every network/database/provider call gets an explicit budget shorter than its caller's budget; unknown outcomes remain unknown and reconcile later.                                                                                                            | NOW for current and new external calls; gRPC deadlines later inherit the request/workflow budget.                                                                    |
| Circuit breaker                | Stop repeated calls to a failing optional dependency and expose degraded state; half-open probes are bounded. Do not wrap authoritative writes in a way that fabricates success.                                                                               | LATER after metrics show a recurring failure mode and a defined fallback exists.                                                                                     |
| Bulkhead                       | Separate concurrency pools/queues protect reservations and auth from slow notifications, reports, imports, or image work.                                                                                                                                      | LATER when measured contention justifies resource separation.                                                                                                        |
| Distributed tracing            | W3C trace context connects HTTP, RPC, relay, broker, and consumer spans without sensitive attributes.                                                                                                                                                          | Basic trace-ready context NOW; provider/collector deployment LATER and mandatory before service extraction.                                                          |

## Workflow choice

Use simple choreography when one accepted fact fans out to independent, non-critical reactions such as notification, analytics, or search indexing. Each consumer owns its retry and idempotency.

Use an explicit application orchestrator when a user-visible workflow has ordered steps, deadlines, compensations, and one status owner - for example inventory hold -> payment intent -> provider outcome -> reservation confirm/release. The orchestrator persists workflow state and does not hold a database transaction open across network calls.

Adopt a saga/workflow engine only after the workflow has multiple long-running participants, recovery cannot be managed safely by a small persisted state machine, and operational evidence supports the added infrastructure. Phase 0 approves no workflow engine and no distributed transaction protocol.

## Broker comparison

The comparison is for a future durable event backbone. Current recommendation is still to deploy **no broker** until the adoption trigger is met.

| Candidate      | Operations and developer experience                                                                                                                               | Durability, ordering, retry/DLQ, replay                                                                                                                                               | Fit for expected Lelungo workload                                                                                                      | Decision                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| NATS JetStream | Lightweight server/clients, subject-based routing, simple local setup, and managed options. Requires deliberate stream/consumer policy.                           | Durable streams, acknowledgements, redelivery, retention, per-subject ordering, and replay. Dead-letter behavior is built with max-delivery plus a dedicated subject/consumer policy. | Good for moderate domain-event fan-out and later service extraction without Kafka-level operations.                                    | **Primary future recommendation.**                                                   |
| RabbitMQ       | Mature routing and work queues; broad hosting support; more exchange/queue topology to operate.                                                                   | Strong acknowledgements, TTL/dead-letter exchanges, priorities, and common retry patterns. Replay/log semantics are less natural than JetStream/Kafka.                                | Strong alternative if job routing, delayed work, and per-message queue semantics dominate event replay.                                | Alternative, not primary.                                                            |
| Kafka          | Highest ecosystem maturity for partitioned event logs, long retention, replay, and stream processing; materially higher operational and schema-governance burden. | Durable ordered partitions, consumer offsets, replay, and very high throughput; application retry/DLQ topics still need design.                                                       | Disproportionate for the current repository and expected initial PMS workload.                                                         | Deferred unless measured volume/retention/stream-processing requirements justify it. |
| Redis Streams  | Convenient if Redis is already operational; simple consumer groups. Persistence, trimming, failover, and operational semantics require care.                      | Acknowledgements and replay are possible; retry/DLQ conventions and long-term log durability are application-defined.                                                                 | Redis is not currently present, and adding it only to obtain Streams would combine cache and critical-event concerns without evidence. | Not selected as the primary event backbone.                                          |

### Recommendation and adoption trigger

If a general broker becomes necessary, use **NATS JetStream** first and connect it through a PostgreSQL transactional-outbox relay. This selection balances durable replay and fan-out with lower operational weight than Kafka. It remains a reversible architecture recommendation; the managed vendor, topology, retention, and cost require a later ADR based on actual workloads.

Deploy it only when at least one of these conditions is true and a database outbox plus bounded worker is demonstrably insufficient:

1. one durable event has two or more independently operated consumers that require replay or separate lag control;
2. sustained backlog/throughput or retention exceeds the agreed PostgreSQL outbox-worker SLO;
3. the first service extraction requires durable cross-deployment delivery; or
4. fault isolation and independent consumer deployment provide measured value exceeding broker operations cost.

Before adoption, prove outbox relay idempotency, event schema compatibility, tenant isolation, redaction, max delivery/dead-letter/replay, consumer lag alerting, backup/restore expectations, local/CI operation, managed-region availability, cost, and rollback to paused publication without losing authoritative database facts.

## Failure and degradation rules

- Authentication, authorization, tenant resolution, inventory acceptance, and persisted pricing decisions fail closed; cached or projected data never substitutes for authority.
- Optional notifications, analytics, and search indexing may degrade asynchronously with visible lag and alerts; they do not roll back accepted core state.
- A timeout or lost response is an unknown outcome. Callers query/reconcile using idempotency keys; they never blindly issue a different command.
- No retry is unbounded. No dead-letter item is silently discarded. Operator replay is authorized, auditable, and idempotent.
- Removing a contract version, event, queue, or consumer is an expand-and-contract migration with usage evidence and a rollback window.
