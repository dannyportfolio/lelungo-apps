## Why

Phase 1 now provides the authenticated tenant-membership boundary, but Lelungo still has no tenant-owned Property or property-scoped staff authority. A narrow Phase 2 foundation is required before accommodation, inventory, pricing, or reservation work can safely attach operational data to a valid property and timezone.

## Context

- `Tenant.id` remains the persisted Organization and isolation root. A Property is always a resource below one Tenant and never a second tenant or an authority established by a browser-selected identifier.
- Phase 1 is implementation-complete but must be reviewed and archived before this change is applied. Planning this change does not claim that release-environment authentication or production migration evidence exists.
- The Phase 3 change is implementation-gated on a tenant-owned Property, valid IANA timezone, classification, safe public identity contract, property-scope grants, same-tenant database constraints, and protected staff routes.
- Current wildcard subdomains identify tenants. Property slugs, route parameters, custom domains, and UI selectors identify requested resources only and do not replace trusted tenant-host resolution.

## Goals

- Add the first complete Property vertical slice: tenant-owned identity, structured address, valid IANA timezone, expandable classification, baseline amenities, explicit lifecycle, and optimistic concurrency.
- Let authorized staff create, list, read, edit, publish, deactivate, and archive only Properties within their trusted Tenant and allowed property scope.
- Add fail-closed organization-wide or explicit-property access grants, including safe bootstrap authority for the tenant owner and auditable grant/revoke administration.
- Provide separate bounded internal and published-identity DTOs so Phase 3 can compose a public accommodation projection without exposing private Property fields or defining marketplace routing.
- Persist material Property and authority changes as minimal append-only audit evidence in the same PostgreSQL transaction.
- Deliver a minimal protected staff Property list/detail/create/edit and scope-administration experience with verified tenant/property isolation.

## Non-goals

- RoomType, Unit/room, inventory, availability, rates, pricing, entitlements, reservations, guests, stays, payments, housekeeping, channel integrations, or marketplace booking behavior.
- Staff invitations, identity-provider administration, arbitrary custom roles, platform impersonation, or a broad organization-settings surface.
- Property media uploads, object storage, geospatial search/PostGIS, custom domains, property-host routing, or a public marketplace route.
- Subscription or plan limits, property-count gating, a second database/service, cache, broker, microservice, or destructive legacy migration.
- Renaming the persisted `Tenant` model/table to Organization or repurposing `TenantDomain` for Properties.

## What Changes

- Add an additive tenant-owned Property aggregate with a normalized tenant-unique slug, display name, classification reference, IANA timezone, structured Indonesian-ready address, baseline amenity references, lifecycle state, publication metadata, version, timestamps, and retained archival identity.
- Add explicit Property application commands and queries with strict boundary schemas, stable errors, bounded deterministic cursor pagination, expected-version conflict detection, and purpose-specific internal/public DTOs.
- Add Identity-owned property access mode and same-tenant membership-property scope grants. `ALL_PROPERTIES` is explicit organization-wide authority; `SELECTED_PROPERTIES` grants only listed Properties and defaults fail closed.
- Add a property-aware authorization contract that composes verified identity, trusted tenant, active membership, explicit permission, access mode/grant, and same-tenant resource ownership before the protected repository operation.
- Correct the authorization persistence path so tenant role assignments and property grants cannot relate records from different tenants; bootstrap future tenant owners with explicit organization-wide Property scope without inferring authority from a role name at request time.
- Add minimal append-only audit records for Property lifecycle/profile changes and Property access-mode/grant changes, written transactionally and containing only safe actor, tenant/property, action, target, result, version, correlation, and changed-field metadata.
- Add protected staff Property and scope-administration routes/components using Server Components for reads and Server Actions for mutations; application/domain services own business rules and Prisma access remains in server-only repositories.
- Add unit, disposable-PostgreSQL integration, authorization/IDOR, migration, component/action, and tenant-host E2E coverage plus architecture, security, runbook, and Phase 3 handoff updates.

## Capabilities

### New Capabilities

- `properties`: Tenant-owned Property identity, profile, address, timezone, classification, amenities, lifecycle/publication, bounded queries, concurrency, and safe internal/public projections.
- `property-scope-administration`: Explicit organization-wide versus selected-Property membership scope, same-tenant grant/revoke administration, owner bootstrap, and archived-Property behavior.
- `audit-evidence`: Minimal append-only, transactionally recorded evidence for material Property and staff-authority changes without logging secrets or sensitive payloads.

### Modified Capabilities

- `staff-authorization`: Require matching tenant-owned Property scope in addition to verified identity, active membership, and explicit permission for Property-protected operations.

## Impact

- Add `src/modules/properties` domain/application/repository boundaries and extend the public Identity/Authorization contract without importing another module's repository internals.
- Extend Prisma with additive Property, catalog, address/amenity, membership-scope, same-tenant role-assignment integrity, and audit structures plus append-only forward migrations.
- Add minimal `/staff/properties` and scoped staff-administration transport/UI while retaining all existing prototype and Phase 1 routes.
- Reuse the existing Next.js application, PostgreSQL database, Prisma client, Zod validation, Supabase staff-session adapter, and npm toolchain; no new runtime dependency or infrastructure service is required by default.
- Phase 3 planning must treat the resulting Property and audit contracts as prerequisites it extends, not duplicate foundations.

## Risks

- A permissive migration or bootstrap rule could silently grant broad multi-Property access. Defaults therefore fail closed, organization-wide access is explicit, backfill is classified and reconciled, and cross-tenant/cross-property attacks are tested at service and database boundaries.
- Property publication could leak a full address or internal configuration. The published resolver returns an allowlisted identity DTO only and does not expose an unbounded public enumeration route.
- Timezone or lifecycle mistakes would corrupt later inventory dates. Timezones are validated and canonicalized as IANA identifiers, changes use expected versions, and archived Properties are terminal and unavailable to new operational configuration.
- Adding audit in the same mutation may increase transaction surface. The Phase 2 audit record is intentionally small, local to PostgreSQL, append-only, and tested atomically; it is not a generic event platform.
- Phase 1 release caveats could be mistaken for completion evidence. Applying Phase 2 is gated on Phase 1 archive and its recorded verification limitations remain explicit.

## Migration impact

- Use only new append-only Prisma migrations after rehearsing the Phase 1 baseline on disposable PostgreSQL. Do not edit the existing tenancy migration or use schema push in production.
- Add explicit `tenant_id NOT NULL`, tenant-leading indexes, and composite same-tenant foreign keys from the first Property/scope/audit tables.
- Existing tenant memberships receive no implicit broad access from a nullable value. A reviewed, idempotent classification/backfill step grants `ALL_PROPERTIES` only to verified tenant-owner memberships; ambiguous records stop for manual review. Future tenant provisioning writes the access mode explicitly.
- Before enforcing same-tenant role-assignment constraints, a dry run MUST classify and reconcile every existing assignment as valid same-tenant, cross-tenant, platform/tenant mixed, orphaned, or otherwise ambiguous. Any non-valid assignment stops rollout for reviewed manual remediation; the migration MUST NOT silently delete, reinterpret, or preserve its permissions as authority.
- New Property data is introduced alongside the affiliate prototype. No legacy deal, destination, or click record is automatically mapped to a Property.
- No production migration, deployment, storage provisioning, secret change, or external write is performed by this planning change.

## Rollback

- Disable the new staff routes/actions and deploy the prior compatible application while retaining additive Property, scope, and audit rows.
- Do not delete Property or authority evidence and do not edit an applied migration. Correct schema or data defects with a reviewed forward migration after backup, reconciliation, and impact analysis.
- If publication behavior is unsafe, disable the published resolver independently while preserving internal Property management and records.
