## Purpose

Define the tenant-owned Property profile and lifecycle contract that protected staff workflows and later accommodation capabilities can rely on without exposing private configuration.

## ADDED Requirements

### Requirement: Tenant-owned Property identity

Every Property MUST have one stable opaque identifier, MUST belong to exactly one Tenant, MUST have a trimmed non-blank display name of at most 120 Unicode characters, and MUST have a normalized slug of at most 80 ASCII characters that is unique within that Tenant. Raw slug input MUST be bounded to 120 characters before normalization. Property ownership MUST NOT be changed after creation, and the system SHALL permit the same normalized slug for Properties in different Tenants.

Slug normalization MUST trim surrounding whitespace, convert letters to lowercase, convert whitespace and underscores to hyphens, collapse consecutive hyphens, remove leading and trailing hyphens, and require the final value to match `[a-z0-9]+(?:-[a-z0-9]+)*`. A slug that is empty or malformed after normalization MUST be rejected.

#### Scenario: Create a Property with a normalized slug

- **WHEN** an authorized caller creates a Property named `Villa Merapi` with slug input `Villa_Merapi` for Tenant A
- **THEN** the Property is created under Tenant A with normalized slug `villa-merapi` and a stable opaque Property identifier

#### Scenario: Reject a duplicate slug within one Tenant

- **WHEN** Tenant A already owns a Property with normalized slug `villa-merapi` and an authorized caller attempts to create another Property whose slug normalizes to `villa-merapi`
- **THEN** the operation fails with the stable generic Property conflict outcome and creates no Property

#### Scenario: Permit the same slug in another Tenant

- **WHEN** Tenant A owns slug `villa-merapi` and an authorized caller for Tenant B creates a Property with the same normalized slug
- **THEN** Tenant B's Property is created without changing or linking Tenant A's Property

#### Scenario: Reject oversized identity input

- **WHEN** a caller submits a display name longer than 120 characters or raw slug input longer than 120 characters
- **THEN** validation rejects the command before slug normalization or persistence

### Requirement: Required classification and canonical timezone

Every Property MUST reference one active value from the system-managed Property-classification catalog and MUST store one canonical IANA timezone identifier. The baseline catalog MUST be provisioned idempotently with stable `VILLA`, `HOMESTAY`, `GUESTHOUSE`, and `SMALL_HOTEL` keys and SHALL be expandable only through a separately reviewed system-catalog change. Classification MUST NOT be accepted as arbitrary free text, and an unknown timezone, fixed UTC offset, abbreviation, or non-canonical timezone value MUST be rejected.

#### Scenario: Accept valid classification and timezone values

- **WHEN** an authorized caller supplies an active `VILLA` classification and canonical timezone `Asia/Jakarta`
- **THEN** the Property stores those catalog-backed canonical values

#### Scenario: Reject unsupported classification or timezone values

- **WHEN** a caller supplies an unknown classification, `UTC+7`, `WIB`, or an unrecognized timezone identifier
- **THEN** validation fails before the Property is created or changed

### Requirement: Structured Indonesian Property address

Every Property MUST have a structured address containing non-blank `line1` of at most 200 characters, `locality` of at most 100 characters, and `adminArea` of at most 100 characters plus `countryCode` fixed to the canonical value `ID`. Optional `line2` MUST be at most 200 characters and optional `postalCode` MUST be at most 12 characters. Address input MUST be trimmed and validated as individual fields and MUST NOT be stored as one unvalidated free-form document.

#### Scenario: Save a complete Indonesian address

- **WHEN** an authorized caller supplies line 1, locality, administrative area, and country code `ID`, with or without line 2 and postal code
- **THEN** the Property stores the validated structured address fields

#### Scenario: Reject an incomplete or non-Indonesian address

- **WHEN** line 1, locality, or administrative area is blank, or country code is not exactly `ID`
- **THEN** validation fails without changing the Property

#### Scenario: Reject oversized address fields

- **WHEN** any address field exceeds its named maximum length
- **THEN** validation fails before the Property address is persisted or changed

### Requirement: Optional public description and WhatsApp contact

A Property SHALL support an optional trimmed `shortDescription` of at most 500 characters and an optional `publicWhatsAppE164`. A configured `publicWhatsAppE164` MUST match strict E.164 format `^\+[1-9][0-9]{1,14}$`; local-format numbers, separators, extensions, labels, and other contact fields MUST be rejected. Neither optional field SHALL be required to publish or republish a Property.

The published identity projection SHALL include `shortDescription` only when it is configured and SHALL include `publicWhatsAppE164` only when it is explicitly configured as the Property's public contact. Removing either value MUST remove it from subsequent published identity projections without affecting publication state.

#### Scenario: Configure a public WhatsApp contact

- **WHEN** an authorized caller explicitly configures `publicWhatsAppE164` as `+6281234567890`
- **THEN** a published Property's safe identity projection includes that exact E.164 value

#### Scenario: Reject a non-E.164 WhatsApp contact

- **WHEN** a caller supplies `081234567890`, `+62 812 3456 7890`, an extension, or another value that does not match strict E.164 format
- **THEN** validation fails and the existing public contact remains unchanged

#### Scenario: Publish without optional public presentation fields

- **WHEN** a complete Property has no short description and no public WhatsApp contact
- **THEN** publication succeeds and the published identity projection omits both optional fields

#### Scenario: Remove a previously public contact

- **WHEN** an authorized caller removes `publicWhatsAppE164` from a `PUBLISHED` Property using its current expected version
- **THEN** the Property remains `PUBLISHED` and subsequent published identity projections omit the contact

#### Scenario: Reject an oversized public description

- **WHEN** a caller supplies a short description longer than 500 characters
- **THEN** validation fails and the existing public description remains unchanged

### Requirement: Baseline catalog amenities

A Property SHALL reference at most 50 active entries from the system-managed baseline amenity catalog by stable amenity identifier. The catalog MUST be provisioned idempotently with stable `WIFI`, `PARKING`, `POOL`, `AIR_CONDITIONING`, `BREAKFAST`, and `KITCHEN` keys and SHALL be expandable only through a separately reviewed system-catalog change. Duplicate identifiers MUST be treated as one selection before the maximum is evaluated, and arbitrary free-text, unknown, or inactive amenity values MUST be rejected.

#### Scenario: Assign active baseline amenities

- **WHEN** an authorized caller assigns valid active baseline amenity identifiers to a Property
- **THEN** the Property exposes each selected amenity once in its internal profile

#### Scenario: Reject an unknown amenity

- **WHEN** a caller includes a free-text, unknown, or inactive amenity value
- **THEN** validation fails and the existing amenity selection remains unchanged

#### Scenario: Reject too many amenities

- **WHEN** a caller submits more than 50 distinct amenity identifiers
- **THEN** validation fails before any Property amenity relationship is changed

### Requirement: Explicit Property lifecycle

Every Property MUST be in exactly one of `DRAFT`, `PUBLISHED`, `INACTIVE`, or `ARCHIVED`. A newly created Property MUST begin in `DRAFT`. Lifecycle changes MUST use intent-specific publish, deactivate, republish, or archive operations and MUST NOT accept a caller-assigned status through a generic profile update.

The lifecycle SHALL permit a `PUBLISHED` Property to transition to `INACTIVE` and an `INACTIVE` Property to return to `PUBLISHED` after publication requirements are revalidated. The lifecycle SHALL permit any non-archived Property to transition to `ARCHIVED`. `ARCHIVED` MUST be terminal, MUST retain the Property identity and prior configuration, and MUST NOT be hard-deleted or used for new operational configuration.

#### Scenario: Deactivate and republish a Property

- **WHEN** an authorized caller deactivates a `PUBLISHED` Property and later republishes it while all publication requirements remain satisfied
- **THEN** the Property transitions from `PUBLISHED` to `INACTIVE` and then back to `PUBLISHED`

#### Scenario: Archive is terminal

- **WHEN** an authorized caller archives a non-archived Property and later attempts to update, publish, deactivate, or republish it
- **THEN** the Property remains `ARCHIVED`, its retained identity is not deleted, and the later mutation fails with the stable generic Property conflict outcome

#### Scenario: Reject generic status mass assignment

- **WHEN** a profile update payload includes a lifecycle status field
- **THEN** validation rejects the payload without changing the Property lifecycle or profile

### Requirement: Publication completeness and active Tenant

The system MUST publish or republish a Property only when its name and normalized slug are valid, its classification is active, its timezone is canonical, its required structured address fields are complete, every selected amenity remains valid, and its owning Tenant is `ACTIVE` at the time of the transition. `shortDescription`, `postalCode`, and `publicWhatsAppE164` MUST NOT be publication prerequisites. A failed publication attempt MUST preserve the prior lifecycle state and version.

#### Scenario: Publish a complete draft under an active Tenant

- **WHEN** an authorized caller publishes a complete `DRAFT` Property owned by an `ACTIVE` Tenant
- **THEN** the Property transitions to `PUBLISHED`

#### Scenario: Reject publication under a non-active Tenant

- **WHEN** a caller attempts to publish or republish a complete Property whose owning Tenant is not `ACTIVE`
- **THEN** publication fails without changing the Property lifecycle state or version

#### Scenario: Reject publication after a catalog dependency becomes invalid

- **WHEN** a `DRAFT` or `INACTIVE` Property references a classification or amenity that is no longer active when publication is attempted
- **THEN** publication fails with validation details safe for the authorized staff caller and the prior Property state is preserved

### Requirement: Lifecycle timestamps describe current publication state

A successful publish or republish MUST set `publishedAt` to the database-recorded transition time and clear `deactivatedAt`. A successful deactivate MUST set `deactivatedAt` to the database-recorded transition time without erasing `publishedAt`. A successful archive MUST set terminal `archivedAt` and MUST preserve earlier publication metadata. Failed or stale lifecycle commands MUST leave all lifecycle timestamps unchanged.

#### Scenario: Publish and then deactivate

- **WHEN** an authorized caller publishes a `DRAFT` Property and later deactivates it with the current expected version
- **THEN** `publishedAt` records the publish transition and `deactivatedAt` records the later deactivate transition

#### Scenario: Republish an inactive Property

- **WHEN** an authorized caller republishes an `INACTIVE` Property
- **THEN** `publishedAt` advances to the republish transition and `deactivatedAt` is cleared

#### Scenario: Archive retains lifecycle history

- **WHEN** an authorized caller archives a previously published or inactive Property
- **THEN** `archivedAt` is recorded while earlier publication metadata remains retained

### Requirement: Catalog retirement preserves published identity validity

A classification or amenity catalog value referenced by any `PUBLISHED` Property MUST NOT be deactivated. A catalog value that is no longer active MUST remain available for retained internal history but MUST NOT be selected by a new Property mutation or satisfy publication validation. This change MUST NOT expose general catalog-administration behavior.

#### Scenario: Deactivation would invalidate a published Property

- **WHEN** a catalog-maintenance operation attempts to deactivate a classification or amenity referenced by a `PUBLISHED` Property
- **THEN** the operation is rejected and the Property remains resolvable with its valid published identity

#### Scenario: Retired value remains in history

- **WHEN** an inactive catalog value is referenced only by a retained `DRAFT`, `INACTIVE`, or `ARCHIVED` Property
- **THEN** the internal Property history remains interpretable but the value cannot be selected by a new mutation or used to publish the Property

### Requirement: Expected-version optimistic concurrency

Every successful Property creation MUST initialize a positive integer version. Every profile, address, amenity, slug, classification, timezone, or lifecycle mutation MUST require a positive integer `expectedVersion` equal to the current version and MUST increment the version exactly once when the mutation succeeds. A stale or otherwise mismatched expected version MUST return the stable generic Property conflict outcome without revealing the current value and without partially changing the Property.

#### Scenario: Update with the current expected version

- **WHEN** an authorized caller updates a Property using the Property's current integer version
- **THEN** the complete mutation succeeds atomically and the Property version increases by exactly one

#### Scenario: Reject a stale expected version

- **WHEN** two callers submit mutations using the same expected version after one mutation has already succeeded
- **THEN** the later mutation fails with the stable generic Property conflict outcome and does not overwrite or partially merge the accepted mutation

### Requirement: Tenant and Property scoped staff operations

Protected Property operations MUST derive Tenant authority from trusted server context and MUST require a verified subject, an active same-Tenant membership, the operation's explicit `property.read` or `property.manage` permission, and matching organization-wide or explicit-Property scope. Creating a new Property MUST require explicit organization-wide Property scope because no target Property grant exists before creation. Listing MUST return only Properties within the caller's authorized scope, and a slug, Property identifier, route parameter, hostname, or UI selection MUST NOT independently grant authority.

#### Scenario: Read a Property within explicit scope

- **WHEN** an active staff member has `property.read` and an explicit grant for the requested Property in the trusted Tenant
- **THEN** the system returns the bounded internal Property DTO to that staff member

#### Scenario: Deny a known Property outside scope

- **WHEN** an active staff member submits a known identifier for a Property in another Tenant or outside the membership's allowed Property set
- **THEN** the operation returns a generic denial or not-found outcome without revealing whether the Property exists and without performing a protected Property mutation

#### Scenario: Create requires organization-wide scope

- **WHEN** a staff member has `property.manage` but only selected-Property grants and attempts to create a new Property
- **THEN** creation is denied without creating or reserving a Property identity

### Requirement: Bounded deterministic Property listing

The protected Property list MUST use opaque cursor pagination, MUST accept a page size from 1 through 100, MUST reject an out-of-range page size, and MUST never expose an unbounded list. Results MUST be restricted to the trusted Tenant and authorized Property scope and ordered deterministically by normalized slug and then stable Property identifier. A continuation cursor MUST remain bound to the same Tenant, authorization scope, filters, and ordering context in which it was issued.

#### Scenario: Return a bounded page

- **WHEN** an authorized caller requests 100 Properties and more authorized Properties remain
- **THEN** the system returns at most 100 deterministically ordered items and an opaque continuation cursor

#### Scenario: Reject an oversized page

- **WHEN** a caller requests a page size greater than 100
- **THEN** boundary validation fails and no unbounded Property query runs

#### Scenario: Reject a cursor from another scope

- **WHEN** a caller reuses a cursor under a different Tenant, Property scope, filter, or ordering context
- **THEN** the request fails generically without exposing any Property from the cursor's original context

### Requirement: Safe published Property identity resolver

The Property capability SHALL provide a server-side resolver for one Property under trusted Tenant context and normalized Property slug. It MUST resolve only a `PUBLISHED` Property owned by an `ACTIVE` Tenant and MUST establish trusted Property identity for downstream application services without treating the slug, hostname, route parameter, or caller-supplied Tenant identifier as authority.

The protected internal Property DTO SHALL expose the validated full structured address only to an authorized staff caller. The allowlisted public identity projection MUST contain only the Property slug, display name, classification, canonical timezone, active public amenity identifiers, locality, administrative area, optional configured short description, and explicitly configured `publicWhatsAppE164`. It MUST NOT expose address lines, postal code, country code, internal identifiers, version, lifecycle metadata, staff data, any other contact data, unpublished configuration, or fields owned by later domains.

This change MUST NOT expose a public Property list, search, marketplace, or direct HTTP route. Missing, cross-Tenant, `DRAFT`, `INACTIVE`, `ARCHIVED`, or non-active-Tenant resolution MUST return the same stable generic Property not-found outcome.

#### Scenario: Resolve one published Property safely

- **WHEN** a downstream server application resolves a normalized slug for a `PUBLISHED` Property under its trusted active Tenant context
- **THEN** it receives trusted Property identity plus only the allowlisted public identity projection

#### Scenario: Hide unpublished and foreign Properties

- **WHEN** resolution targets a missing, cross-Tenant, `DRAFT`, `INACTIVE`, or `ARCHIVED` Property, or a Property owned by a non-active Tenant
- **THEN** the resolver returns the same stable generic Property not-found outcome with no private field or existence disclosure

#### Scenario: Public enumeration is unavailable

- **WHEN** an anonymous caller attempts to list, search, or enumerate Properties through this capability
- **THEN** no public list, search, marketplace, or direct Property route is available

### Requirement: Stable generic Property errors

After staff authentication, permission, and Property-scope authorization succeeds, protected Property reads and mutations MUST use stable generic not-found and conflict outcomes. The protected not-found outcome MUST NOT distinguish an absent identifier from a Property outside the trusted Tenant, but SHALL permit an authorized staff caller to read `DRAFT` and `INACTIVE` Properties. Permission or Property-scope failure MUST use the stable generic authorization denial defined by `staff-authorization` and MUST occur before the protected operation. The published resolver separately MUST map missing and every non-public lifecycle state to its stable public not-found outcome. The conflict outcome MUST cover tenant-local slug collisions, stale expected versions, and invalid lifecycle transitions without exposing another record, current version, database constraint, or internal persistence detail.

#### Scenario: Protected not-found outcome does not disclose Tenant ownership

- **WHEN** an authorized staff caller requests an absent identifier or an identifier owned by another Tenant
- **THEN** protected not-found behavior is equivalent and contains no ownership or existence detail

#### Scenario: Authorized staff reads an unpublished Property

- **WHEN** an authorized staff caller requests a `DRAFT` or `INACTIVE` Property within its permitted scope
- **THEN** the protected read can return the internal Property DTO even though the published resolver would return public not-found

#### Scenario: Scope denial remains an authorization outcome

- **WHEN** a staff caller lacks permission or matching Property scope
- **THEN** the operation returns the stable generic authorization denial before protected Property lookup rather than using Property lifecycle or existence as the explanation

#### Scenario: Conflict outcome hides internal state

- **WHEN** a mutation encounters a duplicate normalized slug, stale version, or invalid lifecycle transition
- **THEN** it returns the stable generic Property conflict outcome without exposing a conflicting Property, current version, SQL, or database constraint name

### Requirement: Property foundation excludes later-domain and sensitive fields

Property create and update contracts MUST reject attempts to supply RoomType, Unit, room, inventory, availability, rate, pricing, media, contact fields other than `publicWhatsAppE164`, booking, guest, stay, payment, housekeeping, channel, custom-domain, or subscription fields. Internal and public Property DTOs MUST NOT imply that any of those capabilities exists.

#### Scenario: Reject speculative nested data

- **WHEN** a caller includes media, an unsupported contact field, room, inventory, price, booking, or another later-domain field in a Property command
- **THEN** strict boundary validation rejects the command and no Property or nested record is changed

#### Scenario: Property response contains no later-domain claims

- **WHEN** an authorized staff caller reads or lists Properties
- **THEN** the response contains only the approved Property foundation fields and does not include fabricated room, availability, price, booking, guest, media, unsupported contact, or subscription data
