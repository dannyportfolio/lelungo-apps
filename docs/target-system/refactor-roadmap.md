# Refactor roadmap

## Foundation — current scope

- Repository discovery, architecture, guardrails, OpenSpec, ADRs, runbooks, CI.
- Tenant entity, wildcard-subdomain resolution, server tenant context, staff membership, initial RBAC.
- Security corrections and validation around existing routes.

## Next safe slices

1. Add an authentication adapter and map authenticated subjects to active memberships.
2. Add integration tests against disposable PostgreSQL for tenant/RBAC boundaries.
3. Provision initial roles/permissions idempotently and audit authorization failures.
4. Specify and implement the Property vertical slice.
5. Specify Room Type/Room, then inventory and reservations only after invariants are designed.

## Explicitly deferred

Subscription billing, reservations/booking engine, smart locks, WhatsApp, self check-in, payment processing, housekeeping, and broad UI replacement are outside this foundation.
