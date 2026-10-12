## 1. Prerequisite and baseline gates

- [x] 1.1 Sync the completed Phase 1 authentication/authorization delta specs into main specs, verify the merge, and archive `add-authenticated-membership-foundation` while preserving its recorded release caveats.
- [x] 1.2 Run and record the pre-Phase-2 format, Prisma, OpenSpec, lint, typecheck, unit-test, integration-test, and build baseline; distinguish repository failures from environment blockers.
- [x] 1.3 Reconcile the Phase 2 proposal, specs, design, and tasks after implementation discoveries and keep `openspec validate add-property-foundation --strict` passing.

## 2. Authorization-integrity migration

- [x] 2.1 Add the Prisma schema changes for Tenant-only role assignments with explicit `tenant_id`, Role scope/tenant coherence, and composite parent keys without editing the Phase 1 migration; run `npm run prisma:validate`.
- [x] 2.2 Add a forward migration preflight that classifies existing role assignments and aborts on cross-Tenant, platform/tenant-mixed, orphaned, or ambiguous rows before backfill or constraint enforcement.
- [x] 2.3 Update tenant provisioning and membership permission reads for the explicit same-Tenant assignment path, preserving minimum selects and idempotent role provisioning; verify focused unit tests.
- [x] 2.4 Add disposable-PostgreSQL tests proving valid same-Tenant assignments succeed and cross-Tenant/cross-scope assignments fail at the database boundary.

## 3. Property and scope persistence

- [x] 3.1 Add Prisma models for system-managed classifications/amenities, tenant-owned Properties, structured addresses, Property amenities, membership Property scopes, and append-only audit events with explicit ownership relations and indexes.
- [x] 3.2 Extend Tenant and tenant membership persistence with Property relations, explicit `ALL_PROPERTIES`/`SELECTED_PROPERTIES` access mode, and positive scope version while keeping platform memberships fail closed.
- [x] 3.3 Extend the forward migration with idempotent baseline catalog seeds, safe owner/non-owner scope classification and backfill, same-Tenant composite foreign keys, lifecycle/version checks, and delete restrictions.
- [x] 3.4 Generate the Prisma client and verify the complete migration against a fresh disposable PostgreSQL database, including table/index/check/FK evidence and a second idempotent deploy.

## 4. Property domain and contracts

- [x] 4.1 Implement strict bounded Property command/list/cursor schemas, slug normalization, canonical IANA timezone validation, catalog constants, lifecycle transitions, and stable validation/not-found/conflict errors; verify focused unit tests.
- [x] 4.2 Implement explicit internal summary/detail, trusted downstream Property context, and allowlisted published identity DTO projections with no Prisma-record or later-domain leakage; verify projection tests.
- [x] 4.3 Define the Property repository port and server-only Prisma adapter with tenant-leading predicates, explicit selects, set-based authorized pagination, public resolution, and expected-version mutation support.
- [x] 4.4 Implement idempotent system catalog provisioning and catalog-retirement validation that prevents invalidating a published Property; verify unit and PostgreSQL tests.

## 5. Audit and Property application services

- [x] 5.1 Implement the narrow audit write contract and server-only Prisma adapter for `STAFF`/`SYSTEM` actors, safe changed-field metadata, same-Tenant ownership, and no application update/delete path.
- [x] 5.2 Implement atomic Property create and profile/address/amenity update services with trusted Tenant ownership, strict catalogs, expected version, exactly one version advance, and exactly one audit event.
- [x] 5.3 Implement atomic publish, deactivate, republish, and terminal archive services with active-Tenant/catalog revalidation, database lifecycle timestamps, stable conflicts, and audit evidence.
- [x] 5.4 Implement bounded protected Property list/detail queries and the transport-neutral single published-identity resolver with owner-defined configurability/serviceability predicates.
- [x] 5.5 Verify Property services with unit and disposable-PostgreSQL tests for duplicate slug, cross-Tenant identifiers, concurrent writers, rollback on audit failure, lifecycle, timezone, catalogs, pagination, and DTO minimization.

## 6. Property-scope authorization and administration

- [x] 6.1 Extend the active request membership projection with membership ID, explicit Property access mode, and scope version while retaining verified-subject and same-Tenant filters; verify focused context tests.
- [x] 6.2 Implement `requirePropertyPermission`/`withPropertyPermission` and set-based authorized-list scope contracts so permission, access mode, grant, and ownership checks complete before protected callbacks.
- [x] 6.3 Implement the Identity-owned Property-scope repository and atomic mode replacement, grant, and revoke services with `staff.manage`, `ALL_PROPERTIES`, no self-escalation, target activity, expected version, exact selected set, and audit evidence.
- [x] 6.4 Implement the bounded minimum-field active-membership and grant/list queries without provider subject, email, token, or role-internal exposure.
- [x] 6.5 Verify authorization/scope behavior with unit and PostgreSQL tests for missing permission, absent grant, same-Tenant cross-Property IDOR, cross-Tenant grants, stale version, mode round trips, archived Properties, non-active memberships, and callback-not-called denial.

## 7. Protected Next.js staff experience

- [x] 7.1 Add a protected `/staff/properties` Server Component list with bounded navigation, accessible empty/denied/error states, and controls conditioned for usability only; verify component/query tests.
- [x] 7.2 Add `/staff/properties/new` and strict create Server Action/form with accessible labels, validation feedback, pending state, repeated backend authorization, safe redirect, and no ownership/status mass assignment.
- [x] 7.3 Add `/staff/properties/[propertyId]` protected detail/edit/lifecycle Server Components and Actions using async Next.js 16 params, expected versions, generic denial/not-found/conflict feedback, and cache revalidation.
- [x] 7.4 Add the minimal `/staff/property-access` membership-scope list and administration forms, displaying only opaque membership scope summaries and repeating `staff.manage` plus `ALL_PROPERTIES` authorization in every Action.
- [x] 7.5 Update the staff landing navigation and copy to reflect the implemented Property foundation without displaying fabricated rooms, inventory, prices, bookings, guests, or revenue.
- [x] 7.6 Run the Vercel React/Next.js review over all new TSX/Server Actions and correct accessibility, serializability, async API, error-boundary, redirect, and waterfall findings.

## 8. Verification and security coverage

- [x] 8.1 Add focused unit tests for every external schema bound, mass-assignment rejection, cursor binding, lifecycle transition, timezone alias, public/private DTO, authorization order, audit redaction, and stable error category.
- [x] 8.2 Extend the integration registry/fixtures and canonical `test:integration` suite for fresh migration, scope backfill, same-Tenant constraints, isolation, OCC, atomic audit, catalogs, and exact-record cleanup.
- [x] 8.3 Add tenant-host browser coverage for unauthenticated redirect, missing permission, selected-scope Property A versus B, authorized create/edit/lifecycle, invalid timezone, stale conflict, and minimum-field scope administration; configure CI PostgreSQL/test environment without secrets.
- [x] 8.4 Perform the required manual security review for authentication/session reuse, CSRF-relevant Actions, tenant-header trust, permission/scope placement, IDOR/enumeration, mass assignment, DTO/audit/log redaction, cursor abuse, and database ownership; add regressions for every correction.
- [x] 8.5 Run the formal security diff scan if its supported runtime is available; otherwise record the exact preflight/launcher blocker without claiming a clean scan.

## 9. Documentation, final gates, and handoff

- [x] 9.1 Update current/target architecture, data model, security/tenant-isolation, environment/testing/migration/rollback runbooks, risk register, and repository map to distinguish implemented Phase 2 behavior from deferred domains.
- [x] 9.2 Update the Phase 3 change prerequisite language and engineering handoff to reference the implemented Property public context, timezone/classification/lifecycle, scope authorization, audit contract, and remaining RoomType/Unit/inventory/pricing obligations.
- [x] 9.3 Create `verification.md` with exact commands, exit codes/counts, migration and rollback evidence, limitations, and a Phase 3 readiness decision; update `docs/runbooks/session-handoff.md` with the same truthful state.
- [x] 9.4 Run final `format:check`, `prisma:validate`, strict OpenSpec validation, `lint`, `typecheck`, unit tests, disposable-PostgreSQL integration tests, relevant E2E, and `build`; fix in-scope regressions without weakening gates.
- [x] 9.5 Re-review the final diff for unrelated edits, secrets, direct Prisma use from `src/app`, missing `server-only`, unbounded queries, Phase 3+ placeholders, and migration destructiveness; mark tasks complete only from actual evidence.
- [x] 9.6 Sync the verified Phase 2 delta specs into main specs, verify every merged requirement, and archive `add-property-foundation` only after all artifacts and tasks are complete.
