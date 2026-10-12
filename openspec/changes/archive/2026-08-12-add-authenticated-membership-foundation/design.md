## Context

See `proposal.md` for motivation and scope. The current request path accepts an `ActorContext` from its caller, resolves a normalized tenant header through Prisma, and attaches an active membership when the supplied user UUID matches. That pure composition is testable but is not an authoritative request authentication boundary.

Supabase SSR clients and cookie-based helpers already exist, but they are used as infrastructure utilities rather than a defined identity adapter. The repository currently installs `@supabase/ssr` 0.5.2 while the package's current session-refresh contract has evolved. Next.js 16 supports a single root `proxy.ts`; its own guidance limits Proxy to optimistic checks and requires authorization near data access. Server Components can read but cannot reliably write refreshed cookies.

PostgreSQL is the transactional authority. Docker was initially unavailable during planning, so integration tests require an explicit disposable database contract that CI and suitably configured developer environments can satisfy without making ordinary unit tests destructive. During implementation, Docker Desktop became reachable and supplied the disposable PostgreSQL 16 evidence recorded below.

## Goals / Non-Goals

**Goals:**

- Make the only production request path from external identity to tenant permissions explicit, server-only, injectable in tests, and deny-by-default.
- Preserve the existing normalized-host tenant authority while composing cookie refresh into the single Next.js Proxy.
- Keep provider SDK objects, tokens, email addresses, and cookie contents outside domain types, logs, and membership queries.
- Make PostgreSQL boundary tests independently runnable and impossible to point casually at a normal application database.

**Non-Goals:**

- Generalize every provider operation behind a large identity framework; only the verified-subject port crosses into domain/application code.
- Store an additional user profile or copy provider session state into Prisma.
- Treat Proxy redirects as authorization, authorize by role name, or add permissions to UI components.
- Make PostgreSQL integration tests part of the fast unit-test command when no disposable database is configured.

## Decisions

### 1. Use a narrow authenticated-subject port with a Supabase adapter

`src/modules/identity` will own a server-only port that returns either `{ userId: string }` or no authenticated subject. The Supabase adapter will create the request-bound server client and call the provider operation that returns a current, verified user record. It will validate the returned identifier as a UUID before exposing it to application code. Provider user objects, claims, access tokens, refresh tokens, and errors terminate inside the adapter.

For the authoritative data-access check, the adapter will use `auth.getUser()` rather than trusting `auth.getSession()` data. The current provider documentation defines `getUser()` as a server round trip that returns an authentic current user, while session data loaded directly from cookies is not sufficient authorization evidence. Proxy may use the provider's verified-claims operation for efficient refresh because the data-access layer will still perform the authoritative subject check.

**Alternatives considered:**

- Adopt Clerk, Auth0, or another provider now. Rejected because Supabase dependencies, cookie helpers, and UUID-shaped membership references already exist; a second provider would expand configuration and operational scope without a demonstrated need.
- Import Supabase directly in tenancy and every route. Rejected because it couples domain behavior to a provider and makes negative-path tests difficult.
- Decode the JWT locally or trust `getSession()`. Rejected because client-controlled cookie contents must not become authorization authority.

### 2. Build request context from authentication, never from a caller-selected actor

The public server request entry will obtain the authenticated subject from the identity port before loading membership. It will then read the trusted normalized tenant subdomain, resolve the active tenant, and query `StaffMembership` by both verified `userId` and resolved `tenantId` with `status = ACTIVE`. Permission keys are selected explicitly.

The pure context composer may accept an injected subject and repository for unit tests, but it will be named and documented as an internal/testable composition seam rather than an alternative request authority. Protected application services will use helpers that distinguish:

1. unauthenticated (no verified subject),
2. not tenant-scoped (no resolved tenant),
3. unauthorized (missing/inactive/mismatched membership or permission).

Client responses remain generic. Authorization is checked before tenant-owned business records are read or mutated. Tenant-owned modules continue to receive `RequestTenantContext`; they do not receive raw auth tokens or provider clients.

**Dependency direction:** App Router transport -> identity/tenancy application boundary -> module service/domain -> Prisma infrastructure. Identity exposes the subject contract; tenancy may depend on that public identity contract. Shared database and Supabase adapters import no PMS domain internals.

**Alternatives considered:**

- Keep accepting `ActorContext` in production request entry points. Rejected because a future route could accidentally pass form/header data as authority.
- Put membership and permission claims into the provider token. Rejected because membership lifecycle and tenant roles are PostgreSQL-owned and must reflect suspension/revocation without token-claim drift.

### 3. Compose session refresh and tenant normalization in the single Proxy

The root `proxy.ts` remains the only Proxy. It will first normalize the actual hostname into a fresh request header, deleting any incoming spoofed tenant header as it does today. A small Supabase request adapter will then refresh an existing cookie session and copy rotated cookies to both the downstream request and browser response. Any response that reads or mutates authentication state receives private/no-store cache headers.

Missing optional Supabase configuration will continue to allow unrelated public prototype routes to render, but authentication and protected staff paths will fail closed with sanitized errors. A successful Proxy refresh is never treated as permission evidence; protected pages and services call the authoritative identity/context boundary again.

`@supabase/ssr` will be upgraded from the old 0.5.x range to a reviewed compatible current release because newer cookie callbacks propagate cache headers required to prevent shared-cache session leakage. The implementation will follow the installed release's types rather than copying examples for a different version.

**Alternatives considered:**

- Perform all session refresh in Server Components. Rejected because Server Components cannot reliably write response cookies.
- Query Prisma or make final authorization decisions in Proxy. Rejected because Next.js explicitly discourages slow data access and full authorization in Proxy, and it would duplicate the data-access boundary.
- Run a second middleware/proxy file. Rejected because Next.js 16 supports one Proxy entry.

### 4. Implement minimal host-local staff authentication flows

The implementation will add a compact accessible sign-in page backed by a server action, a callback route for provider flows that exchange a code, a sign-out server action, and a protected `/staff` landing route. Zod validates external form/query input. Credential failures return one generic message; provider diagnostics are sanitized and contain no credentials, tokens, full email values, or cookie data.

Post-authentication redirects pass through one allowlist helper that accepts only local absolute-path destinations under the staff application. Authentication never creates, activates, or selects a membership. Users sign in on the tenant host they intend to access; a valid identity without an active same-tenant membership receives a generic denial.

The protected landing route proves the authentication-plus-membership boundary but exposes no planned PMS data. Later Property and other module services must add their own explicit permission checks.

**Alternatives considered:**

- Add public sign-up and automatic owner provisioning. Rejected because tenancy creation is a privileged application workflow and automatic membership creation would weaken authorization.
- Build the entire PMS shell now. Rejected because the repository roadmap requires authentication and isolation evidence before Property/UI expansion.

### 5. Keep PostgreSQL integration tests explicit, disposable, and separate

A dedicated integration Vitest configuration and `npm run test:integration` command will require `TEST_DATABASE_URL`. A preflight will parse the URL, require PostgreSQL, require an explicitly test-designated database name, reject URLs matching the normal `DATABASE_URL`, and stop before any migration or cleanup if validation fails. The test process maps the validated value to Prisma's `DATABASE_URL` only for its child commands/client.

CI will provide a disposable PostgreSQL service database and run append-only Prisma migrations before the integration suite. Local developers may point the same command at a disposable local/ephemeral database. Ordinary `npm run test` remains database-free. Cleanup targets only records or an exact test namespace created by the suite; it never drops an unresolved database, broad schema, or production resource.

Tests will cover:

- all committed migrations apply to an empty PostgreSQL database;
- tenant creation and initial role provisioning are idempotent where the service promises idempotency;
- a verified user resolves only the active membership for the trusted tenant;
- invited, suspended, revoked, absent, and other-tenant memberships deny access;
- explicit permission checks deny before a tenant-owned repository call;
- duplicate/partial-unique constraints represented only in migration SQL behave as documented.

**Alternatives considered:**

- Use SQLite or mocks for repository tests. Rejected because PostgreSQL UUIDs, partial indexes, enum behavior, and transaction semantics are part of the boundary.
- Run `prisma migrate reset --force` against the developer's normal `DATABASE_URL`. Rejected because the target could be misconfigured and destructive.
- Add Testcontainers as the only path. Deferred because Docker is not reachable on the current workstation; an explicit URL also works with CI service containers and managed ephemeral databases without another runtime dependency.

### 6. Avoid a production schema change unless testing proves one is required

Authentication subjects continue to map to `StaffMembership.userId`; no user table or provider-token table is added. Existing migrations remain immutable. If PostgreSQL tests reveal a constraint defect, implementation pauses to add a forward migration and update this change's artifacts if the behavior or task breakdown changes materially.

Data ownership remains:

- external provider: identity proof and session lifecycle;
- identity module/PostgreSQL: membership, role, and permission assignment;
- tenancy module/PostgreSQL: tenant/domain resolution;
- Proxy: normalized transport hints and refreshed cookies, never authority.

## Risks / Trade-offs

- **[Provider verification adds a network call on protected requests]** -> Prefer correctness for this foundation, keep the port narrow, and measure before considering verified-claims caching.
- **[Supabase SSR is still a beta API and the repository is several minor lines behind]** -> Upgrade in one isolated task, review API/lockfile changes, and add cookie/cache-header regression tests.
- **[Auth refresh and tenant-header composition can accidentally lose one another's request mutations]** -> Build one response-composition helper and test both concerns on the same request.
- **[Generic errors reduce support detail]** -> Return stable client categories while logging only sanitized correlation IDs and provider error classes server-side.
- **[A developer may lack disposable PostgreSQL]** -> Keep integration tests explicit, provide CI evidence, and report a local environmental blocker exactly; never silently skip and claim coverage.
- **[Host-local cookies complicate moving between root and tenant subdomains]** -> Keep this increment tenant-host-local; cross-subdomain account/property selection requires a separate security design.
- **[The staff landing has intentionally little product value]** -> Treat it only as an executable security seam and proceed to Property after this change verifies successfully.

## Migration Plan

1. Upgrade and adapt the Supabase SSR utilities, then run unit/type/build checks before changing protected request behavior.
2. Add the identity port and Supabase adapter with unit tests for verified, invalid, malformed, and provider-failure outcomes.
3. Refactor request tenant context to consume the verified subject and add PostgreSQL membership/isolation tests.
4. Compose Proxy cookie refresh with existing tenant normalization and verify spoofed headers, cookie propagation, cache headers, and public-route degradation.
5. Add sign-in/callback/sign-out and the protected staff landing behind the new server boundary.
6. Add the CI disposable PostgreSQL service and run migrations plus integration tests before the existing static, unit, and build gates.
7. Update current-system docs, environment/testing runbooks, and session handoff with actual results. No production migration or deployment is executed from this change.

Rollback restores the previous application artifact and compatible Supabase SSR dependency. Because no schema change is planned, membership data remains usable. If a forward constraint migration is added and has been applied outside a disposable environment, it is not edited or reversed blindly; deploy a compatible application rollback and handle schema correction through a reviewed forward migration.

## Implementation evidence and deviations (2026-08-10)

- The reviewed installed auth packages are `@supabase/ssr` 0.12.4 and peer-aligned `@supabase/supabase-js` 2.112.2. Proxy cookie handling follows the installed `setAll(cookies, responseHeaders)` contract and copies provider cache headers before enforcing private/no-store.
- A disposable local PostgreSQL 16 database became available. The existing committed migration and nine integration scenarios passed; no schema defect was exposed, so no Prisma schema or migration was changed.
- Browser coverage uses a deterministic local Supabase Auth contract fixture by default and can target an external test provider through explicit E2E variables. This proves the application boundary but is not live-provider or production-cookie evidence.
- The manual eight-category security review made the cookie policy explicit (`HttpOnly`, host-only, `SameSite=Lax`, and `Secure` in production), bound concurrent PKCE callbacks through validated `sb_flow_id`, and added local-session fallback when provider sign-out revocation fails. Regression tests cover each correction.
- The final tenant-host browser fixture creates and removes one exact tenant/domain in the validated disposable database and deliberately creates no membership. Both browser scenarios completed every assertion and the fixture cleanup hook; the Windows Playwright command later timed out while tearing down its managed application server, so the command itself is recorded as exit 124 rather than a pass.
- The formal Codex Security diff-scan preflight passed, but its MCP launcher failed before creating a scan because the runtime could not start its Python 3 helper. No formal clean security result is claimed.
