## MODIFIED Requirements

### Requirement: Active membership authorization

The system SHALL derive tenant staff permissions only after an authoritative server authentication boundary verifies the external user, the server resolves the tenant from trusted request context, and an active membership matches both that verified user and resolved tenant.

#### Scenario: Suspended membership

- **WHEN** a membership is suspended, revoked, invited, missing, belongs to a different external user, or belongs to a different tenant
- **THEN** tenant authorization is denied before tenant-owned data is read or mutated

#### Scenario: Active same-tenant membership

- **WHEN** a verified external user has an active membership for the server-resolved tenant
- **THEN** only the explicit permissions assigned through that membership are available for subsequent authorization checks

### Requirement: Authentication remains external

The membership model SHALL reference an external authenticated user identifier, SHALL NOT be interpreted as proof that a request is authenticated, and MUST be resolved from the verified server-side subject rather than a caller-selected actor identifier.

#### Scenario: No authenticated subject

- **WHEN** a request has tenant host context but no verified authenticated subject
- **THEN** protected staff authorization is denied even if a matching membership record exists

#### Scenario: Client-supplied actor identifier

- **WHEN** a caller submits the user identifier of an active staff member without a provider-verified session for that subject
- **THEN** the submitted identifier is ignored for authority and protected staff authorization is denied
