## Purpose

Define the tenant-owned hybrid inventory pool, its physical-unit capacity source, sellable-cap behavior, invariants, and the boundary that future Reservation work must use without introducing reservation consumption in Phase 3.

## ADDED Requirements

### Requirement: One tenant-owned inventory pool per RoomType

The system SHALL model sellable inventory as exactly one `InventoryPool` for each sellable RoomType. The pool MUST carry the same trusted tenant and Property ownership as its RoomType, MUST be backed by physical Units assigned to that RoomType, and MUST NOT accept a caller-supplied tenant identifier as ownership authority.

#### Scenario: Pool is created for a RoomType

- **WHEN** an authorized application service creates inventory for a RoomType using server-resolved tenant and Property context
- **THEN** exactly one pool is associated with that RoomType and its tenant and Property ownership matches the RoomType

#### Scenario: Duplicate pool is attempted

- **WHEN** a second pool is requested for a RoomType that already has an inventory pool
- **THEN** the operation is rejected by the application boundary and a database uniqueness constraint

#### Scenario: Cross-property Unit is associated with a pool

- **WHEN** a Unit belongs to a different tenant, Property, or RoomType from the target pool
- **THEN** the association is rejected without revealing data from the other scope

### Requirement: Eligible physical Units define baseline capacity

The system MUST derive a pool's baseline capacity from the count of distinct Units in `ACTIVE` status for that RoomType. Units in `OUT_OF_SERVICE`, `INACTIVE`, or `ARCHIVED` status MUST contribute zero capacity, and a caller MUST NOT directly mutate baseline capacity independently of the physical Units.

#### Scenario: Mixed Unit statuses are evaluated

- **WHEN** a RoomType has five `ACTIVE` Units, one `OUT_OF_SERVICE` Unit, one `INACTIVE` Unit, and one `ARCHIVED` Unit
- **THEN** its baseline inventory capacity is five

#### Scenario: No Unit is eligible

- **WHEN** a RoomType has no `ACTIVE` Units
- **THEN** its baseline inventory capacity is zero and the pool cannot report positive sellable quantity

#### Scenario: Unit lifecycle changes

- **WHEN** an `ACTIVE` Unit becomes `OUT_OF_SERVICE`, `INACTIVE`, or `ARCHIVED`
- **THEN** subsequent inventory calculations exclude that Unit from baseline capacity

### Requirement: Entire-property accommodation uses the shared pool model

The system SHALL represent an entire-property or private-villa product as one RoomType backed by one physical Unit with baseline capacity one. It MUST NOT create a villa-specific inventory engine or bypass the InventoryPool contract.

#### Scenario: Private villa inventory is configured

- **WHEN** an entire-villa RoomType has one `ACTIVE` Unit
- **THEN** the shared inventory pool reports baseline capacity one before blocks or a sellable cap are applied

### Requirement: A nightly sellable cap is absolute and reduction-only

The system SHALL allow at most one absolute sellable-cap override for a RoomType and property-local stay date. After Unit blocks and RoomType blocks are applied, the final inventory quantity MUST be `min(remainingQuantity, sellableCap)` when a cap exists; a cap MUST never add capacity or restore inventory removed by a block.

#### Scenario: Cap reduces remaining quantity

- **WHEN** a RoomType has eight Units remaining after blocks and its cap for the stay date is five
- **THEN** final sellable inventory for that date is five

#### Scenario: Cap is above remaining quantity

- **WHEN** a valid stored cap is eight but later Unit status or blocks leave only three Units remaining
- **THEN** final sellable inventory is three and the cap does not restore the removed capacity

#### Scenario: Duplicate cap is attempted

- **WHEN** a second cap is submitted for the same tenant, Property, RoomType, and stay date
- **THEN** the operation is rejected rather than creating ambiguous override precedence

#### Scenario: Cap mutation exceeds current physical capacity

- **WHEN** a requested cap is negative or exceeds the RoomType's current eligible physical capacity
- **THEN** the mutation is rejected and no inventory state is changed

### Requirement: Inventory-affecting mutations preserve capacity invariants

Every mutation of a pool, sellable cap, Unit eligibility, or inventory block MUST be validated transactionally so that computed sellable inventory cannot be negative or exceed eligible physical capacity. Lelungo MUST default to no overbooking and MUST reject an inventory configuration mutation that would violate these invariants.

#### Scenario: Aggregate reductions exceed capacity

- **WHEN** a requested inventory mutation would make active Unit and RoomType reductions exceed eligible capacity for any affected stay date
- **THEN** the mutation is rejected atomically and the prior valid inventory state remains intact

#### Scenario: Concurrent cap updates race

- **WHEN** two operators concurrently update the same RoomType and stay-date cap from the same prior version
- **THEN** at most one update succeeds for that version and the other receives a stable concurrency conflict without silently overwriting the winner

### Requirement: Inventory uses Property-local stay dates

The system MUST identify nightly inventory by an ISO `YYYY-MM-DD` calendar date interpreted in the Property's configured IANA timezone. It MUST NOT derive the inventory date from the browser, application-server, or database-server timezone.

#### Scenario: Property and server use different timezones

- **WHEN** an inventory mutation targets `2026-08-10` for a Property in `Asia/Makassar` while the server runs in another timezone
- **THEN** the mutation applies to the Property-local night `2026-08-10` without shifting the date

### Requirement: Reservation demand is excluded from Phase 3 inventory

Phase 3 inventory MUST NOT create, consume, commit, or release reservation inventory or holds. The inventory public boundary SHALL document future `HoldInventory`, `ReleaseInventory`, and `CommitInventory` operations, but those operations MUST remain unimplemented until Phase 4 and future consumers MUST NOT mutate inventory persistence directly.

#### Scenario: Phase 3 pool quantity is calculated

- **WHEN** inventory is evaluated during Phase 3
- **THEN** only eligible Units, Unit blocks, RoomType blocks, and the sellable cap affect the result and no fabricated reservation or hold quantity is subtracted

#### Scenario: Future hold operation is invoked early

- **WHEN** a caller attempts to execute `HoldInventory`, `ReleaseInventory`, or `CommitInventory` before Phase 4 implements the contract
- **THEN** no inventory is changed and the system does not imply that capacity was reserved

### Requirement: Inventory adjustments are traceable

The system SHALL retain an audit record for sellable-cap creation, replacement, and removal that includes trusted tenant and Property scope, RoomType, affected stay date, previous and new values, actor, timestamp, and correlation identifier. Meaningful changes SHALL publish the established `inventory.adjusted` domain-event envelope without exposing an oversized aggregate snapshot.

#### Scenario: Operator changes a sellable cap

- **WHEN** an authorized operator replaces a cap of five with a cap of three
- **THEN** the change records both values and actor context and emits one meaningful inventory-adjustment event after the mutation succeeds
