# ADR 0001: Use a modular monolith

Status: Accepted

## Context
Lelungo needs clear PMS domain boundaries without the operational cost of distributed systems.

## Decision
Deploy one Next.js application and one transactional PostgreSQL database, with domain modules and enforced dependency direction.

## Consequences
Transactions and deployment remain simple; modules need discipline and can be extracted later only with evidence.

## Rejected Alternatives
Premature microservices and an unstructured layer-only monolith.
