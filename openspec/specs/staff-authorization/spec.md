# Staff authorization specification

## Purpose

Define how authenticated external identities, active staff memberships, tenant context, and permissions combine to authorize protected operations.

## Requirements

### Requirement: Active membership authorization

The system SHALL derive tenant staff permissions only from an active membership associated with the authenticated external user and resolved tenant.

#### Scenario: Suspended membership

- **WHEN** a membership is suspended, revoked, invited, missing, or belongs to a different tenant
- **THEN** tenant authorization is denied

### Requirement: Permission-based access

The system MUST authorize application operations by explicit permission capabilities and SHALL NOT rely solely on UI visibility or role-name conditionals.

#### Scenario: Missing permission

- **WHEN** an active membership lacks the permission required by an operation
- **THEN** the operation is denied before tenant-owned data is read or mutated

### Requirement: Authentication remains external

The membership model SHALL reference an external authenticated user identifier and SHALL NOT be interpreted as proof that a request is authenticated.

#### Scenario: No authenticated subject

- **WHEN** a request has tenant host context but no authenticated subject
- **THEN** protected staff authorization is denied
