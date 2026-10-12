# ADR 0014: PostgreSQL as the primary transactional database

Status: Accepted

## Context

PMS inventory, reservation, finance, tenant isolation, and audit records need relational constraints, transactions, concurrency controls, and recoverable migrations. The prototype also has legacy Supabase click analytics that must not become PMS authority.

## Decision

Use PostgreSQL as the single authoritative transactional database for PMS and marketplace business records, accessed through reviewed Prisma repositories and migrations. All tenant-owned tables carry an explicit tenant key and tenant-scoped access path. Use native PostgreSQL constraints or reviewed SQL migrations where Prisma cannot express a critical invariant.

Keep legacy click analytics isolated until retired. Add PostGIS only when geographic search is implemented; use object storage for media and private documents rather than database blobs.

## Alternatives

- Supabase Data API as the domain persistence abstraction: rejected because privileged server paths, transactions, and ownership still require an explicit application repository boundary.
- Multiple databases per module now: rejected because it weakens transaction simplicity and adds deployment overhead.
- Document/JSON-first modeling: rejected because unclear relational invariants would become application-only checks.

## Consequences

PostgreSQL migration, backup, indexing, connection, and query discipline become critical. Prisma improves type safety but cannot replace SQL review or concurrency tests.

## Migration Impact

Continue append-only Prisma migrations and expand-contract releases. Rehearse against disposable and staging databases, back up before controlled production migration, and use forward fixes rather than editing applied migration history. Migrate legacy data only when its value and tenant ownership are proven.
