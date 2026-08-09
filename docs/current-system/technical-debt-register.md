# Technical debt register

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| TD-001 | High | No request authentication adapter or protected staff application exists | Required before staff/PMS features |
| TD-002 | High | Tenancy migration has not been applied or tested against a real staging database | Validate in disposable DB, then staging |
| TD-003 | High | Business tables are absent, so end-to-end tenant isolation cannot yet be proven | Add isolation tests with each domain |
| TD-004 | Medium | Legacy affiliate prototype and target PMS coexist with inconsistent product language | Retire incrementally after approved replacement |
| TD-005 | Medium | Supabase and Prisma represent two persistence paths | Keep analytics isolated; choose transactional ownership per ADR |
| TD-006 | Medium | Role catalog exists in code but database provisioning is not implemented | Add idempotent provisioning spec later |
| TD-007 | Medium | QA dashboard contains illustrative/mock operational data | Keep disabled in production; label or replace later |
| TD-008 | Medium | No structured application logging, audit log, metrics, or alerting | Design before production workflows |
| TD-009 | Medium | No integration tests with PostgreSQL | Add disposable DB suite before persistence features |
| TD-010 | Low | Some legacy source comments/text have encoding artifacts and console diagnostics | Clean only in touched modules |
| TD-011 | Low | Browser filter test has historically required retry under animation timing | Stabilize selector/state synchronization |
| TD-012 | Informational | Formal Codex security scanner requires Python, absent on this Windows host | Install supported Python or run scanner in CI |

No circular dependency analyzer is configured. Import review found no demonstrated cycle in the current small module graph. Dead/abandoned candidates are the mock insight engine, legacy affiliate fetch path, and QA mock dashboard, but they remain reachable and must not be deleted until product replacement is accepted.
