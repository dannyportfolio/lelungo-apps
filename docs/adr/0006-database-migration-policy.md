# ADR 0006: Database migration policy

Status: Accepted

## Context
Tenant introduction and future PMS data carry high data-loss and downtime risk.

## Decision
Use immutable forward Prisma migrations and expand-contract releases with explicit backfill, verification, backup, and rollback planning.

## Consequences
Changes take more release steps but remain compatible and auditable.

## Rejected Alternatives
Editing deployed migrations, schema push in production, and destructive same-release replacement.
