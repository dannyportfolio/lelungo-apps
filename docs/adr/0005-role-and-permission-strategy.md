# ADR 0005: Role and permission strategy

Status: Accepted

## Context
Tenant staff need understandable roles without hardcoding authorization across UI and routes.

## Decision
Permissions are stable authorization capabilities; roles group permissions; active memberships receive roles. Services check permissions and tenant context, not role names alone.

## Consequences
Custom tenant roles remain possible and checks stay granular; provisioning and permission evolution need controlled migrations.

## Rejected Alternatives
Single admin flag, UI-only checks, and role-name conditionals scattered through code.
