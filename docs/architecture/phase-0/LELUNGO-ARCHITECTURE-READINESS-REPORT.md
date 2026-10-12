# Lelungo Architecture Readiness Report

> **Current implementation:** A working Next.js affiliate-deal prototype plus repository-backed Prisma tenancy/domain/membership/RBAC artifacts, host-derived tenant resolution, server tenant-context composition, and pure permission checks. Authoritative staff authentication, protected PMS routes, real-PostgreSQL migration/isolation evidence, and every PMS business domain remain absent or unverified.
>
> **Target state:** A tenant-safe hospitality modular monolith delivered through ordered vertical slices, with PostgreSQL-authoritative business invariants, explicit bounded-context ownership, two independently secured product surfaces, and evidence-gated infrastructure evolution.
>
> **Decision status:** Phase 0 architecture package accepted for the narrow Phase 1 entry scope defined below. This verdict is not production, security, database, deployment, or PMS-feature readiness.
>
> **Last verified:** 2026-08-09

## Verdict

# READY FOR PHASE 1

Lelungo is ready to begin **only the authenticated membership and platform-boundary foundation** already planned by the active OpenSpec change [`add-authenticated-membership-foundation`](../../../openspec/changes/add-authenticated-membership-foundation/proposal.md), after this Phase 0 change is completed and archived through the repository workflow.

This verdict does not authorize Property, Accommodation, Inventory, Pricing, Reservation, Guest, Stay, Payment, Finance, marketplace, broker, gRPC, cache, search engine, object storage, microservice, production migration, or deployment work. It does not mean Lelungo is production-ready. The narrow Phase 1 slice exists specifically to close the current authentication, tenant-membership authority, role-integrity, and disposable-PostgreSQL evidence gaps before any tenant-owned PMS feature is introduced.

## Decision basis

The positive verdict is supported by four facts:

1. The repository-backed current-state audit distinguishes implemented code/schema artifacts from deployment claims and target design.
2. The target package defines one coherent bounded-context/data-ownership model, critical reservation/inventory/pricing/payment invariants, security boundaries, migration rules, and an incremental roadmap without creating runtime scaffolding.
3. Major choices are recorded in the canonical ADR series and preserve the historical tenancy ADR rather than renumbering or silently replacing it.
4. The unresolved critical controls are either the explicit subject of the narrow Phase 1 authentication/isolation change or later-phase release gates; none requires speculative PMS implementation during Phase 0.

The formal security scanner is blocked because the required Python runtime is unavailable, and the current Prisma migration has not been executed in a disposable PostgreSQL environment. Those limitations prevent broad production-readiness claims. They do not prevent implementing and testing the narrow non-production foundation whose purpose is to provide the missing evidence, provided no protected PMS business data or production rollout is introduced.

## Repository-backed findings

### Implemented and observed

- Next.js App Router, React, strict TypeScript, npm lockfile, Prisma/PostgreSQL schema direction, Vitest unit tests, Playwright prototype E2E tests, and GitHub Actions quality gates are present.
- The reachable product remains a deal/affiliate prototype with mock data, public deal/analytics routes, a mock dashboard, and QA surface.
- Prisma artifacts model `Tenant`, `TenantDomain`, `StaffMembership`, `Role`, `Permission`, and their joins with UUID/timestamp conventions. Repository artifacts do not prove that the migration is applied in any deployed database.
- The proxy normalizes eligible hostnames and overwrites its tenant-subdomain header. Server code resolves that hint through Prisma and can attach an active membership for a supplied actor.
- A small pure authorization helper checks permissions. It is not wired to an authenticated protected route.
- Legacy click analytics remains a separate optional Supabase persistence path and is not the PMS transactional store.

The complete evidence and path-level classification is in [`00-current-system-audit.md`](./00-current-system-audit.md).

### Not implemented or not verified

- No authoritative identity adapter proves the caller. Current production context construction can receive a caller-supplied actor, so membership is not authentication.
- No staff sign-in/sign-out/callback lifecycle or protected staff application boundary exists.
- No Property or property-scoped permission model exists.
- The membership-role join does not database-enforce that membership and role share the same tenant/scope. The current read path can load linked role permissions without an additional role tenant/scope predicate.
- Tenant resolution does not yet establish the protected-service policy for `PENDING`, `PROVISIONING`, `ACTIVE`, and `SUSPENDED`; Phase 1 must fail closed and explicitly select allowed states.
- No disposable PostgreSQL suite proves migrations, partial indexes, provisioning, tenant isolation, or concurrent constraints.
- No PMS tables or runtime exist for Inventory, Pricing, Reservation, Guest, Stay, Payment, Finance, Operations, Distribution, Search, Analytics, Notification, Review, Promotion, or Platform Billing.
- No transactional outbox, durable broker, cache, search engine/PostGIS deployment, background worker, object-storage adapter, structured application logger, metrics/tracing backend, or production health/readiness boundary exists.
- Canonical production Vercel project, environment mapping, wildcard DNS/TLS, database deployment, backup/restore, RPO/RTO, release promotion, and rollback drill remain unverified.

## Accepted architecture decisions

| Decision                | Result                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product shape           | Public guest booking and separately secured PMS surfaces share authoritative domain services; exact hostname/organization-selection routing remains deferred under the existing tenancy ADR.                                                    |
| Initial architecture    | Modular monolith in one Next.js deployment; no empty context scaffolding or premature service split.                                                                                                                                            |
| Context ownership       | Eighteen explicit contexts own commands, queries, repositories, tables, events, transactions, and extraction evidence. Cross-context access uses public application contracts/events, never another context's repository.                       |
| Transactional store     | PostgreSQL through Prisma is the PMS authority; existing migrations are immutable and future changes use expand/backfill/verify/switch/contract.                                                                                                |
| Tenant isolation        | Trusted server resolution, verified subject, active same-tenant membership, permission plus resource scope, tenant-keyed queries, same-tenant constraints, explicit DTOs, and negative tests are cumulative controls.                           |
| Reservation consistency | Physical units use half-open date ranges plus PostgreSQL overlap exclusion; pooled inventory uses transactionally locked daily capacity rows. Cache never confirms a sale.                                                                      |
| Pricing and money       | Deterministic versioned calculation, immutable snapshots, integer minor/business units with currency, explicit rounding, and string serialization for large integer DTO values.                                                                 |
| Payment and Finance     | Payment owns provider-neutral intent/event/transaction/refund facts. Finance owns invoices, balanced ledger postings, settlement allocation, fees, expenses, and payouts. Platform Billing remains separate.                                    |
| Communication           | REST/HTTP/BFF externally and intentional in-process contracts internally now; future gRPC/protobuf only after measured extraction. Non-blocking cross-domain effects use versioned events.                                                      |
| Durable async           | In-process events are allowed only for non-critical local consumers. The first durability requirement introduces a transactional outbox, idempotent consumers, bounded retries, dead-letter operations, and observability.                      |
| Broker                  | NATS JetStream is the preferred first durable broker only after a real workload and operational owner exist; RabbitMQ is viable, while Kafka and Redis Streams are not the default. No broker is deployed in early phases.                      |
| Service extraction      | Notification and Search are the earliest hypotheses; every extraction still requires measured scale/fault/team/security evidence, stable contracts, reconciliation, observability, and a separate accepted change. Remaining a module is valid. |
| Observability           | Redacted structured logs, trusted request/correlation propagation, bounded metrics, OpenTelemetry-compatible traces, health/readiness signals, and separate append-oriented audit evidence are target contracts introduced incrementally.       |

The canonical decision index is [`docs/adr/README.md`](../../adr/README.md). Compact views are under [`docs/diagrams/`](../../diagrams/README.md).

## Critical debt and risks

| Risk/debt                                            | Current effect                                                                     | Required gate                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No authoritative staff authentication                | Blocks every protected PMS surface                                                 | Complete the active authentication change and negative-path tests before Property work.                                                                                |
| Membership-role cross-tenant/scope integrity gap     | Corrupt or wrongly linked rows could carry authority across scope                  | Add query-side defense and write validation; exercise a disposable PostgreSQL regression first; add only a reviewed forward constraint migration if feasible/required. |
| Tenant lifecycle not enforced for protected requests | Suspended or pre-active tenants could be treated as serviceable                    | Define and test an explicit fail-closed allowed-status policy in Phase 1.                                                                                              |
| Existing migration not exercised on real PostgreSQL  | Schema intent, partial indexes, provisioning, and isolation are unproven           | Phase 1 CI/local integration harness must use an explicitly disposable test database and committed migrations.                                                         |
| Formal security scan blocked at preflight            | No formal repository-wide finding set or clean scan exists                         | Restore a supported Python runtime or compatible CI scan and validate findings before protected production release.                                                    |
| No production environment/recovery evidence          | Deployment target, isolation, backup, restore, promotion, and rollback are unknown | Resolve before any production PMS rollout; never run production migrations from a developer machine or preview build.                                                  |
| Reservation/inventory/payment domains absent         | No booking or money correctness exists                                             | Implement only in their roadmap phases with PostgreSQL concurrency, idempotency, pricing replay, webhook, ledger, and tenant-isolation evidence.                       |

The full 21-item register, owners, triggers, severity, and mitigations is [`risk-register.md`](../risk-register.md).

## Unresolved decisions and deadlines

| Decision                                                                                | Owner                                          | Required before                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| Identity-provider lifecycle details and final Supabase SSR integration behavior         | Identity & Access / Phase 1                    | Protected staff route acceptance                    |
| Allowed Tenant lifecycle states for protected operations                                | Organization & Tenancy + Identity & Access     | First Phase 1 protected context                     |
| Enforceable membership-role/property-scope relational design                            | Identity & Access + Data                       | Role assignment becomes production authority        |
| Central PMS hostname versus tenant-host navigation/selection                            | Product + Security + Organization & Tenancy    | Any central PMS host or organization selector ships |
| Property classification, timezone, address, staff invitation, and scope policy          | Product + Property + Identity & Access         | Phase 2 schema/API                                  |
| Inventory mode, horizon, hold TTL, and mixed entire-place/child-room policy             | Product + Inventory + Reservation + Operations | Corresponding Phase 3/4 slice                       |
| Tax/fee/cancellation/rounding/currency catalog and provider selection                   | Product + Legal + Finance + Payment            | Pricing/payment schema or money movement            |
| Privacy retention, consent, identity-document handling, and audit retention             | Legal/Privacy + Guest + Security               | First sensitive guest/staff/financial field         |
| Canonical Vercel project, environment isolation, production DB, backup/restore, RPO/RTO | Platform/Operations                            | Staging or production PMS promotion                 |
| Broker/provider, SLO thresholds, telemetry retention/sampling                           | Platform + owning domain                       | Durable async or production observability adoption  |

These choices are intentionally deferred; guessing them during foundation work would create schema, compliance, or operational commitments without owners or evidence.

## Verification outcome

The authoritative command-level record is [`verification.md`](../../../openspec/changes/complete-phase-0-architecture-package/verification.md). Results on 2026-08-09 were:

| Gate                       | Actual outcome                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 artifact validator | PASS: 50 Markdown files, 15/15 status blocks, 12/12 target boundaries, 18/18 contexts, 8 ADR structures, 7 Mermaid fence sets, 21 risks, 13/13 roadmap phases, readiness headings, and local links. Mermaid rendering was not executed. |
| OpenSpec                   | PASS: 4 items, 0 failures.                                                                                                                                                                                                              |
| Formatting                 | PASS for repository `format:check`; changed Markdown was also formatted and checked with installed Prettier.                                                                                                                            |
| Prisma schema              | PASS with a process-local placeholder `DATABASE_URL`; this validation made no connection or database mutation. The first attempt without the required variable failed explicitly.                                                       |
| Lint                       | PASS.                                                                                                                                                                                                                                   |
| TypeScript                 | PASS through the exact npm script using Git Bash as script shell. Default Windows child-shell limitations and the successful equivalent/direct steps are recorded.                                                                      |
| Unit tests                 | PASS: 3 files and 9 tests. The sandbox attempt was denied while loading the Vitest configuration; the same command passed outside the sandbox.                                                                                          |
| Production build           | PASS with Next.js 16.3.0; existing routes only.                                                                                                                                                                                         |
| Dependency audit           | Offline critical audit exited 0 and reported 0 vulnerabilities from local cache across 676 dependencies; not a live-registry or formal-security result.                                                                                 |
| Formal security workflow   | `BLOCKED AT PREFLIGHT`: neither `python` nor `py -3` is available, so no formal scan or finding set exists.                                                                                                                             |

No database, identity provider, Vercel project, DNS/TLS, production deployment, or external service was mutated or used as verification evidence.

## Required Phase 1 scope

Use the existing `add-authenticated-membership-foundation` change as the sole owner of new `staff-authentication` and modified `staff-authorization` capabilities. Do not subsume, supersede, or duplicate it in a giant Phase 1 proposal.

The implementation order is:

1. Reconfirm the installed Next.js and Supabase SSR contracts and validate auth-only configuration without breaking public prototype routes.
2. Introduce the server-only verified-subject port and provider adapter; tokens/provider objects never enter domain types or logs.
3. Build request context only from the verified subject, trusted tenant resolution, an allowed tenant lifecycle state, active same-tenant membership, safe same-scope roles, and explicit permission checks.
4. Compose cookie refresh with the single trusted proxy while preserving host normalization, spoofed-header overwrite, safe redirects, private/no-store authenticated responses, and server-side authority.
5. Add only the minimal sign-in/callback/sign-out and protected `/staff` seam; expose no Property or PMS business data.
6. Add a fail-closed disposable-PostgreSQL harness and CI evidence for committed migrations, idempotent provisioning, partial uniqueness, allowed tenant state, inactive/absent membership denial, and cross-tenant/platform-role assignment denial.
7. Run security review and full gates, record actual blockers, update current-state docs/handoff, and archive the completed change before Phase 2.

If a PostgreSQL test proves a schema defect, pause and update the active change. Add a forward migration only after data audit/backfill/constraint feasibility and rollout/rollback review; never edit the existing migration.

## Stop boundary

Phase 0 stops here. This apply contains no Phase 1 runtime code, route, UI, schema, migration, dependency, CI infrastructure, external configuration, or deployment change. The next workflow action after final verification is to review and archive `complete-phase-0-architecture-package`; Phase 1 implementation requires its own explicit apply action.
