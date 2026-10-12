## 1. Prerequisite and baseline gates

- [ ] 1.1 Verify that the completed Phase 0 package and accepted ADR set are present in repository history, reconcile any uncommitted Phase 0 drift without overwriting user work, and record `openspec status --change complete-phase-0-architecture-package` plus `npm run spec:validate`; stop Phase 3 if the package is not accepted.
- [ ] 1.2 Verify that `add-authenticated-membership-foundation` is fully applied and archived with authoritative authentication, safe session handling, tenant-lifecycle enforcement, membership-role integrity, and disposable-PostgreSQL evidence; record its verification and rerun the relevant auth unit/integration/E2E gates, stopping rather than implementing Phase 1 here.
- [ ] 1.3 Verify an approved and completed Phase 2 Property change supplies tenant-owned Property, valid IANA timezone, classification, public identity contract, property-scope grants, protected staff routes, and same-tenant constraints; run its unit/integration/E2E gates and stop rather than absorbing missing Phase 2 behavior.
- [ ] 1.4 Re-read the implemented Phase 1/2 public contracts, current/target documentation, ADRs, and every applicable installed `node_modules/next/dist/docs/` guide; update this change before coding if accepted behavior conflicts, then confirm with `npm run spec:validate`.
- [ ] 1.5 Capture a fresh pre-Phase-3 baseline with `npm run format:check`, `npm run prisma:validate`, `npm run spec:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, relevant `npm run test:e2e`, and `npm run build`; record exact exits/blockers and fix only proven in-scope blockers.

## 2. Architecture decisions and boundaries

- [ ] 2.1 Add a reviewed ADR clarifying the Website-as-a-Service + PMS + Direct Booking packaging and the narrow entitlement subset inside the future Platform Billing boundary; verify links/status with `npm run spec:validate` and Markdown formatting.
- [ ] 2.2 Add a reviewed ADR for universal RoomType-to-Unit identity, one hybrid InventoryPool per RoomType, sparse Phase 3 exceptions, Property-local date semantics, block/cap precedence, and the explicit Phase 4 daily-allocation seam; verify against `room-types`, `units`, `inventory`, `inventory-blocks`, and `availability` specs.
- [ ] 2.3 Add a reviewed ADR for one-pool RatePlans, append-oriented rate/restriction versions, exact-date/season/weekday/base precedence, integer Money, 15-minute transient quotes, and the narrow fee/tax policy; verify against pricing golden-test cases and `npm run spec:validate`.
- [ ] 2.4 Define public application-contract ownership for Property accommodation, Inventory, Pricing, Entitlements, and Audit plus an allowed import matrix; add `npm run architecture:check` without weakening lint/types and prove representative forbidden imports fail its focused tests.
- [ ] 2.5 Define stable Phase 3 application/HTTP error codes and safe mappings, including ownership denial, lifecycle conflicts, invalid ranges/occupancy/currency, block/rate conflicts, `PRICE_NOT_AVAILABLE`, concurrency conflict, and `FEATURE_NOT_ENTITLED`; verify error-envelope tests with `npm run test`.

## 3. Shared date, money, policy, audit, and event primitives

- [ ] 3.1 Implement the canonical `StayDate` and half-open `StayPeriod` primitives with strict ISO parsing, UTC-only calendar arithmetic, Property-local today resolution, adjacency, leap-day, Jakarta/Makassar, and invalid-range tests; verify with `npm run test`, `npm run lint`, and `npm run typecheck`.
- [ ] 3.2 Implement integer-safe `Money`/basis-point arithmetic, currency/unit-scale validation, decimal-string DTO serialization, half-up rounding, overflow/mixed-currency rejection, and line-sum tests without JavaScript number arithmetic; verify with `npm run test` and `npm run typecheck`.
- [ ] 3.3 Centralize maximum stay 30 nights, calendar/rate/block range 366 nights, advance horizon 730 days, requested quantity 100, and quote validity 15 minutes in one typed policy with boundary tests; verify with `npm run test`.
- [ ] 3.4 Introduce the minimum append-oriented Audit module/table and transactional writer needed by Phase 3, with redacted typed change metadata and tenant/property/actor/request/correlation fields; validate the forward migration with `npm run prisma:validate` and disposable-PostgreSQL tests.
- [ ] 3.5 Implement the lightweight versioned domain-event envelope and post-commit in-process dispatch for meaningful Phase 3 facts, ensuring no critical behavior depends on delivery and no broker/outbox is introduced; verify payload/redaction and one-event-per-aggregate-action tests with `npm run test`.

## 4. Product access and entitlements

- [ ] 4.1 Implement the centralized plan/capability catalog, exact Starter/Professional/Premium mappings, future/add-on identifiers, and operational-release metadata with no direct plan checks outside the entitlement module; verify mapping and planned-vs-operational tests with `npm run test`.
- [ ] 4.2 Add append-oriented ProductAccess assignment and capability-override persistence with exactly one active plan per Tenant, at most one active override per capability, revisions, history, tenant ownership, and safe indexes in a new forward migration; run `npm run prisma:validate` and focused PostgreSQL constraint tests.
- [ ] 4.3 Implement fail-closed entitlement resolution where active override wins the base plan and missing, duplicate, invalid, unknown, or ungranted state never enables a feature; verify exhaustive plan/add-on/override tests with `npm run test`.
- [ ] 4.4 Implement the explicitly platform-authorized ProductAccess/override mutation service with validation, optimistic concurrency, audit evidence, and `entitlement.changed`, while exposing no subscription charge/invoice behavior; verify unit and PostgreSQL transaction tests.
- [ ] 4.5 Add reusable backend capability guards that distinguish `FEATURE_NOT_ENTITLED` from permission/property denial and distinguish commercial entitlement from operational release; verify bypass and future-feature regression tests with `npm run test`.
- [ ] 4.6 Add idempotent provisioning/backfill behavior for explicitly approved existing Tenants without inferring a plan from host or data, default uncertain assignments to manual review/fail closed, and verify repeated execution in `npm run test:integration`.
- [ ] 4.7 Prove downgrade and re-upgrade change only effective access while retaining all compatible RoomType, Unit, Inventory, Pricing, and audit data; verify with PostgreSQL integration and browser scenarios.

## 5. RoomType and Unit accommodation catalog

- [ ] 5.1 Extend the Phase 2 Property module with RoomType occupancy, lifecycle, normalized property-unique code, optional typed bed configuration, versioning, and explicit internal/public DTO types; verify lifecycle/occupancy/public-projection unit tests.
- [ ] 5.2 Add Unit identity, same-RoomType ownership, property-wide normalized code uniqueness, lifecycle/status transitions, private fields, versioning, and archived-code retention; verify Unit domain tests with `npm run test`.
- [ ] 5.3 Add RoomType, bed, and Unit Prisma models plus a forward migration with explicit tenant/property keys, composite same-scope foreign keys, occupancy checks, lifecycle constraints, unique codes, versions, indexes, and non-destructive referential behavior; run SQL review, `npm run prisma:validate`, and `npm run test:integration`.
- [ ] 5.4 Implement tenant/property-scoped repositories with explicit minimum-field selects and no unscoped ID-only convenience methods; verify same-tenant, cross-tenant, same-organization cross-property, and query-shape tests.
- [ ] 5.5 Implement create/read/list/update plus explicit activate/deactivate/archive RoomType application services, requiring valid occupancy and a same-property non-archived Unit for activation but no live RatePlan; verify permission, entitlement, lifecycle, audit, and event tests.
- [ ] 5.6 Implement create/read/list/update plus explicit Unit lifecycle services, ensuring only ACTIVE Units contribute capacity and temporary outages are not mass-assigned as status; verify optimistic-concurrency, audit, event, and property-scope tests.
- [ ] 5.7 Extend the permission catalog and idempotent role provisioning with the exact room-type, Unit, inventory, availability, RatePlan, and pricing permissions without role-name checks; verify catalog/provisioning with `npm run test` and `npm run test:integration`.

## 6. Inventory pools, blocks, caps, and availability

- [ ] 6.1 Implement one InventoryPool per RoomType with `PHYSICAL_UNIT` and `POOLED` modes, enforcing private-villa capacity one and deriving baseline capacity exclusively from current ACTIVE Units; verify villa/homestay/hotel domain tests.
- [ ] 6.2 Implement InventoryBlock scope/reason/range/removal models and InventoryOverride absolute sellable-cap behavior, including distinct overlapping Unit-block counting, full/quantity RoomType blocks, reduction-only caps, and non-destructive history; verify pure algorithm and lifecycle tests.
- [ ] 6.3 Add pool, block, and override Prisma models plus a forward migration with tenant/property/RoomType/Unit composite integrity, one pool per RoomType, one cap per pool/date, valid XOR block shape/ranges/quantities, idempotency, versions, and range/date indexes; run `npm run prisma:validate` and PostgreSQL constraint tests.
- [ ] 6.4 Implement Inventory repositories and transactional block/cap services that lock the narrow pool, evaluate every affected date, reject negative/excess capacity atomically, append audit evidence, and emit one meaningful event; verify concurrent create/update/remove and rollback scenarios in `npm run test:integration`.
- [ ] 6.5 Implement bounded batched `CheckAvailability`, `GetAvailableQuantity`, and calendar queries using a consistent snapshot and the exact Unit-block -> RoomType-block -> sellable-cap precedence; verify single/multi-night, adjacency, zero inventory, OOS, overlap, timezone, and cap tests.
- [ ] 6.6 Return structured per-night/stay availability with quantity, timestamp/revision, safe reasons, and public/internal DTO separation; verify no Unit code, note, block reason, or override detail leaks through public contract tests.
- [ ] 6.7 Document future `HoldInventory`, `ReleaseInventory`, and `CommitInventory` signatures and Phase 4 atomicity requirements in the Inventory public contract/handoff without adding callable success stubs, reservation tables, holds, sold counters, or distributed locks; verify architecture checks and source search.

## 7. RatePlans, rates, restrictions, and PriceQuotes

- [ ] 7.1 Implement one-pool RatePlan domain lifecycle, currency, activation prerequisites, published revision/history, optimistic concurrency, and historical interpretation; verify domain tests for draft/active/inactive/archive and invalid activation.
- [ ] 7.2 Implement immutable base, weekday, season-priority, and exact-date rate versions with deterministic replacement precedence and equal-priority/date conflict rejection; verify focused and property-based/golden tests with `npm run test`.
- [ ] 7.3 Implement minimum/maximum stay, CTA, CTD, and stop-sell versions across supported Property/RoomType/RatePlan scopes with conservative combination and structured side-effect-free violations; verify hotel-night and overlapping-scope tests.
- [ ] 7.4 Implement fixed extra-adult-per-night adjustments, fixed per-stay/per-night fees, taxable flags, non-compound exclusive basis-point taxes, deterministic half-up rounding, and explicit rejection of unsupported inclusive/compound/percentage-fee modes; verify arithmetic and currency tests.
- [ ] 7.5 Add RatePlan, published-version, rate, restriction, fee, tax, and indicative-rate Prisma models plus forward migration SQL with composite ownership, `BIGINT` money, currency/range/rule-shape checks, history, versions, uniqueness/conflict protection, and tenant/property/date indexes; run `npm run prisma:validate` and `npm run test:integration`.
- [ ] 7.6 Implement Pricing repositories and lifecycle/range mutation services with explicit selects, bounded 366-date all-or-nothing bulk updates, expected revisions, append-oriented rate history, audit evidence, and meaningful events; verify PostgreSQL concurrency/rollback tests.
- [ ] 7.7 Implement `ValidateRatePlan`, `GetRatePlan`, deterministic rule selection, and `ValidateRestrictions` as public Pricing contracts without importing Inventory repositories; verify architecture and calculation tests.
- [ ] 7.8 Implement the quote orchestrator through public Property, Entitlement, Inventory, and Pricing contracts so a sellable quote requires authoritative requested quantity, valid occupancy/restrictions, and one currency while leaving inventory unchanged; verify sold-out, cross-scope, inactive-plan, and capability denial tests.
- [ ] 7.9 Implement transient PriceQuote output with nightly/adjustment lines, decimal-string totals, applied versions, 15-minute expiry, canonical fingerprint excluding timestamps, future-compatible discount lines, and exact line-sum equality; verify deterministic replay/golden tests and no quote persistence.
- [ ] 7.10 Implement separately versioned Starter indicative-rate management/publication that never contains a stay total, fingerprint, or availability claim; verify Starter/public DTO and attempted quote-substitution tests.

## 8. Validated HTTP and application boundaries

- [ ] 8.1 Define strict Zod schemas and bounded pagination/range inputs for RoomType, Unit, block, cap, availability, RatePlan, rates, restrictions, indicative rate, and PriceQuote commands/queries, rejecting unknown/mass-assigned ownership/status/actor fields; verify schema tests.
- [ ] 8.2 Implement protected staff Server Actions for UI mutations and direct Server Component application queries for reads, preserving the order validation -> authentication -> trusted tenant -> permission/property scope -> entitlement -> service; verify action/query boundary tests and `npm run typecheck`.
- [ ] 8.3 Implement versioned `/api/v1` Route Handlers only for stable staff/public contracts required by OpenAPI or external consumers, with async Next.js params, explicit DTOs, private/no-store staff responses, safe errors, and no route-to-Prisma access; verify HTTP contract tests.
- [ ] 8.4 Implement bounded batched availability and rate-calendar reads plus all-or-nothing range mutations so no client needs one request per cell; verify request-count/query-count regressions and range-limit tests.
- [ ] 8.5 Create or update the repository OpenAPI document for RoomTypes, Units, blocks, caps, availability, RatePlans, rates, restrictions, quotes, indicative rates, concurrency, and entitlement errors; validate examples/schemas through a focused automated contract test and `npm run spec:validate`.

## 9. PMS and public user interfaces

- [ ] 9.1 Add the protected Property accommodation route with Server Component RoomType list, real Unit counts, occupancy, lifecycle state, accessible empty/error/loading states, and capability-aware actions; verify component tests and `npm run typecheck`.
- [ ] 9.2 Add RoomType create/edit/lifecycle and Unit list/create/edit/status workflows using validated Server Actions, expected versions, accessible forms, and no Reservation/guest fields; verify focused browser flows.
- [ ] 9.3 Add a bounded availability/block calendar that displays only Phase 3 capacity from Unit status, blocks, and caps, supports safe block/cap operations, and explicitly avoids booked/revenue/guest/occupancy claims; verify calendar component and E2E tests.
- [ ] 9.4 Add a bounded RatePlan/rate calendar with plan selection, date/weekday/range editing, conflict feedback, Money formatting, and one batched mutation; verify accessibility, keyboard use, request-count, and E2E rate-edit scenarios.
- [ ] 9.5 Add an explainable price-preview surface showing nightly lines, extra-adult charges, fees, taxes, restrictions, total, versions, and transient expiry without presenting a checkout or confirmation action; verify deterministic UI rendering and no booking-language regression.
- [ ] 9.6 Integrate the safe public accommodation projection with the Phase 2 public Property resolver for subdirectory/subdomain surfaces, showing only approved RoomType/capacity and `Mulai dari` indicative rate data plus WhatsApp-ready inputs; verify no real-time claim for Starter and no internal DTO leakage.
- [ ] 9.7 Enforce UI capability states for Starter, Professional, Premium, downgrade, add-ons, and commercially entitled but non-operational future features while treating UI hiding as usability only; verify backend bypass remains denied in E2E tests.

## 10. Legacy migration and rollout safety

- [ ] 10.1 Inventory every legacy accommodation/price source and record `KEEP`, `MAP`, `MIGRATE`, `DEPRECATE`, `REMOVE`, or `MANUAL_REVIEW` with provenance/tenant ownership evidence; default affiliate/mock records to `MANUAL_REVIEW` and verify the classification against current schema/code.
- [ ] 10.2 If any record is approved for migration, implement a bounded idempotent expand/backfill script with dry-run, reconciliation totals, explicit Tenant/Property mapping, and no delete/overwrite path; verify twice against a disposable database and record identical outcomes.
- [ ] 10.3 Document compatible deployment order, migration review, backup/restore prerequisites, feature-disable rollback, data retention on downgrade/rollback, and reviewed forward-fix procedure; validate the runbook links and do not execute production migration or deployment.

## 11. Security, architecture, and end-to-end verification

- [ ] 11.1 Add tenant-attack tests covering known foreign RoomType, Unit, pool, block, override, RatePlan, rate, restriction, indicative-rate, and quote IDs, proving denial before protected data access and database rejection of cross-tenant relations; run unit/API/PostgreSQL suites.
- [ ] 11.2 Add same-Tenant cross-Property attack tests for every read/mutation path and prove property assignment plus composite constraints deny access; run unit/API/PostgreSQL suites.
- [ ] 11.3 Add entitlement-bypass, missing ProductAccess, future-feature, permission-vs-entitlement, mass-assignment, raw-ORM-error, public/internal DTO, and sanitized-log/event regression tests; run relevant unit/integration/E2E gates.
- [ ] 11.4 Add the required E2E stories for private villa, homestay Unit block, small-hotel quantity block, deterministic price precedence, tenant attack, property attack, Starter denial, and upgrade without data migration; run `npm run test:e2e` and record exact projects/results.
- [ ] 11.5 Run architecture/red-flag searches for direct plan checks, `room.price`, availability booleans, unsafe stay-date `new Date`, `parseFloat` money, body-to-ORM spread, ID-only protected lookup, direct cross-module repositories, frontend/database access, and Reservation/payment placeholders; fix verified in-scope findings and rerun `npm run architecture:check`, lint, types, and tests.
- [ ] 11.6 Run the repository's formal security workflow and dependency check in a supported environment; validate every finding or record the exact preflight/environment blocker without equating manual review to a passed scan.

## 12. Observability and performance evidence

- [ ] 12.1 Add structured, redacted Phase 3 diagnostics with safe tenant/property/resource/actor/request/correlation context and no credentials, request bodies, private notes, or unnecessary quote payloads; verify log-capture/redaction tests.
- [ ] 12.2 Add bounded operational metrics for availability count/duration, quote count/duration/failures, inventory/rate updates, and entitlement denials without high-cardinality ID labels; verify metric-name/label tests and document the export state honestly.
- [ ] 12.3 Build a reproducible representative dataset and performance harness for RoomType list, 30-day multi-RoomType availability, 30-day rate calendar, and 2–7-night quotes, recording environment, data volume, warm-up, sample count, and observed distribution rather than inventing an SLA.
- [ ] 12.4 Review `EXPLAIN (ANALYZE, BUFFERS)` for the representative PostgreSQL queries, retain only evidence-backed tenant/property/date/status/range indexes, and rerun `npm run test:integration` plus the performance baseline.

## 13. Documentation, report, and Phase 4 handoff

- [ ] 13.1 Create/update `docs/domain/inventory.md`, `docs/domain/availability.md`, `docs/domain/pricing.md`, and `docs/domain/rate-plans.md` with actual ownership, algorithms, date/Money semantics, limits, contracts, and Phase 3-only behavior; validate links/formatting.
- [ ] 13.2 Create/update `docs/product/entitlements.md` and `docs/product/starter-professional-premium.md` with exact commercial mappings, operational-release distinction, add-ons, upgrade/downgrade retention, and no billing claims; validate against entitlement tests.
- [ ] 13.3 Create/update `docs/security/inventory-authorization.md` and `docs/architecture/phase-3.md` with boundary order, tenant/property constraints, DTO exposure, module ownership, migration/rollback, and Mermaid domain/availability/pricing sequences including clearly marked Phase 4 additions.
- [ ] 13.4 Update current/target architecture, ADR index/risk register, API docs, runbooks, and `docs/runbooks/session-handoff.md` so every implemented/deferred claim and actual verification result matches repository evidence.
- [ ] 13.5 Update `AGENTS.md` with RoomType/Unit/inventory/reservation distinctions, Property-local dates, integer Money, capability-vs-authorization rules, module public contracts, and tenant/property scope without overwriting unrelated user guidance.
- [ ] 13.6 Produce the 25-section `LELUNGO PHASE 3 IMPLEMENTATION REPORT`, including exact implementation, business-tier alignment, schema/APIs/UI/events/security/tests/performance/migration/debt/deviations, and actual command outcomes.
- [ ] 13.7 Produce the Phase 4 engineering handoff with Property/RoomType/Unit/Inventory/Pricing/PriceQuote contracts, date/timezone/currency/entitlement/authorization/transaction/event/constraint rules, test commands, and the still-unimplemented hold/release/commit obligations.

## 14. Final verification and stop boundary

- [ ] 14.1 Create this change's `verification.md` and record exact commands, environment, exit codes, test counts, datasets, migration impact, rollback evidence, skips/blockers, formal-security status, and unresolved debt; never copy historical Phase 0 results as Phase 3 evidence.
- [ ] 14.2 Run final `npm run format:check`, `npm run prisma:validate`, `npm run spec:validate`, `npm run architecture:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, relevant/full `npm run test:e2e`, `npm run build`, performance baseline, and the configured dependency/security checks; fix only verified in-scope failures and record actual outcomes.
- [ ] 14.3 Repeat the final tenant/property IDOR, entitlement bypass, negative/excess inventory, invalid range/timezone, deterministic quote, currency mismatch, mass-assignment, DTO leakage, direct-plan-check, server-timezone, and no-Reservation source review; add regression tests for every correction.
- [ ] 14.4 Reconcile all specs, ADRs, schema, contracts, docs, report, handoff, and session state; output exactly one Phase 4 readiness status (`READY FOR PHASE 4` or `NOT READY FOR PHASE 4`) with evidence-backed rationale, then stop without creating Reservation behavior.
