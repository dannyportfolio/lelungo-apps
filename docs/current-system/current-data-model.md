# Current data model

## Legacy analytics

`supabase/schema.sql` defines click tracking. It is not the PMS transactional model and is not tenant-scoped.

## Prisma tenancy foundation

- `Tenant`: organization boundary with unique slug and lifecycle status.
- `TenantDomain`: unique wildcard subdomain mapped to one tenant.
- `StaffMembership`: external user UUID associated with a tenant or platform scope and lifecycle status.
- `Role` and `Permission`: named RBAC records, joined by `RolePermission`.
- `StaffMembershipRole`: Tenant-only role assignment with explicit `tenant_id` and composite same-Tenant membership/role references.
- `PropertyClassification` and `Amenity`: system-managed catalogs with stable seeded keys and active-state metadata.
- `Property`: tenant-owned identity, tenant-unique normalized slug, classification, canonical timezone, optional public presentation fields, lifecycle timestamps, and positive optimistic-concurrency version.
- `PropertyAddress` and `PropertyAmenity`: structured Indonesian address and tenant-owned catalog relationships.
- `MembershipPropertyScope`: explicit current selected-Property grant with same-Tenant membership, Property, and granting-membership relationships.
- `AuditEvent`: narrow tenant-owned append-only evidence for successful Phase 2 Property and Property-authority mutations.

Tenant memberships persist one explicit `ALL_PROPERTIES` or `SELECTED_PROPERTIES` access mode and a positive scope version; platform memberships keep both fields null and fail closed for Property operations. Properties use `DRAFT`, `PUBLISHED`, `INACTIVE`, and terminal `ARCHIVED` lifecycle values. The Phase 2 public resolver exposes one allowlisted published identity under trusted Tenant context; it is not a public table/list contract.

The initial tenancy migration was applied and verified on a disposable PostgreSQL 16 database during Phase 1. The additive `20260812090000_property_foundation` migration now provides authority preflight, explicit role-assignment tenancy, conservative owner-scope backfill, catalogs, Property/scope/audit tables, checks, indexes, and composite foreign keys. On 2026-08-12, five individually invoked integration files passed 29/29 tests (`9 + 8 + 2 + 8 + 2`) against disposable PostgreSQL 16, including catalog/backfill results, invalid role assignments, duplicate slugs, cross-Tenant grants, optimistic concurrency, atomic audit rollback, and schema evidence. This is local disposable-database evidence only; no staging or production migration has been performed.

No RoomType, Unit/room, inventory, availability, rate, pricing, entitlement, reservation, guest, stay, payment, housekeeping, maintenance, media, notification, or general audit-browser model exists. Legacy affiliate/mock data is not mapped to Property data.
