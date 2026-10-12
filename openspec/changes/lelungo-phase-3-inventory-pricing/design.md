## Context

See [proposal.md](./proposal.md) for motivation and scope. The executable repository now contains the archived Phase 1 authenticated tenant-membership boundary and the Phase 2 Property/property-scope/narrow-audit implementation in the working tree. Phase 2 supplies trusted public Property context, canonical timezone/classification, lifecycle predicates, scoped authorization, and transactional audit writes, but its PostgreSQL/E2E verification, spec sync, and archive remain open. No RoomType, Unit, inventory, pricing, entitlement, or reservation implementation exists.

The design must reconcile the updated Website-as-a-Service product model with accepted repository decisions:

- the initial architecture is one Next.js modular monolith and one PostgreSQL transaction store;
- `Tenant.id` remains the persisted Organization and isolation identifier;
- Property owns accommodation identity, Inventory owns capacity, Pricing owns commercial rules, and Platform Billing owns commercial entitlements;
- modules collaborate through typed public application contracts, never another module's repository;
- every tenant/property-owned row repeats the trusted tenant/property key so PostgreSQL can reject cross-scope relationships;
- stay dates are Property-local PostgreSQL `DATE` values and ranges are half-open;
- money is an integer plus currency and unit scale, never JavaScript floating point;
- no cache, broker, RPC network, or provider integration is required for Phase 3.

The Master Prompt's completion statement is not used as verification evidence. Phase 3 applies only after the repository records Phase 2's database, authorization, public-projection, audit, E2E, final-gate, spec-sync, and archive evidence.

## Goals / Non-Goals

**Goals:**

- Resolve the Phase 3 schema and algorithm ambiguities before a migration is written.
- Preserve the accepted ownership, tenant-isolation, authorization, migration, and dependency boundaries.
- Provide one inventory abstraction for an entire villa, a homestay, and a small hotel while retaining physical Unit identity.
- Make every availability and price result bounded, deterministic, explainable, and ready for later Reservation contracts.
- Make commercial packaging centralized and additive without implementing SaaS billing.
- Define an incremental implementation that can stop safely at every prerequisite or verification gate.

**Non-Goals:**

- Absorbing or reimplementing Phase 1 authentication or Phase 2 Property/property-scope work.
- Creating a Reservation-shaped placeholder, callable hold/commit/release stub, payment/invoice record, guest/stay data, or fabricated booking counters.
- Resolving future legal/accounting policy beyond a typed configurable fee/tax mechanism; a property cannot publish an unconfigured rule.
- Replacing tenant-host authority with a property slug, subdomain, custom domain, or request parameter.

## Decisions

### 1. Treat Phase 1 and Phase 2 as hard implementation gates

The apply workflow first verifies, without changing Phase 3 code, that:

1. the Phase 0 package is accepted in repository history;
2. the archived Phase 1 verification remains available and its authentication, tenant-lifecycle, membership, and session boundaries have not regressed;
3. `add-property-foundation` is complete, synced, and archived with its tenant-owned Property, canonical IANA timezone/classification, owner-defined lifecycle/configurability/serviceability predicates, safe published identity, active membership Property grants, same-Tenant role/grant constraints, protected staff routes, and narrow atomic audit contract verified; and
4. the canonical baseline (`format:check`, `prisma:validate`, strict OpenSpec validation, `lint`, `typecheck`, unit tests, disposable-PostgreSQL integration tests, relevant tenant-host E2E, and `build`) is green, with no environment blocker being treated as a pass.

If any gate is absent, Phase 3 application pauses. It does not silently add the missing foundation or weaken the gate. Phase 1 remains the owner of authenticated membership, and the Phase 2 Property, Identity scope, and Audit contracts remain the owners that Phase 3 consumes rather than duplicates.

**Alternatives considered:** implement all missing phases in this change, or trust the prompt's premise. Both were rejected because they would create an oversized security-sensitive change and contradict executable repository evidence.

### 2. Preserve bounded-context ownership while using a shared supply vocabulary

Phase 3 extends the Phase 2 Property module with `RoomType`, occupancy, bed configuration, and `Unit`, because those concepts identify the accommodation rather than consuming capacity. Inventory owns `InventoryPool`, `InventoryBlock`, `InventoryOverride`, and availability queries. Pricing owns `RatePlan`, append-oriented rate/rule versions, restrictions, fees, taxes, indicative rates, and quote calculation. A narrow `entitlements` module is the capability-policy seam of the Platform Billing context; it owns no charge, invoice, renewal, or payment behavior.

```text
src/app transport and composition
  -> properties public application contract (Property, RoomType, Unit)
  -> inventory public application contract (capacity, blocks, availability)
  -> pricing public application contract (plans, rules, restrictions, quotes)
  -> entitlements public application contract (effective capability)
  -> audit public application contract (append-only operator evidence)

module domain/application
  -> module-owned repository ports
  -> Prisma/PostgreSQL adapters in the owning module
```

An orchestration service may compose public read contracts for a price preview or public offer. Pricing never imports Inventory repositories, Inventory never writes Pricing tables, and `src/app` never calls Prisma. Shared utilities contain only business-neutral date, money serialization, validation, error, database, and logging primitives.

Because the accepted Phase 0 product ADR predates the Website-as-a-Service packaging, implementation adds a clarifying/superseding ADR. It also records the decisions that every Unit belongs to a RoomType and that the entitlement subset is delivered before full Platform Billing.

**Alternatives considered:** move RoomType/Unit into Inventory, create one large rooms-and-rates module, or scaffold all future contexts. These were rejected because they blur accepted ownership or create empty target-only modules.

### 3. Use RoomType for every sellable category and Unit for every physical resource

Every `RoomType` belongs to exactly one `(tenant_id, property_id)` and has a normalized property-unique code, name, description, lifecycle, occupancy policy, and optimistic `version`. Canonical occupancy fields are:

- `base_adults >= 1`;
- `max_adults >= base_adults`;
- `max_children >= 0`;
- `max_guests >= max_adults`; and
- requested adults/children and total guests must each respect their bound.

Optional bedrooms, bathrooms, and typed bed-quantity child rows remain catalog data; no free-form JSON becomes an invariant. `DRAFT -> ACTIVE -> INACTIVE -> ACTIVE` is allowed, while any non-archived state can archive and `ARCHIVED` is terminal. Activation requires valid occupancy and at least one non-archived Unit, but not a live RatePlan so Starter catalog content can exist without real-time pricing.

Every `Unit` belongs to one RoomType in the same tenant/property. This deliberately resolves the Phase 0 proposal that allowed an entire-property Unit without a RoomType in favor of the Master Prompt's invariant. A private villa uses `RoomType: Entire Villa` plus one Unit. Unit status is current operational eligibility, not nightly availability:

- `ACTIVE` contributes to future base capacity;
- `OUT_OF_SERVICE` contributes zero until reactivated;
- `INACTIVE` contributes zero and is not operational;
- `ARCHIVED` is terminal and contributes zero.

Temporary or scheduled maintenance is an InventoryBlock, not a status mutation. Internal notes, unit codes, floor, and block reasons never enter public DTOs.

**Alternatives considered:** optional RoomType for villas and logical quantity-only Units. Both were rejected because one consistent hierarchy makes ownership, public catalog, occupancy, pricing, and later assignment contracts simpler and testable.

### 4. Use one hybrid InventoryPool per RoomType and derive Phase 3 availability from sparse exceptions

Each RoomType has exactly one InventoryPool with allocation mode:

- `PHYSICAL_UNIT` for a uniquely sold resource; Phase 3 requires exactly one non-archived Unit and capacity is at most one; or
- `POOLED` for interchangeable Units sold by quantity before a future physical assignment.

The common availability contract hides that distinction. Base capacity for a future stay date is the count of current `ACTIVE` Units in the pool. Phase 3 does not persist or pretend to subtract held/confirmed reservations. The Phase 4 design will add atomic daily `held`/`confirmed` counters or physical allocation ranges behind the same contract, as already required by ADR 0015.

Phase 3 persists only exceptions:

- `InventoryBlock` is an active or removed half-open range. A Unit block names one Unit and blocks one distinct unit; a RoomType block has either a positive quantity or an explicit full-close flag. Scope forms are mutually exclusive.
- `InventoryOverride` is unique per pool/local date and stores an absolute `sellable_cap`. It can only reduce, never raise, availability.

For each requested night, the Phase 3 algorithm is:

```text
eligibleCapacity = count(current ACTIVE units)
unitBlocked       = count(distinct ACTIVE units with an active Unit block)
typeBlocked       = sum(active RoomType quantity blocks), or full close
afterBlocks       = max(0, eligibleCapacity - unitBlocked - typeBlocked)
available         = min(afterBlocks, sellableCap when present)
```

The stay-wide available quantity is the minimum nightly quantity. A block or override command locks the InventoryPool, evaluates every affected night in ascending order, and rejects a result below zero or a cap above eligible capacity. Overlapping Unit blocks for the same Unit are retained for their distinct operational reasons but count that Unit only once on an overlapping night; exact duplicate commands are idempotent or rejected. Overlapping RoomType quantity blocks are allowed only when the combined result remains valid. Removal is a lifecycle action with actor/time/reason and audit evidence, not a hard delete.

No infinite nightly rows are pre-generated. Bounded reads load Unit counts, overlapping ranges, and sparse overrides in batched queries and enumerate local dates in application memory. This is appropriate for the expected MVP size and leaves Phase 4 free to introduce the daily allocation ledger only when reservations need it.

**Alternatives considered:** pre-generate all InventoryDay rows, store a mutable `available` boolean, or let overrides add capacity. They were rejected because they create unbounded storage, multiple authorities, or implicit overbooking.

### 5. Use a date-only domain type and named query limits

`StayDate` is a validated canonical `YYYY-MM-DD` value persisted as PostgreSQL `DATE`. Date arithmetic parses year/month/day and uses UTC calendar arithmetic only to increment or compare the Gregorian date; it never derives a hotel night from server-local `new Date()` behavior. Property-local "today" is obtained with the Property's validated IANA timezone. Instants such as creation, audit, and calculation time remain UTC `TIMESTAMPTZ(6)`.

All ranges are `[startDate, endDate)`. Defaults are centralized policy values, not scattered magic numbers:

- maximum stay: 30 nights;
- maximum availability/rate/block/calendar request: 366 nights;
- maximum advance horizon: 730 days from Property-local today; and
- maximum requested RoomType quantity in one real-time check: 100.

Real-time availability and quotes reject past arrival dates. Historical configuration/audit reads use separate bounded contracts. These values can change through an explicit product-policy change without changing date semantics.

**Alternatives considered:** UTC timestamps for stay nights and browser/server timezone conversion. They were rejected because they produce incorrect hotel-night boundaries and inconsistent behavior between Jakarta and Makassar properties.

### 6. Keep capacity availability separate from commercial bookability

Inventory's `CheckAvailability` accepts trusted tenant/property scope, a RoomType, stay period, and quantity. It returns a structured per-night result, stay minimum, `asOf`, source revision, status, and capacity reason. It does not accept a RatePlan and does not evaluate minimum stay, CTA/CTD, stop sell, price, or entitlement.

Pricing's `ValidateRestrictions` evaluates commercial bookability for a RatePlan and stay. An application-level offer/quote orchestrator first checks permission/entitlement as applicable, then calls public Property, Inventory, and Pricing contracts. This prevents a RatePlan rule from becoming an Inventory table mutation and prevents callers from treating a capacity read as a right to purchase.

The future Reservation contract will synchronously call `CheckAvailability` and `CalculatePriceQuote`, then atomically call Phase 4-owned `HoldInventory`/`CommitInventory` operations. Phase 3 documents those future signatures in the handoff but does not expose callable stubs that always succeed or fail.

**Alternatives considered:** one boolean `available` or a single service that mixes rates and capacity. They were rejected because useful diagnostics, context ownership, and future atomic allocation would be lost.

### 7. Scope each RatePlan to one InventoryPool and keep pricing versions append-oriented

One RatePlan belongs to exactly one RoomType's InventoryPool in the MVP. This avoids premature many-to-many assignment and makes currency, occupancy, restriction, and calendar queries unambiguous. Operators may duplicate a plan intentionally; reusable templates can be a later capability.

RatePlan lifecycle is `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`; archived is terminal. Activation requires an active RoomType, compatible pool, currency, one active base rate, and no conflicting rules. Only active plans produce real-time quotes.

Rate/rule updates never overwrite commercially relevant history. They close or supersede an old system version and insert a new version while incrementing the RatePlan revision. A quote records the plan revision and selected rule IDs/versions. Supported nightly replacement layers are:

1. required base rate;
2. weekday rate;
3. highest-priority matching season rate; and
4. exact-date override.

Later layers replace the earlier nightly base; they do not add together. One exact-date rule may apply per plan/date. Overlapping seasons require distinct priorities; an equal-priority tie is rejected rather than resolved by query order. Weekday rules are operator-defined and holidays are ordinary named season/date ranges, never hard-coded.

Bulk operations accept one plan, a half-open range of at most 366 nights, selected weekdays where applicable, an expected revision, and an explicit rule/amount. They run in bounded batches in one reviewed transaction where feasible and append one coherent audit summary rather than one HTTP request or audit event per cell.

**Alternatives considered:** a single `room.price`, shared many-to-many plans, mutable rows, and retrieval-order precedence. They were rejected because they cannot explain historical or concurrent price changes safely.

### 8. Implement a narrow deterministic pricing policy and transient PriceQuote

The first operational pricing set includes base/weekday/season/date rates; minimum/maximum stay, CTA, CTD, and stop sell; extra-adult pricing above `base_adults`; non-negative fixed fees with `FIXED_PER_STAY` or `FIXED_PER_NIGHT` modes; and configurable non-compound excluded percentage tax. Promotions remain a public contract seam and quote discount-line type but have no Phase 3 mutation or eligibility engine. Inclusive tax, percentage fees, per-guest fees beyond the explicit extra-adult rule, and compound tax remain deferred until accounting policy is approved.

All authoritative monetary values are PostgreSQL `BIGINT` and application `bigint` with a three-letter uppercase currency and captured unit scale. REST/RSC client DTOs serialize amounts as decimal strings. Percentages use integer basis points. Mixed-currency operations fail before arithmetic.

Calculation order is fixed:

```text
validate scope, dates, occupancy, availability and active RatePlan
-> evaluate min/max stay, CTA, CTD and stop sell
-> select one nightly base by exact-date > season priority > weekday > base
-> add per-night extra-adult amounts
-> apply no discounts in Phase 3 (the output remains extensible)
-> add named fees
-> calculate named excluded taxes on explicitly configured taxable lines
-> verify sum(lines) == total
```

Integer division uses one documented half-up rounding function with stable remainder allocation by `(stayDate, lineType, ruleId)`. Excluded tax is added only to its explicitly configured taxable line categories. Unconfigured or ambiguous tax/fee rules cannot be activated.

`PriceQuote` is a transient value object, not a database aggregate. It includes canonical input, Property timezone, per-night lines, adjustment/tax/fee/discount arrays, subtotal and total, currency/unit scale, calculation version, RatePlan revision, selected rule versions, `calculatedAt`, `expiresAt`, and a canonical calculation fingerprint. A centralized quote-validity policy defaults to 15 minutes; timestamps and expiry are metadata and do not change the monetary fingerprint. Phase 4 persists its own immutable snapshot.

Starter public pricing uses a separate Pricing-owned `IndicativeRate` per RoomType. Its DTO always labels the amount as indicative/"starting from", carries no availability claim, and is available even when no real-time RatePlan entitlement exists.

**Alternatives considered:** persisting expiring quotes now, using JavaScript numbers, deriving Starter prices from live availability, or implementing a generic rule DSL. They were rejected as premature or unsafe.

### 9. Resolve entitlements centrally at Organization scope without implementing billing

The entitlement module owns a stable code catalog, a centralized plan-to-capability map, append-oriented ProductAccess assignment history with exactly one active assignment per Tenant, and append-oriented TenantCapabilityOverride history with at most one active override per capability. Plan codes are `STARTER`, `PROFESSIONAL`, and `PREMIUM`; an override is `ENABLED` or `DISABLED`, records its source (such as an add-on or support correction), revision, actor, and audit reason, and wins over the base plan. Inactive/superseded records remain interpretable but do not affect current resolution. Missing/invalid ProductAccess fails closed rather than guessing a tier from a hostname.

Phase 3 adds granular operational capabilities absent from the business brief:

- Starter baseline: `PUBLIC_WEB_PRESENCE`, `CUSTOM_BRANDING`, `DIRECT_WHATSAPP_BOOKING`, `PUBLIC_ACCOMMODATION_CATALOG`, and `INDICATIVE_RATE_PUBLICATION`.
- Professional baseline adds `ROOM_MANAGEMENT`, `INVENTORY_MANAGEMENT`, `BLACKOUT_DATE_MANAGEMENT`, `REALTIME_AVAILABILITY`, `RATE_MANAGEMENT`, and `AVAILABILITY_CALENDAR`. Its commercial mapping also includes the future `ONLINE_BOOKING`, `BOOKING_NOTIFICATION`, and `INVOICE_GENERATION` keys, which are not operational until their owning phases implement them.
- Premium inherits Professional and commercially includes `SEM_REPORTING`, which remains non-operational in Phase 3.
- Future or add-on identifiers such as `PAYMENT_GATEWAY`, `CUSTOM_DOMAIN`, `MULTILINGUAL`, and `CHANNEL_MANAGER` can be explicitly granted but do not create an endpoint, job, provider, or implemented feature.

The resolver distinguishes an effective grant from release availability so a catalogued/purchased future key is not presented as operational. Phase 3 service gates request only Phase 3 operational capabilities. A downgrade changes ProductAccess and authorization outcomes but never deletes configuration; re-upgrade exposes retained data.

Entitlement is organization-scoped in this increment. Property-specific commercial packaging can later be added through a scoped grant without changing authorization or core tables. Entitlement changes require an explicit platform-authorized service, optimistic revision, and audit; tenant staff cannot self-upgrade through a client payload.

**Alternatives considered:** direct `plan ===` checks, property-specific plans now, inferring plan from subdir/subdomain, and building subscription billing. They were rejected because add-ons, multi-property organizations, routing, and commercial collection are separate concerns.

### 10. Compose validation, identity, tenancy, property scope, permission, and entitlement at every boundary

Protected Phase 3 operations use this order:

```text
strictly parse external input
-> verify authenticated subject
-> resolve trusted tenant from host infrastructure
-> require active same-tenant membership and allowed Tenant state
-> require the operation's explicit permission
-> require same-tenant Property grant
-> resolve the required operational entitlement
-> call the owner application service with trusted context
-> enforce aggregate and database invariants
-> select an explicit DTO and append required audit evidence
```

Permissions added through the existing catalog are `room_type.read/manage`, `unit.read/manage`, `inventory.read/manage`, `availability.read`, `rate_plan.read/manage`, and `pricing.read/manage`. Roles remain groupings; services never check role names. Tenant owners may receive the permissions through provisioning, while other role changes require explicit review. A client-supplied tenant ID, property ID, RoomType ID, Unit ID, plan code, status, amount, or actor remains untrusted command data, not authority.

Missing permission/property scope returns a generic authorization failure without probing the record. A missing effective capability returns safe `403 FEATURE_NOT_ENTITLED`; a catalogued but unavailable future feature is not routed as an implemented operation. Repositories always predicate by tenant and property before resource ID and select named fields only.

All tenant/property-owned parents expose composite unique keys and children reference `(tenant_id, property_id, id)` so another tenant/property cannot be linked even if an application check regresses. Internal fields and raw ORM errors never cross response boundaries.

**Alternatives considered:** UI-only gating, role names, entitlement as authorization, and lookup-by-ID followed by authorization. All were rejected as IDOR or packaging bypass risks.

### 11. Use Server Components for reads, Server Actions for staff mutations, and Route Handlers for stable HTTP contracts

After the Phase 1 staff shell and Phase 2 Property routes exist, the PMS surfaces live below the protected Property route and include:

- accommodation/RoomType list and editor;
- Unit list and explicit status actions;
- bounded availability and block calendar;
- RatePlan/rate calendar with one bounded bulk editor; and
- price preview with full line explanation.

Server Components call application queries directly. Client Components are limited to interactive grids/forms and receive serializable date strings and decimal-string Money DTOs. Staff form mutations use Server Actions with strict schemas, expected revisions, and path revalidation. Stable/public or externally consumable reads and mutations use versioned Route Handlers under `/api/v1/...`; UI code does not call its own HTTP API unnecessarily. Dynamic `params`, `searchParams`, `headers()`, and `cookies()` follow the installed Next.js asynchronous APIs.

Calendar reads are one batched request/query per visible range, never one request per cell. Responses are private/no-store for staff. Public accommodation DTOs are explicitly cacheable only after a Phase 2 public Property resolver supplies a published Property context; subdirectory, subdomain, or later custom-domain routing resolves identity but never grants staff authority. Existing `TenantDomain` is not repurposed as a Property host mapping.

The UI shows only actual RoomType, Unit, block, override, rate, and quote data. It contains no Booked, Revenue, Occupancy, Guest, or other Reservation-derived claims.

**Alternatives considered:** route handlers as an internal BFF for every Server Component read, client-side database fetching, or adapting the public `/dashboard` mock. They were rejected because they add waterfalls, leak boundaries, or misrepresent a prototype as PMS authority.

### 12. Make mutation history append-oriented and keep events lightweight

Phase 3 introduces the minimum real Audit owner required by commercial mutations. RoomType/Unit lifecycle changes, block/override changes, RatePlan/rate/restriction changes, and ProductAccess/override changes append an `AuditEvent` in the same PostgreSQL transaction, with tenant/property, actor, action, aggregate, reason where required, correlation/request IDs, UTC time, version, and a redacted changed-field summary. No credential, full request, internal note, or sensitive value is copied.

Aggregates produce a small versioned domain-event envelope for meaningful facts such as `room_type.activated`, `unit.status_changed`, `inventory.blocked`, `inventory.adjusted`, `rate_plan.activated`, `rate.updated`, and `entitlement.changed`. With no durable consumer in Phase 3, delivery is in-process after commit and no critical behavior depends on it. A transactional outbox is added only with the first durable consumer, per ADR 0013; no broker is introduced now.

Rate history is the append-oriented rule/version model, not only an audit blob. Block removal and lifecycle archives retain the domain record. This preserves explanation without building event sourcing.

**Alternatives considered:** console logs as audit, one event per changed cell, and an unused outbox/broker. They were rejected because they either lose evidence or add infrastructure without a consumer.

### 13. Enforce critical invariants in PostgreSQL and use optimistic concurrency at aggregate boundaries

Forward migration SQL supplements Prisma where needed. At minimum it provides:

- explicit `tenant_id` and `property_id` on every owned row;
- composite foreign keys preventing cross-tenant and cross-property RoomType, Unit, pool, block, override, plan, rate, restriction, fee, and tax relations;
- normalized code uniqueness per Property or RatePlan scope;
- checks for occupancy, non-negative capacity/quantity/money, basis-point bounds, currency shape, and `start_date < end_date`;
- one pool per RoomType and one override per pool/date;
- constraints for mutually exclusive block scope and fee/rate rule shapes;
- idempotency/uniqueness constraints that prevent duplicate block commands and ambiguous exact-date/equal-priority rate rules while allowing distinct overlapping Unit-block reasons to count once; and
- monotonic integer `version` fields checked by update commands.

Mutation services lock or compare the narrow owning aggregate (`InventoryPool`, RatePlan, ProductAccess) and fail with a stable conflict code on stale revision. Bulk operations are bounded and all-or-nothing for their declared range. Basic CRUD uses no Redis lock.

Indexes begin with tenant/property and follow supported reads, including RoomType/Unit status, overlapping block ranges, pool/date overrides, RatePlan status, and rate/restriction ranges. Query-plan evidence for 30-day representative datasets is recorded before adding speculative indexes.

**Alternatives considered:** application-only ownership checks, generic nested Prisma writes, and many speculative indexes. They were rejected because true invariants and isolation need database defense while indexes need workload evidence.

### 14. Verify behavior at domain, PostgreSQL, HTTP/UI, security, architecture, and performance levels

Pure tests cover lifecycle, occupancy, StayDate/range semantics, availability formulas, rule precedence, restriction evaluation, rounding, fee/tax calculations, Money currency mismatch, quote fingerprint stability, and entitlement resolution. PostgreSQL tests apply every committed migration to a disposable database and exercise composite ownership, uniqueness, ranges, block/rate concurrency, optimistic revisions, and transaction rollback.

Negative tests prove other-tenant and other-property known IDs cannot read or mutate any Phase 3 record, a Starter cannot call real-time inventory/rate services, a missing ProductAccess fails closed, mass-assigned ownership/status/money fields are ignored or rejected, and public DTOs omit internal codes/notes/block reasons. Architecture checks enforce `app -> public application contract -> domain -> owned repository/shared infrastructure` and prohibit private cross-module repository imports.

E2E covers the required villa, homestay, hotel, price-precedence, tenant attack, property attack, Starter denial, and upgrade-without-migration scenarios using only Phase 3 data. Representative baselines report dataset, environment, warm-up, sample count, and observed distribution for RoomType list, 30-day availability, 30-day rate calendar, and 2–7-night quote; they are regression evidence, not an invented enterprise SLA.

Structured diagnostics include safe tenant/property/resource/actor/request/correlation identifiers. Metrics use bounded labels for availability checks, quotes, mutations, and entitlement denial; resource IDs are not metric labels.

## Risks / Trade-offs

- **[Prerequisite changes may alter public contracts]** -> Re-read implemented Phase 1/2 artifacts at apply time and update this change before coding if their accepted contracts conflict.
- **[Current Unit status is not effective-dated]** -> Limit real-time queries to present/future dates and use dated blocks for planned outages; preserve audit history and defer historical capacity reconstruction.
- **[Sparse range evaluation is slower than a daily ledger at larger scale]** -> Enforce bounded windows, batch queries, measure 30-day workloads, and introduce the Phase 4 daily allocation ledger behind the existing contract only when reservations require it.
- **[RoomType quantity blocks plus Unit blocks can interact]** -> Lock the pool and validate every affected night atomically; reject invalid overlaps rather than clamp silently.
- **[Integer fee/tax policy can still be legally wrong]** -> Make every rule explicit/versioned, require configuration ownership, expose calculation lines, and prohibit activation until product/legal/finance approves the configured behavior.
- **[Organization-level entitlement may be too coarse for future multi-property packaging]** -> Keep entitlement scope behind one resolver and stable capability keys so later property grants are additive.
- **[Future capabilities can be mistaken for shipped behavior]** -> Distinguish catalog, commercial grant, and operational release state; Phase 3 gates only implemented capabilities and documentation labels the rest planned.
- **[Audit introduction expands Phase 3]** -> Implement only append-oriented mutation evidence required by this phase; defer broad audit search/export/retention UI and durable event delivery.
- **[The existing worktree contains unrelated user changes]** -> Restrict edits to approved Phase 3 files and touched shared catalogs/docs, inspect every diff, and never reset or overwrite unrelated work.

## Migration Plan

1. Stop unless the Phase 0–2 gates and a clean current baseline are evidenced. Local Phase 2 disposable-PostgreSQL execution now has 29/29 passing evidence, but do not proceed while the required full E2E/final-gate record, spec sync, or archive is pending; record the exact blocker instead of marking work complete.
2. Reconcile accepted ADRs: updated product packaging, universal RoomType/Unit hierarchy and hybrid pool, property-local dates/sparse Phase 3 availability, RatePlan/rate precedence, and entitlement-without-billing ownership.
3. Add the centralized StayDate, Money, error, logging, authorization, and operational-limit primitives only where not already supplied by prior phases.
4. Add ProductAccess/entitlement persistence and resolver first, with idempotent catalog/provisioning and fail-closed tests.
5. Extend Property with RoomType/Unit, then add Inventory pools/blocks/overrides and Pricing plans/rules/restrictions/indicative rates in separate additive forward migrations. Apply only to a validated disposable PostgreSQL database during implementation.
6. Introduce public module contracts and application services, then protected Server Actions/Route Handlers and minimum PMS/public projections. Keep legacy prototype reads/writes unchanged.
7. Extend the implemented Phase 2 audit append contract with Phase 3-owned action/metadata allowlists and add in-process event envelopes with each mutation rather than creating a second audit foundation.
8. Classify legacy data. Migrate only verified operator-owned records through idempotent scripts and reconciliation; leave affiliate/mock records `MANUAL_REVIEW`.
9. Run domain, integration, security, architecture, E2E, performance, and full repository gates. Record exact commands, exit codes, datasets, skips, and environmental blockers in `verification.md` and the session handoff.
10. Produce the mandated Phase 3 report and handoff. Return one readiness verdict with rationale and stop before Reservation work.

Rollback disables Phase 3 capability grants and routes/UI, deploys the prior compatible application, and retains all additive configuration. No normal rollback deletes tenant data. Any applied schema defect is corrected with a reviewed forward migration; existing migrations are never edited.

## Open Questions

No material Phase 3 question is intentionally left unresolved. Phase 4 still owns hold TTL, allocation/confirmation concurrency commands, Reservation price snapshots, and the exact integration of held/confirmed daily counters. Legal/accounting owners still control which configured fee/tax policies may be enabled in production; the typed calculation behavior above is fixed regardless of the chosen values.
