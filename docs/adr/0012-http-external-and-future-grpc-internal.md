# ADR 0012: HTTP externally and future gRPC internally

Status: Accepted

## Context

Browsers and mobile clients need stable web semantics. Internal modules currently share one process, while selected modules may later be extracted when independent scaling or isolation is demonstrated.

## Decision

Expose public and staff client operations through HTTP using Next.js route handlers, server actions, or a BFF appropriate to the client. Validate external input and return explicit DTOs and stable error envelopes. Do not expose gRPC to browsers.

Within the modular monolith, use typed in-process application contracts. After a module is extracted, use gRPC with Protocol Buffers for synchronous service operations that require an immediate result. Preserve protobuf compatibility through versioned packages, reserved removed field numbers, additive evolution, and generated-code ownership.

## Alternatives

- gRPC for browser traffic: rejected due browser compatibility, gateway, debugging, and public API concerns.
- Localhost gRPC between modules in one deployment: rejected as network ceremony without isolation benefit.
- Unversioned shared ORM models as contracts: rejected because they leak persistence and prevent compatible evolution.

## Consequences

HTTP remains approachable and deployment stays simple. Extraction later requires an adapter from the existing public module contract to protobuf rather than a domain rewrite, but contract compatibility becomes an explicit responsibility.

## Migration Impact

Phase 1 establishes module public surfaces and HTTP/error conventions. Create `contracts/proto` only when the first extraction change is accepted; migrate one caller at a time through an adapter and keep browser contracts HTTP-based.
