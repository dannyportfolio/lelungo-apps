## MODIFIED Requirements

### Requirement: Permission-based access

The system MUST authorize protected Phase 3 application operations by explicit fine-grained permissions and SHALL NOT rely solely on UI visibility, role-name conditionals, or possession of a broader read permission. The permission catalog SHALL include `room_type.read`, `room_type.manage`, `unit.read`, `unit.manage`, `inventory.read`, `inventory.manage`, `availability.read`, `pricing.read`, `pricing.manage`, `rate_plan.read`, and `rate_plan.manage`, with each operation declaring and enforcing the permission appropriate to its action at the application-service boundary.

#### Scenario: Missing permission

- **WHEN** an active same-tenant membership lacks the fine-grained permission required by a RoomType, Unit, inventory, availability, pricing, or RatePlan operation
- **THEN** the operation is denied before protected tenant-owned data is read or mutated

#### Scenario: Read permission does not grant mutation

- **WHEN** an active staff member has `pricing.read` but lacks `pricing.manage` and attempts to update a rate
- **THEN** the update is denied even though the staff member may read authorized pricing data

## ADDED Requirements

### Requirement: Tenant and Property scoped Phase 3 authorization

Every protected RoomType, Unit, inventory, availability, RatePlan, rate, restriction, and price-management operation MUST verify that the target Property belongs to the trusted server-resolved Tenant and falls within the active staff membership's authorized Property scope. A route parameter, resource identifier, hostname, or same-Tenant relationship SHALL NOT independently grant Property access.

#### Scenario: Known cross-tenant resource identifier

- **WHEN** a staff member authorized for Tenant A submits a RoomType, Unit, or RatePlan identifier owned by Tenant B
- **THEN** the operation is denied without exposing the other Tenant's resource data

#### Scenario: Same-Tenant cross-Property mutation

- **WHEN** a staff member scoped to Property A attempts to mutate Property B inventory or pricing within the same Tenant
- **THEN** the operation is denied before Property B data is changed

#### Scenario: Authorized Property operation

- **WHEN** an active staff member has the required fine-grained permission and the target Property is inside that membership's authorized Property scope for the resolved Tenant
- **THEN** Property scope authorization succeeds and the operation may proceed to any separately required entitlement check

### Requirement: Entitlement is independent from staff authorization

A protected Phase 3 operation that requires a product capability MUST enforce the effective Tenant entitlement independently from authentication, membership, permission, and Property-scope authorization. Permission or Property scope MUST NOT imply entitlement, entitlement MUST NOT grant staff authority, and backend enforcement MUST return the stable `FEATURE_NOT_ENTITLED` denial when an otherwise authorized Tenant lacks the required capability.

#### Scenario: Authorized staff lacks product capability

- **WHEN** a staff member has the required permission and Property scope but the Tenant lacks the capability declared by the requested operation
- **THEN** the backend denies the operation with `FEATURE_NOT_ENTITLED` and does not rely on the UI to prevent access

#### Scenario: Entitled Tenant lacks staff permission

- **WHEN** the Tenant has the required capability but the active staff member lacks the operation's permission or Property scope
- **THEN** authorization is denied and the entitlement does not grant access
