# Verification record — authenticated membership foundation

Date: 2026-08-11  
Workspace: `C:\Users\Lenovo X13\Documents\lelungo-apps`  
Scope: OpenSpec change `add-authenticated-membership-foundation`

## Delivered boundary

- Supabase Auth establishes only a provider-verified UUID subject. Provider users, tokens, cookie values, and diagnostics do not enter tenancy/domain types.
- The request-context boundary derives the actor internally and resolves the Proxy-normalized host. A separate protected helper requires an `ACTIVE` same-tenant membership, and explicit permission helpers gate operations that require a permission before repository work.
- The single Next.js Proxy overwrites/removes the tenant header, performs optimistic cookie refresh, copies rotations downstream and to the browser, and applies private/no-store headers.
- Minimal staff sign-in, code-exchange callback, sign-out, and protected `/staff` landing routes are implemented. No Property or operational PMS model/UI was added.
- Existing migrations were exercised only against disposable PostgreSQL. No Prisma schema or migration changed.

## Runtime and dependency evidence

| Check                                        | Exit | Actual result / limitation                                                                                                                    |
| -------------------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --version`                             |    0 | Local Node `v25.9.0`; repository requires Node 22+, while CI is configured for Node 22.                                                       |
| `npm ls @supabase/ssr @supabase/supabase-js` |    0 | Resolved `@supabase/ssr@0.12.4` and `@supabase/supabase-js@2.112.2`.                                                                          |
| Lockfile review                              |    0 | Package/lock changes are limited to the intentional Supabase upgrade and its resolved transitive versions; no second auth provider was added. |

## Focused automated evidence

| Check                                                                                                              | Exit | Actual result / limitation                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity unit tests                                                                                                |    0 | 3 files / 40 tests passed: configuration, safe redirects, verified/absent/invalid/malformed/provider-failure subjects.                                                                                                                                                                                                                                                                                                                                                                           |
| Tenancy unit tests                                                                                                 |    0 | 22 focused tests passed: internal actor acquisition, active same-tenant membership, status/scope denial, permission gating before callback.                                                                                                                                                                                                                                                                                                                                                      |
| `node ./node_modules/vitest/vitest.mjs run --configLoader runner`                                                  |    0 | Latest database-free suite: 14 files / 103 tests passed. This includes 7 Proxy tests, 13 staff action/callback tests, 3 sign-in component tests, explicit cookie-policy tests, and an actual SSR cookie-removal boundary test. The runner loader avoids the sandbox-only esbuild parent-directory denial without changing the committed npm script.                                                                                                                                              |
| Focused Proxy/session tests                                                                                        |    0 | Configured/no-session, refresh rotation, downstream/browser cookies, private/no-store caching, missing config, provider failure, explicit HttpOnly/SameSite/Secure policy, spoofed tenant header, and simultaneous rotation are covered.                                                                                                                                                                                                                                                         |
| Focused staff flow/component/sign-out tests                                                                        |    0 | Pending/error/accessibility feedback, safe redirects, validated concurrent `sb_flow_id`, generic provider failures, authenticated sign-out, provider-revocation failure with local fallback, already-signed-out idempotence, and cookie removal propagation are covered.                                                                                                                                                                                                                         |
| `npm run test:integration`                                                                                         |    0 | Disposable PostgreSQL 16 database `lelungo_test`: 1 file / 9 tests passed. Existing migration applied; tenant/role provisioning, three partial indexes, active/inactive/absent/cross-tenant behavior verified.                                                                                                                                                                                                                                                                                   |
| Tenant-host Chromium run against the production build on port 3101 with a validated disposable `TEST_DATABASE_URL` |  124 | Both scenarios completed every assertion and the `afterAll` cleanup hook in trace evidence: unauthenticated redirect and verified-user denial on a generated `staff-e2e-*.localhost` tenant with no membership, without UUID/email disclosure. The outer command timed out after 181 seconds while Playwright tore down its managed Windows webServer, so the command is not reported as a pass. An earlier attempt with invalid local test credentials failed closed before browser assertions. |

The Playwright application boundary used a deterministic local Supabase Auth contract fixture and one exact test-owned tenant/domain record that was removed by `afterAll`. It does not prove live Supabase availability, production cookie/domain attributes, DNS/TLS, or a deployed PostgreSQL database.

## Acceptance closure and manual security review

All five previously open implementation tasks now have direct evidence:

- Proxy configured/no-session behavior is covered and remains private/no-store.
- Sign-in pending, field-error, and accessibility states have focused component tests.
- Sign-out distinguishes provider revocation from local cleanup, is idempotent when already signed out, and propagates actual SSR cookie removal.
- Tenant-host browser assertions traverse a generated disposable tenant/domain with a verified user and no membership; only the managed server teardown lacks a clean process exit.
- The eight-category task 7.1 manual review covered authentication cookies, response caching, CSRF-relevant mutations, redirects, tenant-header trust, error/log redaction, minimum selects, and authorization placement. It corrected explicit cookie flags, concurrent PKCE `sb_flow_id` binding, and provider-error local sign-out fallback, each with regression tests.

The manual review is not a replacement for the formal scanner workflow below, and the E2E trace evidence is not misreported as an exit-0 command.

## Formal security workflow

The `codex-security:security-diff-scan` configuration preflight ran with native multi-agent v2 runtime facts, a four-thread session cap, goal/delegation availability, and all available Codex Security skills. The standard `python` command was unavailable; the Android NDK-bundled Python 3.11.4 interpreter then ran the same helper successfully.

- Preflight exit: `0`
- Preflight status: `ready`
- Failed/unmet/unknown capabilities: none
- Suggested `features.goals=true` remediation: not required because the documented default already satisfied the capability

The Codex Security MCP launcher then failed before returning a `scanId`:

```text
Codex Security could not start its Python 3 helper. Reinstall or update Codex to restore its bundled Python runtime, or set the PYTHON environment variable to a working Python 3 executable, then restart Codex.
```

Per the security skill, no replacement scan or clean result was invented. A formal diff security result remains blocked until Codex is restarted with a valid `PYTHON` environment visible to the MCP runtime.

## Final repository gates

Final commands and exact outcomes are recorded here after the last documentation/code pass. A failed environmental attempt is not converted into a pass by inference.

| Command                                                           | Exit | Actual result / limitation                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                            |    0 | Repository-configured Prettier paths matched. New App Router/E2E files were also written and checked directly with installed Prettier.                                                                                                          |
| `git diff --check -- . ':(exclude)src/components/FilterBar.tsx'`  |    0 | The Phase 1/other repository diff had no whitespace errors. Full `git diff --check` exited 1 only for pre-existing user-owned trailing whitespace in `src/components/FilterBar.tsx:21`; that unrelated file was preserved.                      |
| `npm run prisma:validate`                                         |    0 | Prisma schema valid with a process-local non-production placeholder URL; no connection or mutation occurred.                                                                                                                                    |
| `npm run spec:validate`                                           |    0 | OpenSpec reported 5 passed, 0 failed.                                                                                                                                                                                                           |
| `npm run lint`                                                    |    0 | ESLint completed with no diagnostics.                                                                                                                                                                                                           |
| `npm run typecheck`                                               |    0 | Next route type generation and strict `tsc --noEmit` passed.                                                                                                                                                                                    |
| `npm run test`                                                    |    1 | The canonical sandbox rerun stopped before collection because the default esbuild config loader could not read the parent directory/config. This environmental failure is retained rather than converted into a pass.                           |
| `node ./node_modules/vitest/vitest.mjs run --configLoader runner` |    0 | The same committed Vitest configuration executed with Vitest's runner loader: 14 files / 103 tests passed after all acceptance and security fixes.                                                                                              |
| `npm run test:integration`                                        |    1 | Final sandbox rerun hit the same esbuild config-resolution denial before database access. The earlier approved disposable-PostgreSQL run passed 9/9 as recorded above.                                                                          |
| relevant `npm run test:e2e`                                       |  124 | The final tenant-host trace shows both tests and `afterAll` completed without an assertion error; the outer Windows process timed out during managed webServer teardown. Exit 124 is retained and is not described as an exit-0 Playwright run. |
| `npm run build`                                                   |    0 | Next.js 16.3.0 production build passed, including TypeScript and nine generated pages/routes; `/auth/callback`, `/staff`, and `/staff/sign-in` are dynamic as intended.                                                                         |
| `npm audit --audit-level=critical`                                |    1 | Registry endpoint was unavailable in the sandbox; no online result was inferred.                                                                                                                                                                |
| `npm audit --audit-level=critical --offline`                      |    0 | Local cache reported zero vulnerabilities. This is time-sensitive cached evidence, not a current registry or formal security result.                                                                                                            |

## Migration and rollback

- Production migration impact: none. No Prisma schema or migration was edited or added.
- Test migration impact: the committed tenancy migration was applied only to disposable PostgreSQL 16.
- Repository rollback: revert the staff routes, identity/tenancy composition, Proxy auth helper, Supabase dependency/lock changes, CI PostgreSQL service, Vitest/Playwright harnesses, environment template, and Phase 1 documentation together.
- Database rollback: none for this change. Never edit the existing migration; any future deployed correction remains a reviewed forward migration.
- Operational cleanup: stop the disposable `lelungo-phase1-postgres-test` container when no longer needed. A timed-out diagnostic left a repository Next dev server on local port 3000; re-verify its exact repository-owned PID/command before stopping it in a later session.

## Unresolved evidence and release boundary

- Formal Codex Security diff scan is blocked at launcher startup as recorded above.
- Live provider sign-in/callback/sign-out, production cookie/domain behavior, and external-provider E2E are unverified.
- CI Node 22/PostgreSQL service configuration is authored but has not run in GitHub Actions from this workspace.
- Staging/production database, deployment, wildcard DNS/TLS, backup/restore, and rollback drills are unverified.
- Public registration, invitation, MFA, recovery, and tenant selection remain deferred. Property is authorized only as the next separately specified Phase 2 change; all later operational PMS domains remain deferred.
