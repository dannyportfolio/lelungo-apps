# Migration strategy

1. Stabilize the legacy prototype and preserve working flows.
2. Introduce tenant, domain, staff membership, and RBAC tables additively.
3. Validate migration in a disposable database and rehearse backup/restore.
4. Create one system tenant only if legacy data must be retained; map data explicitly.
5. Add PMS domains one vertical slice at a time with `tenant_id`, indexes, and isolation tests from creation.
6. Move legacy UI/routes behind new services before removing them.
7. Remove legacy tables or integrations only after usage evidence and an accepted change.

Never combine destructive schema removal with the first release of a replacement. Use expand, backfill, verify, switch reads/writes, then contract. Production migrations are immutable and rollback normally uses a new forward migration plus application rollback compatibility.
