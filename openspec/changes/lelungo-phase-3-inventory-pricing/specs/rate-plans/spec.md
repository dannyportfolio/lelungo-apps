## Purpose

Define the tenant-safe commercial plan that binds one sellable accommodation category and inventory pool to one currency and an explicit lifecycle.

## ADDED Requirements

### Requirement: RatePlan has one sellable scope

Each RatePlan MUST belong to exactly one Organization, one Property, one RoomType, and the single InventoryPool that backs that RoomType for the MVP. The system MUST reject a RatePlan whose RoomType or InventoryPool belongs to another Organization or Property, and a RatePlan MUST NOT span multiple RoomTypes or InventoryPools.

#### Scenario: Same-scope RatePlan is created

- **WHEN** an authorized operation creates a RatePlan for a RoomType and its backing InventoryPool within the same Organization and Property
- **THEN** the system creates one RatePlan scoped only to that RoomType and InventoryPool

#### Scenario: Cross-property RatePlan is rejected

- **WHEN** a caller attempts to associate a RatePlan with a RoomType or InventoryPool from another Property or Organization
- **THEN** the system rejects the operation without creating or changing a RatePlan

### Requirement: RatePlan lifecycle is explicit

The system SHALL represent RatePlan lifecycle with exactly `DRAFT`, `ACTIVE`, `INACTIVE`, and `ARCHIVED`. Only an `ACTIVE` RatePlan SHALL be eligible for a new PriceQuote. An `INACTIVE` RatePlan SHALL be eligible to return to `ACTIVE` after validation, while `ARCHIVED` MUST be terminal and MUST remain available only for historical interpretation.

#### Scenario: Draft RatePlan is activated

- **WHEN** an authorized caller activates a valid `DRAFT` RatePlan
- **THEN** the system changes its status to `ACTIVE` and permits it to be selected for new PriceQuotes

#### Scenario: Inactive RatePlan cannot price a new stay

- **WHEN** a PriceQuote request selects an `INACTIVE` RatePlan
- **THEN** the system rejects the selection with a stable non-sellable-rate-plan error

#### Scenario: Archived RatePlan cannot be restored

- **WHEN** a caller attempts to activate or otherwise return an `ARCHIVED` RatePlan to a sellable status
- **THEN** the system rejects the transition and preserves the archived record

### Requirement: Activation validates sellability

The system MUST activate a RatePlan only when its Organization, Property, RoomType, and InventoryPool are serviceable, its currency is valid, and a versioned base rate exists in that same currency. Activation MUST fail atomically when any prerequisite is missing or incompatible.

#### Scenario: Activation prerequisite is missing

- **WHEN** a caller activates a RatePlan that has no valid base rate or references a non-serviceable RoomType or InventoryPool
- **THEN** the system leaves the RatePlan non-active and returns the failed prerequisite without partially publishing it

### Requirement: RatePlan uses one currency

Each RatePlan MUST declare exactly one supported three-letter currency code. Every rate, occupancy adjustment, fee, tax result, and PriceQuote associated with that RatePlan MUST use the same currency, and changing the currency of an active or historically used RatePlan MUST require a new version rather than reinterpret existing money.

#### Scenario: Mixed-currency rate is rejected

- **WHEN** a caller adds a rate or adjustment whose currency differs from the RatePlan currency
- **THEN** the system rejects the operation without converting or silently reinterpreting the amount

### Requirement: RatePlan changes preserve version evidence

The system SHALL assign an immutable version identifier to each published RatePlan configuration and MUST retain prior published versions required to explain a PriceQuote. A concurrent update using a stale expected version MUST fail without overwriting the newer configuration.

#### Scenario: Published terms are revised

- **WHEN** an authorized caller changes a published RatePlan configuration using its current expected version
- **THEN** the system publishes a new version and preserves the previous version for quote explanation

#### Scenario: Stale RatePlan update is rejected

- **WHEN** two callers update the same RatePlan and the later request supplies an outdated expected version
- **THEN** the system rejects the stale request without losing the already accepted change
