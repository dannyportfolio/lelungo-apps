## Purpose

Define transient, deterministic, and explainable stay pricing results that never create a reservation or confer a right to inventory capacity.

## ADDED Requirements

### Requirement: PriceQuote uses canonical scoped input

The system MUST calculate a PriceQuote from trusted Organization and Property scope, exactly one RoomType and InventoryPool, an `ACTIVE` RatePlan, a Property-local half-open stay period, valid occupancy, and one currency. It MUST reject cross-tenant, cross-property, incompatible, inactive, malformed, or mixed-currency input before returning a sellable quote.

#### Scenario: Valid multi-night quote input is accepted

- **WHEN** a caller requests pricing for compatible same-property resources, an active RatePlan, valid occupancy, and `checkIn < checkOut`
- **THEN** the system calculates one quote for the occupied Property-local dates from check-in inclusive to checkout exclusive

#### Scenario: Cross-scope quote input is rejected

- **WHEN** a quote request combines identifiers from different Organizations, Properties, RoomTypes, InventoryPools, or RatePlans
- **THEN** the system rejects the request without revealing data from the other scope

### Requirement: PriceQuote calculation is deterministic

For identical canonical input, calculation version, and exact RatePlan, rate, restriction, fee, tax, occupancy, and currency versions, the system MUST produce identical monetary lines, totals, and canonical fingerprint. Differences in request or response timestamps MUST NOT alter the monetary fingerprint.

#### Scenario: Identical inputs reproduce the quote

- **WHEN** the same normalized input is calculated twice against the same referenced versions
- **THEN** both results contain identical monetary breakdowns, totals, version references, and fingerprints

### Requirement: PriceQuote contains an explainable breakdown

A successful PriceQuote SHALL include one line per occupied date identifying the selected base-rate layer and version, separate extra-guest, fee, tax, and future-compatible discount adjustment lines, subtotal and total decimal-string amounts, currency, applied restriction results, calculation version, source-version identifiers, canonical input fingerprint, calculation time, and expiry time. The sum of signed line amounts MUST equal the quoted total.

#### Scenario: Date override and adjustments are explained

- **WHEN** a multi-night quote uses a weekday rate on one night, an exact-date rate on another, plus extra-guest, fee, and tax adjustments
- **THEN** the quote reports each nightly selection and each adjustment separately and its line sum equals the total

#### Scenario: Line sum mismatch is rejected

- **WHEN** calculation cannot produce integer line amounts whose signed sum equals the total
- **THEN** the system fails the quote rather than returning an unexplained or floating-point correction

### Requirement: Restrictions can deny a sellable quote

The system MUST evaluate the supported restriction versions before returning a sellable PriceQuote. When one or more restrictions fail, it MUST return stable structured violations and MUST NOT return a sellable total that conceals the failure.

#### Scenario: Stop-sell prevents quote

- **WHEN** an occupied night has an applicable stop-sell restriction
- **THEN** the system returns an ineligible result with the affected date and restriction version instead of a sellable PriceQuote

### Requirement: Sellable quotes require authoritative Phase 3 availability

Before returning a sellable PriceQuote, the system MUST verify that the requested RoomType quantity is available for every occupied night through the Inventory public contract. An unavailable quantity MUST return a stable `PRICE_NOT_AVAILABLE` result with safe nightly context and MUST NOT be converted into a quote merely because rates exist.

#### Scenario: One night is sold out

- **WHEN** the selected RatePlan has valid rates but authoritative availability is zero on one occupied night
- **THEN** the system returns `PRICE_NOT_AVAILABLE` and no sellable PriceQuote total

#### Scenario: Requested quantity is available

- **WHEN** every occupied night has at least the requested quantity and all pricing inputs and restrictions are valid
- **THEN** the system may return the explainable PriceQuote without changing inventory

### Requirement: PriceQuote is transient and makes no capacity promise

A PriceQuote MUST NOT create a Reservation, inventory hold, allocation, or unit assignment and MUST NOT decrement or guarantee capacity. It MUST identify itself as transient and advisory, MUST carry an expiry derived from a centralized validity policy whose default is 15 minutes, and any future acceptance flow MUST revalidate its fingerprint, referenced versions, expiry, restrictions, and authoritative availability.

#### Scenario: Quote leaves inventory unchanged

- **WHEN** a PriceQuote is calculated successfully
- **THEN** inventory capacity and all allocation counters remain unchanged and another caller receives no reduced capacity because of the quote

#### Scenario: Expired quote is not authoritative

- **WHEN** a future consumer presents a PriceQuote after its expiry or after a referenced version changed
- **THEN** the quote cannot establish a price or capacity right and must be recalculated or revalidated

#### Scenario: Default quote expiry is assigned

- **WHEN** a quote is calculated without an explicitly configured validity override
- **THEN** its expiry is 15 minutes after its calculation time and neither timestamp changes its monetary fingerprint

### Requirement: Promotion calculation is deferred but quote lines are extensible

Phase 3 MUST NOT evaluate coupons, promotion eligibility, redemption limits, or stacking. The PriceQuote schema SHALL support a typed signed `DISCOUNT` line with source and version metadata for a future Promotion contract, but the Phase 3 calculator MUST NOT generate a discount without such an implemented, authorized, and versioned source.

#### Scenario: Coupon input is not silently applied

- **WHEN** a Phase 3 quote request supplies a coupon or unversioned promotional amount
- **THEN** the system rejects or ignores it according to the public contract and does not generate a discount line

### Requirement: Starter indicative rate is distinct from PriceQuote

The system SHALL expose a separately versioned Starter indicative-rate projection as a non-negative decimal-string amount and currency suitable for `Mulai dari` presentation. An indicative rate MUST NOT contain a PriceQuote fingerprint, stay total, availability assertion, or capacity promise and MUST NOT be labeled as real-time or bookable pricing.

#### Scenario: Starter public page shows an indicative rate

- **WHEN** a Starter property has an authorized published indicative rate
- **THEN** its public catalog can display the amount as indicative pricing without exposing a sellable PriceQuote or real-time availability

#### Scenario: Indicative rate is not accepted as a quote

- **WHEN** a caller presents an indicative rate as though it were a stay-specific PriceQuote
- **THEN** the system rejects it because it lacks the required canonical inputs, versions, breakdown, fingerprint, and expiry
