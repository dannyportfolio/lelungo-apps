# Current data model

## Legacy analytics

`supabase/schema.sql` defines click tracking. It is not the PMS transactional model and is not tenant-scoped.

## Prisma tenancy foundation

- `Tenant`: organization boundary with unique slug and lifecycle status.
- `TenantDomain`: unique wildcard subdomain mapped to one tenant.
- `StaffMembership`: external user UUID associated with a tenant or platform scope and lifecycle status.
- `Role` and `Permission`: named RBAC records, joined by `RolePermission`.
- `StaffMembershipRole`: assigns roles to memberships.

The first migration is additive. No property, room, inventory, reservation, guest, stay, payment, housekeeping, maintenance, audit-log, or notification table exists yet.

Known constraints: platform membership uniqueness with nullable `tenant_id` must be enforced explicitly in a later migration if platform memberships are used; PostgreSQL unique constraints treat nulls as distinct. Tenant roles also need provisioning/seed orchestration before runtime use.
