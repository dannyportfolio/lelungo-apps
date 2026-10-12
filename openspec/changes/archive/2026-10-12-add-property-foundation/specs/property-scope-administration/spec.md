## Purpose

Define explicit, fail-closed Property access scope for active staff memberships and safe administration of membership-to-Property grants within one trusted Tenant boundary.

## ADDED Requirements

### Requirement: Active memberships have an explicit Property access mode

Every active tenant-scoped staff membership MUST have exactly one explicit Property access mode: `ALL_PROPERTIES` or `SELECTED_PROPERTIES`. `ALL_PROPERTIES` SHALL permit access to non-archived Properties owned by the trusted Tenant, subject to the operation's separate permission checks. `SELECTED_PROPERTIES` SHALL permit access only to non-archived Properties covered by a current same-tenant grant. A missing, null, unknown, duplicated, or otherwise invalid access mode MUST fail closed and MUST NOT be interpreted as organization-wide access.

#### Scenario: Explicit organization-wide access

- **WHEN** an active same-tenant membership has `ALL_PROPERTIES`, has the required operation permission, and targets a non-archived Property owned by the trusted Tenant
- **THEN** its Property-scope check succeeds without requiring an individual Property grant

#### Scenario: Explicit selected-Property access

- **WHEN** an active same-tenant membership has `SELECTED_PROPERTIES`, has the required operation permission, and has a current same-tenant grant for the targeted non-archived Property
- **THEN** its Property-scope check succeeds for that Property only

#### Scenario: Selected membership has no matching grant

- **WHEN** an active membership has `SELECTED_PROPERTIES` but has no current grant for the requested Property
- **THEN** the Property-scope check fails closed even when the Property belongs to the same Tenant

#### Scenario: Access mode is missing or invalid

- **WHEN** an active membership's Property access mode is missing, unknown, duplicated, or cannot be resolved
- **THEN** every Property-protected operation is denied without falling back to `ALL_PROPERTIES`

### Requirement: Tenant-owner bootstrap is explicit and migration is conservative

Future trusted provisioning of an active `TENANT_OWNER` membership MUST persist `ALL_PROPERTIES` explicitly and MUST NOT depend on request-time inference from a role name. An existing membership MUST receive `ALL_PROPERTIES` during backfill only when reviewed evidence verifies that membership as the Tenant owner. An ambiguous existing membership MUST remain fail closed, MUST receive no inferred Property grant, and MUST be classified for manual review.

#### Scenario: Future owner is provisioned

- **WHEN** the trusted Tenant provisioning workflow creates and activates its designated `TENANT_OWNER` membership
- **THEN** the workflow persists `ALL_PROPERTIES` explicitly as part of the resulting owner authority

#### Scenario: Existing owner evidence is verified

- **WHEN** the bounded backfill has reviewed evidence that an existing active membership is the designated Tenant owner
- **THEN** the backfill may assign `ALL_PROPERTIES` explicitly and records the classified outcome

#### Scenario: Existing owner status is ambiguous

- **WHEN** the backfill cannot verify that an existing membership is the designated Tenant owner
- **THEN** it assigns no broad authority or inferred grant, classifies the record for manual review, and leaves Property authorization fail closed

### Requirement: Selected-Property grants enforce same-tenant integrity

A current selected-Property grant MUST be unique for its `(tenant, membership, Property)` tuple. The target membership MUST be active and belong to the trusted Tenant, and the target Property MUST belong to that same Tenant. These relationships MUST be enforceable at the database boundary with same-tenant composite integrity in addition to application authorization. A duplicate, cross-tenant, inactive-membership, missing, or incompatible target MUST be rejected without creating or changing a grant.

#### Scenario: Valid same-tenant grant

- **WHEN** an authorized administrator grants a non-archived Property to another active membership in the same trusted Tenant
- **THEN** exactly one current grant exists for that Tenant, membership, and Property tuple

#### Scenario: Duplicate grant is attempted

- **WHEN** a current grant already exists for a Tenant, membership, and Property tuple and another grant is requested for the same tuple
- **THEN** the operation is rejected without creating a duplicate relationship

#### Scenario: Cross-tenant grant is attempted

- **WHEN** a grant command combines a membership and Property that do not both belong to the trusted Tenant
- **THEN** the operation is denied and the database also rejects the cross-tenant relationship if an application check regresses

#### Scenario: Target membership is not active

- **WHEN** an administrator attempts to grant, revoke, or change Property access for a target membership that is invited, suspended, revoked, missing, or otherwise not active
- **THEN** the operation is denied without changing its access mode or grants

### Requirement: Archived Properties never grant new operational authority

Archiving a Property MUST retain its scope-grant relationships and authority history, but neither `ALL_PROPERTIES` nor a selected-Property grant SHALL authorize new accommodation, inventory, pricing, reservation, or other operational configuration against that archived Property. Default authorized-Property and grant lists MUST exclude archived Properties and their retained grants. Explicit archive-aware Property reads and lifecycle commands MAY pass the membership's retained scope to the Property service, where the Property lifecycle determines the stable internal result; that access MUST NOT reactivate the Property or authorize later-domain operations.

#### Scenario: Granted Property is archived

- **WHEN** a Property covered by an existing selected-Property grant is archived
- **THEN** the grant is retained for history but no new Property-protected operation is authorized through it

#### Scenario: Organization-wide member targets an archived Property

- **WHEN** a membership with `ALL_PROPERTIES` attempts a new operational-domain command against an archived Property
- **THEN** the operation is denied because organization-wide scope does not override Property lifecycle or serviceability

#### Scenario: Authorized historical read targets an archived Property

- **WHEN** an authorized staff caller explicitly requests the retained internal history of an archived Property
- **THEN** the retained scope may authorize the minimum-field historical read without making the Property operational

#### Scenario: Default authorized-Property list is requested

- **WHEN** an authorized caller lists the Properties currently available to a membership without requesting a historical view
- **THEN** archived Properties and retained grants for archived Properties are excluded from the result

### Requirement: Scope administration requires broad explicit authority

Granting, revoking, or changing Property access for another membership MUST require an active actor in the trusted Tenant with both the explicit `staff.manage` permission and `ALL_PROPERTIES` access mode. The target membership MUST be a different active membership in that same Tenant. Having only one of those authorities, holding a selected-Property grant, knowing the target identifiers, or sharing the Tenant MUST NOT authorize scope administration. An actor MUST NOT grant itself a Property, change itself to `ALL_PROPERTIES`, or otherwise use this capability to widen its own Property authority.

#### Scenario: Authorized administrator changes another membership

- **WHEN** an active same-tenant actor with `staff.manage` and `ALL_PROPERTIES` changes the Property access of another active membership in that Tenant
- **THEN** the administration operation may proceed to concurrency and invariant validation

#### Scenario: Staff permission is missing

- **WHEN** an actor has `ALL_PROPERTIES` but lacks `staff.manage`
- **THEN** grant, revoke, and access-mode changes for another membership are denied

#### Scenario: Organization-wide access is missing

- **WHEN** an actor has `staff.manage` but has `SELECTED_PROPERTIES`
- **THEN** grant, revoke, and access-mode changes for another membership are denied even if the actor is granted the targeted Property

#### Scenario: Actor attempts self-escalation

- **WHEN** an actor submits a command that would grant itself a Property, set itself to `ALL_PROPERTIES`, or otherwise widen its own Property scope
- **THEN** the command is denied without changing the actor's access mode, grants, or version

#### Scenario: Administrator targets another Tenant membership

- **WHEN** an otherwise authorized administrator submits a membership identifier owned by another Tenant
- **THEN** the operation is denied without revealing whether that foreign membership exists

### Requirement: Scope changes use optimistic concurrency

Every access-mode, grant, and revoke command MUST include the target membership scope's current expected version. A successful change SHALL atomically advance that version exactly once. A command with a missing or stale expected version MUST return a stable conflict result and MUST NOT partially change the access mode, grants, version, or audit evidence.

#### Scenario: Scope change uses the current version

- **WHEN** an authorized administrator submits a valid scope change with the target membership scope's current expected version
- **THEN** the complete change commits and the scope version advances exactly once

#### Scenario: Concurrent scope change uses a stale version

- **WHEN** another accepted change has already advanced the target membership scope beyond the submitted expected version
- **THEN** the stale command returns a stable conflict and leaves the newer scope state unchanged

### Requirement: Access-mode transitions replace the effective selected set atomically

Changing a membership from `SELECTED_PROPERTIES` to `ALL_PROPERTIES` MUST revoke every current explicit Property grant while retaining audit history. Changing from `ALL_PROPERTIES` to `SELECTED_PROPERTIES` MUST include the complete intended set of zero through 100 same-tenant non-archived Property identifiers and MUST atomically establish exactly that set; an empty set is valid and grants no Property authority. A grant or revoke command MUST apply only while the target membership already uses `SELECTED_PROPERTIES`. Validation, ownership, or expected-version failure MUST leave the prior mode and effective selected set unchanged.

#### Scenario: Selected access becomes organization-wide

- **WHEN** an authorized administrator changes a membership from `SELECTED_PROPERTIES` with current grants to `ALL_PROPERTIES`
- **THEN** organization-wide access and revocation of every current explicit grant commit together with one scope-version advance

#### Scenario: Organization-wide access becomes a selected set

- **WHEN** an authorized administrator changes a membership from `ALL_PROPERTIES` to `SELECTED_PROPERTIES` with a valid complete set of Property identifiers
- **THEN** exactly that selected set becomes current and no older grant silently reactivates

#### Scenario: Organization-wide access becomes empty selected access

- **WHEN** an authorized administrator changes a membership from `ALL_PROPERTIES` to `SELECTED_PROPERTIES` with an explicit empty set
- **THEN** the membership has no current Property authority until a later authorized grant succeeds

#### Scenario: Mode change contains too many Properties

- **WHEN** a mode-change command contains more than 100 distinct Property identifiers
- **THEN** validation rejects the complete command without changing the prior access mode, grants, version, or audit evidence

#### Scenario: Grant command targets organization-wide membership

- **WHEN** an administrator submits an individual grant or revoke for a membership currently using `ALL_PROPERTIES`
- **THEN** the command is rejected without retaining a dormant selected grant

### Requirement: Property-scope lists are bounded and deterministic

Property-scope administration lists MUST require a validated page size within a named maximum, MUST use a stable deterministic order with a unique tie-breaker, and MUST return an opaque continuation cursor when more results remain. Repeating a page request against unchanged source data MUST return the same ordered identities. Default lists MUST exclude archived Properties and MUST expose only the minimum fields required for scope administration.

#### Scenario: Bounded list is returned

- **WHEN** an authorized administrator requests a valid page smaller than or equal to the configured maximum
- **THEN** the system returns no more than the requested number of records in deterministic order and includes an opaque cursor only when another page exists

#### Scenario: Requested page is unbounded

- **WHEN** a caller omits a required bound or requests a page larger than the configured maximum
- **THEN** validation rejects the request before an unbounded Property or grant query executes

#### Scenario: Page is repeated without source changes

- **WHEN** the same authorized page request and cursor are evaluated against unchanged scope data
- **THEN** the same ordered Property or grant identities are returned

### Requirement: Staff administrators can select a target through a minimum-field membership list

The scope-administration capability SHALL provide a bounded deterministic list of active same-Tenant staff memberships for an actor authorized by `staff.manage` and `ALL_PROPERTIES`. Each item MUST contain only the stable membership identifier, membership status, Property access mode, scope version, and current selected-Property count. It MUST NOT expose the external provider subject identifier, email, credentials, tokens, role internals, or other provider profile data. The list MUST use an opaque continuation cursor, deterministic creation-time and membership-identifier ordering, and a page size from 1 through 100. A missing recognizable staff profile is an explicit Phase 2 limitation and MUST NOT be filled by querying provider internals from the UI.

#### Scenario: Administrator lists active membership scope summaries

- **WHEN** an actor with `staff.manage` and `ALL_PROPERTIES` requests a valid page of active memberships in the trusted Tenant
- **THEN** the system returns at most the requested number of minimum-field scope summaries and an opaque continuation cursor when more remain

#### Scenario: Membership list hides provider identity

- **WHEN** the scope-administration UI renders a target membership summary
- **THEN** it displays the stable membership identifier and scope state without exposing external subject IDs, email, credentials, tokens, or provider profile data

#### Scenario: Membership list attempts cross-Tenant enumeration

- **WHEN** a caller supplies another Tenant identifier or reuses a membership-list cursor under another Tenant
- **THEN** the request is rejected generically before another Tenant's membership record is returned

### Requirement: Requested identifiers never establish Property authority

A route identifier, Property slug, hostname, UI selection, resource identifier, or same-Tenant relationship MUST be treated only as a requested resource and MUST NOT establish or widen Property authority. The system MUST resolve the trusted Tenant, active membership, explicit permission, access mode, applicable grant, and Property ownership before protected Property data is returned or mutated.

#### Scenario: Same-Tenant route identifier lacks a grant

- **WHEN** a `SELECTED_PROPERTIES` member supplies a valid route identifier or slug for another Property in the same Tenant without a matching grant
- **THEN** the operation is denied before that Property's protected data is returned or changed

#### Scenario: Hostname is presented as Property authority

- **WHEN** a caller reaches a route through a tenant hostname but lacks the required access mode or selected-Property grant
- **THEN** hostname possession does not authorize the requested Property operation

### Requirement: Authorization denials are stable and non-enumerating

Property-scope authorization failures MUST return the same stable generic denial class for a missing or inactive membership, missing permission, invalid access mode, missing grant, cross-tenant target, or unauthorized Property identifier. The response MUST NOT reveal whether a protected membership, Property, slug, or grant exists and MUST NOT expose internal ownership details. After authorization succeeds, the owning Property service MAY return its separately specified stable lifecycle conflict for a mutation of an archived Property.

#### Scenario: Foreign and ungranted identifiers are compared

- **WHEN** a caller separately submits a known foreign-Tenant Property identifier and a same-Tenant Property identifier for which it has no grant
- **THEN** both requests receive the stable generic denial without distinguishable ownership or existence details

### Requirement: Accepted authority changes append audit evidence atomically

Every accepted access-mode change, Property grant, Property revocation, owner bootstrap, and owner backfill assignment MUST append audit evidence in the same transaction as the authority change. The evidence MUST identify the trusted Tenant, actor type and stable actor identifier, target membership, affected Property when applicable, action, prior and resulting scope versions, timestamp, request or correlation identifier, and a redacted change summary. A `STAFF` actor MUST include its verified membership identifier; a bounded owner backfill SHALL use a `SYSTEM` actor and omit a staff membership identifier. If the audit record cannot be appended, the authority mutation MUST roll back completely.

#### Scenario: Grant and audit both succeed

- **WHEN** an authorized grant command passes validation, authorization, ownership, and expected-version checks
- **THEN** the grant, advanced scope version, and corresponding append-only audit evidence commit together

#### Scenario: Audit append fails

- **WHEN** an otherwise valid scope mutation cannot append its required audit evidence
- **THEN** the access mode, grants, and scope version remain unchanged

#### Scenario: Owner backfill records a system actor

- **WHEN** the reviewed owner backfill assigns `ALL_PROPERTIES` without an interactive staff actor
- **THEN** the authority change and audit event commit together with actor type `SYSTEM` and no staff membership identifier

### Requirement: Scope administration does not manage membership or role lifecycles

Property-scope administration MUST NOT invite, activate, suspend, or revoke staff memberships and MUST NOT create, update, or delete custom roles. It MUST NOT infer current Property authority from a role name; the trusted owner-provisioning decision only supplies an explicit initial access mode. A non-active membership's retained access mode and grants MUST grant no authority. A later membership reactivation MAY make retained scope effective only through a separately authorized and audited Identity lifecycle operation; direct database or caller-selected status changes MUST NOT be an authority path.

#### Scenario: Invitation fields are submitted to a scope command

- **WHEN** a caller submits invitation, membership-lifecycle, or identity-provider fields to a Property-scope administration command
- **THEN** validation rejects the unsupported fields without creating or changing a membership

#### Scenario: Custom-role change is submitted to a scope command

- **WHEN** a caller submits custom-role creation or mutation fields to a Property-scope administration command
- **THEN** validation rejects the unsupported fields without changing a role, permission, access mode, or Property grant

#### Scenario: Suspended membership retains no current authority

- **WHEN** a membership with retained grants is suspended, revoked, or otherwise non-active
- **THEN** its retained access records authorize no Property operation unless a separately approved Identity lifecycle later reactivates the membership
