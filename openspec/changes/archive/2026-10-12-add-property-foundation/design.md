## Context

See [proposal.md](./proposal.md) for motivation and scope. The executable repository now has the Phase 1 authenticated tenant-membership boundary, but Prisma still contains no Property, Property scope, or audit table. The Phase 1 read path filters role joins defensively, while `staff_membership_roles` still lacks database-enforced same-Tenant integrity. Phase 2 must close that gap before protected Property data becomes authoritative.

The accepted architecture constrains this design:

- `Tenant.id` remains the persisted Organization and isolation key;
- tenant host resolution remains server authority, while Property identifiers only select resources;
- dependencies flow from `src/app` to module application/domain contracts to server-only repositories;
- PostgreSQL is transactional authority and migrations are append-only;
- every tenant-owned relationship repeats `tenant_id` and uses composite integrity where practical;
- Phase 3 consumes Property timezone, classification, lifecycle/serviceability, public identity, scope authorization, and audit contracts but owns RoomType, Unit, Inventory, Pricing, and Entitlements itself.

## Goals / Non-Goals

**Goals:**

- Make the Property and staff Property-scope contracts executable without widening the Phase 1 authentication boundary.
- Encode ownership, role-assignment integrity, selected-Property grants, optimistic concurrency, and atomic audit evidence in PostgreSQL as well as application code.
- Expose small application contracts for protected management, authorized lists, and one published Property identity that Phase 3 can compose.
- Keep migration, backfill, rollback, and negative-test behavior explicit enough to stop safely on ambiguous existing authority.

**Non-Goals:**

- A generic organization, staff invitation, role editor, catalog editor, audit viewer, event bus, or public marketplace API.
- Property media, geospatial search, custom domains, subscription limits, or any accommodation/inventory/pricing/reservation placeholder.
- Deriving Property authority from a role name, slug, host, client-supplied Tenant ID, or UI state.

## Decisions

### 1. Archive Phase 1 before applying Phase 2

The apply workflow first verifies that `add-authenticated-membership-foundation` is complete, its delta specs are synced, and the change is archived with its recorded verification caveats intact. Phase 2 planning can exist before that point, but schema or runtime implementation does not begin while the prerequisite remains active.

**Alternatives considered:** silently absorb unfinished Phase 1 work or rely only on its task count. Both are rejected because Phase 2 protects real tenant data and must inherit an explicit, repository-visible authentication contract.

### 2. Keep Property, Identity/Authorization, and Audit as separate owners

`src/modules/properties` owns Property profile, lifecycle, catalogs, projections, repository port, and application services. Identity/Authorization owns membership access mode, selected grants, and authorization composition. A small `src/modules/audit` public write contract owns append-only evidence. Cross-module orchestration receives intentional ports; no module imports another module's Prisma repository.

```text
src/app/staff transport and composition
  -> tenancy request context
  -> identity/property authorization public contract
  -> properties application contract
       -> properties repository port -> Prisma
       -> audit write port -> Prisma transaction client
  -> property-scope administration application contract
       -> identity scope repository port -> Prisma
       -> audit write port -> Prisma transaction client
```

Server Components call application queries directly. Server Actions revalidate or redirect only after validation, authentication, trusted Tenant resolution, authorization, and service execution. Prisma adapters and privileged composition files import `server-only`; Client Components receive serializable DTOs and Server Actions only.

**Alternatives considered:** one large staff/Property service, Prisma calls in route components, or a generic repository. Each obscures data ownership or permits authorization bypass.

### 3. Use relational Property data and system-managed catalogs

The additive data model is:

- `properties`: UUID `id`, required `tenant_id`, tenant-unique normalized `slug`, bounded `name`, stable `classification_key`, canonical `timezone`, optional bounded public description/contact, lifecycle, positive `version`, lifecycle timestamps, and UTC create/update timestamps;
- `property_addresses`: one required row per Property with repeated `tenant_id`, structured bounded Indonesian address fields, and a composite Property reference;
- `property_classifications`: stable string key, display name, and active flag;
- `amenities`: stable string key, display name, and active flag;
- `property_amenities`: repeated `tenant_id`, composite Property reference, and catalog key;
- `membership_property_scopes`: repeated `tenant_id`, membership, Property, grant time, and granting membership; the tuple is unique;
- `audit_events`: append-only UUID evidence with Tenant, optional same-Tenant Property, actor type/ID, optional same-Tenant actor membership, action/target/result, optional aggregate version, correlation ID, safe changed-field array, and occurrence time.

`PropertyClassification` and Amenity are descriptive catalogs, not inventory behavior. The migration seeds the exact baseline keys idempotently. Runtime Phase 2 exposes no catalog mutation UI; catalog retirement is a reviewed system operation that refuses to invalidate a published Property.

`Property` exposes `UNIQUE (tenant_id, id)` and tenant-leading list indexes. Property children and grants use composite foreign keys in reviewed SQL where Prisma cannot express the full constraint. Tenant deletion remains restricted once a Property exists. Properties have no delete command; archive is terminal.

**Alternatives considered:** JSON profile/address, free-text classification/amenities, database enums for expandable catalogs, or embedding address fields directly in every future projection. Relational catalogs and a one-to-one address preserve constraints and intentional DTOs.

### 4. Make tenant role assignments database-safe before using permissions for Property

The existing `staff_membership_roles` table becomes the Tenant-only assignment path by adding required `tenant_id`. Before changing it, migration preflight classifies every row and raises an error for cross-Tenant, platform/tenant mixed, orphaned, or ambiguous assignments. Valid Tenant assignments are backfilled from their membership Tenant. Composite unique keys on memberships/roles plus composite foreign keys from the assignment prove one Tenant. A Role check enforces `TENANT <=> tenant_id IS NOT NULL` and `PLATFORM <=> tenant_id IS NULL`.

No platform assignment behavior is introduced. A future platform authorization slice must use a separate reviewed path instead of overloading the Tenant table. Application provisioning supplies `tenant_id` explicitly and membership reads keep the same minimum permission projection.

**Alternatives considered:** continue relying on read filtering, add only a trigger, or keep nullable tenant semantics in one assignment table. They either leave corruption persistable or make platform scope ambiguous.

### 5. Store explicit membership Property access mode and replace selected sets atomically

Tenant memberships receive `property_access_mode` and positive `property_scope_version`; platform memberships retain null Property scope. Migration preflight validates role assignments first, then assigns `ALL_PROPERTIES` only to an unambiguous active same-Tenant `TENANT_OWNER` assignment and assigns safe empty `SELECTED_PROPERTIES` to every other Tenant membership. Ambiguous owner evidence stops for manual review. Future tenant-owner provisioning writes `ALL_PROPERTIES`; other Tenant membership creation writes `SELECTED_PROPERTIES`.

Changing selected access to all access deletes current selected grant rows in the same transaction; audit events retain history. Changing all access to selected access accepts the complete intended set (zero through 100), validates every Property under the trusted Tenant, and atomically replaces the effective set. Individual grant/revoke commands work only in selected mode. Every command predicates on the current scope version and increments it once.

Suspended/invited/revoked memberships never authorize, even when scope rows remain. Phase 2 does not own membership reactivation; any future reactivation must be an explicit audited Identity command. Direct status mutation is not an application authority path.

**Alternatives considered:** nullable mode meaning all, role-name inference, dormant grants while in all mode, or automatically granting the creator a new Property. Each can silently widen or resurrect authority.

### 6. Authorize before protected operations and keep list authorization set-based

The Phase 1 request context is extended with the minimum membership identity, access mode, and scope version needed by authorization. Permission derivation remains based on the verified subject and active same-Tenant membership.

`withPropertyPermission` first requires the explicit permission. For `ALL_PROPERTIES`, it passes trusted Tenant/actor context to a Tenant-scoped operation. For `SELECTED_PROPERTIES`, it verifies the current `(tenant, membership, property)` grant before invoking the protected callback. Creation requires `property.manage` plus `ALL_PROPERTIES`. Scope administration requires `staff.manage`, `ALL_PROPERTIES`, a different active target membership, and expected scope version.

Property lists do not authorize one row at a time. The repository applies one Tenant-leading query plus either no Property restriction for `ALL_PROPERTIES` or a relational membership-grant predicate for selected access. Scope and membership lists use the same bounded set-based pattern.

Authentication failure, membership/permission/scope failure, protected not-found, public not-found, validation, and conflict remain separate stable categories. Denials do not reveal whether an unauthorized resource exists; authorized internal reads can return Draft/Inactive records, while the public resolver hides every non-published state.

**Alternatives considered:** route-level role checks, fetch-then-authorize, N+1 grant checks, or mapping every denial to one database result. Those approaches leak existence, duplicate policy, or perform poorly.

### 7. Treat Property lifecycle and serviceability as owner-defined predicates

The state machine is `DRAFT -> PUBLISHED -> INACTIVE -> PUBLISHED`, with any non-archived state able to archive and `ARCHIVED` terminal. All create fields are complete; publication revalidates the active Tenant, active catalogs, canonical timezone, address, and current expected version. Publication and lifecycle timestamps use the database transaction time.

The public Property context exposes owner-defined booleans rather than asking Phase 3 to reinterpret status:

- `configurable`: non-archived and owned by an active Tenant;
- `serviceableForSale`: `PUBLISHED` and owned by an active Tenant;
- `publiclyResolvable`: same Phase 2 predicate as serviceable for the minimal identity contract.

Phase 3 may add stronger RoomType/Unit/rate/entitlement prerequisites but cannot weaken these Property predicates. Changing timezone is a versioned profile mutation; Phase 3 will later decide whether existing dated configuration requires additional transition guards.

**Alternatives considered:** boolean `published`, hard delete, or letting each downstream module map lifecycle independently. An explicit lifecycle with public predicates prevents inconsistent behavior.

### 8. Validate canonical IANA timezone and bounded external input in the domain boundary

Strict Zod command schemas reject unknown keys and all ownership, actor, lifecycle, version-on-create, and later-domain fields. Slug normalization is one pure function. IANA validation constructs `Intl.DateTimeFormat` with the submitted value, reads the resolved canonical zone, and requires exact equality; aliases, abbreviations, and offsets are rejected. Named bounds from the specs are shared by application schemas and form attributes.

Repository inputs are typed commands built after validation and authorization, never ORM input objects. Public/internal DTO projection uses explicit field selection and plain serializable values.

**Alternatives considered:** accepting any timezone string, browser-only validation, or spreading `FormData`/JSON into Prisma. Each creates date ambiguity or mass-assignment risk.

### 9. Use transaction-scoped repositories for optimistic mutations and audit

Create, profile/lifecycle mutation, access-mode replacement, grant, and revoke run in one Prisma interactive transaction. Services load the minimum current state, validate invariants, then use an expected-version predicate. Zero affected rows maps to the stable conflict/not-found contract without returning the current version. Address and amenity replacement, aggregate version increment, lifecycle timestamp, and exactly one audit row commit together.

Audit accepts either a verified `STAFF` actor with its membership ID or a named `SYSTEM` migration actor. It stores changed-field names, not full values or request bodies. No application update/delete method exists. PostgreSQL permissions/operational policy for physical immutability remain deployment concerns; application and integration tests prove the repository contract.

**Alternatives considered:** best-effort logs, post-commit audit calls, or full before/after JSON. They can lose evidence or retain unnecessary data.

### 10. Use opaque bound cursors and expected versions

Property lists order by normalized slug and UUID; active membership/scope lists order by creation time and UUID. An HMAC-signed cursor would require a new secret and deployment contract, so Phase 2 uses a base64url encoded, schema-versioned payload containing the last sort values and a SHA-256 binding of trusted Tenant, membership/access mode, filters, and ordering. The server recomputes and compares the binding; cursor content grants no authority and every query reauthorizes. Payload parsing is strict and size-bounded.

This prevents accidental cross-scope reuse and opaque implementation leakage without treating the cursor as a security token. If tamper resistance becomes necessary for a public cursor, a separately configured signing-key design can supersede it.

**Alternatives considered:** offset pagination, raw UUID cursors, or adding a secret now. Offset drifts and scans; raw values expose implementation; a new secret is unnecessary for an authenticated cursor that is rebound and reauthorized.

### 11. Keep the Phase 2 UI minimal and server-first

Routes are `/staff/properties`, `/staff/properties/new`, `/staff/properties/[propertyId]`, and `/staff/property-access`. Pages are dynamic Server Components that resolve request context and call application queries directly. Mutations are Server Actions with authentication and authorization repeated inside each action. Small Client Components use `useActionState` only for validation/conflict feedback and pending controls. Dynamic `params`, `searchParams`, `headers()`, and `cookies()` follow installed Next.js 16 async contracts.

The scope UI lists only opaque membership IDs and scope summaries because no approved provider-profile or staff-directory contract exists. This limitation is displayed honestly. UI visibility never replaces backend authorization. No public Property HTTP route is created in Phase 2.

**Alternatives considered:** client-side fetching, internal REST endpoints, or querying Supabase profiles. They add waterfalls/surfaces or cross the approved identity-data boundary.

## Risks / Trade-offs

- **[Authority backfill misclassification]** -> Run a read-only classification first, abort on every invalid/ambiguous role assignment, assign broad scope only from verified owner evidence, and record reconciliation totals.
- **[Catalog retirement breaks publication]** -> Seed stable system keys, expose no general catalog UI, and reject deactivation while a published Property references the value.
- **[OCC across related rows is implemented incorrectly]** -> Lock/read one aggregate in an interactive transaction, predicate the root update on expected version, and test two concurrent writers against PostgreSQL.
- **[Cursor binding is mistaken for authorization]** -> Reauthenticate and reauthorize every page; repository predicates always begin with trusted Tenant and effective scope.
- **[Audit table grows without lifecycle policy]** -> Keep records narrow and indexed by Tenant/time; retention/export remains a later approved Audit slice.
- **[Opaque membership UI is hard to use]** -> Label the limitation and expose only stable membership IDs until an approved minimum staff profile exists; do not pull provider identity into Phase 2.
- **[Timezone changes affect later dated configuration]** -> Phase 2 versions and audits the change; Phase 3 must add a guard once dated records exist rather than retroactively changing Phase 2 semantics.
- **[Dirty worktree overlap]** -> Apply in scoped batches, inspect diffs before each verification gate, and preserve unrelated prototype/Phase 0/Phase 3 changes.

## Migration Plan

1. Require Phase 1 spec sync/archive and run the canonical baseline.
2. Rehearse a read-only role-assignment and owner-scope classification against disposable PostgreSQL; stop on invalid, orphaned, cross-scope, or ambiguous owner evidence.
3. Add one forward Prisma migration that creates catalogs/Property/address/amenity/scope/audit structures, adds composite parent keys, converts the Tenant role-assignment path, adds role-scope checks, backfills explicit membership access modes/versions, seeds stable catalogs, and then enforces constraints.
4. Generate/validate Prisma, apply every committed migration to a fresh disposable database, and run constraint/backfill/concurrency tests. Do not edit the Phase 1 migration.
5. Deploy application reads/writes and protected UI behind the existing authenticated Tenant host. No public route or legacy replacement is switched.
6. Record actual staging/production migration and live-provider checks separately; this implementation performs neither deployment nor production migration.

Rollback disables Phase 2 routes/actions and returns to the prior compatible application while retaining additive data. No down migration deletes Property, scope, or audit evidence. Schema/data defects are corrected with a reviewed forward migration after backup and reconciliation.

## Open Questions

- A recognizable staff directory (display name/email), general catalog administration, audit browsing/retention, public routing/custom domains, and timezone-change policy after Phase 3 dated records exist remain separately scoped decisions. None changes the Phase 2 contracts or implementation sequence above.
