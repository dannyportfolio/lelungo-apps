# Risk analysis

| Risk | Impact | Control |
| --- | --- | --- |
| Cross-tenant data access | Critical confidentiality breach | Trusted tenant context, scoped repositories, isolation tests |
| Incomplete authentication integration | Unauthorized staff access | Block protected PMS routes until adapter/membership checks exist |
| Migration applied without backfill plan | Downtime/data loss | Expand-contract, rehearsal, backup, forward fix |
| Double booking/race conditions | Revenue and operational harm | Transactional inventory invariants and concurrency tests |
| Sensitive guest/payment leakage | Legal and trust impact | Classification, minimum selects, redaction, audit |
| External provider outage/retry duplication | Inconsistent state | Idempotency, outbox, bounded retries, circuit controls |
| Agent makes broad undocumented changes | Maintainability/security regression | AGENTS.md, OpenSpec, ADR, CI, session handoff |
| Model/gateway dependency | Development interruption or data exposure | Provider abstraction, explicit data policy, local optional fallback |
