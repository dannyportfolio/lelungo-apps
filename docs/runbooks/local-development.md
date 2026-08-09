# Local development

1. Install Node.js 22+ and npm.
2. Run `npm install`.
3. Copy `.env.example` to ignored `.env.local` and set only required local values.
4. Run `npm run prisma:generate`; a database is optional until Prisma-backed flows execute.
5. Run `npm run dev` and open `http://localhost:3000`.

For local tenant hosts, explicitly enable `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS` and use `<tenant>.localhost`. Do not weaken production host rules. Before handoff run lint, typecheck, relevant tests, and build.
