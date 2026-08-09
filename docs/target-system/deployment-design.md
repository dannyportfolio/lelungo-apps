# Deployment design

Pull requests run deterministic install, Prisma validation/generation, lint, typecheck, unit tests, build, and critical dependency audit. Browser tests run separately. Preview environments use isolated credentials and never share production data.

Production promotion from `main` requires the same gates, migration review, backup confirmation, a backward-compatible deploy order, smoke tests, and monitoring. Database migrations are a controlled release step, not an automatic side effect of the web build. Roll back application artifacts first when compatible; repair data/schema with reviewed forward migrations.
