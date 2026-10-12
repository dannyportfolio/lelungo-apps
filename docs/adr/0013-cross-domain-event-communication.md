# ADR 0013: Cross-domain event communication

Status: Accepted

## Context

Notifications, analytics, search projection, channel synchronization, and operational follow-up should not extend critical request chains or cause reservation transactions to fail when a downstream system is unavailable.

## Decision

Use direct in-process application calls for immediate validation and same-boundary transactions. Use versioned domain events for non-blocking cross-domain facts. Begin with explicit in-process dispatch only for non-critical local consumers; before an event must survive process failure, write it through a transactional outbox and deliver it with idempotent consumers, bounded retries, and dead-letter handling.

When a durable broker is justified, prefer NATS JetStream for Lelungo's expected scale and operational profile. Broker deployment is deferred until at least one real durable asynchronous workflow exists and operational ownership is available.

## Alternatives

- Synchronous chains through payment, notification, analytics, search, and channels: rejected because they create cascading latency and failures.
- Kafka now: rejected because expected throughput and replay requirements do not justify its operational footprint.
- Redis Streams as the primary durable integration backbone: rejected because persistence and operational coupling to cache use are less explicit.
- RabbitMQ: viable, but NATS JetStream offers a simpler initial developer and service-messaging path for the expected workload.

## Consequences

Consumers must be idempotent and eventual consistency must be visible. Event schemas, correlation, delivery attempts, and ownership become governed contracts; critical strong-consistency operations remain synchronous and transactional.

## Migration Impact

Define event metadata and naming before publishing cross-domain events. Add an outbox in the first durable workflow, operate it in one deployment, then introduce managed NATS JetStream and migrate consumers without changing domain event creation.
