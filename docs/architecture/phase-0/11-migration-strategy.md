# Legacy migration and platform evolution strategy

> **Current implementation:** Lelungo is a Next.js affiliate-deal prototype with legacy Supabase click analytics plus an additive Prisma tenancy/RBAC foundation. No PMS business migration, production database application, managed worker, broker, cache, PostGIS search, object storage, or production recovery exercise is verified.
>
> **Target state:** Lelungo evolves incrementally through a strangler migration into a tenant-scoped modular monolith on PostgreSQL, with isolated environments, reversible releases, evidence-based infrastructure adoption, and forward-only database correction.
>
> **Decision status:** Incremental migration, PostgreSQL ownership, environment isolation, and rollback principles are accepted. Artifact disposition, provider selection, data-retention policy, RPO/RTO, and infrastructure adoption require later evidence and approved changes.
>
> **Last verified:** 2026-08-09

> **Target-only boundary:** Classifications, migrations, environments, workers, PostGIS/search, cache, storage, deployment, recovery, and rollback designs below authorize no runtime, data, provider, or infrastructure change by themselves.

## Scope and non-goals

This document defines how later changes may replace the legacy product and add PMS capabilities. Phase 0 does not delete or edit legacy runtime code, migrate data, apply a database migration, deploy infrastructure, or activate a provider.

The migration objectives are:

- keep known public prototype flows working until an accepted replacement has passed its gates;
- establish authentication, tenant, module, and data boundaries before PMS breadth;
- introduce one vertical slice at a time with compatible schema and application releases;
- preserve valuable data or prove that it has no retention/business value before removal;
- make cutover, observation, rollback, and recovery explicit;
- avoid dual sources of truth, stale availability, and hidden cross-module persistence.

## Legacy disposition vocabulary

| Class       | Meaning                                                                                                                    | Exit evidence                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| KEEP        | Retain the artifact and its responsibility; harden it through normal changes.                                              | Tests and documentation show it fits the target boundary.                                        |
| REFACTOR    | Retain useful behavior or presentation while moving business logic/data access behind the target contract.                 | New boundary is verified and callers no longer depend on legacy internals.                       |
| MIGRATE     | Move valuable data or behavior to a new owner using an explicit mapping and reconciliation.                                | Backfill/reconciliation passes, cutover is observed, rollback window closes.                     |
| DEPRECATE   | Stop adding features and announce a replacement/removal path while keeping current consumers safe.                         | Usage/consumer inventory reaches the removal threshold and retention obligations are resolved.   |
| REMOVE      | Delete only after replacement or confirmed non-use, preservation, deprecation, and a separately approved execution change. | No live consumers, required data archived/migrated, rollback/recovery agreed.                    |
| INVESTIGATE | Evidence is insufficient for a safe decision. No removal is allowed.                                                       | Named owner gathers usage, product fit, security, and migration evidence by a decision deadline. |

## Repository-backed initial classification

This table is a Phase 0 planning classification, not an instruction to change the listed files now.

| Artifact/group                                                                                              | Class                               | Safe migration strategy and evidence requirement                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/tenancy`, `src/modules/identity`, `src/shared/database`, Prisma schema/migrations              | KEEP + harden                       | Preserve tenant-context and module direction. Complete authoritative auth, database isolation/constraint tests, role provisioning, and forward-only corrections before protected PMS use.                                            |
| `AGENTS.md`, `openspec/`, architecture/current/target/runbook documentation, npm/TypeScript/Next.js tooling | KEEP                                | Continue repository-as-source-of-truth and verification. Do not weaken checks or introduce another package manager.                                                                                                                  |
| Root Next.js layout, global styles, theme utilities, error/hydration boundaries, and generic UI primitives  | INVESTIGATE / REFACTOR              | Audit accessibility, product fit, server/client boundaries, and design-system ownership. Reuse only proven primitives; move business behavior out of components.                                                                     |
| Public deal-discovery page, filters, cards, widgets, social proof, affiliate navigation, and `/api/deals`   | DEPRECATE, then REFACTOR or REMOVE  | Freeze feature expansion. Decide whether a public marketplace remains a product surface. If yes, rebuild it later on Property/Search/Availability application contracts; otherwise prove non-use before removal.                     |
| `src/lib/mock-data.ts`, `src/lib/insight-engine.ts`, QA illustrative data/dashboard, legacy widget rules    | DEPRECATE / INVESTIGATE             | Keep QA routes disabled in production. Identify any development value; replace with explicit fixtures/diagnostics or remove only after reachability and user-owner review.                                                           |
| Traveloka-style affiliate adapter and related environment variables                                         | DEPRECATE / INVESTIGATE             | Verify commercial/product need and live usage. Do not copy provider shapes into new domains. If retained, move behind a distribution/marketplace adapter with timeout, validation, secrets, observability, and contract tests.       |
| `/api/track-click`, analytics click model, and `supabase/schema.sql`                                        | MIGRATE or DEPRECATE after decision | Keep isolated from PMS transactions. If click history has value, map to a future analytics event/projection with retention/privacy review and count/checksum reconciliation. Otherwise document expiry and remove in a later change. |
| Supabase browser/server helpers                                                                             | REFACTOR / KEEP selectively         | The active auth change may reuse a reviewed SSR adapter for external identity. Service-role and analytics clients remain server-only and purpose-specific; unused client paths need consumer evidence before removal.                |
| Existing E2E prototype tests and snapshots                                                                  | REFACTOR                            | Preserve regression protection while legacy flows remain. Replace tests with new-surface coverage only after feature cutover; do not delete a failing test merely because a redesign is planned.                                     |
| Supabase click data itself                                                                                  | INVESTIGATE                         | Establish environment, volume, ownership, retention, sensitivity, and whether production data exists. No destructive query or export is authorized by Phase 0.                                                                       |

## Strangler sequence

1. **Stabilize and observe:** preserve current routes, record consumers and baseline behavior, fix only scoped security/reliability defects, and avoid broad product redesign.
2. **Establish authority first:** apply the existing `add-authenticated-membership-foundation` change only after Phase 0 readiness. Verify server authentication, same-tenant membership, RBAC integrity, and disposable PostgreSQL migration/isolation. Do not begin with Property.
3. **Introduce one owned vertical slice:** add a module, table(s), application service, transport DTO, minimal UI, authorization, tests, and rollback in one separately approved OpenSpec change.
4. **Route through the new boundary:** legacy/new UI calls an application contract rather than legacy libraries or another module's repository. Use feature cohorts or explicit route cutover; do not create two authoritative mutation paths casually.
5. **Migrate valuable data:** expand schema, backfill idempotently, reconcile, observe shadow reads where safe, then switch reads/writes. Preserve source data through the rollback window.
6. **Deprecate:** stop enhancements, inventory remaining consumers, publish/remove links, and measure traffic/jobs/data dependencies.
7. **Contract/remove:** only a new approved change may remove code, configuration, tables, objects, or provider access after recovery and retention gates pass.

New PMS surfaces may coexist with the affiliate prototype. Coexistence does not make prototype entities part of the PMS domain model.

## Database migration method

PostgreSQL through Prisma is the target transactional authority. Legacy Supabase click analytics stays isolated until disposition. Existing migrations are immutable.

### Expand, backfill, verify, switch, contract

1. **Expand:** add nullable columns, new tables, indexes, constraints that are safe for existing rows, and compatible application reads/writes. Prefer additive changes.
2. **Backfill:** run an idempotent, restartable, bounded process with explicit source/target mapping, checkpoints, rate limits, tenant partitioning, and sanitized diagnostics. Never embed production credentials or trigger it from a preview build.
3. **Verify:** reconcile counts, required-field completeness, tenant ownership, foreign keys, checksums/totals, sampled semantics, duplicate/conflict queues, and performance. Record exact results.
4. **Enforce:** only after verified backfill, add non-null/unique/check/exclusion constraints or validate previously non-valid constraints through a forward migration.
5. **Switch:** deploy compatible code, route a reversible cohort, monitor errors/latency/correctness, then make the new owner authoritative. Avoid indefinite dual write.
6. **Contract:** remove old reads/writes/columns/tables in a later release after consumer inventory, retention, backup, and rollback windows close.

Schema changes and application deployment are separate controlled steps. CI validates/generates the client and rehearses migrations on disposable PostgreSQL. A developer machine, web build, preview deployment, startup, or health endpoint never applies production migrations automatically.

### Tenant and ownership gates

- Every new tenant-owned table starts with an explicit tenant key, foreign key, tenant-leading access index, and isolation tests.
- Cross-tenant child relationships are prevented with database-enforceable composite/check constraints where practical plus application ownership checks.
- Money uses integer minor units and currency; no JavaScript floating-point migration calculation.
- Backfills process one explicit tenant/range at a time and never infer tenant from client input.
- Soft deletion is not a default substitute for retention design. Uniqueness, references, privacy erasure, audit, and restore behavior are specified per domain.
- JSON is not a substitute for unresolved modeling; provider payloads remain in adapters or narrowly justified immutable evidence with classification/retention.

### Dual-write rule

Avoid two authoritative writes. When coexistence requires propagation, commit the source of truth plus a transactional outbox record, then update a projection idempotently. If temporary dual write is unavoidable, the implementing change must define ordering, failure matrix, reconciliation, cutoff, and which side wins. A failed secondary write cannot be silently ignored.

## Environment isolation

No non-production environment shares a production database, object bucket, queue/stream, cache namespace, provider webhook endpoint, encryption key, or service credential.

| Environment             | Purpose and resources                                                                                                           | Data and access rules                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local                   | Developer Next.js process; optional local/disposable PostgreSQL; mock/sandbox providers; optional local worker only when needed | Ignored `.env.local`; synthetic/test data; no production credential or dataset; destructive integration preflight accepts only an explicit test database |
| Development/integration | Shared or ephemeral engineering validation and CI service database                                                              | Isolated project/database and credentials; migrations may be applied only to the declared disposable target; no production PII                           |
| Preview                 | Per-branch application review with isolated or tightly controlled ephemeral dependencies                                        | Never production DB; least-privilege preview secrets; auth callback/host isolation; migrations not applied as a build side effect                        |
| Staging                 | Production-like rehearsal for migration, backup/restore, providers, observability, smoke and rollback                           | Separate accounts/projects/DB/buckets/queues/keys/domains; sanitized/synthetic data unless an approved anonymization policy exists                       |
| Production              | Customer traffic and authoritative records                                                                                      | Managed secrets, least privilege, audited access, approved migrations, backups/PITR, monitoring/on-call, no developer-local migration execution          |

Environment and release identity appears in telemetry. Public `NEXT_PUBLIC_*` values are treated as visible. Server credentials use environment-specific secret stores and rotation; values never enter tracked templates, docs, logs, events, or build output.

## Minimum infrastructure and adoption path

### Minimum PMS foundation

The minimum deployable target is a managed Next.js-compatible application, managed PostgreSQL with TLS and reviewed backups/PITR, CI quality and migration validation, isolated secret/configuration storage, domain/TLS support, and a basic structured telemetry/error destination. Exact vendors and production readiness are not selected or verified in Phase 0.

Do not add Redis, a broker, dedicated search, Kubernetes, or a microservice merely to complete an architecture diagram.

### Background jobs

Work that should not hold an HTTP request open includes notification delivery, hold expiry, payment reconciliation, calendar/channel sync, image processing, analytics aggregation, payout/report generation, and cleanup. These are target workflows and most depend on domains that do not exist.

Adopt in stages:

1. a platform scheduler invokes an authenticated, idempotent, bounded handler for low-volume periodic work;
2. authoritative transactions write a PostgreSQL outbox/job record when delivery must survive a crash;
3. a worker claims jobs with leases/locking, bounded concurrency, deadlines, exponential backoff/jitter, attempt history, terminal failure, alerting, and authorized replay;
4. adopt NATS JetStream only when the trigger in [08-rpc-event-strategy.md](08-rpc-event-strategy.md) is met.

Workers use the same tenant/authorization/data-minimization rules as HTTP code. A job carries stable tenant/resource/correlation references, not broad serialized ORM/provider/session objects. Expired leases and retries are idempotent; cleanup never targets an unresolved broad database or storage path.

### Search and geospatial evolution

Start marketplace/property search in PostgreSQL using normalized columns, bounded filters, suitable B-tree/GIN indexes, and query plans measured against representative data. Add PostGIS through a reviewed forward migration when accepted requirements include radius, bounding-box, proximity ranking, or geospatial correctness; record managed-host extension support and rollback/restore implications first.

Properties target normalized address, city, province, country, area, latitude, and longitude. Destination matching is not plain string equality. A dedicated Elasticsearch/OpenSearch-style system is justified only after PostgreSQL/PostGIS tuning misses an agreed latency/capacity/ranking SLO or independent search scaling/ownership is demonstrated.

A search index is an eventually consistent projection. It may filter candidates by coarse availability for discovery, but **never becomes authoritative availability**. Before quoting or accepting a reservation, the reservation/inventory owner revalidates current inventory and price against PostgreSQL in the protected transaction/hold workflow. A stale cache or index may at worst show a candidate that is rejected during revalidation; it must never create a double booking.

### Cache boundaries

There is no application cache today, and none is required for Phase 1. Add cache only after a measured read-pressure/latency need and a named owner/invalidation policy.

Potential target candidates are published property metadata, destination suggestions, static configuration, or popular search results. Keys include schema/version and safe tenant/public scope. TTL, invalidation event, maximum staleness, fallback, stampede control, size, and eviction monitoring are specified per entry.

Never use cached membership/permission as authority without a separately accepted revocation design. Never use stale cache for inventory hold/commit, reservation transition, payment outcome, accepted pricing snapshot, or final availability. Cache failure falls back to the authoritative path or a safe unavailable response; it never fabricates success.

### Object storage

Property images, exports, invoices where legally appropriate, and identity documents do not live in the application filesystem. A future storage port owns object key, class, tenant/property/resource ownership, content metadata, checksum, lifecycle, and access operation. Domain records store opaque object references, not provider SDK types or public URLs.

- Objects are private by default; public property media is published explicitly, preferably through transformed/CDN delivery.
- Uploads use bounded size, content verification, randomized keys, traversal-safe handling, malware/sandbox policy, and cleanup for abandoned objects.
- Restricted documents use short-lived signed access, narrow permissions, access audit, retention/deletion, and encryption expectations.
- Database mutation and object write cannot be one transaction; use staged upload/finalize state plus idempotent cleanup/reconciliation.

Supabase Storage, S3-compatible storage, and Cloudflare R2 are candidates. Selection is deferred until media/document requirements, region, transformations, egress, lifecycle, compliance, local/CI experience, and current vendor fit are known. Phase 0 migrates no files.

## Release and deployment sequence

For a schema-affecting slice:

1. confirm scope/non-goals, backup state, compatible deploy order, migration review, environment target, and rollback owner;
2. validate on an empty disposable database and representative staging data; rehearse backup restore where relevant;
3. deploy additive schema as a controlled release step;
4. deploy backward-compatible application code with the new path disabled or to a small cohort;
5. run idempotent backfill/reconciliation if needed;
6. enable the path gradually, run smoke/concurrency/isolation checks, and observe telemetry for a defined window;
7. switch authority only after acceptance evidence;
8. perform contract cleanup in a later change/release.

Feature gating must fail safely and remain environment/tenant aware; it is not an authorization mechanism. Preview and application rollback never silently downgrade or rewrite the database.

## Recovery and rollback

### Recovery target

Managed PostgreSQL must support automated backups and point-in-time recovery before authoritative PMS data ships. Staging restore drills prove procedures, access, integrity, tenant isolation, application compatibility, and measured recovery time. Business owners must approve numerical RPO/RTO per critical workflow; Phase 0 does not invent them.

Object storage requires lifecycle/versioning or recoverability appropriate to its data class. Broker/outbox recovery preserves event identity and consumer idempotency. Provider reconciliation recovers unknown external outcomes. Runbooks name backup ownership, encryption, retention, restore validation, communication, and evidence.

No production backup, PITR, or restore drill is verified by the current repository; this is an entry gate, not an implemented capability.

### Rollback hierarchy

1. **Stop exposure:** disable the new route/cohort or pause a worker/consumer without deleting authoritative data.
2. **Application rollback:** restore the prior compatible artifact while leaving additive schema in place.
3. **Data correction:** correct bad derived/projection data idempotently; preserve evidence. Do not reverse an unknown external provider outcome by guess.
4. **Schema correction:** add a reviewed forward-fix migration. Never edit an applied migration or run an unreviewed destructive reset.
5. **External compensation:** use an authorized domain command such as release/refund/cancel only when policy permits, with idempotency, audit, and reconciliation.
6. **Restore:** use PITR/backup only for an incident where recovery analysis accepts the loss/replay window; reconcile outbox, jobs, object writes, and external systems afterward.

A contract/remove release cannot rely on application rollback after old data/columns are destroyed. It needs a preserved source/archive, restore path, and explicit point-of-no-return approval.

## Migration verification checklist

- source/target owners, mappings, classifications, consumers, volumes, and retention are documented;
- authentication, tenant, permission/property scope, DTO exposure, and audit/outbox behavior are tested;
- fresh migration, upgrade migration, backfill restart/idempotency, constraint enforcement, and representative query plans pass on disposable/staging PostgreSQL;
- counts, checksums/totals, nulls, duplicates, orphan references, tenant distribution, and sampled semantics reconcile;
- no production resource appears in local/development/preview configuration;
- availability acceptance always revalidates authoritative PostgreSQL state, independent of cache/search lag;
- telemetry, smoke test, observation window, backup/restore, forward-fix, application rollback, and external compensation are exercised or recorded as blockers;
- removal is a separate approved step and no user-owned unrelated file/data is changed.
