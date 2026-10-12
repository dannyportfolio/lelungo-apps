# ADR 0007: Observability and structured logging

Status: Accepted

## Context

Console diagnostics cannot support production incidents or tenant-sensitive audit needs.

## Decision

Use structured, redacted application logs with request and correlation identifiers as the first operational signal. Add a small, named metric set with implemented workflows and OpenTelemetry-compatible traces when cross-process work or production incident diagnosis justifies them. Security/business audit records are append-oriented domain history owned separately from diagnostic logs.

Never log credentials, tokens, full request bodies, payment details, identity documents, or unnecessary personal data. Tenant, property, reservation, and actor identifiers appear only where needed and permitted.

## Alternatives

- Console-only text logs were rejected because they are difficult to correlate, query, redact consistently, or use during multi-tenant incidents.
- A full observability stack during Phase 0 was rejected because no production PMS workflow exists and provider selection requires deployment evidence.
- Treating application logs as audit history was rejected because retention, immutability, access, and evidentiary requirements differ.

## Consequences

Operations gain consistent correlation and safer diagnostics, but field governance and redaction testing become mandatory. Metrics, traces, and audit retention need explicit ownership and cost/privacy decisions as workflows are implemented.

## Migration Impact

Phase 1 introduces request/correlation propagation and a structured logger without requiring a telemetry vendor. Later phases add domain metrics and audit persistence with the owning module, then enable OpenTelemetry export before service extraction. Existing console diagnostics are migrated only when their paths are touched.
