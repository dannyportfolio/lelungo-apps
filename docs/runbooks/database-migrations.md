# Database migrations

1. Create an OpenSpec change with data/backfill/rollback analysis.
2. Modify `prisma/schema.prisma` and generate a new migration against a disposable database.
3. Run `npm run prisma:validate`, `npm run prisma:generate`, and integration tests.
4. Review SQL for locks, destructive changes, tenant indexes, and constraint timing.
5. Rehearse backup/restore and migration on staging-sized data.
6. Apply during a controlled release, monitor, and record the migration ID.

Never edit a production-used migration or run `db push` in production. Prefer expand-contract. Roll back application code only when schema compatibility permits; repair schema/data through a reviewed forward migration.
