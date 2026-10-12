# Refactor roadmap

## Foundation — current scope

- Repository discovery, architecture, guardrails, OpenSpec, ADRs, runbooks, CI.
- Tenant entity, wildcard-subdomain resolution, server Tenant context, staff membership, initial RBAC, provider-verified request identity, Proxy session refresh, and the protected staff shell. Phase 1 is synced and archived; its live-provider/deployment and formal-scanner caveats remain historical release gates.
- Tenant-only role assignments with explicit same-Tenant persistence, explicit Property access mode/scope version, and fail-closed Property authorization.
- Tenant-owned Property profile, structured address, canonical timezone, classification/amenities, lifecycle, optimistic concurrency, safe internal/public DTOs, and protected staff management/scope UI.
- Narrow atomic append-only audit evidence for accepted Property and Property-authority mutations.
- Unit coverage plus disposable-PostgreSQL and tenant-host E2E coverage. Five individually invoked integration files passed 29/29 tests on disposable PostgreSQL 16; focused real tenant-host authentication and missing-permission scenarios passed, while the complete seven-scenario Property E2E rerun remains incomplete.

## Next safe slices

1. Complete the Phase 2 verification record: finish the seven-scenario tenant-host Property E2E rerun, rerun and record final static/unit/build gates, reconcile security evidence, sync specs, and archive. Preserve the 29/29 local disposable-PostgreSQL result without treating it as staging or remote-CI evidence.
2. Restore the formal Codex Security launcher and validate any findings; obtain live-provider, staging migration, and Node 22/PostgreSQL CI evidence before release.
3. Reconcile and then apply the existing Phase 3 change only after it confirms the implemented Phase 2 public Property context, canonical timezone/classification, owner-defined lifecycle/serviceability predicates, Property-scope authorization, and narrow audit contract.
4. Implement RoomType/Unit, inventory, pricing, and entitlements in Phase 3. Reservation hold/commit/release and booking behavior remain Phase 4 obligations.

## Explicitly deferred

RoomType/Unit, inventory, availability, rates/pricing, entitlements, reservations/booking engine, guests/stays, subscription billing, smart locks, self check-in, payment processing, housekeeping, media/custom domains, public marketplace routing, audit browsing/export, and broad UI replacement are outside Phase 2. `publicWhatsAppE164` is only an optional allowlisted Property contact field; it is not a WhatsApp integration.
