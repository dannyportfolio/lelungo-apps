# Integrations inventory

| Integration | Current use | Boundary | Status |
| --- | --- | --- | --- |
| Supabase | Browser/server helpers and legacy click inserts | `src/lib/supabase` | Optional, partial |
| PostgreSQL | Target transactional data through Prisma | `prisma`, `src/shared/database` | Schema only; no deployed DB verified |
| Traveloka-style affiliate API | Deal request helper | `src/lib/api/traveloka.ts` | Optional; credentials not verified |
| Vercel | Metadata URL environment conventions; compatible deployment | Next.js | Deployment not verified |
| OpenCode/OpenSpec | Agent runtime and spec workflow | repository tooling | Configured locally |
| 9Router/OpenRouter/local inference | Optional external model routing | agent tooling only | Documented, not required or verified |

No payment, email, WhatsApp, storage, webhook, analytics platform, background worker, or scheduled-job integration is implemented. Supabase is not authentication in the current application merely because auth-capable SDKs are installed.
