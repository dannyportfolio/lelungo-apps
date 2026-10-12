# 04 — Target data architecture

- **Current implementation:** Prisma declares PostgreSQL tables for tenancy, domains, staff membership, roles, and permissions; the additive migration exists but has not been verified against a deployed staging database. Legacy click analytics uses a separate Supabase schema and is not tenant-scoped PMS data.
- **Target state:** One managed PostgreSQL transactional authority with explicit bounded-context ownership, mandatory tenant keys, database-enforced business invariants, immutable financial/audit evidence, and minimum-field data exposure.
- **Decision status:** Shared PostgreSQL, Prisma forward migrations, and tenant scoping are accepted. New table layouts, constraints, RLS policies, privacy retention, and context schemas remain target proposals.
- **Last verified:** 2026-08-09

> **Target-only artifact.** No schema, migration, database extension, RLS policy, backfill, or production data operation is performed by this document.

Data structures arrive only with their owning phase in [12-phase-roadmap.md](12-phase-roadmap.md): tenant/RBAC integrity in Phase 1, Property in Phase 2, Inventory/Pricing in Phase 3, Reservation in Phase 4, Guest/Stay in Phase 5, Payment/Finance in Phase 6, and later projections/integrations in their named phases. No unified “future schema” migration is authorized.

Current evidence is [prisma/schema.prisma](../../../prisma/schema.prisma), the [append-only tenancy migration](../../../prisma/migrations/20260808100000_saas_tenancy_foundation/migration.sql), [current-data-model.md](../../current-system/current-data-model.md), and the [database migration ADR](../../adr/0006-database-migration-policy.md).

## Current-state reconciliation

- `prisma/schema.prisma` and `20260808100000_saas_tenancy_foundation/migration.sql` contain the only PMS-oriented relational model.
- `Tenant` is already the technical organization/isolation root. `TenantDomain` maps a normalized subdomain to it.
- `StaffMembership`, `Role`, `Permission`, and their join tables are a partial authorization catalog; authentication is absent.
- `supabase/schema.sql` click analytics is legacy, unscoped, and must not be queried as PMS transactional truth.
- No Property, Unit, Inventory, Reservation, Guest, Stay, Payment, Invoice, Ledger, Operations, Distribution, Audit, or Outbox table exists.
- A running PostgreSQL database, applied migration, backup, RLS, and integration-test behavior have not been verified. Schema intent is not deployment evidence.

## Primary transactional store

PostgreSQL through Prisma is the initial transactional authority for all PMS bounded contexts. The modular monolith uses one database so Reservation/Inventory and financial invariants can use local transactions and native constraints. Logical ownership is documented per module even when tables share the default PostgreSQL schema.

Not selected now:

- database-per-tenant or schema-per-tenant, because provisioning, migration, reporting, backup, and Prisma operations would multiply before a demonstrated isolation need;
- database-per-context, because it would turn local correctness transactions into distributed workflows prematurely;
- Supabase Data API as a second PMS access path, because privileged and ORM paths would have inconsistent authorization behavior;
- a cache, search engine, or vector database as transactional authority.

RLS may later add defense in depth for compatible tenant tables. It never replaces trusted server context, permission checks, tenant-scoped repositories, or tests because privileged/service clients may bypass policies.

## Context data ownership

All names are proposed. A module owns migrations, writes, invariants, and public read DTOs for its rows.

| Context              | Target-owned relational data                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization/Tenancy | Existing `tenants`, `tenant_domains`; future `organization_settings`, provisioning history                                                                                         |
| Identity & Access    | Existing `staff_memberships`, `roles`, `permissions`, `role_permissions`, `staff_membership_roles`; replacement same-tenant assignment structures and `membership_property_scopes` |
| Property             | `properties`, `property_addresses`, `amenities`, `property_amenities`, `property_media`, `property_policies`, `room_types`, `units`                                                |
| Inventory            | `inventory_pools`, `inventory_days`, `inventory_allocations`, `unit_assignments`, `availability_blocks`, inventory idempotency                                                     |
| Pricing              | `rate_plans`, `rates`, `pricing_rules`, `restrictions`, `cancellation_policies`, short-lived `price_quotes` and quote inputs/lines                                                 |
| Promotion            | `promotions`, `promotion_rules`, `coupons`, `promotion_redemptions`                                                                                                                |
| Reservation          | `reservations`, `reservation_items`, `reservation_guests`, state history, immutable reservation price snapshots/lines, booking sources, reservation idempotency                    |
| Guest                | `guest_profiles`, contacts, consents, restricted identity metadata, profile merge/history                                                                                          |
| Operations           | `stays`, `guest_stays`, housekeeping/maintenance tasks, unit-readiness history; Inventory retains assignment/block data                                                            |
| Payment              | `payment_intents`, append-oriented transactions, provider event receipts, `refunds`, provider reference mappings                                                                   |
| Finance              | guest invoices/lines, expenses, ledger accounts/transactions/postings, settlements, payouts/lines                                                                                  |
| Platform Billing     | subscription plans/subscriptions/platform invoices/payments and entitlement history, isolated from guest finance                                                                   |
| Distribution         | channels/accounts/mappings, external reservation references, calendar sources, sync runs, conflicts                                                                                |
| Notification         | templates/versions, notifications, attempts, preferences, suppression/idempotency                                                                                                  |
| Search               | reconstructable property/location/search projections and indexing checkpoints                                                                                                      |
| Review               | eligibility, reviews, moderation, responses, rating projections                                                                                                                    |
| Analytics            | ingestion checkpoints, facts, aggregates, report projections; never source-domain rows                                                                                             |
| Audit                | append-only `audit_events` and retention/export checkpoints                                                                                                                        |

Cross-context reads use public application queries or projections. A database foreign key can protect referential integrity in the shared database, but it does not grant the referencing module permission to update the referenced table.

## Tenant and property ownership

### Tenant key

Every tenant-owned table must have `tenant_id UUID NOT NULL`, even when tenant could be inferred through another relation. The explicit key supports safe repository signatures, composite integrity, indexes, partition analysis, RLS defense, audit, and incident investigation.

Every tenant-scoped repository method takes a trusted server-resolved context and begins its predicate with that tenant. A client-provided `tenant_id` is ignored or rejected as authority. Intentionally global tables—such as a stable permission catalog or platform plan catalog—must be explicitly documented and accessed only through platform-authorized services.

### Same-tenant relational integrity

Where a child references another tenant-owned row, the target prefers:

```text
parent: UNIQUE (tenant_id, id)
child:  FOREIGN KEY (tenant_id, parent_id)
        REFERENCES parent (tenant_id, id)
```

This makes cross-tenant relationships invalid even if application code makes a mistake. Multi-column indexes follow the same access path. A foreign key to `id` alone is insufficient for tenant ownership.

### Property scope

Property-owned data carries both `tenant_id` and `property_id` where that improves enforcement/query safety. The Property table exposes `UNIQUE (tenant_id, id)`, and children use a composite foreign key. A proposed `membership_property_scopes` record similarly binds tenant, membership, and property with composite references.

Authorization sequence is:

```text
verified external subject
  -> active membership for trusted tenant
  -> explicit permission
  -> organization-wide or same-tenant property grant
  -> owner-module query with tenant_id + property_id
```

A property selector is only a requested resource. It cannot establish tenant authority or widen membership scope.

## Known RBAC integrity risk

The current `staff_membership_roles` table contains only `membership_id` and `role_id`, with independent foreign keys. PostgreSQL therefore permits a membership in Tenant A to be linked to a role in Tenant B or to an incorrectly scoped platform role. `TenantRepository.findMembership` filters the membership by tenant but currently reads every joined role without rechecking role tenant/scope. This can turn an invalid assignment into cross-tenant permissions.

Target correction before production authorization:

1. audit existing assignments and fail rollout on any cross-scope record;
2. introduce additive tenant-role assignment storage with `tenant_id NOT NULL` and composite membership/role foreign keys;
3. use a separate explicitly platform-scoped assignment path rather than nullable tenant semantics that evade composite-FK checks;
4. add checks that a `TENANT` role has a tenant and a `PLATFORM` role does not;
5. switch reads/writes through a reviewed application contract;
6. add cross-tenant integration/regression tests; and
7. contract the old join only in a later forward migration after backfill verification.

Phase 0 does not implement this migration, and the current relation must not be called production-safe.

## Relational conventions

### Identifiers

- Retain opaque PostgreSQL UUID primary keys, generated by trusted application/database infrastructure. Current IDs must remain stable.
- Never encode tenant, date, property, or provider meaning in a primary key.
- External/provider IDs live in separate columns with uniqueness scoped to provider account, tenant, and object type as required.
- Human references such as reservation codes or invoice numbers are separate, scoped, normalized, and protected by explicit unique constraints.
- Idempotency records scope a key to tenant, operation, and actor/channel, store a request hash, and return the original outcome for a matching retry. Reusing a key with a different payload is a conflict.

UUIDv7 or another sortable identifier may be evaluated later only with measured index/write benefits and a compatibility plan; Phase 0 does not change the current UUID strategy.

### Time, dates, and ranges

- Store instants as `TIMESTAMPTZ(6)` in UTC and render them in the relevant property/user timezone.
- Use `created_at` and `updated_at` for mutable records. Immutable facts use `occurred_at` and `recorded_at` and normally omit `updated_at`.
- Store accommodation check-in/check-out calendar boundaries as PostgreSQL `DATE`, interpreted using the versioned Property timezone/policy.
- Occupancy is a half-open range `[check_in_date, check_out_date)`: checkout day can be the next guest's check-in day.
- Use the database clock for hold expiry comparisons and record both expiry instant and state transition time. Worker clock or browser clock is not authority.
- Preserve source timezone/offset when a provider contract requires replay/explanation, while normalizing the authoritative instant.

### Money and quantities

- Store money in `BIGINT` integer units with explicit three-letter currency and captured currency-unit scale; never JavaScript floating point.
- Store percentages/ratios as integer basis points or explicit numerator/denominator and apply a documented rounding rule.
- Prohibit mixed-currency arithmetic inside one price snapshot or balanced ledger transaction.
- Use integer capacity/guest counts with non-negative `CHECK` constraints.

### JSON

`JSONB` is allowed only for versioned, schema-validated documents whose shape is genuinely variable, such as a redacted provider receipt, immutable pricing explanation, audit change metadata, or integration-specific extension. Core ownership, state, monetary totals, dates, foreign keys, searchable attributes, and invariants remain typed columns/tables.

Every JSON document carries an explicit schema/version discriminator where it must be replayed. Sensitive raw provider payloads are minimized, access-controlled, and retained only by policy. GIN or expression indexes are added only for a proven query; JSON is not the default escape hatch for an unclear domain.

### Enums and reference values

- Existing PostgreSQL enums are preserved; an applied migration is never edited.
- Use a database enum only for a small, genuinely closed/stable set.
- Use a constrained text state plus forward migration for code-owned workflow states that may evolve.
- Use a reference table for tenant/operator-configurable or descriptive catalogs such as amenities/classifications.
- Application unions, Zod schemas, database constraints, and transition services must agree; accepting a string in TypeScript does not make it a valid state transition.

### Foreign keys and deletion behavior

- Use `RESTRICT` for financial, reservation, audit, and referenced business records whose deletion would erase evidence.
- Use `CASCADE` only for true aggregate-owned dependent data whose lifecycle cannot outlive its root, and review tenant data-preservation consequences.
- No endpoint may provide generic nested writes or mass assignment across aggregates.
- Cross-context foreign keys are allowed for integrity in the monolith, but deletion/change occurs only through owner contracts.

### Indexes and constraints

Indexes follow actual access paths and begin with the isolation key where tenant-scoped:

- `(tenant_id, property_id, status, check_in_date)` for property reservation lists;
- `(tenant_id, inventory_pool_id, inventory_date)` unique for pooled daily inventory;
- partial indexes for active holds, open tasks, or published records when predicates use immutable row values;
- GiST/exclusion support for overlapping physical-unit ranges;
- `(tenant_id, external_provider, external_id)` unique for idempotent integrations;
- correlation/source event IDs unique where events/providers retry.

Foreign keys, unique constraints, `CHECK` constraints, and exclusion constraints protect correctness; indexes then support verified query plans. Avoid unbounded list queries, wildcard scans on PII, and indexes added without workload evidence.

### Soft deletion and history

Soft delete is not a universal convention:

- lifecycle roots use explicit states such as `ARCHIVED`, with `archived_at`/actor/reason where needed;
- recoverable low-risk catalog rows may use `deleted_at` plus partial uniqueness for active records;
- reservations, payment transactions, refunds, ledger postings, invoices, settlements, payouts, state history, provider receipts, and audit events are not deleted or overwritten during normal operation;
- corrections append transitions, adjustment/reversal records, or superseding versions;
- a privacy erasure request removes/anonymizes eligible PII while retaining legally required non-identifying commercial/accounting evidence.

Hard deletion is a separately authorized retention/migration operation, never a routine generic repository method.

## Inventory/reservation database invariants

The detailed algorithms are in [05-reservation-engine.md](05-reservation-engine.md) and [06-pricing-inventory.md](06-pricing-inventory.md). At the data layer, the minimum target is:

- physical-unit active allocations use a `daterange(check_in_date, check_out_date, '[)')` and PostgreSQL exclusion constraint on tenant/unit overlap;
- expired holds first transition out of an active status in an acquisition/cleanup transaction, because a time-dependent `now()` predicate cannot safely define a partial exclusion constraint;
- pooled `inventory_days` is unique per tenant/pool/date and enforces non-negative counters plus `held + sold + blocked <= capacity`;
- multi-day pooled allocation locks rows in deterministic date order and succeeds or rolls back as one unit;
- Reservation confirmation stores immutable price totals and line evidence and atomically proves/commits Inventory allocation;
- caches and search projections never participate in these constraints.

## Audit, history, and outbox

Three evidence types remain distinct:

1. **Domain history**, owned by its context (reservation transitions, payment transactions, ledger postings, rate versions).
2. **Audit events**, append-oriented human/security actions with actor type/ID, tenant, property, action, target, result, request/correlation ID, timestamps, and redacted old/new metadata where justified.
3. **Outbox messages**, delivery records written in the same transaction as a source fact, with event ID, aggregate ID/version, tenant, type/schema version, occurred time, correlation/causation IDs, payload, and publication state.

Audit is not a replacement for domain state/history, and application logs are not an immutable audit trail. No record includes credentials, access/refresh tokens, CVV/PAN, identity document content, private signed URLs, or unnecessary contact data.

## Privacy and exposure classes

| Class        | Examples                                                                                            | Target controls                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public       | Published property name, approved media, amenities, coarse location, public rating                  | Explicit publication state/DTO; cacheable only with invalidation/freshness policy                                                                                       |
| Internal     | Unit labels, staff task metadata, unpublished rate plans                                            | Authenticated tenant plus permission/property scope; no public projection                                                                                               |
| Confidential | Guest name/contact, staff identity reference, invoices, expenses, payout statements                 | Minimum selects, purpose-specific permission, encryption in transit/at rest, log redaction, retention policy                                                            |
| Restricted   | Guest identity documents/numbers, provider tokens/secrets, bank destination, impersonation evidence | Separate permission and audit of access, field/application encryption or tokenization where required, private storage/signed short access, shortest justified retention |

Lelungo does not store payment card PAN/CVV. Provider references are opaque and scoped. Broad Prisma records, `include: true`, and shared “full guest” DTOs are prohibited at application boundaries. Every query contract names its response fields and treats sensitive-field access as a separate capability.

Exact Indonesian privacy, taxation, identity-retention, and accounting periods require legal/finance review before those domains ship; Phase 0 does not invent durations.

## Migration and rollback posture

All changes use immutable forward Prisma migrations and expand-contract sequencing:

1. add tables/nullable columns/constraints that are safe for old code;
2. backfill in bounded, observable batches;
3. verify counts, ownership, duplicates, tenant integrity, and application compatibility;
4. switch writes, then reads, behind an approved service boundary;
5. enforce non-null/unique/foreign/exclusion constraints only after validation;
6. retain compatibility through application rollback; and
7. remove/deprecate old data only in a later approved contraction.

Production migrations are controlled release steps, never automatic preview/developer actions. Rollback is normally application rollback plus a reviewed forward-fix migration; an applied migration is not edited.

## Decisions

### Decision: one shared PostgreSQL database with logical context ownership

- **Rationale:** Native transactions, constraints, date ranges, relational integrity, and mature operations match early PMS correctness needs while keeping deployment small.
- **Alternatives considered:** Supabase click store as PMS authority; database/schema per tenant; database per context; NoSQL/document-first storage.
- **Why alternatives were not selected:** They weaken one authority or add provisioning/distributed consistency cost without a measured requirement. JSON/document storage cannot enforce the critical relational/date/money invariants as clearly.
- **Use now or later:** PostgreSQL/Prisma is the current accepted target; actual new tables arrive only with each domain change. Separate stores are later extraction decisions.
- **Migration path:** Validate the existing migration in disposable/staging databases, add each tenant-owned vertical slice, introduce outbox/projections, and split data only after a service extraction plan includes reconciliation and rollback.

### Decision: duplicate the trusted tenant key to enforce ownership

- **Rationale:** Explicit `tenant_id` plus composite foreign keys stops cross-tenant relationships at the database boundary and makes query review observable.
- **Alternatives considered:** Infer tenant through joins; rely on frontend filtering; rely only on application code or RLS.
- **Why alternatives were not selected:** Indirect inference is easy to omit and privileged paths can bypass UI/RLS assumptions.
- **Use now or later:** Mandatory for every new tenant-owned table. Retrofit the RBAC assignment gap before production authorization.
- **Migration path:** Add keys/constraints additively, backfill and audit, switch scoped repositories, then enforce non-null/composite references with isolation tests.

### Decision: use typed relational columns by default and narrow JSON/soft-delete use

- **Rationale:** PMS correctness depends on searchable, constrained ownership, money, state, and dates; immutable evidence also needs clear lifecycle semantics.
- **Alternatives considered:** JSON for evolving domains; soft-delete on every table; hard-delete as normal behavior.
- **Why alternatives were not selected:** They hide invariants, complicate indexing/uniqueness, and risk erasing operational/financial evidence.
- **Use now or later:** Apply these conventions when each schema is proposed. Provider-specific versioned evidence and recoverable catalogs are reviewed exceptions.
- **Migration path:** Move useful legacy JSON fields into typed columns during a separately approved backfill; retain versioned source evidence only for the justified retention period.

### Decision: retain opaque UUIDs and UTC instants while modeling stay dates separately

- **Rationale:** Stable opaque IDs preserve current references; UTC is correct for instants, while accommodation nights are property-local calendar concepts.
- **Alternatives considered:** Sequential public IDs; timestamps alone for occupancy; browser-local time as authority.
- **Why alternatives were not selected:** They leak volume, misrepresent nights around timezones, or permit untrusted clock behavior.
- **Use now or later:** Retain current UUID/TIMESTAMPTZ conventions now; require `DATE` plus property timezone for future reservation inventory.
- **Migration path:** No current ID rewrite. Add explicit date/timezone fields with new domains and backfill only from verified legacy semantics if such data is migrated.
