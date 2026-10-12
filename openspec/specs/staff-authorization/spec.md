# Staff authorization specification

## Purpose

Define how authenticated external identities, active staff memberships, tenant context, and permissions combine to authorize protected operations.

## Requirements

### Requirement: Active membership authorization

The system SHALL derive tenant staff permissions only after an authoritative server authentication boundary verifies the external user, the server resolves the tenant from trusted request context, and an active membership matches both that verified user and resolved tenant.

#### Scenario: Suspended membership

- **WHEN** a membership is suspended, revoked, invited, missing, belongs to a different external user, or belongs to a different tenant
- **THEN** tenant authorization is denied before tenant-owned data is read or mutated

#### Scenario: Active same-tenant membership

- **WHEN** a verified external user has an active membership for the server-resolved tenant
- **THEN** only the explicit permissions assigned through that membership are available for subsequent authorization checks

### Requirement: Permission-based access

The system MUST authorize application operations by explicit permission capabilities and SHALL NOT rely solely on UI visibility or role-name conditionals.

#### Scenario: Missing permission

- **WHEN** an active membership lacks the permission required by an operation
- **THEN** the operation is denied before tenant-owned data is read or mutated

### Requirement: Authentication remains external

The membership model SHALL reference an external authenticated user identifier, SHALL NOT be interpreted as proof that a request is authenticated, and MUST be resolved from the verified server-side subject rather than a caller-selected actor identifier.

#### Scenario: No authenticated subject

- **WHEN** a request has tenant host context but no verified authenticated subject
- **THEN** protected staff authorization is denied even if a matching membership record exists

#### Scenario: Client-supplied actor identifier

- **WHEN** a caller submits the user identifier of an active staff member without a provider-verified session for that subject
- **THEN** the submitted identifier is ignored for authority and protected staff authorization is denied

### Requirement: Tenant role assignments enforce tenant and scope integrity

Every role assignment used to derive Tenant permissions MUST bind a tenant-scoped membership to a `TENANT` role owned by the same trusted Tenant. A tenant membership MUST NOT receive a role owned by another Tenant or a `PLATFORM` role, and a platform membership MUST NOT receive a tenant role through the tenant-assignment path. These invariants MUST be enforced at the database boundary in addition to application checks, and an invalid persisted assignment MUST NOT contribute permissions.

#### Scenario: Same-Tenant role assignment

- **WHEN** a trusted assignment path links a tenant membership to a `TENANT` role owned by that same Tenant
- **THEN** the assignment may be persisted and may contribute permissions only while the membership remains active

#### Scenario: Cross-Tenant role assignment

- **WHEN** an assignment combines a membership in Tenant A with a role owned by Tenant B
- **THEN** the operation is rejected and the database prevents the relationship from being persisted

#### Scenario: Platform and Tenant scopes are mixed

- **WHEN** an assignment combines a tenant membership with a `PLATFORM` role or a platform membership with a `TENANT` role through the tenant-assignment path
- **THEN** the operation is rejected and the invalid relationship contributes no Tenant permission

### Requirement: Property-protected operations require explicit Property scope

Every protected Property operation MUST combine an authenticated subject, an active membership in the trusted server-resolved Tenant, the operation's explicit permission, and either explicit organization-wide Property access or an active same-tenant grant for the requested Property. Permission alone, a matching role name, a Property identifier or slug, a route parameter, a hostname, or the fact that a Property belongs to the same Tenant MUST NOT independently grant access.

#### Scenario: Permission exists without selected-Property grant

- **WHEN** an active membership has `property.read` but uses selected-Property access and has no grant for the requested Property
- **THEN** the operation is denied before the Property's protected record is read

#### Scenario: Explicit organization-wide access

- **WHEN** an active membership has the required permission and explicit organization-wide Property access in the resolved Tenant
- **THEN** the operation may proceed for a non-archived Property owned by that Tenant

#### Scenario: Matching explicit Property grant

- **WHEN** an active membership has the required permission and an active same-tenant grant for the requested Property
- **THEN** the operation may proceed within that Property scope

### Requirement: New Property creation requires organization-wide authority

Creating a Property MUST require `property.manage` plus explicit organization-wide Property access because no existing Property grant can authorize the new resource. Selected-Property access SHALL NOT inherit or acquire authority over a newly created Property automatically.

#### Scenario: Selected-Property manager creates a Property

- **WHEN** a staff member with `property.manage` is authorized only for an explicit set of existing Properties
- **THEN** creation is denied and the membership receives no grant to the requested new Property

#### Scenario: Organization-wide manager creates a Property

- **WHEN** an active staff member has `property.manage` and explicit organization-wide Property access
- **THEN** the service may create a Property in the trusted Tenant without accepting a client-selected Tenant identifier

### Requirement: Property authorization fails closed before protected repository access

Missing, malformed, inactive, revoked, other-tenant, duplicate, or unresolved membership scope data MUST deny access with a stable generic authorization outcome. Authorization MUST complete before a protected Property repository callback runs, and same-Tenant cross-Property denial MUST NOT reveal whether the target exists.

#### Scenario: Known Property identifier belongs to another Tenant

- **WHEN** a caller in Tenant A submits the known identifier of a Property in Tenant B
- **THEN** access is denied generically before Tenant B Property data is selected or mutated

#### Scenario: Same-Tenant Property is outside selected scope

- **WHEN** a caller scoped to Property A submits the identifier of Property B in the same Tenant
- **THEN** access is denied generically and the protected repository callback is not invoked

#### Scenario: Scope state cannot be resolved

- **WHEN** membership access mode or grant state is missing, contradictory, or cannot be loaded
- **THEN** authorization denies the operation rather than assuming organization-wide access

### Requirement: Authorized Property lists are bounded by permission and scope

A protected Property list MUST require `property.read`, constrain results to the trusted Tenant, and return only Properties authorized by explicit organization-wide access or selected grants. Results MUST be bounded and deterministically paginated, and archived Properties MUST be excluded unless an explicit archive-aware query is authorized.

#### Scenario: Selected-Property staff lists Properties

- **WHEN** a staff member with `property.read` has active grants for two of five non-archived Properties in the Tenant
- **THEN** the list returns only those two Properties within the requested page bound

#### Scenario: UI selection attempts to widen scope

- **WHEN** the client selects or submits a Property outside the membership's authorized list
- **THEN** the subsequent protected operation performs authorization again and denies access

### Requirement: Property scope and staff permissions remain independent

Property scope MUST restrict where an existing permission applies and MUST NOT create that permission. Revoking a role permission MUST immediately deny the associated operation even when the membership retains organization-wide access or an explicit Property grant.

#### Scenario: Grant exists without read permission

- **WHEN** a membership has an active grant for a Property but lacks `property.read`
- **THEN** the Property read is denied before protected data is returned

#### Scenario: Read permission does not authorize mutation

- **WHEN** a membership has `property.read` and matching Property scope but lacks `property.manage`
- **THEN** profile, publication, inactivity, and archive mutations are denied
