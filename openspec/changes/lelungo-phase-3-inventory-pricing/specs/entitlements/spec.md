## Purpose

Define centralized organization-level commercial capability resolution that supports plans and add-ons without replacing authorization or implying unimplemented features.

## ADDED Requirements

### Requirement: Organization has an explicit product-plan assignment

The entitlement system MUST resolve commercial capabilities from one explicit active Organization-level assignment to `STARTER`, `PROFESSIONAL`, or `PREMIUM`. It MUST retain assignment history, MUST NOT infer a plan from hostname, subdomain, route, stored feature data, or staff role, and MUST fail closed when the active assignment is missing, duplicated, invalid, or cannot be resolved.

#### Scenario: Explicit plan assignment resolves

- **WHEN** an Organization has exactly one valid active `PROFESSIONAL` assignment
- **THEN** the resolver evaluates that plan's base capability set for the Organization

#### Scenario: Hostname does not infer plan

- **WHEN** an Organization has a professional-looking subdomain but no active plan assignment
- **THEN** the resolver returns no enabled capabilities rather than inferring `PROFESSIONAL`

#### Scenario: Duplicate active assignments fail closed

- **WHEN** inconsistent data presents more than one active plan assignment for an Organization
- **THEN** capability resolution fails closed and reports a sanitized configuration error

### Requirement: Capability catalog and base plan mappings are centralized

The system SHALL use stable capability identifiers and centralized plan mappings. `STARTER` SHALL include `PUBLIC_WEB_PRESENCE`, `CUSTOM_BRANDING`, `DIRECT_WHATSAPP_BOOKING`, `PUBLIC_ACCOMMODATION_CATALOG`, and `INDICATIVE_RATE_PUBLICATION`. `PROFESSIONAL` SHALL include all Starter capabilities plus `ROOM_MANAGEMENT`, `INVENTORY_MANAGEMENT`, `BLACKOUT_DATE_MANAGEMENT`, `REALTIME_AVAILABILITY`, `RATE_MANAGEMENT`, `AVAILABILITY_CALENDAR`, `ONLINE_BOOKING`, `BOOKING_NOTIFICATION`, and `INVOICE_GENERATION`. `PREMIUM` SHALL include all Professional capabilities plus `SEM_REPORTING`. The catalog SHALL also recognize future or add-on identifiers including `PAYMENT_GATEWAY`, `CUSTOM_DOMAIN`, `MULTILINGUAL`, and `CHANNEL_MANAGER` without automatically granting them.

#### Scenario: Starter receives granular catalog capabilities

- **WHEN** a Starter Organization resolves its base capabilities
- **THEN** it receives public accommodation-catalog and indicative-rate publication capabilities but not inventory, blackout, real-time availability, or rate-management capabilities

#### Scenario: Professional receives inventory capabilities

- **WHEN** a Professional Organization resolves its base capabilities
- **THEN** it receives inventory-management, blackout-date-management, real-time availability, availability-calendar, and rate-management capabilities in addition to Starter capabilities

#### Scenario: Add-on is not granted by catalog membership

- **WHEN** `PAYMENT_GATEWAY` exists in the capability catalog but neither the active plan nor an active enabling override grants it
- **THEN** the resolver reports the capability as not entitled

### Requirement: One active override per Organization and capability wins

The system SHALL support explicit `ENABLED` and `DISABLED` entitlement overrides for add-ons and exceptions. No more than one active override SHALL exist for an Organization and capability, and an active override MUST take precedence over the active plan's base mapping. Historical and inactive overrides MUST remain interpretable but MUST NOT affect current resolution.

#### Scenario: Enabling override adds an add-on

- **WHEN** a Professional Organization has one active `ENABLED` override for `PAYMENT_GATEWAY`
- **THEN** the resolver reports `PAYMENT_GATEWAY` as entitled even though it is absent from the base Professional mapping

#### Scenario: Disabling override removes a base capability

- **WHEN** an Organization's active plan grants `RATE_MANAGEMENT` and one active `DISABLED` override exists for that capability
- **THEN** the resolver reports `RATE_MANAGEMENT` as not entitled

#### Scenario: Duplicate active override is rejected

- **WHEN** a caller attempts to create a second active override for the same Organization and capability
- **THEN** the system rejects the new override and preserves deterministic resolution

### Requirement: Missing and unknown capability resolution fails closed

An operation that requires a capability MUST be denied when the Organization has no active plan, the capability code is unknown, no base mapping or enabled override grants it, or entitlement resolution fails. A protected backend boundary SHALL return stable code `FEATURE_NOT_ENTITLED` for a valid but ungranted capability without exposing internal plan or override data.

#### Scenario: Starter calls rate management

- **WHEN** a Starter Organization without an enabling override calls a backend operation requiring `RATE_MANAGEMENT`
- **THEN** the backend denies the operation with `FEATURE_NOT_ENTITLED` and performs no protected mutation

#### Scenario: Unknown capability is denied

- **WHEN** an operation requests a capability identifier outside the catalog
- **THEN** resolution fails closed rather than treating the identifier as enabled

### Requirement: Entitlement and authorization are independent controls

Every protected Phase 3 backend operation MUST enforce both the authenticated actor's permission and Property scope and the Organization's required entitlement. Entitlement MUST NOT grant staff authority, authorization MUST NOT imply commercial entitlement, and hiding a control in the UI MUST NOT replace backend enforcement. Feature code MUST ask the centralized resolver for a capability and MUST NOT branch directly on product-plan names.

#### Scenario: Entitled but unauthorized caller is denied

- **WHEN** an Organization has `RATE_MANAGEMENT` but the authenticated staff member lacks pricing permission or Property scope
- **THEN** the backend denies the operation without reading or mutating unauthorized Property data

#### Scenario: Authorized but not entitled caller is denied

- **WHEN** a staff member has pricing permission and Property scope but the Organization lacks `RATE_MANAGEMENT`
- **THEN** the backend returns `FEATURE_NOT_ENTITLED` and performs no pricing mutation

#### Scenario: Direct plan-name feature check is prohibited

- **WHEN** feature behavior needs to decide whether an Organization can use inventory or pricing functionality
- **THEN** it obtains the decision from capability resolution rather than comparing the plan identifier in that feature

### Requirement: Plan changes retain domain data

Changing or downgrading an Organization's plan or overrides MUST change capability resolution without deleting or reinterpreting its RoomTypes, Units, Inventory, blocks, RatePlans, rates, restrictions, quotes, or audit history. Re-enabling a capability MUST make the retained compatible configuration available without a schema or ownership migration.

#### Scenario: Professional downgrades to Starter

- **WHEN** a Professional Organization is explicitly reassigned to Starter
- **THEN** restricted inventory and pricing operations become not entitled while all existing configuration and history remain intact

#### Scenario: Starter upgrades back to Professional

- **WHEN** the same Organization is explicitly reassigned to Professional
- **THEN** Professional capabilities become entitled and retained compatible inventory and pricing configuration is available without data migration

### Requirement: Catalogued future capability does not imply operational readiness

A capability identifier or plan mapping MUST express only commercial entitlement. The system MUST NOT expose a route, claim a feature is available, or synthesize behavior solely because a future capability such as `ONLINE_BOOKING`, `PAYMENT_GATEWAY`, `CHANNEL_MANAGER`, or `SEM_REPORTING` exists or resolves as entitled; the owning feature MUST also be implemented and explicitly operational.

#### Scenario: Future capability is commercially entitled but unimplemented

- **WHEN** a plan or override commercially entitles an Organization to a capability whose owning feature is not implemented
- **THEN** the system does not advertise or execute that feature and reports it as unavailable rather than fabricating behavior
