# audit-evidence Specification

## Purpose

Define the minimum append-only accountability evidence required when Phase 2 changes Property state or staff authority.

## Requirements

### Requirement: Material Phase 2 mutations create audit evidence

Every successful Property create, profile, address, timezone, classification, amenity, publication, inactivity, or archive mutation and every Property access-mode, grant, or revoke mutation MUST create exactly one corresponding audit event. The event SHALL identify the trusted Tenant, optional affected Property, actor type and stable actor identifier, optional verified membership for a `STAFF` actor, action, target type and identifier, successful result, aggregate version when applicable, correlation identifier, and database-recorded occurrence time.

#### Scenario: Property profile changes successfully

- **WHEN** an authorized staff member commits a Property profile change
- **THEN** the same operation records one audit event identifying the Property, actor, changed-field names, resulting version, and correlation identifier

#### Scenario: Property access changes successfully

- **WHEN** an authorized staff administrator changes a membership access mode or grants or revokes a Property scope
- **THEN** one audit event identifies the target membership, safe authority change, actor, Tenant, affected Property when applicable, and correlation identifier

#### Scenario: Bounded owner backfill runs as the system

- **WHEN** the reviewed migration workflow assigns explicit owner Property scope without an interactive staff actor
- **THEN** the audit event uses actor type `SYSTEM`, identifies the migration operation as its stable actor, and omits a staff membership identifier

### Requirement: Required audit evidence is atomic with the mutation

A material Phase 2 mutation and its required audit event MUST commit in one PostgreSQL transaction. If required audit persistence fails, the domain or authority mutation MUST roll back; a rejected command MUST NOT produce a misleading successful audit result.

#### Scenario: Audit persistence fails

- **WHEN** a Property publication change succeeds in domain validation but its required audit event cannot be persisted
- **THEN** neither the publication change nor a successful audit event is committed

#### Scenario: Authorization rejects a mutation

- **WHEN** a caller lacks the required permission or Property scope
- **THEN** no protected mutation occurs and the system does not record a successful mutation event

### Requirement: Audit events are append-only and tenant-owned

Every audit event MUST carry a non-null trusted Tenant identifier and MUST NOT be updated or deleted through application commands. A Property-scoped event SHALL reference a Property in the same Tenant, and a caller-supplied tenant or actor identifier MUST NOT establish audit ownership or attribution.

#### Scenario: Cross-tenant Property reference is attempted

- **WHEN** an operation in Tenant A attempts to create audit evidence referencing a Property in Tenant B
- **THEN** persistence rejects the relationship and no Phase 2 mutation commits

#### Scenario: Existing event modification is attempted

- **WHEN** application code attempts to update or delete an existing Phase 2 audit event
- **THEN** the audit application contract rejects the operation because no mutation command exists for recorded evidence

### Requirement: Audit metadata is minimized and redacted

Audit metadata SHALL contain only stable action identifiers and the minimum safe changed-field names or identifiers needed for accountability. It MUST NOT contain passwords, authentication tokens, cookies, request bodies, provider payloads, full addresses, private contact values, secrets, or oversized before-and-after aggregate snapshots.

#### Scenario: Address fields are changed

- **WHEN** an authorized actor updates a Property address
- **THEN** audit metadata may name the changed address fields but does not copy the complete previous or new address

#### Scenario: Scope administration input contains unrelated fields

- **WHEN** external scope-administration input includes data not allowed by the command schema
- **THEN** the data is rejected and is not copied into audit metadata or diagnostics

### Requirement: Phase 2 audit scope remains intentionally narrow

The Phase 2 audit capability SHALL expose the write contract required by Property and Identity authority mutations but MUST NOT imply a general audit browser, export, retention-management workflow, remote audit service, or domain-event broker.

#### Scenario: Staff requests an audit export

- **WHEN** a caller requests a general audit export through the Phase 2 surface
- **THEN** the system exposes no such operation and preserves the recorded events for a separately approved capability
