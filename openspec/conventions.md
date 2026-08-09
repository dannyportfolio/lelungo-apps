# Conventions

- npm only; Node.js 22+; strict TypeScript; no undocumented `any`.
- Kebab-case module files, PascalCase React components, explicit service/repository names.
- API input is schema-validated; responses expose only named fields and generic errors.
- Database tables use snake_case mappings and UUID identifiers; tenant-owned data includes indexed `tenant_id`.
- Production migrations are immutable. Add forward migrations and use expand-contract.
- Errors carry stable codes at application boundaries; logs redact secrets and personal data.
- Tests prioritize authentication, authorization, tenant isolation, transactions, and business invariants.
- Material work uses an OpenSpec change containing `proposal.md`, `tasks.md`, applicable `design.md`, specification deltas, and `verification.md` before archive.
- Update docs and `docs/runbooks/session-handoff.md` whenever architecture or operational behavior changes.
