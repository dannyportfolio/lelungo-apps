## Purpose

Define deterministic, versioned nightly rates and narrowly bounded monetary adjustments using integer-safe arithmetic and explicit precedence.

## ADDED Requirements

### Requirement: Authoritative money is integer-safe

The system MUST persist every authoritative monetary amount as a signed 64-bit integer in the RatePlan currency's configured minor or business unit and MUST use arbitrary-precision integer arithmetic in the domain. Public and transport DTOs MUST serialize monetary amounts as base-ten decimal strings and MUST NOT expose authoritative amounts as floating-point numbers.

#### Scenario: Integer money is returned

- **WHEN** a rate of 350000 IDR units is read through a public or staff DTO
- **THEN** the DTO returns `"350000"` with currency `IDR` rather than a floating-point value

#### Scenario: Non-integer amount is rejected

- **WHEN** a caller submits a decimal or floating-point authoritative rate amount
- **THEN** the system rejects the input instead of rounding it implicitly

### Requirement: Nightly rate layers have deterministic precedence

For each occupied Property-local date, the system MUST select exactly one nightly base amount using this precedence: an exact-date rate replaces every other base layer; otherwise the applicable season with the highest unique priority replaces lower layers; otherwise an applicable weekday rate replaces the base rate; otherwise the base rate applies. Base-rate layers MUST replace rather than add to one another.

#### Scenario: Exact-date rate wins

- **WHEN** a night matches an exact-date rate, a season, a weekday rate, and the base rate
- **THEN** the system selects only the exact-date rate as that night's base amount

#### Scenario: Highest-priority season wins

- **WHEN** a night matches multiple seasons with distinct priorities and no exact-date rate
- **THEN** the system selects only the matching season with the highest priority

#### Scenario: Equal-priority season conflict is rejected

- **WHEN** publishing or updating rates would leave two matching seasons with the same highest priority for a date
- **THEN** the system rejects the conflicting configuration instead of choosing by insertion or update order

#### Scenario: Weekday and base fallbacks apply

- **WHEN** a night has no exact-date or seasonal rate
- **THEN** the system uses its weekday rate when configured and otherwise uses the RatePlan base rate

### Requirement: Rate history is immutable and versioned

The system SHALL create a new immutable rate version for every accepted base, weekday, season, exact-date, occupancy-adjustment, fee, or tax change. It MUST retain the prior amount, new amount, affected scope and dates, actor, timestamp, and version so an earlier quote can be explained without reading current mutable configuration.

#### Scenario: Rate update retains prior evidence

- **WHEN** an authorized caller changes a published exact-date rate
- **THEN** subsequent calculations use the new version while the former version remains available with its change evidence

#### Scenario: Stale rate update is rejected

- **WHEN** a rate mutation supplies an expected version older than the current version
- **THEN** the system rejects the mutation without overwriting the accepted rate

### Requirement: Bulk rate edits are bounded and atomic

A single bulk rate mutation MUST target no more than 366 distinct Property-local dates. The system MUST validate ownership, currency, date range, values, conflicts, and expected versions for the entire request before applying it, and MUST apply all accepted entries or none of them.

#### Scenario: Bounded bulk edit succeeds

- **WHEN** an authorized caller submits a valid bulk mutation covering at most 366 dates in one Property and RatePlan
- **THEN** the system applies every requested rate version as one successful operation

#### Scenario: Oversized bulk edit is rejected

- **WHEN** a caller submits a bulk mutation covering more than 366 distinct dates
- **THEN** the system rejects the request before changing any rate

#### Scenario: One invalid entry prevents partial update

- **WHEN** one entry in a bulk mutation has a currency mismatch, conflict, invalid date, or stale version
- **THEN** the system rejects the entire mutation and leaves every targeted rate unchanged

### Requirement: Extra-guest pricing is narrowly defined

The MVP SHALL support only a non-negative fixed integer amount per extra adult above the RoomType `baseAdults` value per occupied night. Requested adults, children, and total guests MUST satisfy the RoomType's independent limits before pricing; children MUST NOT be charged as extra adults without a later explicit child-pricing policy. The system MUST NOT infer child-age bands or other unconfigured guest categories.

#### Scenario: Extra guests add nightly adjustments

- **WHEN** a RoomType has `baseAdults` two, a valid request has four adults, and the RatePlan charges 100000 units per extra adult per night
- **THEN** the system adds an extra-guest line of 200000 units for each occupied night

#### Scenario: Occupancy above maximum is rejected

- **WHEN** requested adults, children, or total guests exceed the corresponding RoomType limit
- **THEN** the system rejects pricing instead of charging an arbitrary number of extra guests

### Requirement: MVP fees and taxes use a fixed calculation model

The MVP SHALL support fixed non-negative fees charged either once per stay or once per occupied night and exclusive percentage taxes expressed as non-negative integer basis points. Each fee MUST declare whether it is taxable, each tax MUST declare the line categories in its taxable base, and calculations MUST apply nightly base rates, then extra-guest adjustments, then fees, then taxes. Percentage tax results MUST use deterministic half-up rounding to the nearest integer money unit. The MVP MUST reject inclusive taxes, compound taxes, percentage fees, and currency-mismatched adjustments.

#### Scenario: Fixed stay fee and exclusive tax are calculated

- **WHEN** a quote has configured room charges, a taxable fixed per-stay fee, and an exclusive basis-point tax whose base includes both categories
- **THEN** the system adds the fee once, calculates the tax over only the declared taxable lines, rounds it half-up to an integer unit, and reports each amount separately

#### Scenario: Unsupported adjustment is rejected

- **WHEN** a caller configures an inclusive tax, compound tax, percentage fee, negative fee, or adjustment in another currency
- **THEN** the system rejects the configuration without publishing a new rate version
