# Baseline health report

Baseline captured on 2026-08-08 before final foundation verification.

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | 520 packages before agent-tool additions |
| `npm run lint` | PASS | No lint errors |
| `npm run typecheck` | PASS | Next type generation and TypeScript completed |
| `npm run test` | PASS | 2 files, 7 tests at baseline |
| `npm run build` | PASS | Production build generated 8 routes |
| `npm audit` | FAIL | Initially 9 advisories: 1 critical, 6 high, 2 moderate |

`npm audit fix` was run without `--force` and updated the lockfile, including Next.js, Prisma, PostCSS, and Vitest patch versions. Residual audit state and all quality gates are recorded in `docs/foundation/first-step-report.md` after the final run.

Manual review found a public-named affiliate credential, missing click payload validation, an unhandled tracking promise, and privileged modules without an explicit server-only boundary. These were corrected in the foundation batch. Formal automated security scanning was not run because its mandatory Python preflight failed; manual results must not be represented as equivalent coverage.
