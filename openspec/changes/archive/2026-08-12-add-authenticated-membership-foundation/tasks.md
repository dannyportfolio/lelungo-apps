## 1. Dependency and configuration baseline

- [x] 1.1 Upgrade `@supabase/ssr` to a reviewed current release, adapt existing client factories to its installed types, inspect the lockfile diff for unrelated changes, and verify with `npm ls @supabase/ssr @supabase/supabase-js` plus `npm run typecheck`.
- [x] 1.2 Add a server-only authentication configuration accessor that validates required provider variables only on authentication/protected paths, redacts failures, and cover configured, missing, and malformed values with `npm run test`.
- [x] 1.3 Read the installed Next.js 16 authentication, Proxy, cookies, Server Action, and Route Handler guides before editing those boundaries; record any implementation-impacting deviation in `design.md` and verify no obsolete middleware/API convention is introduced with `npm run typecheck`.

## 2. Authoritative identity boundary

- [x] 2.1 Add the narrow authenticated-subject port and stable unauthenticated/configuration error types under `src/modules/identity`, keeping provider objects and tokens out of public domain types; verify server-only/import boundaries with `npm run lint` and `npm run typecheck`.
- [x] 2.2 Implement the Supabase server adapter using authoritative user verification and UUID validation, with unit tests for valid, absent, expired/invalid, malformed-user-ID, and provider-failure outcomes; verify with `npm run test`.
- [x] 2.3 Implement Zod schemas and a local staff-path redirect allowlist that rejects absolute, protocol-relative, malformed, and non-staff targets; verify positive and open-redirect regression cases with `npm run test`.

## 3. Tenant membership and authorization composition

- [x] 3.1 Refactor the production request-context entry to obtain its actor from the authentication port while retaining only an explicit injectable composition seam for tests; verify unauthenticated and authenticated context behavior with `npm run test` and `npm run typecheck`.
- [x] 3.2 Keep membership lookup scoped by verified user UUID, trusted tenant UUID, and `ACTIVE` status with minimum-field selects; add regression tests proving caller-selected actor IDs, inactive memberships, and other-tenant memberships cannot create authority, then run `npm run test`.
- [x] 3.3 Add server application-boundary helpers for authenticated tenant membership and explicit permissions with stable generic failures; test denial occurs before a protected repository callback executes using `npm run test`.

## 4. Proxy session refresh

- [x] 4.1 Add a request-bound Supabase cookie-refresh helper that copies rotated cookies to downstream request and browser response and applies private/no-store cache headers; cover refresh success, no session, failure, and missing optional configuration with `npm run test`.
- [x] 4.2 Compose the helper into the existing single `proxy.ts` without weakening hostname normalization or trusted-header overwrite behavior; add regression tests for spoofed tenant headers plus simultaneous cookie rotation and run `npm run test`, `npm run lint`, and `npm run typecheck`.

## 5. Minimal executable staff flow

- [x] 5.1 Add an accessible tenant-host staff sign-in page and validated server action with generic credential failures, pending/error feedback, and safe redirect handling; verify component/action behavior with focused tests and `npm run typecheck`.
- [x] 5.2 Add the provider code-exchange callback Route Handler with validated query input, safe local redirects, private/no-store responses, and generic failures; verify success, invalid code, missing code, and open-redirect cases with focused tests.
- [x] 5.3 Add a sign-out server action that invalidates the provider session, clears applicable cookies through the provider client, and redirects safely; verify authenticated, already-signed-out, and provider-failure behavior with focused tests.
- [x] 5.4 Add a minimal protected `/staff` Server Component boundary that requires a verified subject and active same-tenant membership but exposes no planned PMS data; add browser coverage for unauthenticated redirect and generic no-membership denial, then run the relevant `npm run test:e2e` project/spec.

## 6. Disposable PostgreSQL integration suite

- [x] 6.1 Add a separate Vitest integration configuration and `npm run test:integration` command whose preflight requires a PostgreSQL `TEST_DATABASE_URL`, rejects the normal `DATABASE_URL` and non-test database names, and fails rather than silently skipping; unit-test the preflight with `npm run test`.
- [x] 6.2 Configure CI with a disposable PostgreSQL service and explicit migration-plus-integration-test step while preserving existing user-owned workflow changes; validate the workflow syntax and run `npm run prisma:validate` locally.
- [x] 6.3 Add integration setup that applies committed migrations only to the validated disposable target and cleans only exact test-owned records/namespaces; verify a fresh database reaches the expected schema with `npm run test:integration` where PostgreSQL is available.
- [x] 6.4 Add PostgreSQL tests for tenant creation, tenant role provisioning, migration-only partial uniqueness, active membership resolution, inactive/absent membership denial, and cross-tenant isolation; run `npm run test:integration` and record the actual environment/result.
- [x] 6.5 If integration tests expose a real schema constraint defect, pause implementation, update the OpenSpec artifacts as needed, and add only a reviewed forward Prisma migration; verify its SQL, `npm run prisma:validate`, and the complete integration suite without editing the existing migration.

Integration evidence (2026-08-10): `npm run test:integration` exited 0 against the disposable PostgreSQL 16 database `lelungo_test` in container `lelungo-phase1-postgres-test`; the committed migration had no pending reapplication and 1 file / 9 tests passed. No schema-constraint defect was exposed, so task 6.5 did not trigger a migration change. The local runtime was Node.js 25.9.0, so the GitHub Actions Node.js 22 run remains CI evidence rather than a local claim.

## 7. Security review, documentation, and verification

- [x] 7.1 Review authentication cookies, response caching, CSRF-relevant mutations, redirect validation, tenant-header trust, error/log redaction, minimum selects, and authorization placement; add regression tests for every corrected finding and run the relevant unit/integration/E2E gates.
- [x] 7.2 Update `.env.example`, current-system architecture/data-flow/integration/environment documents, the testing/local-development runbooks, and `docs/runbooks/session-handoff.md` to distinguish implemented authentication from deferred identity/PMS behavior.
- [x] 7.3 Create `verification.md` for this change and record exact commands, exit codes, skips/blockers, migration impact, rollback notes, and unresolved risks; do not mark unavailable PostgreSQL or external-provider checks as passed.
- [x] 7.4 Run final gates: `npm run format:check`, `npm run prisma:validate`, `npm run spec:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, relevant `npm run test:e2e`, `npm run build`, and the repository's configured dependency security check; record actual results in `verification.md` and the session handoff.
