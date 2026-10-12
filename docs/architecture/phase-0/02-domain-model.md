# 02 — Target domain model

- **Current implementation:** `Tenant`, `TenantDomain`, `StaffMembership`, `Role`, `Permission`, and their join records are the only PMS foundation in Prisma. No Property, Unit, Inventory, Pricing, Reservation, Guest, Stay, Payment, Operations, or Distribution aggregate is implemented.
- **Target state:** A hospitality domain model that supports entire private villas and room-based homestays without conflating property classification, sellable capacity, reservation, stay, or payment state.
- **Decision status:** Proposed target model. `Tenant` as the Organization/isolation root and permission-based authorization follow accepted decisions; all new concepts require later OpenSpec and migration approval.
- **Last verified:** 2026-08-09

> **Target-only artifact.** Entity and table names below are architectural vocabulary, not evidence of Prisma models, migrations, services, or APIs.

The model is introduced incrementally under [12-phase-roadmap.md](12-phase-roadmap.md): Organization/Property in Phase 2, accommodation/Inventory/Pricing in Phase 3, Reservation in Phase 4, Guest/Stay in Phase 5, Payment/Finance in Phase 6, Operations in Phase 8, Distribution in Phases 9/11, and Analytics in Phase 10. Cross-phase relationships below are design seams, not permission to scaffold them together.

Current schema evidence is [prisma/schema.prisma](../../../prisma/schema.prisma) and [current-data-model.md](../../current-system/current-data-model.md); earlier target vocabulary is reconciled from [proposed-domain-model.md](../../target-system/proposed-domain-model.md).

## Modeling principles

1. An Organization is the tenant boundary; a Property is never an independent tenant.
2. Property classification describes the business, while inventory resources describe what can actually be sold.
3. A physical Unit is not a Room Type, and a Room Type is not a quantity counter.
4. Reservation, Stay, Payment, housekeeping state, and unit readiness have independent lifecycles.
5. Date-bound availability is authoritative in PostgreSQL and cannot be inferred from UI state, cache, or a single `room.price` field.
6. Cross-context references use stable IDs and public application contracts; sharing one database does not create shared ownership.

## Core hierarchy

```text
Organization (implemented persistence name: Tenant)
  +-- Staff memberships and scoped permissions
  +-- Property A
  |     +-- address, amenities, media, policies, timezone
  |     +-- physical units
  |     +-- optional room types
  |     +-- inventory pools
  |     +-- rate plans and restrictions
  +-- Property B
        +-- ...
```

An Organization owns one or more Properties. A membership is organization-scoped and can be granted organization-wide access or an explicit set of property scopes. The current `Tenant.id` is the Organization identifier during migration; Phase 0 does not rename the table or create a second isolation key.

## Accommodation model

The generic term `AccommodationType` is too ambiguous to carry both classification and inventory behavior. The target vocabulary separates it into:

- **PropertyClassification:** villa, homestay, guesthouse, or another expandable catalog value.
- **OccupancyType:** entire place, private room, or other policy-level occupancy description.
- **RoomType:** a commercial/operational grouping of compatible units, such as Deluxe or Family.
- **Unit:** a physical, assignable space with a stable identity, such as Entire Villa, Unit 101, or Unit 202.
- **InventoryPool:** the capacity authority for an item that can be sold for an occupancy date range.

### Private villa

```text
Organization
  +-- Property "Villa Merapi" [classification: VILLA]
        +-- Unit "Entire Villa" [occupancy: ENTIRE_PLACE]
        +-- InventoryPool "Entire Villa" [mode: PHYSICAL_UNIT, capacity: 1]
              +-- backed by the Entire Villa unit
```

The target does not require a fake hotel room or a numeric room inventory. The entire villa is one physical unit and an overlapping sale is blocked by a unit/date-range database invariant.

### Homestay or guesthouse

```text
Organization
  +-- Property "Homestay Melati" [classification: HOMESTAY]
        +-- RoomType "Deluxe"
        |     +-- Unit 101
        |     +-- Unit 102
        |     +-- Unit 103
        |     +-- InventoryPool "Deluxe" [mode: POOLED, capacity by day]
        +-- RoomType "Family"
              +-- Unit 201
              +-- Unit 202
              +-- InventoryPool "Family" [mode: POOLED, capacity by day]
```

A pooled reservation protects a quantity in the Room Type pool; a specific compatible Unit may be assigned later. Capacity ledgers prevent overselling the pool, while a separate date-range assignment constraint prevents one physical Unit from being assigned to overlapping stays.

### Mixed selling modes

Selling an entire villa and its child rooms for overlapping dates creates a resource-hierarchy conflict. Mixed mode is therefore **deferred**, not implicitly supported. A later design must introduce explicit mutually exclusive resource groups and prove that a parent and child cannot both be allocated. The first implementation should support either entire-property/unit sale or room-type sale per physical resource set.

## Bounded-context and entity catalog

| Bounded context                | Target concepts                                                                                                                  | Key relationships and invariants                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization & Tenancy         | Organization (`Tenant` initially), TenantDomain, organization settings                                                           | Organization is the isolation root. A Property, staff membership, role, and all operational data resolve to exactly one `tenant_id`.                                                                                  |
| Identity & Access              | ExternalSubject reference, StaffMembership, Role, Permission, PropertyScopeGrant                                                 | Authentication proves the subject; an active same-tenant membership plus explicit permission/scope grants authority. Role names alone do not.                                                                         |
| Property                       | Property, PropertyAddress, PropertyAmenity, Amenity, PropertyMedia, PropertyPolicy, PropertyClassification, RoomType, Unit       | A Property belongs to one Organization and owns its accommodation catalog. A Unit belongs to one Property and at most one active Room Type grouping at a time; an entire-property Unit can exist without a Room Type. |
| Inventory                      | InventoryPool, InventoryDay, InventoryAllocation/Hold, UnitAssignment, AvailabilityBlock                                         | A pool belongs to one Property. Physical-unit overlaps are excluded; pooled counters never exceed capacity; all occupancy intervals use `[check_in, check_out)`.                                                      |
| Pricing                        | RatePlan, Rate, PricingRule, Restriction, CancellationPolicy, PriceQuote and quote input/line versions                           | A rate plan targets compatible sellable inventory. Pricing calculates deterministic quotes; it does not own confirmed Reservation price evidence.                                                                     |
| Reservation                    | Reservation, ReservationItem, BookingSource reference, ReservationGuest link, PriceSnapshot, PriceLine, state transition/history | A Reservation belongs to one tenant/property boundary and owns its participant links and immutable confirmed price evidence. Reservation state is not payment or check-in state.                                      |
| Guest                          | GuestProfile, GuestContact, GuestIdentityRecord, GuestConsent                                                                    | PII is tenant-scoped, minimized, and permission-separated. Reservation refers to a minimum guest identity through its own `ReservationGuest` link rather than transferring profile ownership.                         |
| Payment                        | PaymentIntent, PaymentTransaction, ProviderEvent, Refund                                                                         | Provider operations are idempotent and append-oriented. Captured value and refundable balance are derived from immutable transactions.                                                                                |
| Finance                        | GuestInvoice, InvoiceLine, LedgerAccount, LedgerEntry/Posting, Settlement, Payout, Expense                                       | Guest finance is separate from Lelungo subscription billing. Balanced ledger postings, settlement, and owner payout never rewrite provider history.                                                                   |
| Operations                     | Stay, GuestStay, HousekeepingTask, MaintenanceTask, UnitReadiness                                                                | A Stay represents actual occupancy. Operations refers to Inventory-owned UnitAssignment through a public contract; checkout can trigger housekeeping without encoding cleaning state inside Reservation.              |
| Notification                   | Notification, TemplateVersion, DeliveryAttempt, Preference                                                                       | Delivery is asynchronous and idempotent; templates receive minimum fields rather than broad ORM objects.                                                                                                              |
| Search                         | PropertySearchDocument/Projection, location projection, availability/price hint                                                  | Search is a reconstructable read model. Search availability is never confirmation authority.                                                                                                                          |
| Review                         | Review, ReviewEligibility, ModerationDecision                                                                                    | Eligibility is derived from a completed stay; moderation and publication are separate from immutable submission history.                                                                                              |
| Promotion                      | Promotion, Coupon, EligibilityRule, Redemption                                                                                   | Promotions decide eligibility/benefit but do not mutate a confirmed PriceSnapshot. Redemptions are tenant-scoped and idempotent.                                                                                      |
| Distribution / Channel Manager | Channel, ChannelAccount, ChannelMapping, ExternalReservationRef, CalendarSource, CalendarSyncRun/Conflict                        | External property/unit IDs map to internal stable IDs. Imports are idempotent and conflicts are explicit; channel data never bypasses Reservation/Inventory invariants.                                               |
| Analytics                      | Domain-event projection, metric fact/aggregate                                                                                   | Analytics consumes events/read models and cannot mutate source domain tables.                                                                                                                                         |
| Audit                          | AuditEvent                                                                                                                       | Append-oriented actor/action/target/change metadata with tenant, request, and correlation IDs; sensitive values are redacted.                                                                                         |
| Platform Billing               | SubscriptionPlan, Subscription, SubscriptionInvoice, SubscriptionPayment, Entitlement history                                    | Owns Lelungo's commercial relationship with an Organization and remains isolated from guest Payment/Finance data, accounts, invoice sequences, and idempotency namespaces.                                            |

## Relationship model

```text
Organization 1 --- * Property
Organization 1 --- * StaffMembership * --- * Role * --- * Permission
StaffMembership 1 --- * PropertyScopeGrant * --- 1 Property

Property 1 --- 1 PropertyAddress
Property 1 --- * PropertyMedia
Property * --- * Amenity
Property 1 --- * RoomType
Property 1 --- * Unit
RoomType 1 --- * Unit                 (optional for an entire-property Unit)
Property 1 --- * InventoryPool
InventoryPool 1 --- * InventoryDay
InventoryPool 1 --- * InventoryAllocation
InventoryAllocation 0..1 --- 1 Unit  (required for physical-unit mode)

InventoryPool 1 --- * RatePlan
RatePlan 1 --- * Rate / Restriction
Reservation 1 --- * ReservationItem
ReservationItem * --- 1 InventoryPool
ReservationItem 1 --- 1 PriceSnapshot           (Reservation-owned)
Reservation * --- * GuestProfile                (through Reservation-owned ReservationGuest)
Reservation 1 --- 0..* Stay
Stay 1 --- * GuestStay
Stay 0..* --- UnitAssignment                    (Inventory-owned)

Reservation 1 --- * PaymentIntent
PaymentIntent 1 --- * PaymentTransaction
PaymentTransaction 1 --- * Refund
Settlement 1 --- * LedgerPosting
Payout 1 --- * LedgerPosting
Organization 1 --- 0..* Subscription            (Platform Billing-owned)
```

Cross-context arrows are references/contracts, not permission for direct repository access. For example, Payment stores a `reservation_id` reference but confirms a reservation through the Reservation application contract; it never updates `reservations` directly.

## State separation

| Concern                    | Owner       | Examples                                                                                        | Must not be stored as                              |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Commercial booking outcome | Reservation | pending, confirmed, cancelled, expired, no-show, fulfilled                                      | Payment provider status or check-in status         |
| Actual visit               | Operations  | planned, in-house, completed, cancelled                                                         | Reservation status or unit/housekeeping readiness  |
| Provider payment execution | Payment     | requires action, processing, authorized, captured, failed, voided, refunded                     | Reservation, invoice, settlement, or payout status |
| Accounting and owner funds | Finance     | invoice issued/voided, ledger posted/reversed, settlement matched, payout scheduled/paid/failed | Payment-provider or Reservation status             |
| Unit readiness             | Operations  | dirty, cleaning, inspected, ready, out-of-service                                               | Reservation or inventory-allocation status         |
| Capacity protection        | Inventory   | held, confirmed allocation, released, expired, blocked                                          | Cached availability boolean                        |

Read models may combine these states for a calendar or dashboard, but the source states remain separately owned.

## Ownership and authorization invariants

- Every tenant-sensitive aggregate carries trusted `tenant_id`; every property-owned reference must resolve to the same tenant.
- The server verifies a property scope grant after authenticating and resolving the Organization. A caller cannot widen access by supplying another `property_id`.
- Cross-tenant foreign relationships are prohibited with composite keys/constraints where PostgreSQL can enforce them, plus tenant-scoped application contracts and tests.
- Explicit DTOs select only required fields. Guest identity records, provider payloads, invoices, payouts, and staff data never flow through broad includes.
- The current membership-role join does not prove same-tenant assignment. Until a forward constraint migration exists, role assignment is a documented authorization risk and must not be described as production-safe.

## Domain invariants that drive later implementation

1. One physical Unit cannot have overlapping active allocations/assignments for the same occupancy interval.
2. A pooled InventoryDay cannot have `held + sold + blocked > capacity`.
3. Reservation confirmation requires valid allocation and an immutable PriceSnapshot; neither payment success nor a stale quote alone is sufficient.
4. A ReservationItem cannot cross tenant, property, currency, or occupancy boundaries without an explicitly modeled multi-property order; the initial design should keep one reservation within one property.
5. A refund cannot exceed captured, refundable value after prior refunds/chargebacks.
6. A payout cannot exceed settled owner-available funds and must remain reconstructable through balanced ledger postings.
7. A completed checkout creates/updates operational work through a contract/event; it does not mutate housekeeping fields on Reservation.
8. External channel imports obey the same availability and idempotency invariants as direct/PMS reservations.

## Decisions

### Decision: model a physical Unit and an Inventory Pool separately

- **Rationale:** A private villa sells one unique physical resource, while a homestay can sell interchangeable capacity before assigning a room.
- **Alternatives considered:** `Hotel -> Room -> Booking`; only a quantity per Room Type; force every property into a Room Type hierarchy.
- **Why alternatives were not selected:** They either cannot express pooled assignment safely or create artificial room records and obscure the physical overlap invariant.
- **Use now or later:** Adopt the vocabulary and invariants now; implement each persistence strategy only in its approved Inventory/Reservation phase.
- **Migration path:** Add Property and Unit additively, introduce InventoryPool with an explicit mode, backfill only new PMS data, and keep the legacy affiliate objects isolated until retired.

### Decision: keep Tenant as the initial Organization record

- **Rationale:** The implemented table already provides the intended isolation root, and a second organization key would create ambiguous authority.
- **Alternatives considered:** Rename `tenants` immediately; add a separate Organization above Tenant; make each Property a tenant.
- **Why alternatives were not selected:** Immediate renaming adds migration churn, a second root duplicates scope, and property tenancy prevents clean multi-property operation.
- **Use now or later:** Use `Tenant.id` as `organization_id` conceptually now. Revisit persistence naming only when downstream schemas and API vocabulary are stable.
- **Migration path:** Keep existing IDs and foreign keys; if naming is later changed, use expand/backfill/dual-read-or-view/contract rather than an in-place destructive rename.

### Decision: keep Reservation, Stay, Payment, and Operations as separate aggregates

- **Rationale:** They change for different actors, transaction boundaries, timing, and failure modes.
- **Alternatives considered:** One booking status enum containing payment, check-in, refund, and cleaning states; one large booking aggregate.
- **Why alternatives were not selected:** A Cartesian state explosion makes transitions ambiguous and lets provider/operational failures corrupt the commercial booking lifecycle.
- **Use now or later:** This separation is a design constraint now and an implementation requirement for later vertical slices.
- **Migration path:** New tables reference stable IDs and exchange explicit commands/events. Combined UI calendars are projections, never a merged source table.

## Deferred product decisions

- Exact cancellation products, tax treatment, guest identity retention, and invoice numbering require product/legal/finance ownership before their schema phases.
- Property support for mixed entire-place and child-room sales requires an explicit resource-conflict model and concurrency tests.
- Multi-property reservations are not part of the initial aggregate; a guest cart can later coordinate multiple property-specific reservations without weakening tenant/property invariants.
