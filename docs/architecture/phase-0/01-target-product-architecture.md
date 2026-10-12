# 01 — Target product architecture

- **Current implementation:** Next.js affiliate-deal prototype plus tenant resolution, tenant-scoped server context, staff membership, and an initial RBAC catalog. Guest booking, protected PMS, Property, Inventory, Pricing, Reservation, Payment, and the containers described below are not implemented.
- **Target state:** One hospitality platform with a guest booking surface and a first-class PMS surface, initially deployed as a tenant-scoped modular monolith.
- **Decision status:** The modular-monolith, PostgreSQL, and server-resolved tenant directions are accepted. Product-surface composition and the central PMS hostname are target proposals and require later implementation changes.
- **Last verified:** 2026-08-09

> **Target-only artifact.** Detail in this document defines boundaries for later OpenSpec changes; it does not assert that the PMS, marketplace, workers, broker, storage, or provider integrations exist.

Implementation timing follows [12-phase-roadmap.md](12-phase-roadmap.md): authentication/tenant proof is Phase 1, Property begins in Phase 2, Inventory/Pricing in Phase 3, Reservation in Phase 4, the guest marketplace in Phase 7, and later contexts only after their gates. The two complete product surfaces are therefore an incremental target, not a Phase 1 deliverable.

Current-state evidence is maintained in [current-architecture.md](../../current-system/current-architecture.md), [current-user-flows.md](../../current-system/current-user-flows.md), and the accepted [modular-monolith ADR](../../adr/0001-use-modular-monolith.md).

## Product definition

Lelungo's target product is a hospitality operating system for villas and homestays plus a direct-booking marketplace. It has two independently secured presentation surfaces over the same intentional application contracts. Neither surface owns domain rules.

| Surface                    | Intended audience                                                                                              | Target capabilities                                                                                                                                                               | Boundary rule                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest booking platform     | Anonymous visitors and authenticated guests                                                                    | Destination/property discovery, map search, property detail, availability, deterministic quotes, booking, payment, booking history, wishlist, reviews, and property communication | Public DTOs expose only published/minimum fields. Availability and prices are advisory until revalidated by authoritative services in a transaction.             |
| Property Management System | Organization owners, managers, front office, finance, housekeeping, maintenance, and authorized platform staff | Multi-property configuration, physical units, inventory, pricing, reservations, stays, guest profiles, operations, finance, distribution, and reporting                           | Every protected request authenticates, resolves trusted tenant context, authorizes a permission plus property scope, and only then calls an application service. |

The product intent is a guest entry point at `lelungo.com` and a PMS entry point at `app.lelungo.com`. That hostname map is **not implemented or finally authorized**. The accepted tenancy ADR and current proxy use a normalized tenant subdomain as the tenant-resolution input, while `app` is currently reserved. A future routing/authentication change must choose one of these server-authoritative approaches before a central PMS host ships:

1. retain tenant-specific hosts for tenant authority; or
2. use the central PMS host and resolve an organization selection only from a verified session and an active membership, never directly from a browser-supplied organization ID.

Until that later decision, [ADR-001](../ADR-001-SAAS-MULTI-TENANCY.md) remains authoritative and Phase 0 makes no routing change.

## Actors and external systems

| Actor/system                   | Target relationship with Lelungo                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Prospective guest              | Searches published inventory and requests quotes without receiving tenant-private data.                                                     |
| Booking guest                  | Creates a reservation, completes payment actions, and sees only reservations linked through verified guest authority.                       |
| Organization owner/host        | Administers all authorized properties in one organization and delegates scoped permissions.                                                 |
| Property manager               | Manages explicitly scoped properties, rates, inventory, reservations, and operations.                                                       |
| Front office                   | Manages arrivals, departures, assignments, and permitted payment recording for scoped properties.                                           |
| Finance staff                  | Reads financial reports and records/refunds payments within granted scope; cannot infer guest identity fields beyond explicit permission.   |
| Housekeeping/maintenance staff | Works operational tasks and minimum property/unit data, not broad reservation, guest, or finance objects.                                   |
| Platform administrator/support | Uses separate platform permissions; any tenant support/impersonation context is explicit, visible, time-bounded, and audited.               |
| External identity provider     | Proves an external subject. It does not create tenant membership or grant a Lelungo permission.                                             |
| Payment provider               | Executes provider-specific payment operations through an adapter and sends verified, idempotent callbacks. It never owns reservation truth. |
| OTA/channel/iCal source        | Exchanges availability/reservation calendar information through Distribution adapters with conflict tracking.                               |
| Notification provider          | Delivers messages asynchronously from approved templates/events; it does not participate in reservation transactions.                       |
| Object-storage provider        | Holds private or public assets according to classification; database records retain ownership and access policy.                            |

## Target system context

```text
Guest browser/mobile ---- HTTP ----> Guest web/BFF -----+
                                                      |
Staff browser ---------- HTTP ----> PMS web/BFF -------+--> application modules
                                                      |       |
Provider callbacks ----- HTTP ----> verified adapters -+       +--> PostgreSQL
                                                              +--> outbox/jobs (later)
                                                              +--> external adapters (later)
```

Browsers use REST/HTTP or a purpose-built BFF. They never receive gRPC endpoints or ORM records. In-process application contracts are the initial internal boundary. gRPC/protobuf becomes an option only after a module is extracted for measured operational reasons.

## Target container model

| Container                       | Current evidence                                                                      | Target responsibility                                                                                              | Deployment timing                                          |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| CDN/edge and Next.js Proxy      | A single `proxy.ts` normalizes eligible hosts and overwrites trusted routing metadata | TLS/routing, request IDs, safe session refresh, and optimistic redirects; never authoritative domain authorization | Existing shell, extended only by separate approved changes |
| Guest web/BFF                   | Legacy deal-discovery App Router pages and route handlers                             | Compose public marketplace pages and minimum-field guest APIs                                                      | Later vertical slices                                      |
| PMS web/BFF                     | Not implemented                                                                       | Compose protected staff pages and call application services after boundary validation/authentication               | Later, after authentication foundation                     |
| Modular application             | Only `tenancy` and `identity` foundations exist                                       | Explicit bounded contexts with dependency direction `app -> module application/domain -> shared/infrastructure`    | Add one approved vertical slice at a time                  |
| PostgreSQL through Prisma       | Tenancy/RBAC schema and additive migration exist; deployment is not verified          | Transactional authority for tenant-owned PMS data, inventory, reservations, and finance                            | Validate foundation before adding domains                  |
| Legacy Supabase click analytics | Optional click insert path exists                                                     | Remain isolated while useful; it is not PMS transactional authority or proof of authentication                     | Migrate/deprecate only with usage evidence                 |
| Worker/outbox processor         | Not implemented                                                                       | Expiration, provider reconciliation, distribution sync, notifications, and durable asynchronous work               | Add when the first durable job exists                      |
| Object storage                  | Not implemented                                                                       | Private identity/documents and controlled property media via signed/public access policy                           | Add with first approved media/document use case            |
| Cache                           | Not implemented                                                                       | Derived, reconstructable public reads only; never inventory, reservation, payment, or authorization authority      | Add only after measured read pressure                      |
| Event broker                    | Not implemented                                                                       | Durable cross-service delivery after extraction or workload evidence                                               | Deferred; in-process events plus an outbox seam first      |

The initial target remains one Next.js deployable and one PostgreSQL transactional database. Physical co-location does not permit one module to import another module's repository or mutate its tables.

## Request and mutation sequence

Every target protected operation follows this order:

```text
validate external input
  -> authenticate external subject
  -> resolve trusted tenant/organization context
  -> authorize permission and property scope
  -> call application/domain service
  -> execute owner-module transaction
  -> append audit/outbox evidence
  -> shape an explicit response DTO
```

Public requests replace staff membership checks with resource-specific public/guest authority, but still resolve ownership on the server. A property ID, organization ID, price, availability result, role, or payment status from a client is never authority.

## Canonical terminology

| Term                    | Meaning in the target model                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization            | Accommodation operator/business that owns properties and staff access. Initially one-to-one with the implemented `Tenant` record.                     |
| Tenant                  | Technical isolation and authorization root. `tenant_id` is the current persistence key for an Organization; the terms are not two independent scopes. |
| Property                | A managed hospitality location/business unit under one Organization, with address, timezone, policies, media, and sellable accommodation.             |
| Property classification | Business classification such as villa, homestay, or guesthouse; it does not itself define sellable inventory.                                         |
| Room type               | A commercial/operational grouping of compatible physical units, such as Deluxe or Family. It is not a specific room.                                  |
| Physical unit           | A uniquely assignable accommodation space, such as an entire villa or Room 101.                                                                       |
| Inventory pool          | The authoritative capacity resource sold for dates. It may represent one specific unit or a pool of compatible units.                                 |
| Sellable accommodation  | A guest-facing offer backed by an inventory pool and rate plan; it is not another copy of availability.                                               |
| Availability            | Capacity after confirmed sales, active holds, closures, and operational blocks for an occupancy date.                                                 |
| Reservation             | Commercial promise/order with immutable pricing evidence and one or more reserved items. It is separate from physical occupancy.                      |
| Stay                    | Actual operational visit, assignment, check-in, and check-out lifecycle created from a confirmed reservation.                                         |
| Inventory hold          | Expiring allocation that protects capacity during checkout/payment; cleanup improves availability but is not the correctness mechanism.               |
| Booking source          | Attribution for how a reservation entered Lelungo, such as direct guest, PMS staff, iCal, or native channel adapter.                                  |
| Channel                 | External distribution system and its mappings/synchronization state.                                                                                  |

## Tenant and property authority

`Tenant` is the implemented Organization/isolation root and is retained during incremental migration. Every future tenant-owned row carries `tenant_id NOT NULL`; property-owned rows also carry or can prove a same-tenant `property_id`. Staff access combines stable permissions with a scope grant (`organization-wide` or an explicit set of properties). Selecting a property narrows authority; it never changes or establishes tenant authority.

The current `StaffMembershipRole` relation can link any membership ID to any role ID without a database-enforced same-tenant invariant, and the current membership query does not filter joined roles by tenant/scope. This is a **known cross-tenant RBAC risk**, not an implemented guarantee. It must be corrected by a forward migration and integration tests before role assignment becomes a production authorization source.

## Consistency posture

- Strong consistency: reservation-to-inventory allocation, active price snapshot at confirmation, monetary ledger balancing, permission/tenant checks before sensitive access.
- Eventual consistency: notifications, search projections, analytics, review aggregates, and channel propagation after the authoritative local transaction.
- Explicit workflow boundary: payment is asynchronous, but a callback may confirm a reservation only through an idempotent transaction that still proves valid inventory.
- Cache posture: cached availability and quotes are hints; confirmation always revalidates authoritative PostgreSQL state.

## Decisions

### Decision: two surfaces, one bounded application initially

- **Rationale:** Guest conversion and staff operations need different security and DTO boundaries, while a single deployment keeps early transactions and operations understandable.
- **Alternatives considered:** One mixed UI; immediately separate guest/PMS services; a full repository restructure.
- **Why alternatives were not selected:** A mixed UI blurs public/private exposure, while separate services and a broad restructure add coordination cost before working PMS domains or measured scaling pressure exist.
- **Use now or later:** Use the logical separation now in planning and route composition; add actual surface routes only in approved vertical slices. Independent deployments are later options.
- **Migration path:** Preserve legacy public flows, introduce protected PMS composition after authentication, move each route behind application services, and split deployables only when ownership or scaling evidence justifies it.

### Decision: preserve server-authoritative tenant resolution

- **Rationale:** Tenant isolation cannot depend on frontend filtering or caller-selected IDs.
- **Alternatives considered:** Trust an organization ID in request payload; authorize by selected property alone; rely only on PostgreSQL RLS.
- **Why alternatives were not selected:** All can be bypassed by privileged server paths or direct-object requests and do not prove membership in the requested tenant.
- **Use now or later:** The current server-resolved tenant context remains mandatory now. Central PMS-host selection is a later design requiring verified membership and a superseding/clarifying ADR.
- **Migration path:** Keep `Tenant` and trusted host resolution, implement authoritative authentication, enforce same-tenant membership/role constraints, then add any central-host selection as an auditable server-side context.

## Explicit non-goals for this artifact

- No routes, modules, database tables, workers, provider adapters, or host configuration are created.
- No microservice, broker, cache, gRPC contract, or monorepo restructure is approved.
- No destination or city is hard-coded into architecture; Indonesian expansion is data-driven through the future location model.
