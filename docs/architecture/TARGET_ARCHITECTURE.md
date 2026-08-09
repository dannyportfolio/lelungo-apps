# Lelungo Target Architecture

## Selected approach

Lelungo will be a Node.js LTS, Next.js App Router modular monolith. Next.js route handlers and server actions call domain services; services call tenant-safe repositories; repositories use Prisma against PostgreSQL. This retains the existing frontend foundation while establishing a testable backend boundary without premature microservices.

```text
Browser / tenant host
  -> Next.js middleware/proxy: normalize host, resolve tenant domain
  -> route layout: session + actor + tenant context + permission gate
  -> route handler / server action
  -> domain service: validation, pricing, state transitions, transaction
  -> tenant-safe repository: enforced TenantContext, explicit DTO select
  -> PostgreSQL / Prisma migrations

Post-commit events -> job/outbox -> notification / payment / smart-lock adapters
```

## Request and tenant scope

1. Normalize the request host and identify platform, tenant public, tenant PMS, or check-in surface.
2. Resolve the tenant domain server-side. Localhost uses an explicit development mapping only.
3. Resolve authenticated actor/session, then validate platform privilege or tenant membership and permission.
4. Construct immutable `TenantContext` with tenant ID, actor ID/type, membership, correlation ID, and request metadata.
5. Pass that context into all service/repository operations. Browser payloads never choose tenant ID.

Tenant-owned tables have `tenant_id NOT NULL` plus indexes appropriate to their access patterns. Repository APIs accept a `TenantContext`, use explicit selects/DTOs, and reject unscoped operations. RLS is defense in depth, not the only safeguard for service-role paths.

## Modules

```text
src/
  app/                       Route compositions only
  modules/
    identity/                Session, actor context, RBAC
    tenancy/                 Tenant domains, provisioning, isolation
    platform-billing/        Lelungo subscription invoices/payments
    property/                Property, building, rooms, amenities
    inventory/               Availability, rate plans, restrictions
    bookings/                Booking aggregate, assignment, lifecycle
    guest-finance/           Guest invoices, payments, refunds
    operations/              Front desk, housekeeping, maintenance
    public-booking/          Tenant public pages and checkout
    self-checkin/            Token-scoped guest flow and e-KYC policy
    integrations/            Notifications, smart locks, provider webhooks
    reporting/               Tenant and platform reports
    audit/                   Immutable redacted audit events
  shared/
    validation/              Zod schemas
    database/                Prisma client, transaction/repository helpers
    security/                Rate limits, redaction, signing, CSRF
    jobs/                    Outbox/job contracts
```

## Data model boundaries

Platform billing owns `SubscriptionPlan`, `Subscription`, `SubscriptionInvoice`, and `SubscriptionPayment`. Guest finance owns `Payment`, `GuestInvoice`, and `Refund`. Neither shares invoice numbering, settlement logic, ledgers, payment credentials, or revenue reporting.

The PMS booking aggregate owns availability decisions. Public booking uses its services, never a replica inventory store. Booking price snapshots are immutable. A booking service runs availability revalidation and protected inventory mutation in a transaction; UI checks are advisory only.

## Domain invariants

- A booking cannot cross tenant/property scope, overlap unavailable compatible inventory, or transition outside its state machine.
- `CHECKED_IN` requires a valid room assignment; checkout releases the room and creates the appropriate housekeeping state transition.
- Refund value cannot exceed refundable recorded guest payment.
- Guest self-check-in is bound to an expiring, opaque, reservation-scoped token; it cannot query PMS resources generally.
- Smart-lock credentials are encrypted/protected, time bounded, redacted from logs, and issued only after required verification.
- Sensitive identity files are private, validated, signed for short-lived access, subject to retention, and audited.

## Deployment topology

- Vercel hosts the Next.js app with wildcard `*.lelungo.com` and wildcard TLS, or an equivalent managed host with the same capability.
- Managed PostgreSQL/Supabase PostgreSQL provides the transactional store. Object storage is private for documents/assets.
- A managed queue/worker is added only for durable asynchronous adapter work; it is not a separate business microservice.
- Development, staging, and production use separate environment values and databases. CI runs migration safety checks but never automatically applies destructive production migrations.

## Observability and security

Every request/job has correlation ID and structured logs. Audit logging is immutable and redacts tokens, passwords, API keys, bank credentials, smart-lock PINs, identity values, and private URLs. Webhooks are signature-verified and idempotent. Sensitive DTOs are intentionally shaped rather than returning database records.
