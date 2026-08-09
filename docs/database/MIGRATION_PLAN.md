# Migration Plan

## Phase 1 tenancy foundation

Migration `20260808100000_saas_tenancy_foundation` is additive. It creates tenants, tenant domains, RBAC tables, staff memberships, constraints, and indexes. It does not alter the existing Supabase `clicks`, `user_preferences`, or analytics views.

Before applying: confirm `pgcrypto` is available (the existing Supabase schema enables it), back up the target database, validate against a staging clone, and check for collisions with the new table/type names.

Apply with Prisma only after `DATABASE_URL` points to the intended database. Verify the migration status and test a tenant, domain, membership, and role assignment transaction. Do not use automatic destructive migration deployment.

Rollback is forward-only after data exists: disable the feature and create a corrective additive migration. Dropping tenancy/RBAC tables is permitted only before they contain production data and only after a verified backup.
