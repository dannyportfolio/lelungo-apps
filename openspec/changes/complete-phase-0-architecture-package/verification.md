# Verification record — complete Phase 0 architecture package

Date: 2026-08-09  
Workspace: `C:\Users\Lenovo X13\Documents\lelungo-apps`  
Scope: documentation and OpenSpec artifacts only

## Change-boundary verification

- No runtime source, UI, Prisma schema, applied migration, package manifest, lockfile, CI workflow, environment value, external service, deployment, or production data was changed by this OpenSpec apply.
- Current-system documentation corrections are factual reconciliations against existing source and migration evidence.
- Planned PMS entities, APIs, events, jobs, infrastructure, and services are labeled target-only or deferred.
- Rollback is a documentation/OpenSpec revert. If a downstream change later relies on an accepted ADR, supersede the ADR instead of silently deleting its history.

## Evidence inventory and dependency checks

| Command                                                 | Exit | Actual result and limitation                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg --files \| Sort-Object` plus targeted `rg` searches |    0 | Repository, environment-variable-name, data-access, test, workflow, documentation, and OpenSpec inventories were captured. Values from secret files were not printed.                                                                           |
| `git status --short`                                    |    0 | Initial change surface was the untracked Phase 0 OpenSpec change; later status checks are recorded below. Git also warned that the user-level `.config/git/ignore` could not be read; this did not prevent repository status inspection.        |
| `node --version`                                        |    0 | Local runtime is `v25.9.0`; repository policy and CI require Node 22 or newer, while CI itself uses Node 22.                                                                                                                                    |
| `npm.cmd --version`                                     |    0 | Local npm is `11.12.1`. `npm.cmd` was used because the PowerShell policy blocks the `npm.ps1` shim.                                                                                                                                             |
| `npm.cmd ls --depth=0`                                  |    0 | Declared top-level dependencies resolved. Local `node_modules` also contains extraneous `@emnapi/runtime` and `@img/sharp-wasm32`; clean-install evidence is deferred to CI/another disposable workspace and no lockfile cleanup was attempted. |
| `npm.cmd audit --audit-level=critical --json --offline` |    0 | Reported 0 vulnerabilities from the local cache across 676 dependencies. This is offline, time-sensitive evidence, not a current registry check or formal security scan.                                                                        |

No dependency was installed, removed, or upgraded.

## Formal security workflow

The `codex-security:security-scan` workflow requires its Python configuration preflight before source review. The required preflight could not start:

```text
python "C:\Users\Lenovo X13\.codex\plugins\cache\openai-curated-remote\codex-security\0.1.18\scripts\config_preflight.py" --profile security_scan --cwd "C:\Users\Lenovo X13\Documents\lelungo-apps" --runtime-check delegation_available=true --runtime-check goal_tools_available=true --multi-agent-runtime-owner native --multi-agent-runtime-version v2 --multi-agent-session-cap 4 --multi-agent-runtime-provenance thread-context --available-plugin-skill security-scan
```

Exit `1`: PowerShell reported that `python` is not recognized.

The Windows launcher fallback was also attempted:

```text
py -3 "C:\Users\Lenovo X13\.codex\plugins\cache\openai-curated-remote\codex-security\0.1.18\scripts\config_preflight.py" --profile security_scan --cwd "C:\Users\Lenovo X13\Documents\lelungo-apps" --runtime-check delegation_available=true --runtime-check goal_tools_available=true --multi-agent-runtime-owner native --multi-agent-runtime-version v2 --multi-agent-session-cap 4 --multi-agent-runtime-provenance thread-context --available-plugin-skill security-scan
```

Exit `1`: PowerShell reported that `py` is not recognized.

Result: `BLOCKED AT PREFLIGHT`; the formal scanner did not run and no formal finding set or clean result exists. Repository observations in the audit and security design are explicitly not a substitute. This blocks broad production-security readiness, but it does not by itself block beginning the narrow, non-production Phase 1 authentication/isolation foundation if the final repository gates pass. A supported Python runtime or compatible CI security job is required before protected production release.

## Architecture-artifact validation

| Command/check                                                                                                                           | Exit | Actual result and limitation                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `& "openspec/changes/complete-phase-0-architecture-package/validate-phase-0.ps1"`                                                       |    1 | Windows PowerShell execution policy blocked direct script loading. No validation result was inferred from this attempt.                                                                                                                                                                                                                      |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "openspec/changes/complete-phase-0-architecture-package/validate-phase-0.ps1"` |    0 | Process-scoped execution succeeded: 50 Markdown files/relative links, 15/15 status blocks, 12/12 target boundaries, canonical 18/18 context taxonomy and required fields, 8 ADR structures, 7 Mermaid fence sets, 21 risk rows, 13/13 roadmap phases with all required fields, and readiness headings passed. No machine policy was changed. |
| `npm.cmd --script-shell powershell.exe run spec:validate`                                                                               |    0 | OpenSpec reported 4 passed and 0 failed: two active changes plus the `staff-authorization` and `tenancy` specs.                                                                                                                                                                                                                              |
| Installed Prettier over all changed Markdown paths                                                                                      |    0 | Changed Phase 0, ADR, diagram, current-system, risk, OpenSpec, and handoff Markdown was written once and then checked. The repository `format:check` script covers code paths only, so this separate documentation check is retained.                                                                                                        |

The Mermaid check is text-level: every source has one balanced Mermaid fence, and independent review found no undeclared/ambiguous nodes after corrections. A Mermaid renderer was not installed or executed, so rendered-layout compatibility is not claimed.

## Repository regression gates

| Command                                                                                                                                                        | Exit | Actual result and limitation                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd --script-shell powershell.exe run format:check`                                                                                                       |    0 | All repository-configured TypeScript/TSX paths match Prettier. Wall time 2.4 s.                                                                                                                                  |
| `npm.cmd --script-shell powershell.exe run prisma:validate`                                                                                                    |    1 | First attempt failed with Prisma `P1012` because `DATABASE_URL` was absent. This is an explicit environment requirement, not a schema verdict.                                                                   |
| `$env:DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:5432/lelungo_phase0_validation'; npm.cmd --script-shell powershell.exe run prisma:validate` |    0 | Prisma 6.19.3 reported the schema valid. The process-local placeholder is non-production and schema validation made no network connection or database mutation. Wall time 2.4 s.                                 |
| `npm.cmd --script-shell powershell.exe run lint`                                                                                                               |    0 | ESLint completed with no diagnostics. Wall time 8.5 s.                                                                                                                                                           |
| `npm.cmd run typecheck`                                                                                                                                        |    1 | The npm child `cmd` environment exposed an empty `PATH`, so it could not locate `node`. An attempt with Windows PowerShell 5 also failed to parse the repository script's `&&`. Neither is a TypeScript failure. |
| `npm.cmd --script-shell "C:\Program Files\Git\bin\bash.exe" run typecheck`                                                                                     |    0 | The exact repository script ran successfully: Next route types generated and `tsc --noEmit` passed. Wall time 4.8 s. Direct execution of both underlying commands also passed before this exact-script rerun.    |
| `npm.cmd --script-shell powershell.exe run test` (sandbox)                                                                                                     |    1 | Vitest/esbuild was denied while resolving `vitest.config.ts` because the sandbox could not read a parent directory. No test result was inferred.                                                                 |
| `npm.cmd --script-shell powershell.exe run test` (approved outside sandbox)                                                                                    |    0 | Vitest 3.2.7: 3 files and 9 tests passed; no skips or failures. Test duration 1.19 s; command wall time 3.0 s.                                                                                                   |
| `npm.cmd --script-shell powershell.exe run build`                                                                                                              |    0 | Next.js 16.3.0 production build passed. TypeScript passed in-build; eight pages were generated and only the existing route inventory was present. Wall time 18.5 s.                                              |

`npm run test:e2e` was not rerun because the change is documentation-only and changes no route, component, browser flow, or runtime behavior. Historical prototype E2E evidence is retained in the current-system audit and is not treated as protected-PMS coverage.

## Final worktree inspection

| Command                                                    | Exit | Actual result and limitation                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git diff --check`                                         |    0 | No whitespace errors. Git emitted informational LF-to-CRLF warnings for modified tracked Markdown.                                                                                                                                                                                                                                                        |
| `git diff --stat`                                          |    0 | Five previously tracked documentation files show 92 insertions and 41 deletions. Git diff statistics do not include the new untracked documentation/OpenSpec files.                                                                                                                                                                                       |
| `git status --short` and `git status --porcelain=v1 -uall` |    0 | Every changed/new path is under `docs/` or `openspec/changes/complete-phase-0-architecture-package/`; no runtime source, schema, migration, package, lockfile, workflow, environment value, or generated build artifact is in the change surface. Git warned that the user-level `.config/git/ignore` is inaccessible; repository status still completed. |

## Remaining evidence limitations

- No disposable PostgreSQL URL or deployed database was used. Migration execution, database constraints, tenant isolation, and role provisioning remain unverified against a real PostgreSQL instance and are acceptance work for `add-authenticated-membership-foundation`.
- No external identity-provider session, canonical Vercel production project, DNS/TLS, staging environment, backup/restore, rollback drill, or production deployment was exercised.
- No Phase 1 runtime implementation was started.
