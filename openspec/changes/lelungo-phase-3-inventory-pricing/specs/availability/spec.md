## Purpose

Define bounded, Property-local, structured availability calculations for individual stays and operational calendars while keeping raw inventory availability separate from rate-plan bookability and excluding Reservation demand from Phase 3.

## ADDED Requirements

### Requirement: Real-time availability uses Property-local half-open stay dates

The system MUST interpret `checkIn` and `checkOut` as ISO `YYYY-MM-DD` dates in the Property's configured IANA timezone and MUST evaluate stay nights using the half-open range `[checkIn, checkOut)`. It MUST NOT use browser, server, or database timezone boundaries to choose a stay date.

#### Scenario: Multi-night stay is evaluated

- **WHEN** a Property-local request has check-in `2026-08-10` and check-out `2026-08-12`
- **THEN** availability is evaluated for August 10 and August 11 and not for August 12

#### Scenario: Server timezone differs from Property timezone

- **WHEN** the server and Property have different calendar dates at the instant a request is processed
- **THEN** validation and nightly inventory selection use the Property-local date

### Requirement: Availability requests enforce named bounded defaults

The system SHALL enforce named configurable availability limits whose defaults are a maximum stay of 30 nights, a maximum availability-calendar window of 366 dates, a maximum advance horizon of 730 dates from the Property-local current date, and a maximum requested RoomType quantity of 100 per real-time check. Real-time stay and calendar queries MUST reject a start date before the Property-local current date, and every requested stay date MUST remain within the configured advance horizon.

#### Scenario: Maximum stay is accepted

- **WHEN** a valid real-time stay request contains exactly 30 nights and remains within the advance horizon
- **THEN** the stay may be evaluated

#### Scenario: Stay is too long

- **WHEN** a real-time stay request contains 31 nights under the default policy
- **THEN** validation rejects it before inventory is queried

#### Scenario: Calendar window is too large

- **WHEN** a calendar request asks for 367 dates under the default policy
- **THEN** validation rejects it rather than issuing an unbounded inventory query

#### Scenario: Advance horizon is exceeded

- **WHEN** any requested stay date falls later than the 730-date default advance horizon
- **THEN** validation rejects the request with a stable range error

#### Scenario: Past real-time query is attempted

- **WHEN** a stay or real-time calendar request starts before the current date in the Property timezone
- **THEN** the real-time endpoint rejects it and does not reinterpret it as a historical report request

#### Scenario: Requested quantity exceeds the default bound

- **WHEN** a real-time availability request asks for 101 RoomType units under the default policy
- **THEN** validation rejects the request before inventory is queried

### Requirement: Nightly availability follows deterministic inventory precedence

For each requested stay date, the system MUST calculate eligible capacity from distinct `ACTIVE` Units, subtract distinct eligible Unit blocks, then apply the RoomType full or aggregate quantity blocks, and finally apply the single absolute sellable cap as `min(remainingQuantity, sellableCap)`. `OUT_OF_SERVICE`, `INACTIVE`, and `ARCHIVED` Units MUST be excluded from eligible capacity, and the result MUST remain between zero and eligible capacity inclusive.

#### Scenario: Unit block, RoomType block, and cap all apply

- **WHEN** a RoomType has eight `ACTIVE` Units, two distinct Units are blocked, a RoomType quantity block subtracts one, and the stay-date cap is four
- **THEN** the nightly result is `min(8 - 2 - 1, 4)`, which is four

#### Scenario: Cap cannot restore blocked inventory

- **WHEN** blocks leave two Units remaining and the stay-date cap is five
- **THEN** nightly availability is two

#### Scenario: Entire villa is blocked

- **WHEN** an entire-villa RoomType has one `ACTIVE` Unit and that Unit is blocked for a stay date
- **THEN** nightly availability for that date is zero

### Requirement: Stay availability is structured and quantity-aware

The availability contract SHALL accept trusted Property and RoomType context, a valid stay period, and a positive requested room quantity. It SHALL return a per-night breakdown plus a stay-level result containing status, quantity available, calculated time, and a stable safe reason when unavailable. Stay-level quantity available MUST equal the minimum nightly quantity across the stay, and the requested quantity is available only when every stay night has at least that quantity.

#### Scenario: All nights satisfy requested quantity

- **WHEN** nightly availability across a three-night stay is five, three, and four and the caller requests three rooms
- **THEN** the stay result is `AVAILABLE`, `quantityAvailable` is three, and all three nightly results are returned

#### Scenario: One night is insufficient

- **WHEN** nightly availability across a stay is three, zero, and two and the caller requests one room
- **THEN** the stay result is `UNAVAILABLE`, `quantityAvailable` is zero, and the structured result identifies the unavailable date with a safe reason

#### Scenario: Invalid requested quantity is submitted

- **WHEN** the requested room quantity is zero, negative, fractional, or above an established request bound
- **THEN** validation rejects the request before availability is calculated

### Requirement: Inventory availability is separate from rate-plan bookability

The availability service MUST report inventory supply independently of price, RatePlan lifecycle, and pricing restrictions. A bookable-offer or pricing application service MUST compose inventory availability with active RatePlan and restriction validation rather than changing the meaning of the raw availability result.

#### Scenario: Inventory exists but RatePlan is stopped for sale

- **WHEN** a RoomType has positive inventory but the selected RatePlan has a stop-sell restriction
- **THEN** inventory availability remains positive while the composed rate-plan bookability result is not bookable

#### Scenario: Starter indicative price is requested

- **WHEN** a Starter public page reads an indicative price without real-time-availability entitlement
- **THEN** it does not call or present the raw availability result as a guarantee that inventory can be booked

### Requirement: Availability calendars are batched and bounded

The system SHALL provide a batched calendar read for authorized RoomTypes and a bounded date range, returning one Property-local nightly quantity per RoomType/date without requiring one request or one database query per calendar cell. The response SHALL include a calculation or freshness timestamp and MUST omit private Unit codes, block reasons, internal notes, and sellable-cap implementation details from public DTOs.

#### Scenario: Property calendar is requested

- **WHEN** an authorized caller requests a valid 30-date calendar for multiple RoomTypes
- **THEN** the service returns the requested RoomType/date matrix through bounded batched access rather than per-cell transport calls

#### Scenario: Public calendar reflects an internal block

- **WHEN** an internal Unit block reduces a publicly entitled RoomType's quantity
- **THEN** the public calendar returns the reduced quantity without revealing which Unit was blocked or why

### Requirement: Availability access enforces tenant, Property, permission, and entitlement boundaries

Internal real-time availability reads MUST use server-resolved tenant context, verify that the Property and RoomType belong to that tenant, enforce Property assignments and the established availability-read permission, and enforce the applicable real-time-availability entitlement independently. Public real-time reads MUST resolve published Property context on the server and MUST be unavailable when that Property lacks the capability.

#### Scenario: Caller knows another tenant's RoomType identifier

- **WHEN** an authenticated caller submits a RoomType identifier owned by another tenant
- **THEN** the request is denied with a generic response and no inventory, block, rate, or ownership details are disclosed

#### Scenario: Starter requests real-time availability

- **WHEN** a Starter Property without `REALTIME_AVAILABILITY` invokes a protected real-time endpoint
- **THEN** the backend denies the operation with `FEATURE_NOT_ENTITLED` even if a frontend control was bypassed

#### Scenario: Entitled user lacks Property assignment

- **WHEN** the tenant is entitled but the staff member is not assigned to the requested Property
- **THEN** authorization denies the request before availability data is returned

### Requirement: Phase 3 availability excludes reservations and holds

Phase 3 availability MUST NOT subtract fabricated reservations, confirmed bookings, or inventory holds. Its result SHALL be an instantaneous supply calculation and MUST NOT claim to reserve capacity. Future `HoldInventory`, `ReleaseInventory`, and `CommitInventory` contracts SHALL be documented as Phase 4 integration points but MUST NOT have executable Phase 3 behavior.

#### Scenario: Concurrent availability reads occur

- **WHEN** two callers read the same available quantity during Phase 3
- **THEN** each receives a timestamped supply result and neither response is represented as a hold or ownership of that capacity

#### Scenario: Phase 4 demand does not yet exist

- **WHEN** the Phase 3 calculation loads its inventory inputs
- **THEN** it reads eligible Units, active blocks, and the sellable cap only and performs no reservation-table or hold-store access

### Requirement: One calculation uses a consistent data snapshot

The system MUST evaluate a requested stay or calendar against a transactionally consistent view of Unit eligibility, active blocks, and sellable caps. It MUST return a stable application error rather than a partially mixed result when concurrent changes prevent a consistent calculation.

#### Scenario: Block changes during a multi-night read

- **WHEN** a block mutation commits concurrently with a multi-night availability calculation
- **THEN** the returned calculation reflects one consistent database snapshot and includes its calculation timestamp rather than mixing nights from incompatible inventory states
