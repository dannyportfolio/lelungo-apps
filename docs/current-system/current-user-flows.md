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

## Not implemented

Login, protected staff UI, property management, rooms, reservations, check-in/out, payments, housekeeping, guest management, and reporting are target flows. They must not be inferred from prototype screens.
