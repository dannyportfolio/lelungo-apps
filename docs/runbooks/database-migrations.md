# Database migrations

1. Create an OpenSpec change with data/backfill/rollback analysis.
2. Modify `prisma/schema.prisma` and generate a new migration against a disposable database.
3. Run `npm run prisma:validate`, `npm run prisma:generate`, and integration tests.
4. Review SQL for locks, destructive changes, tenant indexes, and constraint timing.
5. Rehearse backup/restore and migration on staging-sized data.
6. Apply during a controlled release, monitor, and record the migration ID.

Never edit a production-used migration or run `db push` in production. Prefer expand-contract. Roll back application code only when schema compatibility permits; repair schema/data through a reviewed forward migration.

## Phase 2 Property migration

The committed forward migration is `20260812090000_property_foundation`. Before applying it outside a disposable database:

1. Back up and run the same read-only classification represented by the migration preflight. Reconcile orphaned, cross-Tenant, platform/Tenant-mixed, incoherent-role, or multiple-active-owner evidence; do not delete or reinterpret authority silently.
2. Confirm the application artifact supplies `tenant_id` on every Tenant role assignment. The migration converts `staff_membership_roles` to a required Tenant-only composite assignment path; an older artifact that writes the prior shape is not rollback-compatible.
3. Confirm every Tenant membership will receive an explicit scope: one unambiguous active `TENANT_OWNER` membership may receive `ALL_PROPERTIES`; all other Tenant memberships receive empty `SELECTED_PROPERTIES`; platform memberships retain null Property scope.
4. Apply all migrations to a fresh disposable PostgreSQL database, run `npm run test:integration`, inspect catalog seeds, backfill totals, checks, indexes, and composite foreign keys, then run `migrate deploy` a second time and record that no migration remains pending.
5. Rehearse on staging-sized data with backup/restore and lock-duration observation before any production approval.

The migration seeds only stable Phase 2 classification and amenity catalogs and creates Property/address/amenity/scope/audit persistence. It does not map legacy deal/mock data or create RoomType, Unit, inventory, pricing, entitlement, reservation, guest, payment, or media records. On 2026-08-12, five individually invoked integration files passed 29/29 tests (`9 + 8 + 2 + 8 + 2`) against disposable PostgreSQL 16. This satisfies local disposable-database rehearsal evidence only; staging-sized rehearsal, backup/restore, lock-duration observation, and any production application remain outstanding release steps.
