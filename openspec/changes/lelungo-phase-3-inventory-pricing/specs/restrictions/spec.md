## Purpose

Define versioned operational sell restrictions that produce deterministic, explainable eligibility decisions without changing physical inventory capacity.

## ADDED Requirements

### Requirement: Supported operational restrictions are explicit

The MVP SHALL support minimum stay, maximum stay, closed to arrival (`CTA`), closed to departure (`CTD`), and stop-sell restrictions at supported Property, RoomType, RatePlan, and Property-local date scopes. The system MUST reject invalid date ranges, non-positive stay limits, or a configuration whose effective minimum stay exceeds its effective maximum stay.

#### Scenario: Valid restrictions are published

- **WHEN** an authorized caller publishes valid dated minimum-stay, CTA, CTD, or stop-sell restrictions within one tenant and Property scope
- **THEN** the restrictions become applicable under a new immutable version

#### Scenario: Invalid stay limits are rejected

- **WHEN** a restriction configuration produces an effective minimum stay longer than its effective maximum stay
- **THEN** the system rejects the configuration without changing the published restriction version

### Requirement: Applicable restrictions combine conservatively

For one quote request, all applicable restriction scopes MUST be evaluated together. The effective minimum stay SHALL be the greatest applicable minimum, the effective maximum stay SHALL be the smallest applicable maximum, and any applicable `CTA`, `CTD`, or stop-sell closure SHALL deny the corresponding action. The system MUST NOT resolve conflicts by nondeterministic record order.

#### Scenario: Most restrictive stay limits apply

- **WHEN** applicable scopes specify minimum stays of two and three nights and maximum stays of ten and seven nights
- **THEN** the effective stay limits are a minimum of three nights and a maximum of seven nights

#### Scenario: Any applicable closure denies sellability

- **WHEN** one applicable scope is open and another applicable scope has a closure relevant to the requested stay
- **THEN** the closure is enforced and the system returns its source and version

### Requirement: Restriction date semantics follow hotel nights

Minimum-stay and maximum-stay rules MUST evaluate the requested number of occupied nights in `[checkIn, checkOut)`. `CTA` MUST evaluate the Property-local check-in date, `CTD` MUST evaluate the Property-local checkout date, and stop-sell MUST evaluate every occupied date while excluding the checkout date.

#### Scenario: CTA rejects arrival only

- **WHEN** the requested check-in date is closed to arrival
- **THEN** the system rejects that arrival even if subsequent occupied nights are otherwise open

#### Scenario: CTD evaluates checkout date

- **WHEN** the requested checkout date is closed to departure
- **THEN** the system rejects the stay even though the checkout date does not consume an inventory night

#### Scenario: Stop-sell on an occupied night rejects the stay

- **WHEN** any date from check-in inclusive to checkout exclusive has an applicable stop-sell restriction
- **THEN** the system rejects the requested stay and identifies the affected occupied date

### Requirement: Restriction evaluation is structured and side-effect free

Restriction evaluation MUST return an explicit eligible or ineligible result with stable reason codes, affected dates, scopes, and version identifiers. It MUST NOT create a Reservation, decrement Inventory, create a block, or alter an existing reservation or historical quote.

#### Scenario: Multiple failures are explainable

- **WHEN** a stay violates both minimum stay and CTA
- **THEN** the result reports both violations with their affected dates and versions without mutating capacity

### Requirement: Restriction history remains interpretable

Every accepted restriction change MUST create a new immutable version with actor, timestamp, scope, effective dates, and prior/new values. Deactivation or replacement MUST affect future evaluations only and MUST NOT rewrite the inputs referenced by an earlier PriceQuote.

#### Scenario: Restriction is changed after a quote

- **WHEN** an authorized caller changes a restriction after a PriceQuote was calculated
- **THEN** new calculations use the new version while the earlier quote continues to reference the retained former version
