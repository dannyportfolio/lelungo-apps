# ADR 0007: Observability and structured logging

Status: Proposed

## Context
Console diagnostics cannot support production incidents or tenant-sensitive audit needs.

## Decision
Introduce structured redacted application logs, metrics, tracing, and a separate immutable audit-log domain when production workflows arrive.

## Consequences
Operations gain correlation and evidence; providers and retention require a later implementation decision.

## Rejected Alternatives
Unstructured console-only logging and mixing security audit records with transient logs.
