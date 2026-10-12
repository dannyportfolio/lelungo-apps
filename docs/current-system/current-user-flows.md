# Current user flows

## Implemented legacy flow: deal discovery

```text
Visitor -> home UI -> local filtering/search -> optional /api/deals -> mock-data enrichment -> cards
```

## Implemented legacy flow: affiliate click

```text
Visitor -> DealCard -> validated POST /api/track-click -> optional Supabase insert -> affiliate navigation
```

Tracking failure does not block navigation. The endpoint validates field types, enum values, string lengths, unexpected fields, and price bounds.

## Implemented foundation flow: tenant resolution

```text
Host -> proxy normalizes subdomain -> trusted request header -> server tenant service -> TenantDomain lookup -> active tenant context
```

## Implemented foundation flow: staff authentication

```text
Tenant-host /staff
-> unauthenticated redirect to /staff/sign-in
-> validated sign-in Server Action
-> Supabase session
-> allowlisted local /staff redirect
```

```text
/auth/callback
-> validated code
-> provider code exchange
-> allowlisted local staff redirect
```

```text
Protected /staff
-> authoritative subject verification
-> trusted tenant lookup
-> ACTIVE same-tenant membership
-> minimal landing or generic denial
```

Sign-out is a CSRF-protected Server Action that asks the provider to revoke the session and always attempts local session cleanup when provider revocation fails. It redirects to `/staff/sign-in` after local cookie state is cleared and returns a generic error only when local cleanup cannot be established.

## Implemented Phase 2 flow: Property management

```text
Tenant-host /staff/properties
-> verified subject and trusted Tenant
-> ACTIVE membership, explicit permission, and Property access mode/grant
-> bounded tenant-leading Property query
-> minimum staff summary/detail DTO
```

Create, profile, address, amenity, and lifecycle Server Actions repeat validation, authentication, Tenant resolution, permission, and scope checks before calling the transactional Property service. Successful material mutations advance the expected version and append one redacted audit event atomically.

`/staff/property-access` provides bounded minimum-field membership summaries and access-mode/grant administration. Every mutation requires `staff.manage`, explicit `ALL_PROPERTIES`, a different active same-Tenant target membership, and the current scope version.

## Not implemented

Public registration, staff invitation, MFA, password recovery, cross-subdomain tenant selection, RoomType/Unit management, inventory, pricing, reservations, check-in/out, payments, housekeeping, guest management, reporting, public Property enumeration, and public booking are target flows. They must not be inferred from the protected Property foundation or prototype screens.
