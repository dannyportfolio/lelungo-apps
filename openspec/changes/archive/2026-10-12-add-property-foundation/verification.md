## Verification status

**Change:** `add-property-foundation`  
**Date:** 2026-08-12  
**Current state:** Phase 2 implementation and database verification are complete. Final browser-suite execution and archive are blocked by the local approval/runtime limits described below; no production or deployed-environment claim is made.

## Implemented scope

- Tenant-only same-Tenant role-assignment integrity and a conservative authority migration preflight.
- Tenant-owned Property, address, amenity, lifecycle, publication, catalog, optimistic-version, and safe projection contracts.
- Explicit `ALL_PROPERTIES`/`SELECTED_PROPERTIES` membership scope, same-Tenant grants, bounded administration queries, and atomic scope audit evidence.
- Protected staff Property list/create/detail/edit/lifecycle and minimum-field scope administration.
- One transport-neutral, trusted-Tenant published Property resolver. There is no public list/route and no RoomType, Unit, inventory, pricing, entitlement, reservation, guest, payment, or operations implementation.

## Final static and unit gates

Commands were run from the repository root with direct local Node entry points because the host PowerShell npm shim is blocked by execution policy. This executes the package-script bodies without changing their meaning.

| Check            | Exact command                                                                                                                                          | Result                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Formatting       | `node ./node_modules/prettier/bin/prettier.cjs --check "src/modules/**/*.{ts,tsx}" "src/shared/**/*.{ts,tsx}" "tests/unit/**/*.{ts,tsx}" src/proxy.ts` | Exit 0.                                                                                          |
| Prisma schema    | Process-local nonsecret placeholder `DATABASE_URL`, then `node ./node_modules/prisma/build/index.js validate`                                          | Exit 0.                                                                                          |
| OpenSpec         | `node ./node_modules/@fission-ai/openspec/bin/openspec.js validate --all --strict`                                                                     | Exit 0; 6/6 valid.                                                                               |
| Lint             | `node ./node_modules/eslint/bin/eslint.js .`                                                                                                           | Exit 0.                                                                                          |
| Next route types | `node ./node_modules/next/dist/bin/next typegen`                                                                                                       | Exit 0.                                                                                          |
| TypeScript       | `node ./node_modules/typescript/bin/tsc --noEmit`                                                                                                      | Exit 0.                                                                                          |
| Unit tests       | `node ./node_modules/vitest/vitest.mjs run --configLoader runner`                                                                                      | Exit 0; 32 files / 209 tests passed.                                                             |
| Production build | `node ./node_modules/next/dist/bin/next build`                                                                                                         | Exit 0; Next.js 16.3, 9 static pages, and `ƒ Proxy (Middleware)` discovered from `src/proxy.ts`. |

`prisma generate` had passed earlier for the Phase 2 schema and produced the client used by TypeScript, unit, integration, and build checks. Its last final-gate retry was blocked with Windows `EPERM` because the local Next server held the Prisma engine DLL; the approval service then refused the requested targeted process cleanup because its usage quota was exhausted. This is not a schema-validation failure, but the final retry is not recorded as a pass.

`git diff --check` reports only trailing whitespace in `src/components/FilterBar.tsx:21`, a pre-existing unrelated user-owned edit that this change deliberately did not modify.

## Disposable PostgreSQL evidence

An isolated PostgreSQL 16 container named `lelungo-phase2-postgres-test` exposed only local port 55433 and hosted the test-marked database `lelungo_phase2_test`. Its password was read process-locally from the container environment and was never printed or persisted. Each focused command supplied a validated `TEST_DATABASE_URL`; the Vitest integration configuration mapped it to `DATABASE_URL` only inside the test process and applied committed migrations through Prisma.

All five focused integration files passed individually, 29/29 tests total:

| File                                                      | Result     | Evidence                                                                                                                                                      |
| --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/tenancy-foundation.test.ts`            | 9/9 passed | Tenant provisioning, role catalog, membership isolation, and migration constraints.                                                                           |
| `tests/integration/property-foundation.test.ts`           | 8/8 passed | Fresh Property schema, tenant uniqueness/isolation, grants, optimistic concurrency, atomic audit, and named constraints/indexes.                              |
| `tests/integration/property-foundation-migration.test.ts` | 2/2 passed | Phase 1-to-2 upgrade, explicit owner `SELECTED v1 -> ALL v2` SYSTEM audit, second deploy, and invalid legacy authority preflight rollback.                    |
| `tests/integration/property-service-regressions.test.ts`  | 8/8 passed | Cross-Tenant/IDOR denial, two-writer OCC, inactive catalogs, bounded cursor/DTO, stale/non-active scope, exact mode round trip, and retained archived grants. |
| `tests/integration/property-catalog-retirement.test.ts`   | 2/2 passed | Published catalog-reference guard and concurrent publish-versus-retire invariant.                                                                             |

The final post-edit canonical all-files `test:integration` command could not be rerun after the approval quota was exhausted. The production implementation did not change after these database passes except the Next Proxy convention/Host correction and browser/unit tests. The five individual passes are real database evidence, but are not described as one final canonical-command pass.

No staging or production migration was run. No production database, deployed provider, secret store, or external infrastructure was changed.

## Browser evidence

The browser fixture uses a local fake Supabase Auth HTTP boundary whose `auth.getUser()` result is consumed by the production provider adapter; it does not bypass application authentication. It creates exact disposable Tenant/domain/membership/Property records and removes only those records.

- A focused Chromium tenant-host test for an authenticated active membership missing `property.read` passed: 1/1 in 10 seconds. It proved host-derived tenant context, provider-verified identity, active same-Tenant membership, and permission denial before Property repository access.
- This run exposed and fixed a real Next.js 16 convention bug: with `src/app`, the Proxy must be `src/proxy.ts`, and self-hosted/dev requests may expose the routed tenant hostname through `Host` while `nextUrl.hostname` is normalized to `localhost`. The Proxy now uses the routed `Host`, deletes untrusted `x-forwarded-host`, overwrites tenant/request headers, and has unit regressions.
- The subsequent Property suite run reached the valid tenant-host flows but stopped at an ambiguous Playwright `alert` locator; that test was corrected.
- The next run reached the create flow but correctly preserved uncontrolled required form fields as empty after a Server Action response; the test now refills required fields before its valid submission.
- The approval service then rejected the final rerun because its execution-approval quota was exhausted. Therefore the complete authored nine-test file is **not** recorded as passing. Only the focused 1/1 result above is passing browser evidence.

CI provisions PostgreSQL 16, runs committed migrations, installs Chromium, and invokes the tenant-host suite with synthetic local test configuration. A remote CI result and live Supabase-provider result remain unverified.

## Security review

The manual review covered authentication/session reuse, cookie scope/flags, CSRF-relevant Server Actions, Host/forwarded-header trust, tenant and Property authorization placement, persistence-boundary TOCTOU, actor binding, IDOR/enumeration, mass assignment, public/internal DTOs, audit/log redaction, cursor bounding/rebinding, catalog races, and database same-Tenant ownership.

Corrections include explicit host-only HttpOnly/SameSite cookie policy with production `Secure`, concurrent PKCE flow binding, local sign-out clearing, untrusted forwarded-host removal, runtime Host normalization, transaction-scoped membership/permission/scope/actor rechecks, combined authorized detail reads, minimum list/public selects, bounded scope loads, catalog serialization, atomic migration wrapping/locks, and redacted audit version evidence. Focused unit and PostgreSQL regressions cover these corrections.

Formal Codex Security diff scan outcome: **blocked before worklist generation; no clean-scan claim**.

- Capability preflight command used the bundled Android NDK Python 3.11.4 with profile `security_diff_scan`, native multi-agent v2 ownership/capacity facts, goal-tool/delegation checks, and every available `codex-security` skill. It exited 0 with status `ready`, no unmet or unknown requirement.
- The prescribed `python` launcher was absent from `PATH`.
- The only discovered fallback interpreter lacked `_sqlite3`; the deterministic diff-rank generator could not start. No `rank_input.jsonl`, review ledger, candidate set, final report, or scan ID was produced.
- Manual review is supporting evidence only and is not a substitute for the formal scan.

The formal-scan goal was closed on the allowed alternative (exact supported-runtime blocker established) after 956,401 tokens and about 1 hour 19 minutes of accumulated goal time.

## Migration and rollback

The new forward migration is wrapped in explicit `BEGIN`/`COMMIT`, locks authority inputs before classification, aborts before mutation on invalid legacy assignments, transforms only verified Tenant role assignments, seeds catalogs idempotently, initializes tenant memberships fail closed, and records reviewed owner backfill as a SYSTEM audit with exact version transition. Fresh and staged upgrade tests cover success, idempotency, constraints, and preflight rollback.

Rollback is application-first: disable the Phase 2 routes/actions and deploy the prior schema-compatible application while retaining additive Property, scope, catalog, and audit rows. Never hard-delete evidence, edit an applied migration, or run a destructive down migration. Schema/data defects require a reviewed forward fix after backup and reconciliation. The published resolver can be disabled independently if its projection is unsafe.

Local operational cleanup is still required: the approval service prevented stopping the exact repository Next server on port 3004 and the disposable PostgreSQL container. A later operator must inspect their exact process/container identity before stopping them; no broad process kill or unrelated container cleanup is authorized.

## Phase 3 readiness decision

**Implementation prerequisite: satisfied. Release/archive gate: not yet satisfied in this environment.**

Phase 3 may rely on the implemented public contracts for trusted Tenant/Property identity, canonical timezone/classification, lifecycle configurability/serviceability, Property scope, and transactional audit. It must still stop at its prerequisite gate until Phase 2 main-spec sync/archive is complete. This change cannot be archived here because the final complete browser rerun and cleanup were blocked by the approval quota. Phase 3 must continue to own RoomType, Unit, inventory, pricing, and entitlements; reservation/hold/booking behavior remains Phase 4.
