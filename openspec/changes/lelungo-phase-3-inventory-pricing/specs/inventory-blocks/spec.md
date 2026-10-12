## Purpose

Define auditable Unit- and RoomType-scoped inventory blocks, their half-open Property-local ranges, deterministic quantity effects, tenant boundaries, and non-destructive removal behavior.

## ADDED Requirements

### Requirement: Inventory blocks are tenant- and Property-owned

Every InventoryBlock MUST belong to a trusted tenant and Property and MUST target exactly one RoomType or one Unit within that same ownership chain. A Unit-scoped block MUST reference a Unit belonging to the target RoomType and Property, and block creation MUST reject client-selected ownership that does not match server-resolved context.

#### Scenario: Same-property Unit block is created

- **WHEN** an authorized operator creates a block for a Unit in the resolved tenant and Property
- **THEN** the block is stored with that trusted ownership and Unit scope

#### Scenario: Cross-property target is submitted

- **WHEN** an operator assigned to Property A submits the identifier of a RoomType or Unit from Property B
- **THEN** the block operation is denied before any record is created and no Property B details are disclosed

#### Scenario: Ambiguous scope is submitted

- **WHEN** a block targets both a RoomType and a Unit or targets neither
- **THEN** validation rejects the block as an invalid scope

### Requirement: Blocks use valid half-open Property-local ranges

An InventoryBlock MUST use ISO `YYYY-MM-DD` dates interpreted in the Property timezone and MUST apply to the half-open range `[startDate, endDate)`. The start date MUST be earlier than the end date, and invalid or unbounded ranges MUST be rejected before persistence.

#### Scenario: Two-night block is evaluated

- **WHEN** a block has `startDate` `2026-08-10` and `endDate` `2026-08-12`
- **THEN** it affects the nights of August 10 and August 11 but not August 12 in the Property timezone

#### Scenario: Empty or reversed range is submitted

- **WHEN** a block's end date is equal to or earlier than its start date
- **THEN** the system rejects the block without changing inventory

### Requirement: Unit blocks subtract distinct eligible Units

For each stay date, the system MUST subtract the number of distinct blocked Units that would otherwise be `ACTIVE` and eligible for the RoomType pool. Multiple overlapping active block records for the same Unit and date MUST subtract that Unit at most once, and a block for an already ineligible Unit MUST NOT create an additional reduction.

#### Scenario: Different Units are blocked

- **WHEN** two distinct `ACTIVE` Units in a five-Unit pool are blocked for the same stay date
- **THEN** three Units remain before RoomType blocks and the sellable cap are applied

#### Scenario: One Unit has overlapping blocks

- **WHEN** maintenance and owner-use blocks overlap for the same Unit and stay date
- **THEN** the Unit contributes exactly one reduction to the pool for that date

#### Scenario: Out-of-service Unit is also blocked

- **WHEN** a Unit is already `OUT_OF_SERVICE` and an active Unit block covers the same stay date
- **THEN** the block does not subtract additional inventory because the Unit was excluded from baseline capacity

### Requirement: RoomType blocks reduce the post-Unit-block quantity

A RoomType block MUST be either a full block or a positive integer quantity block. After distinct Unit blocks are subtracted, a full RoomType block MUST reduce the remaining quantity to zero; otherwise active quantity blocks MUST subtract their aggregate quantity. The system MUST reject a block mutation whose affected-date combination would reduce inventory below zero.

#### Scenario: Quantity block follows Unit blocks

- **WHEN** a five-Unit pool has one distinct Unit blocked and a RoomType quantity block of two for the same stay date
- **THEN** two is subtracted from the post-Unit-block quantity of four and two Units remain before the sellable cap

#### Scenario: Full RoomType block applies

- **WHEN** a full RoomType block covers a stay date
- **THEN** the remaining inventory for that RoomType and date is zero before the sellable cap is applied

#### Scenario: Quantity blocks exceed remaining capacity

- **WHEN** a requested RoomType quantity block would make the aggregate block quantity exceed capacity remaining after distinct Unit blocks on an affected date
- **THEN** the entire mutation is rejected and no partial range is written

### Requirement: Block reason and private notes remain explicit

Every block SHALL record a supported operational reason such as `OWNER_BLOCK`, `MAINTENANCE`, `RENOVATION`, `PRIVATE_USE`, `MANUAL_CLOSE`, or `OTHER`, together with its creating actor. Optional operator notes MUST remain internal and MUST NOT appear in public accommodation or availability DTOs.

#### Scenario: Public availability reflects a maintenance block

- **WHEN** a maintenance block reduces public real-time availability
- **THEN** the public response may report reduced or unavailable inventory but does not expose the maintenance reason, internal note, actor, or Unit code

### Requirement: Block removal is audited rather than hard-deleted

Removing an active InventoryBlock MUST retain the original block record and record its removal status, removing actor, removal time, and correlation identifier. A removed block MUST cease affecting availability from the successful removal onward, and the system MUST NOT hard-delete it through the operational block API.

#### Scenario: Future block is removed

- **WHEN** an authorized operator removes an active future InventoryBlock
- **THEN** the original range and creation metadata remain auditable, removal metadata is recorded, and subsequent availability calculations ignore the removed block

#### Scenario: Removed block is removed again

- **WHEN** an operator repeats removal of an already removed block
- **THEN** no second inventory reduction or restoration occurs and the API returns a stable idempotent or conflict outcome according to the documented contract

### Requirement: Block mutations are authorized and concurrency-safe

Creating or removing a block MUST require trusted tenant context, Property-scope authorization, the established inventory-management permission, and the applicable inventory-management entitlement. The mutation and its audit state MUST commit atomically, and conflicting concurrent mutations MUST fail with a stable error rather than leave an invalid inventory combination.

#### Scenario: Entitled but unauthorized caller creates a block

- **WHEN** a tenant has the inventory capability but the authenticated staff member lacks Property scope or the inventory-management permission
- **THEN** block creation is denied and entitlement does not substitute for authorization

#### Scenario: Authorized but unentitled caller creates a block

- **WHEN** a staff member has permission and Property scope but the tenant lacks the required capability
- **THEN** block creation is denied with `FEATURE_NOT_ENTITLED` and no block or audit record is written

### Requirement: Meaningful block lifecycle events are emitted

Successful block creation and removal SHALL emit `inventory.blocked` and `inventory.unblocked` through the established domain-event mechanism. The event envelope MUST include event, tenant, Property, aggregate, actor, occurrence, correlation, and version identifiers plus only the block data required by authorized consumers.

#### Scenario: Block creation commits

- **WHEN** a valid InventoryBlock and its audit record commit successfully
- **THEN** one `inventory.blocked` event is made available through the established event mechanism without exposing its private note
