# Architecture

- Style: modular monolith in one Next.js deployment.
- Frontend boundary: `src/app` and presentation components; no business ownership.
- Backend boundary: Next.js route/server actions call module application services.
- Database boundary: module repositories use Prisma/PostgreSQL and require trusted tenant context.
- Integration boundary: provider SDKs terminate in adapters.
- Authentication: external identity adapter, not yet implemented.
- Authorization: active membership plus explicit permissions; deny by default.
- Validation: Zod at transport/integration boundaries and domain invariants in services.
- Errors: stable client errors, sanitized structured server diagnostics.
- Logging: structured and redacted; audit records are a separate immutable domain.
- Testing: risk-based unit, PostgreSQL integration, API, component, and browser tests.

See `docs/target-system/` and ADRs for rationale and migration constraints.
