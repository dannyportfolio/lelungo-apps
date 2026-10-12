## Why

Lelungo needs one authoritative accommodation-supply and pricing foundation that can serve a Starter public catalog today and later support Professional/Premium direct booking without plan-specific schemas or booking shortcuts. Phase 2 now supplies the tenant-owned Property seam, but the repository still has no RoomType, Unit, inventory, rate, pricing, or entitlement persistence, so these target capabilities must be implemented and verified before Phase 4 can safely create reservations.

## Context

- The repository retains the Next.js affiliate prototype alongside an archived Phase 1 authenticated-membership foundation and the Phase 2 `add-property-foundation` implementation in the working tree.
- Phase 2 now defines tenant-owned Property identity, canonical IANA timezone, classification/amenities, lifecycle/configurability/serviceability predicates, one safe published-identity resolver, same-Tenant Property-scope authorization, and a narrow audit append contract. Five individually invoked integration files passed 29/29 tests on disposable PostgreSQL 16, and focused real tenant-host authentication/missing-permission browser scenarios passed. The complete seven-scenario Property E2E rerun, final gate record, spec sync, and archive remain prerequisites; the focused browser result is not a full-suite pass.
- `Tenant` remains the persisted Organization/isolation root. Legacy deal and affiliate prices are not PMS inventory or pricing authority and are not migrated automatically.
- The approved product direction is Hospitality Website-as-a-Service + PMS + Direct Booking Platform. Starter, Professional, Premium, and add-ons use one domain model; centralized capabilities control which operations are enabled.

## Goals

- Model RoomTypes, physical Units, occupancy rules, hybrid physical/pooled inventory, manual blocks, sellable caps, and structured property-local availability for villas, homestays, guest houses, and small hotels.
- Model lifecycle-aware RatePlans, deterministic date-sensitive rates and restrictions, integer-safe Money, and explainable transient PriceQuotes that Phase 4 can snapshot.
- Add centralized organization-level plan and add-on entitlement resolution, while keeping entitlement checks distinct from staff permission and property-scope authorization.
- Expose bounded application contracts, validated staff/public DTOs, stable errors, and the minimum operational room, availability, rate, and price-preview UI needed for Phase 3.
- Preserve a Starter public accommodation/indicative-rate path without claiming real-time availability, and retain configuration across upgrade or downgrade.
- Add additive PostgreSQL constraints, security/integration/architecture tests, documented migration classification, observability, ADRs, OpenAPI, Phase 3 report, and Phase 4 handoff evidence.

## Non-goals

- Reservation, inventory holds/commit/release behavior, checkout, guest booking, confirmation, cancellation, refund, stay, housekeeping automation, payment capture/provider integration, guest invoices, or booking notifications.
- Subscription billing, renewal, SaaS invoice collection, SEM/Google Ads, custom-domain automation, multilingual delivery, channel/OTA synchronization, marketplace search, reviews, or photography workflows.
- Overbooking, AI/dynamic pricing, a generic pricing/finance DSL, sophisticated child-age pricing, distributed locks, Redis/Kafka/search infrastructure, network gRPC, or microservices.
- A broad legacy UI rewrite, destructive legacy migration, production migration/deployment, or duplication of the archived Phase 1 and current Phase 2 contracts.

## What Changes

- Introduce tenant/property-owned RoomType and Unit aggregates with explicit lifecycles, canonical occupancy fields, same-property constraints, unique property-scoped codes, and separate public/internal DTOs.
- Introduce a hybrid Inventory model in which every sellable RoomType has a pool backed by physical Units; entire-property accommodation uses one RoomType, one Unit, and capacity one, while multi-unit properties sell pooled capacity before later unit assignment.
- Add property-local `YYYY-MM-DD` stay semantics, half-open `[checkIn, checkOut)` ranges, bounded availability/calendar queries, Unit- and RoomType-scoped blocks, absolute sellable-cap overrides, and no-overbooking invariants. Phase 3 availability explicitly excludes reservation demand.
- Introduce one RoomType-scoped RatePlan per sellable pool for the MVP, versioned base/weekday/season/date rates, minimum-stay/CTA/CTD/stop-sell restrictions, extra-guest pricing, narrowly defined fees/taxes, deterministic precedence, and decimal-string Money DTOs backed by integer database units.
- Return transient, explainable PriceQuotes with rule/version references and nightly/adjustment lines; do not persist a Reservation or advertise the result as capacity ownership.
- Add a centralized plan/capability catalog and additive entitlement overrides. Catalog future capabilities without treating unimplemented booking/payment/SEM features as operational. Backend services enforce both permission/property scope and entitlement.
- Add versioned staff APIs/application actions and batched calendar operations, public accommodation/indicative-price projections, PMS setup/calendars/price preview, explicit lifecycle actions, stable errors, audit/rate history, and meaningful domain-event envelopes.
- Add append-only Prisma migrations, PostgreSQL integration/concurrency coverage, tenant/property IDOR and entitlement-bypass tests, architecture checks, representative performance baselines, architecture/domain/product/security docs, ADRs where decisions are significant, AGENTS guidance, and honest verification/readiness reports.

## Capabilities

### New Capabilities

- `room-types`: Tenant/property-owned sellable accommodation categories, occupancy rules, lifecycle, public catalog projection, and explicit DTOs.
- `units`: Physical accommodation identity, lifecycle/operational status, RoomType membership, and private-field exposure rules.
- `inventory`: Hybrid inventory pools, capacity source, sellable caps, no-overbooking invariants, and future Reservation contract boundary.
- `inventory-blocks`: Auditable Unit- and RoomType-scoped half-open blackout/maintenance blocks and removal behavior.
- `availability`: Bounded property-local single- and multi-night availability/calendar results with structured reasons and freshness.
- `rate-plans`: RoomType-scoped commercial plans, lifecycle, currency, activation requirements, and public/internal validation.
- `rates`: Versioned nightly base/weekday/season/date pricing, occupancy adjustments, fees/taxes, deterministic precedence, history, and bulk calendar mutation.
- `restrictions`: Minimum stay, CTA, CTD, and stop-sell evaluation at supported property/RoomType/RatePlan/date scopes.
- `price-quotes`: Deterministic, explainable, integer-safe, transient quotes and distinct Starter indicative-price publication.
- `entitlements`: Central plan/add-on capability resolution, backend enforcement, upgrade/downgrade retention, and `FEATURE_NOT_ENTITLED` behavior.

### Modified Capabilities

- `staff-authorization`: Require the new fine-grained supply/pricing permissions plus same-tenant property scope before protected Phase 3 operations, independently of product entitlement.

## Impact

- Extend the Phase 2 Property module for RoomType/Unit identity and add domain/application/infrastructure/public boundaries under `src/modules` for inventory, pricing, entitlements, and the minimum audit owner; `src/app` remains transport/composition and UI only.
- Additive Prisma models and forward migrations with explicit `tenant_id` and `property_id`, composite ownership constraints, bounded indexes, integer money, version fields, and audited history. Existing migrations and legacy Supabase analytics remain unchanged.
- New staff/public HTTP DTOs or Server Actions following installed Next.js 16 conventions; no controller, component, or route handler accesses Prisma directly.
- New PMS room/unit, availability, rate-calendar, and price-preview surfaces plus a public accommodation projection. Existing prototype routes remain until separately retired.
- Permission catalog additions, architecture/OpenAPI/domain/product/security documentation, session handoff, verification evidence, and a final `READY FOR PHASE 4` or `NOT READY FOR PHASE 4` decision.
- No new runtime database, broker, cache, search service, payment provider, package manager, or deployment topology.

## Risks

- Starting before the Phase 2 migration, isolation, authorization, public-projection, audit, and final quality gates are verified and archived would create unproven accommodation data; implementation must stop at the prerequisite gate.
- Date, block, override, and pricing precedence mistakes could misstate availability or price; explicit ADRs, PostgreSQL constraints, deterministic algorithms, golden tests, and concurrency tests mitigate this.
- Entitlement checks can be confused with authorization or imply unavailable products; services require both controls and distinguish catalogued future capabilities from operational features.
- Calendar materialization or bulk edits can become unbounded; all stay, query, block, and rate ranges use named limits and batched transactions with measured query plans.
- The scope is broad; tasks are sequenced as independently verifiable vertical increments and cannot be marked complete from documentation alone.

## Migration impact

- Use expand-only Prisma migrations after the Phase 2 forward migration and its constraints/backfill are verified on disposable PostgreSQL. Add tenant/property keys and composite foreign keys from the first Phase 3 table.
- Classify every legacy accommodation/price source as `KEEP`, `MAP`, `MIGRATE`, `DEPRECATE`, `REMOVE`, or `MANUAL_REVIEW`. Affiliate/mock data defaults to `MANUAL_REVIEW` and receives no automatic PMS ownership.
- Seed only stable global capability/plan definitions and authorized tenant plan assignments through idempotent application/administrative paths; do not infer a paid tier from hostname.
- Introduce new reads/writes alongside the legacy prototype. Any later switchover or legacy removal requires separate evidence and an approved contract phase.

## Rollback

- Disable Phase 3 routes/actions/UI and capability grants, then deploy the prior compatible application while retaining additive RoomType, Unit, inventory, rate, and entitlement data.
- Never delete configuration on downgrade or rollback and never edit an applied migration. Correct schema/data defects with reviewed forward migrations after backup and impact analysis.
- No production migration or deployment is performed by this change's planning phase.
