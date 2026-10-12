# Migration Plan

## Phase 1 tenancy foundation

Migration `20260808100000_saas_tenancy_foundation` is additive. It creates tenants, tenant domains, RBAC tables, staff memberships, constraints, and indexes. It does not alter the existing Supabase `clicks`, `user_preferences`, or analytics views.

Before applying: confirm `pgcrypto` is available (the existing Supabase schema enables it), back up the target database, validate against a staging clone, and check for collisions with the new table/type names.

Apply with Prisma only after `DATABASE_URL` points to the intended database. Verify the migration status and test a tenant, domain, membership, and role assignment transaction. Do not use automatic destructive migration deployment.

Rollback is forward-only after data exists: disable the feature and create a corrective additive migration. Dropping tenancy/RBAC tables is permitted only before they contain production data and only after a verified backup.

## Phase 2 Property and authority integrity

Migration `20260812090000_property_foundation` is a forward-only extension. It preflights existing role assignments and aborts before changing authority when rows are orphaned, cross-Tenant, platform/Tenant mixed, scope-incoherent, or have multiple active owner candidates. It then makes the Tenant role-assignment path explicit, backfills safe Property access modes/versions, seeds stable classification/amenity catalogs, and creates tenant-owned Property/address/amenity/scope/audit persistence with checks, indexes, delete restrictions, and composite same-Tenant foreign keys.

Before applying, back up and reconcile the preflight classifications, verify the deployed application writes explicit assignment `tenant_id`, and review which unambiguous active owner receives `ALL_PROPERTIES`; every other Tenant membership defaults to empty `SELECTED_PROPERTIES`, while platform membership remains fail closed. Apply first to a fresh disposable PostgreSQL database, run the canonical integration suite, record constraints/backfill/catalog/audit evidence, and execute a second `migrate deploy` showing no pending migration. Then rehearse on staging-sized data with lock and rollback observation.

On 2026-08-12, five individually invoked integration files passed 29/29 tests (`9 + 8 + 2 + 8 + 2`) against disposable PostgreSQL 16, including migration/upgrade and schema-boundary evidence. This is local disposable-database rehearsal only; no production or staging migration has been performed, and staging-sized lock/rollback observation remains outstanding. Rollback disables Phase 2 surfaces with a schema-compatible application and retains Property, scope, and audit data; schema/data defects use a reviewed forward fix, never an edited or blindly reversed applied migration.
