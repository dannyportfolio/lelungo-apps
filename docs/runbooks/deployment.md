# Deployment

GitHub integration currently creates protected Vercel previews in two existing
projects, `lelungo` and legacy-named `lelunngo`. On 2026-10-12, production deployment was
executed to canonical domain owner project `lelunngo` (`dpl_Hz2D19cbHTzduGPkyN9Hv2vb8jWG`)
and successfully aliased to `https://lelungo.com` and `https://www.lelungo.com`.
The duplicate project mapping risk remains until `lelungo` is consolidated.

The release procedure is:

1. Merge only after CI quality gates and review.
2. Build one immutable artifact with scoped environment configuration.
3. Review and separately approve database migration execution.
4. Deploy staging, run smoke/E2E checks, then promote the same artifact.
5. Run production smoke tests that do not mutate real guest/payment data.
6. Monitor errors, latency, database health, and audit events.

Preview environments must never connect to production databases. Production deployment and migration require explicit authorization.
