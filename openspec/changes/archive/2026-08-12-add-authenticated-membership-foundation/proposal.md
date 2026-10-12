## Why

Lelungo can resolve a tenant and model staff permissions, but it cannot yet prove who is making a request. This leaves every future protected PMS feature blocked and prevents the repository from demonstrating the required authentication, membership, and tenant-isolation boundary against PostgreSQL.

## Context

The implemented foundation consists of wildcard-subdomain tenant resolution, tenant-scoped request context, external user UUIDs on `StaffMembership`, an initial role/permission catalog, and pure authorization checks. Supabase browser/server clients are present for legacy integration work, but Supabase Auth is not currently integrated and a membership must not be treated as authentication. The initial Prisma migration has not been exercised by an automated disposable-PostgreSQL suite.

## Goals

- Establish a provider-neutral server authentication contract with a Supabase Auth adapter that returns only a verified external subject.
- Resolve the verified subject to an active membership for the server-resolved tenant and deny protected operations by default when authentication, membership, tenant scope, or permission is missing.
- Provide a minimal staff sign-in, sign-out, callback/session-refresh path, and protected staff landing boundary so the authentication chain is executable without introducing PMS business screens.
- Add an isolated PostgreSQL integration-test harness covering migration viability, membership resolution, role provisioning, and cross-tenant denial.
- Keep authorization inside server data-access/application boundaries; proxy checks remain session-refresh or optimistic-routing helpers only.

## Non-goals

- Public self-registration, social login, MFA, account recovery, staff invitations, or an identity-provider migration framework.
- Property, room, inventory, reservation, payment, audit-log, or other planned PMS domain implementation.
- A broad staff dashboard redesign, platform impersonation, custom roles, or production deployment/migration execution.
- Replacing Prisma/PostgreSQL with Supabase Data API or merging legacy click analytics into the PMS transaction store.

## What Changes

- Add a server-only authenticated-subject port in the identity module and a Supabase implementation that verifies the request session instead of trusting client claims or `getSession()` user data.
- Upgrade the beta Supabase SSR helper from the repository's old `0.5.x` line to a reviewed compatible release so token refresh can propagate cookies and private/no-store response headers correctly.
- Compose the single Next.js `proxy.ts` so it preserves trusted tenant-subdomain normalization while refreshing authentication cookies; authoritative authentication and authorization remain in the server data-access layer.
- Change protected request-context construction to obtain the actor from the authentication adapter, then resolve only an active membership matching the trusted tenant.
- Add stable unauthenticated and unauthorized failures, a minimal login/logout/callback flow, and a protected staff landing boundary with safe redirects.
- Add disposable PostgreSQL integration-test setup and tests for schema migration, idempotent role provisioning, authenticated membership resolution, inactive/missing membership denial, and cross-tenant isolation.
- Update environment inventory, current-system documentation, testing runbook, and session handoff with actual behavior and verification results during implementation.

## Capabilities

### New Capabilities

- `staff-authentication`: Verified external staff identity, secure session lifecycle, and server-side protection of staff request boundaries.

### Modified Capabilities

- `staff-authorization`: Require protected tenant operations to compose verified authentication, trusted tenant resolution, active same-tenant membership, and explicit permission checks.

## Impact

- **Code:** `src/modules/identity`, `src/modules/tenancy`, `src/lib/supabase`, the root `proxy.ts`, minimal App Router authentication/staff routes, and focused unit/integration tests.
- **Database:** No new business tables are expected. Tests apply existing append-only migrations only to an explicitly disposable PostgreSQL database; implementation may add a forward constraint migration only if the tests expose a real schema defect.
- **Dependencies:** `@supabase/ssr` is expected to move to a current compatible release; no second authentication provider is introduced.
- **Configuration:** Existing Supabase URL/public-key variables become required for the authentication paths. A clearly named test-only PostgreSQL URL may be added; secrets and values remain outside tracked files.
- **APIs/UX:** Adds minimal authentication routes and a protected staff entry point. Existing public travel-deal and click-tracking flows remain available and unchanged.

## Risks

- Incorrect cookie propagation or caching could leak or stale sessions across requests; authenticated responses must be private/no-store and tested against the installed SSR helper behavior.
- Combining auth refresh with existing tenant header normalization could regress wildcard-host resolution; composition tests must preserve both behaviors.
- A valid external user with a missing, inactive, or different-tenant membership could be accidentally authorized; deny-by-default integration tests are mandatory.
- Test configuration could target a non-disposable database; the harness must fail closed unless the URL is explicitly designated for tests and must never run production migrations automatically.
- Upgrading a beta SSR package can contain breaking API changes; review the lockfile and official migration behavior, then verify all session paths.

## Migration impact

The expected production data migration impact is none because external user UUIDs and membership relationships already exist. The integration harness will create and destroy only a dedicated disposable database or schema. If implementation discovers that an existing constraint is insufficient, the correction must be a new forward Prisma migration with reviewed SQL and documented rollout/rollback behavior.

## Rollback

Revert the authentication route/proxy composition and restore the prior compatible Supabase SSR dependency and lockfile. Because no destructive production data change is planned, application rollback should be sufficient; any new additive constraint migration would remain immutable and require a separately reviewed forward fix rather than editing or blindly reversing an applied migration. Existing public prototype routes and tenancy schema remain intact.
