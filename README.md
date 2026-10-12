# Lelungo

Lelungo is being prepared as a multi-tenant Property Management System for homestays, villas, guest houses, and small-to-medium lodging operators. The current UI remains a legacy travel-deal prototype; PMS development has not started beyond the tenancy and staff-authorization foundation.

## Local setup

Requirements: Node.js 22+, npm, and PostgreSQL when exercising Prisma-backed flows.

```bash
npm install
copy .env.example .env.local
npm run prisma:generate
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Start with [AGENTS.md](AGENTS.md), `docs/current-system/`, `docs/target-system/`, and `openspec/`. Operational procedures are in `docs/runbooks/`.

No real credentials belong in the repository. The project uses npm only.
