# ADR 0004: Validate at system boundaries

Status: Accepted

## Context
Network, browser, webhook, environment, and provider data are untrusted.

## Decision
Parse external input with explicit schemas at entry, then enforce domain invariants inside application services.

## Consequences
Failures are early and typed; schemas require maintenance and do not replace authorization.

## Rejected Alternatives
Type assertions, validation only in UI, and provider types flowing through the domain.
