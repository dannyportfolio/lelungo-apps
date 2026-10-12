# Lelungo engineering instructions

## Purpose and direction

Lelungo is transitioning from a travel-deal prototype into a production-grade, multi-tenant Property Management System for small and medium accommodation operators. The repository is the source of truth. Do not rely on chat history or undocumented assumptions.

The current product is still a Next.js affiliate-deal prototype. The approved target is a modular monolith. The only implemented PMS foundation is tenancy, tenant resolution, tenant-scoped server access, staff membership, and an initial RBAC catalog. Do not describe planned PMS domains as implemented.

## Required workflow

1. Read `docs/current-system/`, `docs/target-system/`, relevant ADRs, and existing module patterns.
2. For a material change, create an OpenSpec change with proposal, tasks, design when needed, specs, and verification.
3. Make the smallest safe change. Keep business logic out of UI components and route handlers.
4. Validate external input, authenticate, authorize, resolve tenant context, then call an application/domain service.
5. Run the verification commands and record actual results. Never claim a check passed if it was not run.
6. Update architecture documentation and `docs/runbooks/session-handoff.md` when decisions or system behavior change.

## Stack and repository shape

- Runtime: Node.js 22 or newer; CI uses Node.js 22.
- Package manager: npm only. Never introduce pnpm, Yarn, or Bun.
- Application: Next.js App Router, React, strict TypeScript, Tailwind CSS.
- Database target: PostgreSQL through Prisma. Legacy click analytics can still use Supabase.
- `src/app`: transport, routes, layouts, and composition.
- `src/modules`: domain/application boundaries.
- `src/shared`: cross-cutting infrastructure with no domain ownership.
- `prisma`: schema and append-only migrations.
- `tests/unit` and `tests/e2e`: risk-based automated checks.

## Commands

```text
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run prisma:validate
npm run spec:validate
npm run format:check
```

Use `npm ci` in CI. See `docs/runbooks/` for environment, migration, testing, deployment, and rollback procedures.

## Architecture and dependency rules

- Prefer a modular monolith. Do not introduce microservices without an accepted ADR.
- Dependency direction is `app -> module application/domain -> shared/infrastructure`.
- A module must not reach into another module's internals. Expose intentional public services/types.
- Server-only code must use `server-only` when accidental client import would expose credentials or privileged access.
- Every tenant-owned query and mutation must take trusted server-resolved tenant context. Never accept a client-supplied tenant ID as authority.
- The proxy may normalize a host into a tenant subdomain, but database resolution and authorization remain server responsibilities.
- Select only required database fields. Avoid N+1 queries and unbounded lists.

## Security guardrails

- Never expose or commit secrets. Only document variable names and purpose.
- Never bypass authentication or authorization, including in tests or temporary routes.
- Validate every external input at the system boundary with a schema.
- Do not expose sensitive guest, payment, identity, staff, or property data.
- Do not trust forwarding or tenant headers unless they were overwritten by trusted application infrastructure.
- Do not log credentials, tokens, full request bodies, or sensitive personal data.
- Use generic client errors and structured, sanitized server diagnostics.
- Keep service-role credentials server-only. `NEXT_PUBLIC_*` values are public by definition.
- Treat redirects, uploads, webhooks, cookies, CORS, and direct-object access as explicit security boundaries.

## Database and migration policy

- Never edit a migration that may have run outside a disposable local database. Add a forward migration.
- Make additive changes first; backfill and verify before enforcing non-null constraints or deleting legacy data.
- All tenant-owned tables require an explicit tenant key and tenant-scoped access path.
- Never run production migrations automatically from a developer machine or preview deployment.
- Validate schema and generated client before merge. Migration rollback is normally a forward-fix migration.

## Code and testing conventions

- Use descriptive kebab-case file names and PascalCase React component names.
- Keep strict TypeScript. Do not use `any` unless a narrow, documented integration boundary makes it unavoidable.
- Prefer named domain types, explicit return types at module boundaries, and small pure functions.
- Test authorization, tenant isolation, validation, database boundaries, and critical business rules first.
- A bug fix requires a regression test when practical.
- Avoid coverage targets that reward low-value tests; use risk-based coverage.

## Environment policy

- `.env.example` is the inventory template and contains no real credentials.
- Local secrets belong in ignored `.env.local`; CI and deployments use their secret stores.
- Startup paths that require configuration should fail clearly. Optional integrations must degrade explicitly and safely.
- Never put a server secret in `NEXT_PUBLIC_*`.

## Agent and tooling policy

- OpenCode is the primary daily runtime; other agents must follow this file and OpenSpec.
- Model providers are routed externally. Do not hardcode provider secrets or make a particular commercial/local model mandatory.
- MCP is disabled by default and enabled per task under `docs/agentic/mcp-policy.md`.
- Qdrant is not a transactional PMS database. Langfuse is only for AI execution telemetry, not normal application requests.
- Generated agent instruction files may be refreshed with OpenSpec, but project-owned documentation must remain human-readable.

## Definition of done

- Scope and non-goals are explicit.
- Authentication, authorization, tenancy, validation, and data exposure were reviewed where relevant.
- Migration and rollback impacts are documented.
- Lint, typecheck, relevant tests, and build were run, or the exact blocker is recorded.
- Documentation and session handoff reflect the resulting system.
- No unrelated feature, dependency, or infrastructure was introduced.

## Forbidden actions

- No broad rewrite, speculative abstraction, premature microservice, or unapproved PMS feature.
- No destructive database action, production migration, secret rotation, deployment, or external write without explicit authorization.
- No weakening lint, types, tests, authentication, or authorization to make a check pass.
- No modification of user-owned unrelated work.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
