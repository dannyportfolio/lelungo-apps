# Lelungo foundation first-step report

> Historical snapshot from the Phase 0 foundation checkpoint on 2026-08-08. Statements such as “authentication adapter belum ada” describe that checkpoint, not the current repository. Use `docs/runbooks/session-handoff.md` and the active OpenSpec verification records for current status.

Date: 2026-08-08

## Executive summary

Kondisi awal adalah prototype travel-deal Next.js dengan mock data, Supabase click analytics, dokumentasi PMS yang belum menjadi workflow repository, kualitas CI parsial, dan belum ada auth/tenant/RBAC transactional foundation. Baseline build bekerja, tetapi dependency audit menemukan 9 vulnerability dan beberapa boundary server/input lemah.

Foundation sekarang memiliki peta current/target system, modular-monolith design, infrastructure/security/deployment flows, technical-debt register, AGENTS guardrails, OpenCode config, OpenSpec canonical specs, sembilan ADR, MCP/model-routing policy, CI gates, runbooks, Prisma tenancy/RBAC schema, server-side tenant resolution/scoping, unit tests, dan stable production browser verification. Dependency audit bersih. Prototype lama tetap berfungsi dan belum di-rewrite.

Remaining risk terbesar adalah authentication adapter belum ada, migration belum diuji/applied ke PostgreSQL nyata, tenant isolation belum dapat dibuktikan pada business tables yang belum dibuat, structured observability/audit log belum ada, dan formal Codex security scan terblokir karena Python tidak tersedia.

## Repository and architecture summary

`src/app` tetap menjadi Next.js transport/composition; `src/modules` memiliki tenancy, identity, dan analytics boundary; `src/shared` memiliki Prisma infrastructure; `prisma` berisi additive migration; `openspec`, `docs`, ADR, runbooks, dan `AGENTS.md` menjadi long-term repository memory.

Target architecture adalah modular monolith: CDN/edge -> Next.js UI/API -> validation/authentication/tenant/authorization -> application service -> domain logic -> tenant-scoped Prisma/PostgreSQL -> bounded integration adapters. Microservices, queue, cache, vector database, dan AI observability tidak ditambahkan tanpa kebutuhan terukur.

## Refactor change log

File / Module: tenant and identity foundation  
Masalah: tidak ada tenant entity, host resolution, scoped repository, membership, atau RBAC.  
Perubahan: additive Prisma schema/migration, normalized subdomain parser, trusted tenant context/repository/service, role catalog, permission checks, and tests.  
Alasan: membentuk isolation/authorization boundary pertama.  
Risiko: migration belum dijalankan dan auth subject adapter belum ada.  
Verification: Prisma schema PASS; unit tests PASS.

File / Module: existing server/security boundaries  
Masalah: affiliate secret dinamai public, privileged modules bisa ter-import client, analytics input tidak tervalidasi, tracking promise tidak ditangani.  
Perubahan: server-only env/modules, strict Zod schema with bounds, regression tests, handled fetch rejection.  
Alasan: mencegah credential exposure, malformed payload, dan unhandled rejection.  
Risiko: legacy Supabase analytics tetap non-tenant dan opsional.  
Verification: lint/typecheck/unit/build/E2E PASS.

File / Module: agentic foundation and documentation  
Masalah: agents bergantung discovery/chat dan tidak memiliki spec/decision/operation guardrails.  
Perubahan: AGENTS, OpenCode, OpenSpec, ADR, current/target docs, tooling rationale, MCP policy, runbooks, session handoff.  
Alasan: repository menjadi portable source of truth.  
Risiko: docs harus dipelihara dan optional gateways belum diverifikasi.  
Verification: OpenSpec 2/2 PASS; OpenCode 1.18.15 and OpenSpec 1.8.0 commands available locally.

File / Module: CI and browser tests  
Masalah: CI tidak menjalankan unit tests/schema/spec/audit; Lighthouse menunjuk internal build directory; E2E base URL dan server URL tidak konsisten; network-idle/load waits flaky.  
Perubahan: deterministic CI gates, unified configurable base URL, optional externally managed server, content/animation-frame readiness.  
Alasan: gate harus menguji executable behavior dan memberi bukti deterministik.  
Risiko: `next dev` Turbopack hang pada host Windows ini; production artifact stabil.  
Verification: production E2E 8/8 PASS without retry.

## Infrastructure summary

- Deployment: Next.js-compatible managed platform proposed; no live deployment changed or verified.
- Database: managed PostgreSQL with Prisma, backups/PITR and controlled migrations; no migration applied.
- Storage/cache/jobs: deferred until a specified workload exists; transactional outbox is the preferred future async boundary.
- Observability: structured logs, metrics, tracing, and separate immutable audit log are proposed, not implemented.
- CI/CD: PR/main quality gate exists; deploy/promotion and migration approval remain future platform work.

## Agentic workflow and tooling

```text
Developer -> OpenCode -> AGENTS + OpenSpec + ADR + Docs
          -> optional 9Router -> OpenRouter / approved local model
          -> implementation -> verification -> session handoff
```

OpenCode is primary and provider-neutral. 9Router/OpenRouter/vLLM/Ollama are optional external routing choices, not PMS dependencies. OpenSpec is active. MCP is deny-by-default. Langfuse is reserved for real AI workflows. Qdrant is never the PMS transaction store. Full rationale is in `docs/agentic/tooling-rationale.md`.

## Security findings

- Critical: initial vulnerable Vitest dependency; fixed by safe dependency updates. Residual audit: 0.
- High: public-named server credential, missing trusted tenant boundary, and no authentication adapter. Credential/tenant foundation fixed; authentication remains unresolved before protected PMS work.
- Medium: unvalidated analytics payload, unhandled tracking promise, no structured/audit logging, migration not integration-tested. First two fixed; latter two remain.
- Low: legacy encoding/console diagnostics and E2E dev-server instability. Documented; production E2E stabilized.
- Informational: formal Codex security scanner was NOT RUN because mandatory Python preflight failed. Manual audit is not equivalent.

## Actual test results

| Check                | Status  | Catatan                                                                         |
| -------------------- | ------- | ------------------------------------------------------------------------------- |
| Install              | PASS    | `npm install`; up to date, 569 packages, 0 vulnerabilities                      |
| Format               | PASS    | foundation source files matched Prettier                                        |
| Prisma validation    | PASS    | schema valid using synthetic parse-only `DATABASE_URL`; no connection/migration |
| OpenSpec             | PASS    | 2 specs passed, 0 failed                                                        |
| Lint                 | PASS    | ESLint exit 0                                                                   |
| Typecheck            | PASS    | Next typegen and `tsc --noEmit` exit 0                                          |
| Unit Test            | PASS    | 3 files, 9 tests                                                                |
| Integration Test     | NOT RUN | no disposable PostgreSQL configured                                             |
| Browser E2E          | PASS    | production artifact, Chromium, 8/8, one worker, no retry                        |
| Build                | PASS    | Next.js 16.3.0; 8 routes generated                                              |
| Dependency audit     | PASS    | `npm audit --audit-level=critical`: 0 vulnerabilities                           |
| Local Smoke Test     | PASS    | HTTP 200 plus homepage/hydration 2/2 on production server port 3001             |
| Formal security scan | NOT RUN | Python preflight blocker                                                        |

The first full E2E attempt against `next dev` timed out after 304 seconds. A production-server rerun was used as the authoritative browser result; the dev-server hang remains an environment/tooling issue.

## Readiness score

| Dimension            | Score | Reason                                                                                                          |
| -------------------- | ----: | --------------------------------------------------------------------------------------------------------------- |
| System Design        |  8/10 | Domain, flows, ownership, migration, and risk direction documented                                              |
| Architecture         |  8/10 | Modular boundaries and dependency direction established; most PMS modules remain planned                        |
| Infrastructure       |  6/10 | Environments, deploy, recovery, and jobs designed; live staging/production not configured                       |
| Security             |  6/10 | Tenancy/RBAC/input/server boundaries improved; auth, audit log, DB isolation test, formal scan missing          |
| Maintainability      |  8/10 | Guardrails, docs, modules, CI, and handoff present; legacy prototype remains                                    |
| Testability          |  7/10 | Unit/E2E foundations pass; database integration layer absent                                                    |
| Documentation        |  9/10 | Current/target maps, ADR, specs, runbooks, rationale, and report present                                        |
| Agent Readiness      |  9/10 | OpenCode/OpenSpec/provider-neutral workflow and permissions configured                                          |
| Production Readiness |  4/10 | Build is healthy, but auth, real DB migration, observability, deployment, and operational validation are absent |

## Unresolved issues and next action

1. Specify and implement authentication-subject to active-membership resolution before protected staff UI.
2. Run migration and tenant/RBAC integration tests in disposable PostgreSQL, then staging.
3. Add idempotent role/permission provisioning and audit events.
4. Install supported Python or run formal security scan in a compatible CI environment.
5. Investigate Windows `next dev` hang separately; production build/start is currently the reliable smoke path.
6. Do not begin booking, subscription billing, smart lock, WhatsApp, self check-in, or payment features yet.

Recommended commit message:

```text
feat(foundation): establish tenant-safe agentic architecture
```

STATUS FONDASI AGENTIC LELUNGO:
SIAP UNTUK MASTER PROMPT

This means the repository is ready for the next governed Master Prompt; it does not mean the PMS is production-ready.
