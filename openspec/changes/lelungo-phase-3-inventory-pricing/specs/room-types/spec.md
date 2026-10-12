## Purpose

Define the tenant- and property-owned sellable accommodation categories, canonical occupancy rules, lifecycle, and safe public projection used by Lelungo's shared villa, homestay, guest-house, and small-hotel supply model.

## ADDED Requirements

### Requirement: Tenant and property ownership

Every RoomType SHALL belong to exactly one Tenant and exactly one Property, the referenced Property MUST belong to that same Tenant, and all RoomType commands and queries MUST constrain access by trusted server-resolved tenant and property context rather than treating a caller-supplied identifier as authority.

#### Scenario: Same-tenant RoomType creation

- **WHEN** an authorized command creates a RoomType for a Property owned by the resolved Tenant
- **THEN** the RoomType is persisted with that Tenant and Property as its immutable ownership boundary

#### Scenario: Cross-tenant Property reference

- **WHEN** a command issued in Tenant A's context references a Property owned by Tenant B
- **THEN** RoomType creation is denied before any Tenant B data is exposed or mutated

### Requirement: Sellable category separation

A RoomType MUST represent a sellable accommodation category and pooled inventory identity, and MUST NOT be treated as a physical Unit, a nightly inventory quantity, an availability boolean, or a price field.

#### Scenario: Entire-property villa category

- **WHEN** a private villa is configured for entire-property sale
- **THEN** the system represents `Entire Villa` as one RoomType whose physical accommodation is represented separately by one Unit

#### Scenario: Multi-unit hotel category

- **WHEN** a hotel has several interchangeable Deluxe rooms
- **THEN** the system represents Deluxe as one RoomType and each physical room as a separate Unit belonging to that RoomType

### Requirement: Canonical occupancy configuration

A RoomType MUST store integer `baseAdults`, `maxAdults`, `maxChildren`, and `maxGuests` values such that `baseAdults >= 1`, `maxAdults >= baseAdults`, `maxChildren >= 0`, and `maxGuests >= maxAdults`. `maxGuests` SHALL be the total simultaneous guest limit, while `maxAdults` and `maxChildren` are independent sub-limits; configuration validity MUST NOT require `maxGuests >= maxAdults + maxChildren`.

#### Scenario: Valid occupancy with independent sub-limits

- **WHEN** a RoomType is configured with `baseAdults = 2`, `maxAdults = 4`, `maxChildren = 2`, and `maxGuests = 4`
- **THEN** the configuration is accepted and a future occupancy request remains subject to the adult limit, child limit, and total guest limit independently

#### Scenario: Invalid occupancy bounds

- **WHEN** a RoomType is submitted with zero `baseAdults`, `maxAdults` below `baseAdults`, a negative `maxChildren`, or `maxGuests` below `maxAdults`
- **THEN** validation rejects the RoomType without persisting any partial change

### Requirement: Property-scoped RoomType code

Every RoomType MUST have a normalized internal code that is unique within its Property, and the uniqueness rule MUST remain enforceable independently for RoomTypes in different Properties.

#### Scenario: Duplicate RoomType code in one Property

- **WHEN** a second RoomType is created or renamed to a code already used by another RoomType in the same Property
- **THEN** the operation is rejected with a stable code-conflict error

#### Scenario: Same RoomType code in different Properties

- **WHEN** two Properties define RoomTypes with the same normalized code
- **THEN** both definitions are accepted when all other invariants hold

### Requirement: Explicit RoomType lifecycle

A RoomType SHALL have exactly one of `DRAFT`, `ACTIVE`, `INACTIVE`, or `ARCHIVED` status, lifecycle changes MUST occur through intent-specific domain operations rather than generic status mass assignment, and `ARCHIVED` MUST be terminal. Activation MUST require valid occupancy configuration and at least one same-property non-archived Unit, but MUST NOT require a real-time RatePlan so a Starter catalog can be published independently.

#### Scenario: Activate a valid draft

- **WHEN** an authorized actor activates a DRAFT RoomType whose required configuration is valid
- **THEN** the RoomType transitions to ACTIVE through the activation operation

#### Scenario: Activation has no Unit

- **WHEN** an actor attempts to activate a DRAFT RoomType that has no same-property non-archived Unit
- **THEN** activation is rejected and the RoomType remains DRAFT

#### Scenario: Attempt to reactivate an archived RoomType

- **WHEN** any actor attempts to activate, deactivate, or otherwise change an ARCHIVED RoomType's lifecycle status
- **THEN** the operation is rejected and the RoomType remains ARCHIVED

### Requirement: Lifecycle-aware sellability and retention

Only an ACTIVE RoomType SHALL be eligible for new sellable availability or a bookable offer. DRAFT, INACTIVE, and ARCHIVED RoomTypes MUST NOT become newly sellable, and archival MUST retain the record required to interpret historical configuration rather than deleting it.

#### Scenario: Inactive RoomType availability request

- **WHEN** availability or pricing evaluates an INACTIVE RoomType for a new sale
- **THEN** the RoomType is treated as unavailable regardless of its Unit count or configured rates

#### Scenario: Archive preserves identity

- **WHEN** an authorized actor archives a RoomType
- **THEN** the RoomType is excluded from new sale while its stable identity and configuration remain retained

### Requirement: Separate internal and public RoomType projections

The system MUST map RoomType data to explicit internal and public DTOs. A public RoomType DTO SHALL expose only approved catalog information and MUST NOT expose the internal RoomType code, lifecycle-management details, tenant ownership fields, staff-only notes, Unit operational details, inventory overrides, or block reasons.

#### Scenario: Public accommodation catalog read

- **WHEN** a visitor requests a published RoomType through a public property projection
- **THEN** the response contains approved descriptive and occupancy information without internal codes, notes, status-management data, or operational inventory details

#### Scenario: Internal PMS read

- **WHEN** an authorized staff member with the required property scope requests a RoomType through a protected PMS operation
- **THEN** the internal DTO may include the management fields needed by that operation without reusing the public DTO as an authority boundary
