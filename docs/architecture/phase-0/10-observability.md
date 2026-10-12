# Observability architecture

> **Current implementation:** `RequestTenantContext` carries a correlation ID sourced from `x-request-id` or a generated UUID, and Prisma emits limited development warnings/errors. No trusted request-ID ingress policy, structured application logger, metrics backend, tracing SDK/collector, dashboards, alerts, health endpoints, or immutable audit log is verified.
>
> **Target state:** Redacted structured logs, bounded metrics, OpenTelemetry-compatible traces, dependency-aware health signals, and end-to-end correlation make tenant-sensitive requests, jobs, events, and future RPCs diagnosable without exposing private data.
>
> **Decision status:** Observability principles and signal contracts are accepted target decisions. Provider, retention, sampling, SLO thresholds, and alert destinations require implementation-phase and operational evidence.
>
> **Last verified:** 2026-08-09

> **Target-only boundary:** Logger, metrics, traces, health endpoints, dashboards, alerts, providers, and domain signals below are future contracts; Phase 0 installs or deploys none of them.

## Objectives

Observability must answer four questions without inspecting production data manually:

1. Is Lelungo serving the expected traffic correctly and within agreed latency?
2. Which module, dependency, tenant-safe workflow step, deployment, or event caused a failure?
3. Are correctness-sensitive workflows stuck, duplicated, delayed, or silently degraded?
4. Can an operator correlate a client-visible failure with sanitized server evidence without exposing credentials or PII?

Application telemetry does not replace append-oriented business/security audit records. Langfuse, if used for future AI execution, remains AI telemetry only; it is not the normal PMS log, trace, audit, or availability system.

## Signal maturity by stage

| Stage                       | Required capability                                                                                                                                                                                                                                                     | Explicitly deferred                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Current Phase 0 evidence    | Document correlation gap, redaction rules, target fields, health semantics, metric/trace plan, and verification limitations.                                                                                                                                            | No runtime package, provider, endpoint, dashboard, or infrastructure change.                                         |
| Phase 1 foundation target   | Trusted request/correlation creation for protected paths; one server-only structured logging boundary; sanitized auth/tenant/authorization diagnostics; release/environment metadata; basic HTTP/error/DB dependency signals where the selected platform supports them. | No business-domain metric that implies Property/reservation/payment exists; no broker or distributed tracing estate. |
| First PMS domains           | Module/application-service spans and metrics; tenant-isolation and authorization denial signals; database pool/query and migration signals; domain health without high-cardinality metric labels.                                                                       | Cross-service telemetry until extraction exists.                                                                     |
| First jobs/events/providers | Job/event IDs, outbox age, attempts, terminal failure, consumer lag, provider latency/error categories, idempotency and reconciliation signals.                                                                                                                         | Broker-specific dashboards until a broker is approved.                                                               |
| Service extraction          | W3C trace propagation over HTTP/gRPC/events, per-service SLOs, dependency maps, sampling policy, service ownership/on-call, and collector resilience.                                                                                                                   | Nothing in Phase 0 authorizes extraction.                                                                            |

## Correlation and context propagation

At trusted ingress, Lelungo creates a UUID request ID and a correlation ID. A syntactically valid upstream value may be continued only when the deployment has an explicitly trusted proxy boundary; arbitrary client values are otherwise replaced. Values have a strict length/character schema to prevent log injection and high-cardinality abuse.

- `request_id` identifies one HTTP/RPC/job execution attempt.
- `correlation_id` links attempts belonging to the same user-visible or business workflow.
- `causation_id` identifies the event/command that directly caused a new job or event.
- `trace_id` and `span_id` are generated by the tracing system and never used as authorization or idempotency authority.
- `idempotency_key` is stored/used only by the owning operation and is redacted or hashed when its caller could treat it as sensitive.

The current `getRequestTenantContext` reads `x-request-id` directly and therefore does not yet prove a trusted ingress policy. Phase 1 must either overwrite it in the root Proxy/deployment boundary or validate and replace it before logging/propagation. Tenant hints and correlation fields remain transport metadata; the database-resolved tenant and verified membership remain authority.

Context propagates through in-process application calls explicitly, then through future job/event envelopes and RPC metadata. An asynchronous consumer creates a new `request_id` while continuing the `correlation_id`, setting `causation_id` to the triggering event, and linking its tracing span to the producer where supported. A retry gets a new attempt/request identifier but retains job/event, idempotency, and correlation identity.

Return a safe request ID to the client for support. Never expose internal stack traces, database identifiers beyond the DTO, hostnames, queue names, tokens, or provider response bodies.

## Structured logging contract

All server logs are machine-readable records through one server-only logging interface. Direct `console.*` is limited to bootstrap fallback or local tooling and is not the production observability contract.

### Common fields

| Field                                                                 | Rule                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `timestamp`, `level`, `message`, `event`                              | UTC timestamp, normalized severity, short human summary, stable machine event name                                 |
| `service`, `module`, `operation`                                      | Current service is the monolith deployment; module/operation identifies the owning boundary                        |
| `environment`, `release`, `region`                                    | Deployment metadata; never inferred from user input                                                                |
| `request_id`, `correlation_id`, `causation_id`, `trace_id`, `span_id` | Included where applicable and schema-validated                                                                     |
| `tenant_id`, `property_id`                                            | Stable IDs only after trusted resolution; allowed in restricted logs/traces, not as high-cardinality metric labels |
| `actor_type`, `actor_id`, `membership_id`                             | Minimum identifiers needed for diagnosis; do not include email/profile/session/token                               |
| `aggregate_type`, `aggregate_id`, `aggregate_version`                 | Only for domain operations where the identifier is not itself restricted                                           |
| `http_method`, `route_template`, `status_code`, `duration_ms`         | Use route template, never a raw URL containing query values                                                        |
| `outcome`, `error_category`, `retryable`, `attempt`                   | Stable bounded categories; exception details are sanitized                                                         |

Fields are omitted when unavailable; fabricated `unknown` tenant/actor values must not obscure whether authority resolution occurred. Logger APIs accept typed safe fields, not a request object, provider response, Prisma record, or arbitrary payload.

### Never log

- passwords, access/refresh tokens, API keys, cookies, authorization headers, OTPs, session payloads, webhook signatures, or connection strings;
- raw card/payment credentials, bank credentials, identity document numbers/images, smart-lock PINs, or private signed URLs;
- full request/response bodies, raw SQL with values, provider user objects, or broad ORM records;
- guest/staff email, phone, address, name, free text, or search query unless an explicitly approved, minimized, protected diagnostic use exists;
- secrets embedded in URLs or exception messages.

Redaction is allowlist-based at the logger boundary and is tested. Errors map to stable categories such as `validation`, `unauthenticated`, `unauthorized`, `not_found`, `conflict`, `dependency_timeout`, `dependency_unavailable`, and `internal`. Client error text and internal diagnostics remain separate.

### Event examples (target-only)

```text
auth.subject_verified
auth.verification_failed
tenant.resolution_failed
authorization.denied
database.operation_failed
outbox.relay_failed
job.exhausted
reservation.create_conflict
payment.webhook_duplicate
```

The last four business examples do not describe current functionality.

## Metrics strategy

Metrics use bounded names, units, and label sets. Do not put tenant, property, user, guest, reservation, raw route, error message, idempotency key, or request ID in metric labels. Those belong in correlated logs/traces. A metric has an owner, description, type, label allowlist, and dashboard/alert consumer before release.

### Platform and HTTP metrics

- request rate, duration histogram, status/error rate by normalized route template/method;
- server/render/function duration, timeout, cold-start or saturation signals exposed by the selected host;
- PostgreSQL connection-pool utilization/wait, transaction/query duration by safe operation name, errors, and migration outcome;
- external dependency requests, duration, timeout, error category, retry, and circuit state by bounded provider/operation label;
- authentication verification outcome and authorization denial count by bounded reason/permission category, never subject/tenant;
- process/runtime CPU, memory, event-loop, and queue saturation where meaningful for the deployment model.

### Asynchronous metrics when implemented

- `outbox_pending_total`, oldest outbox age, relay success/failure;
- job queued/running/succeeded/failed/exhausted totals and duration by job type;
- consumer lag, redelivery, duplicate, dead-letter, replay, and handler duration by event/consumer type;
- reconciliation discrepancy count/age and provider rate-limit events.

### Domain metrics when implemented

- reservation attempts, accepted, conflicts, failures, and latency;
- inventory holds created, expired, released, converted, and conflict rate;
- payment intent/outcome/refund counts, latency, unknown/reconciliation age;
- notification outcome/latency and search-index freshness;
- checkout-to-housekeeping task latency and distribution sync lag/conflicts.

Financial amounts, occupancy, conversion, and business analytics are tenant-scoped reporting data, not unrestricted infrastructure metric labels. Their definitions belong to the owning domain/KPI layer.

## Tracing strategy

Instrumentation is OpenTelemetry-compatible so providers remain replaceable. Phase 1 should preserve trace-ready context and instrument the high-risk server boundaries selected by its OpenSpec change; collector/backend deployment and broad sampling are deferred until an implementation decision.

Target spans include:

- trusted ingress and normalized route template;
- identity verification, tenant resolution, membership/permission decision (outcome only, never secrets);
- application command/query and owned transaction;
- named database operation without SQL values;
- external HTTP/provider call with deadline/outcome;
- outbox relay, broker publish/receive, job/consumer handling, and reconciliation;
- future gRPC client/server operations.

Trace attributes follow the same privacy and cardinality rules as logs. W3C `traceparent`/`tracestate` are validated and propagated but never establish identity or tenant authority. Baggage is allowlisted and must not carry PII, credentials, raw headers, or authorization claims.

Sampling keeps all errors and selected high-risk workflow traces subject to cost/privacy policy, while healthy high-volume traffic may be probabilistically sampled. Tail sampling is considered only when the collector/cost justifies it. Telemetry export failure must not fail a core PMS transaction; buffers are bounded and drop behavior is measured.

## Health, readiness, and deployment signals

Conceptual endpoints are target-only and require an implementation change:

| Signal                      | Meaning                                                              | Behavior                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness (`/health/live`)   | The process can execute requests                                     | No network dependency fan-out; fast, sanitized, suitable for restart decisions                                                                                                                                                                            |
| Readiness (`/health/ready`) | This release can safely serve its required traffic                   | Checks required configuration and a bounded PostgreSQL operation; checks broker/storage/provider only if that dependency is mandatory for the served surface. Optional dependency failure reports degraded elsewhere rather than taking all traffic down. |
| Startup                     | Configuration/schema compatibility needed by the process is valid    | Fail clearly and sanitized for required configuration; no secret values; migrations are not auto-applied by health checks                                                                                                                                 |
| Detailed/operator health    | Dependency/module status, migration/release metadata, outbox/job lag | Authenticated platform-only surface or observability backend; never public topology/secrets/data                                                                                                                                                          |

Health endpoints use strict timeouts and do not create cascading load. A readiness check does not execute a business mutation or call every downstream provider. Deployment promotion also watches smoke tests, error/latency change, database saturation, and asynchronous lag for a defined observation window.

## SLO and alert design

Phase 0 does not invent numeric production SLOs because traffic, support coverage, and commercial commitments are not evidenced. Before a production workflow ships, its owner establishes a baseline and proposes:

- availability and latency SLI at the user-visible boundary;
- correctness/processing SLI, such as reservation conflict handling or webhook reconciliation age;
- asynchronous freshness/lag SLI for notification, search, analytics, and distribution;
- error budget, measurement window, exclusions, and owner/on-call response;
- severity, runbook link, and escalation for each alert.

Alerts must be actionable and symptom-oriented. Examples include a sustained protected-route error/latency burn, database pool saturation, tenant resolution failure spike, oldest outbox/job age over the accepted limit, dead-letter growth, payment unknown/reconciliation backlog, reservation conflict anomaly, or search/channel freshness breach. One isolated log line is not automatically a page.

## Audit versus operational telemetry

Audit evidence is append-oriented, authorization-controlled, and retained under business/legal policy. Application logs/traces may be sampled and have different retention. Required audit capture occurs in the owning transaction/outbox; telemetry export is best effort and cannot be the only evidence of a role change, reservation transition, payment refund, sensitive-data access, or impersonation session.

Audit payloads still obey minimization and redaction. Operators need correlation between audit and logs without copying sensitive old/new state into telemetry.

## Provider selection criteria

No vendor is selected in Phase 0. A later decision compares support for OpenTelemetry ingestion/export, Next.js hosting integration, log/trace/metric correlation, regional availability, encryption and access controls, retention/deletion, PII scrubbing, alerting/on-call integration, dashboards-as-code/export, sampling, cost/cardinality controls, data residency, and incident export.

The minimum MVP may use hosting-platform logs/metrics plus one error/telemetry destination if it satisfies the contract. It does not require a self-hosted observability cluster. Service extraction cannot proceed until the selected stack supports end-to-end traces, per-service SLOs, and ownership.

## Verification gates

- unit tests prove request/correlation validation/replacement and propagation;
- logger tests prove allowlisted fields, redaction, error normalization, and no raw request/provider/ORM payload;
- integration tests correlate a protected request through identity, tenancy, authorization, and a denied repository boundary;
- health tests prove fast liveness, dependency-aware readiness, sanitized output, timeout, and optional-dependency degradation;
- metric tests or review prove bounded labels and stable route/operation names;
- job/event tests prove attempt/correlation/causation propagation, duplicate handling, terminal failure, and lag metrics when those systems exist;
- trace tests prove context propagation and absence of restricted attributes before any service extraction;
- deployment smoke/rollback runs record actual release and telemetry outcomes.

Unavailable providers or telemetry infrastructure are recorded as blocked/not run; they are never reported as passing based only on this design.
