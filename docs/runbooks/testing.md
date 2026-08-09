# Testing

- Unit: `npm run test` for pure domain rules, parsing, permissions, and validation.
- Integration: disposable PostgreSQL for repositories, constraints, transactions, and tenant isolation. Not configured yet.
- E2E: start/target the application and run `npm run test:e2e`; set `BASE_URL` for a non-default port.
- Static: `npm run lint`, `npm run typecheck`, `npm run prisma:validate`.
- Production compilation: `npm run build`.

Record the exact command, exit code, failures, retries, and skipped layers. Never call a retry-only flaky result unconditionally healthy; retain artifacts and fix synchronization.
