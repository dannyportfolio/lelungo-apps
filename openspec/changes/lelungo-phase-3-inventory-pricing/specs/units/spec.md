## Purpose

Define physical accommodation Units, their exact RoomType and Property ownership, property-scoped identity, operational lifecycle, inventory eligibility, and protection from public data leakage.

## ADDED Requirements

### Requirement: Physical Unit identity

A Unit SHALL represent one actual physical accommodation such as a numbered room, villa, cottage, or bungalow, and MUST NOT represent a RoomType, nightly availability state, inventory override, reservation, or guest occupancy record.

#### Scenario: Create physical hotel rooms

- **WHEN** an authorized actor adds Room 101 and Room 102 for a Deluxe RoomType
- **THEN** the system creates two distinct physical Units without creating separate RoomTypes or booking records

### Requirement: Exact RoomType and Property ownership

Every Unit SHALL belong to exactly one RoomType and exactly one Property, and its RoomType MUST belong to the same Property and Tenant as the Unit. Unit commands and queries MUST constrain the complete Tenant, Property, RoomType, and Unit ownership chain using trusted server-resolved context.

#### Scenario: Same-property Unit creation

- **WHEN** an authorized command creates a Unit under a RoomType owned by the command's resolved Property and Tenant
- **THEN** the Unit is persisted under exactly that RoomType and the same Property and Tenant ownership boundary

#### Scenario: Cross-property RoomType reference

- **WHEN** a Unit creation or update for Property A references a RoomType owned by Property B
- **THEN** the operation is rejected even when both Properties belong to the same Tenant

#### Scenario: Cross-tenant Unit identifier

- **WHEN** a caller in Tenant A knows a Unit identifier owned by Tenant B and attempts to read or mutate it
- **THEN** access is denied without revealing Tenant B's Unit data

### Requirement: Property-scoped Unit code uniqueness

Every Unit MUST have a normalized internal code that is unique across its Property, including across different RoomTypes in that Property, and the database SHALL enforce the uniqueness invariant in addition to boundary validation.

#### Scenario: Duplicate code across RoomTypes in one Property

- **WHEN** RoomType Standard already contains Unit code `101` and an actor attempts to create code `101` under RoomType Deluxe in the same Property
- **THEN** the operation is rejected with a stable unit-code-conflict error

#### Scenario: Same code in different Properties

- **WHEN** two different Properties each define a Unit with code `101`
- **THEN** both Units are accepted when all other invariants hold

### Requirement: Explicit Unit lifecycle

A Unit SHALL have exactly one of `ACTIVE`, `OUT_OF_SERVICE`, `INACTIVE`, or `ARCHIVED` status, status changes MUST occur through intent-specific domain operations rather than generic status mass assignment, and `ARCHIVED` MUST be terminal.

#### Scenario: Take a Unit out of service

- **WHEN** an authorized actor marks an ACTIVE Unit as OUT_OF_SERVICE
- **THEN** the lifecycle operation records the operational status change and the Unit is no longer eligible to contribute sellable capacity

#### Scenario: Attempt to restore an archived Unit

- **WHEN** any actor attempts to activate or otherwise change the status of an ARCHIVED Unit
- **THEN** the operation is rejected and the Unit remains ARCHIVED

### Requirement: Operational status is separate from nightly availability

Only ACTIVE Units SHALL contribute to the physical capacity of their RoomType. OUT_OF_SERVICE, INACTIVE, and ARCHIVED Units MUST contribute zero capacity, while a date-bounded maintenance or owner block MUST be modeled separately and MUST NOT overwrite the Unit lifecycle status.

#### Scenario: Out-of-service capacity effect

- **WHEN** a RoomType has five Units and one Unit is OUT_OF_SERVICE
- **THEN** the RoomType's physical capacity source counts four ACTIVE Units before date-specific blocks or sellable caps are applied

#### Scenario: Temporary maintenance period

- **WHEN** an ACTIVE Unit is unavailable only for a bounded maintenance period
- **THEN** the system records a Unit-scoped inventory block for that period and leaves the Unit lifecycle status ACTIVE

### Requirement: Archived Unit retention

Archiving a Unit MUST remove it from future capacity without deleting its stable identity or prior auditable configuration, and an archived Unit code MUST remain protected by the Property-scoped uniqueness invariant unless a separately approved retention policy explicitly permits reuse.

#### Scenario: Archive a Unit

- **WHEN** an authorized actor archives a Unit
- **THEN** the Unit no longer contributes capacity, remains queryable through authorized historical or audit paths, and its code cannot be silently reassigned

### Requirement: Unit data exposure boundary

Unit management data MUST use an internal PMS DTO, and public accommodation projections MUST NOT expose individual Unit internal codes, internal notes, floor or operational details, lifecycle status details, or other staff-only identifiers. Public responses MAY expose an approved aggregate accommodation count without exposing individual Unit records.

#### Scenario: Public RoomType response

- **WHEN** a visitor reads a public RoomType projection backed by several physical Units
- **THEN** the response omits the individual Unit codes, notes, floors, and lifecycle statuses even if an approved aggregate count is displayed

#### Scenario: Authorized PMS Unit list

- **WHEN** an authorized staff member with Unit read permission and matching property scope lists Units
- **THEN** the internal DTO returns only the management fields required for that operation and is never reused as a public response model
