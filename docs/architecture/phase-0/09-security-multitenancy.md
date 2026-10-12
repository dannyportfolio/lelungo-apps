# Security, multi-tenancy, and privacy

> **Current implementation:** Host normalization, server-side tenant lookup, tenant context helpers, active membership lookup, an initial role/permission catalog, Zod validation on click tracking, and server-only Prisma access exist. Authoritative staff authentication, protected PMS routes, property scope, audit records, sensitive PMS data, and end-to-end tenant isolation against a live PostgreSQL test database are not implemented or verified.
>
> **Target state:** Every protected operation composes verified identity, trusted tenant resolution, active same-tenant membership, scoped permission, validated input, domain invariants, tenant-safe persistence, explicit DTO output, redacted diagnostics, and append-oriented audit evidence.
>
> **Decision status:** Tenant-scoped modular-monolith and deny-by-default authorization decisions are accepted. Detailed privacy retention, provider, and regulatory policies remain phase-specific target decisions. Formal automated security coverage is blocked as recorded below.
>
> **Last verified:** 2026-08-09

> **Target-only boundary:** Property scope, authoritative authentication, privacy controls for future PMS records, audit persistence, and boundary protections below remain requirements for later approved changes unless explicitly listed as current evidence.

## Security boundary order

The target server execution order is:

```text
untrusted request
  -> validate transport shape and size
  -> verify external identity/session
  -> resolve tenant from trusted host infrastructure
  -> resolve active membership for (verified subject, resolved tenant)
  -> require permission and resource/property scope
  -> call application/domain service
  -> enforce business invariant and tenant ownership again
  -> execute minimum-field tenant-scoped database access
  -> write required audit/outbox evidence
  -> return an explicit response DTO
```

Changing the order can create an enumeration or direct-object-reference weakness. Authorization happens before protected records are selected, and sensitive services repeat ownership and permission checks rather than depending on hidden UI or route assumptions.

The existing `add-authenticated-membership-foundation` OpenSpec change is the next safe Phase 1 slice. It establishes authoritative authentication, active same-tenant membership resolution, a minimal protected staff boundary, and disposable PostgreSQL tests. It does **not** authorize Property or any other PMS domain implementation.

## Tenant authority

### Current evidence

- `proxy.ts` derives a normalized tenant subdomain from the actual request hostname and overwrites/deletes `x-lelungo-tenant-subdomain` for matched requests.
- `TenantRepository.findBySubdomain` resolves the subdomain server-side; a request body/query tenant ID is not accepted as authority.
- `RequestTenantContext` carries the resolved tenant and correlation identifier, and `applyTenantScope` rejects a conflicting tenant ID.
- `TenantRepository.findMembership` scopes an active membership lookup by user ID and tenant ID and selects only the fields required to derive permissions.
- There is no authoritative authentication adapter. The caller-supplied `ActorContext` in the current production-shaped entry is not proof of identity.
- There are no property, guest, reservation, stay, inventory, or payment records against which full tenant isolation can be tested.

### Target invariants

1. Every tenant-owned table has `tenant_id NOT NULL`, a foreign key, and tenant-leading indexes for supported access paths. A child reference must be proven to belong to the same tenant, preferably through a composite database constraint where practical and always through the owning service.
2. A tenant ID from JSON, form data, query parameters, route parameters, cookies, or arbitrary forwarding headers may identify a requested resource but never grants authority. It is compared with trusted server context.
3. Tenant host resolution and authenticated membership must agree. Missing, inactive, suspended, revoked, absent, or other-tenant membership denies access generically before protected data is read.
4. Platform operations are separate application services with explicit platform permissions. A nullable tenant field never silently upgrades a caller to platform authority.
5. Support impersonation, if later approved, is time-bounded and visible, requires a dedicated platform permission and reason, forbids credential disclosure, and emits start/end audit records. It is not part of the current implementation.
6. RLS may be added as defense in depth but never replaces server authorization and repository scoping, because privileged connections can bypass it.
7. Cross-tenant analytics use authorized projections or purpose-built platform queries. Tenant modules do not expose an `unscoped` convenience path.

## RBAC plus resource scope

Permissions are stable capabilities; roles are administrative groupings. Application services authorize permission keys, not UI state or role-name string comparisons. The current catalog includes future PMS permission names, but their presence does not mean the corresponding domain exists.

Tenant-level RBAC alone is insufficient for an organization with multiple properties. Target authorization evaluates:

```text
decision = verified subject
         + active membership in resolved tenant
         + required permission
         + allowed resource scope (tenant/property/owned assignment)
         + resource belongs to resolved tenant and scope
         + applicable domain-state rule
```

| Scope                 | Target meaning                                                              | Examples                                                                              |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Platform              | Intentionally global Lelungo operation, never inferred from a null tenant   | Tenant support, platform billing administration; separate protected surface and audit |
| Tenant / organization | Permission applies to all properties in one resolved tenant                 | Organization owner managing staff or tenant configuration                             |
| Property set          | Permission applies only to explicitly assigned properties within the tenant | Property manager, front office, finance staff assigned to selected properties         |
| Task/record ownership | Narrow assignment is additionally required                                  | Housekeeper updating an assigned task; guest using an opaque reservation-scoped token |

Property selection in the UI filters an already authorized set; it does not change tenant or property authority. Target property-scoped grants must be owned by Identity/Authorization and must not copy permission logic into each page.

### Known RBAC integrity gap

The current `staff_membership_roles` table has separate foreign keys to `staff_memberships` and `roles`, but no database constraint proves the membership and role share the same tenant or that their platform/tenant scopes agree. The current tenant creation service selects a role within the new tenant, but another write path or corrupted data could link a tenant-A membership to a tenant-B or platform role. `findMembership` would then flatten the linked permissions.

This is an unresolved high-severity foundation risk, not a verified exploit or a completed fix. Before RBAC protects PMS data, the active authentication change must add disposable PostgreSQL tests for cross-tenant role assignment and role-scope invariants. If the defect is confirmed, implementation must pause as its task requires, update the change artifacts, and add a reviewed **forward** migration or equally strong database/application invariant. Existing migration files must not be edited.

Additional integrity rules to prove include:

- `TENANT` roles require a tenant and `PLATFORM` roles do not have one;
- tenant memberships receive only roles from the same tenant;
- platform memberships receive only platform roles;
- permission provisioning is idempotent and unknown permissions fail closed;
- membership suspension/revocation takes effect without relying on stale token claims;
- every authorization denial happens before the protected repository callback.

## Privacy classification

Exact Indonesian legal obligations, retention durations, deletion exceptions, and data-residency needs require product/legal review before sensitive schemas ship. The architecture uses these minimum classes:

| Class        | Examples                                                                                                                       | Target handling                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public       | Published property name, approved descriptions, public amenities                                                               | Explicit publication state; integrity controls; cacheable only by an owned policy                                                                              |
| Internal     | Operational configuration, non-sensitive staff workflow metadata                                                               | Authenticated tenant/property scope; no public exposure; bounded logs                                                                                          |
| Confidential | Guest name/contact/address, staff profile, reservation details, invoices                                                       | Minimum-field access, purpose-based permission, encryption in transit/managed storage, redaction, retention/deletion policy, audited sensitive access          |
| Restricted   | Identity documents/numbers, authentication tokens, provider secrets, payment credentials, smart-lock PINs, private signed URLs | Never in general DTOs/events/logs; encrypted/private storage; very narrow permission; short-lived access; access audit; provider tokenization for payment data |

Lelungo stores no raw card number, CVV, access token, refresh token, password, or provider secret in business tables. Payment providers own payment credentials; Lelungo stores provider references and integer minor-unit business records. Sensitive object content lives in private object storage, not the application filesystem or database JSON by default.

Retention is purpose- and class-specific. Legal hold and financial record requirements may override deletion, but the system must distinguish deletion, anonymization, access restriction, and provider erasure. A later implementing change must name the policy owner and duration before creating each sensitive data class.

## Explicit DTO and data-access rules

- Validate each external payload with a strict schema, including unknown-field behavior, lengths, formats, enums, numerical bounds, and collection limits. Domain services validate state and ownership independently.
- Accept command DTOs, never ORM `create`/`update` objects. Build explicit persistence data so callers cannot mass-assign `tenantId`, status, price, role, audit actor, provider reference, or privilege fields.
- Prisma queries use explicit `select` for the minimum fields. Broad `include`, returning database records, and serializing provider SDK objects are prohibited at sensitive boundaries.
- Response DTOs are purpose-specific. Guest list, front-desk detail, finance, identity review, public property, and audit views expose different fields under different permissions.
- IDs are identifiers, not secrets. Every record lookup includes tenant and applicable property scope before response or mutation; a UUID alone never passes IDOR authorization.
- List queries are paginated, bounded, sorted deterministically, and tenant-scoped. Search/export endpoints enforce field-level exposure and rate/size limits.
- Client errors are stable and generic. Server diagnostics use a correlation ID and sanitized error category, not a full body, secret, token, cookie, SQL, or PII dump.

## Boundary control matrix

| Threat/boundary          | Required target control                                                                                                                                                                        | Current status / gate                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Authentication/session   | Authoritative server verification, secure/HttpOnly/SameSite-appropriate cookies, rotation, private/no-store authenticated responses, generic failure                                           | Not implemented; active auth change owns it                                                              |
| Tenant-header spoofing   | Trusted proxy overwrites tenant hint from actual host; server resolves database authority                                                                                                      | Host-derived overwrite implemented; deployment trust chain still requires verification                   |
| Other forwarding headers | Deployment overwrites or ignores untrusted identity, role, tenant, client-IP, protocol, request-ID, and internal-service headers                                                               | Request-ID trust is not yet hardened; define trusted ingress during Phase 1/observability implementation |
| CSRF                     | SameSite cookie policy plus origin/host validation and anti-CSRF token for cookie-authenticated unsafe methods where needed; GET remains side-effect free                                      | Must be designed/tested with auth mutations                                                              |
| CORS                     | Deny cross-origin credentialed access by default; explicit exact-origin allowlist per surface, no reflected wildcard                                                                           | No public PMS API exists; required before cross-origin clients                                           |
| Open redirect            | Only validated local staff destinations; reject absolute, protocol-relative, encoded, and malformed targets                                                                                    | Active auth change includes regression tests                                                             |
| SSRF                     | Provider base URLs/config are server-owned allowlisted HTTPS origins; reject user-selected scheme/host/port, private/link-local/metadata destinations, redirect escape, and unbounded response | Existing affiliate helper requires review; mandatory for future import/webhook/media features            |
| Webhooks/replay          | Raw-body signature verification, timestamp window, event-id deduplication, idempotent state transition, secret rotation, size/rate limit                                                       | Not implemented; gate for payment/channel providers                                                      |
| Upload/path traversal    | Allowlisted MIME and verified content, bounded size/dimensions, randomized object keys, malware/sandbox review, private storage, signed short-lived access; never trust a filename/path        | Not implemented; gate before property/identity uploads                                                   |
| SQL/injection            | Parameterized Prisma/query APIs; reviewed raw SQL only; schema validation and tenant scope                                                                                                     | Prisma used for current tenancy; future raw migration/query review required                              |
| XSS                      | React escaping by default, sanitized allowlisted rich text, CSP, no unsafe HTML from providers/users                                                                                           | CSP/rich-text policy not verified; required for public/user content                                      |
| Rate abuse               | Per-IP/subject/tenant/operation budgets, stricter auth/public search/webhook limits, bounded payloads and pagination; availability controls fail safely                                        | No platform rate limiter verified; add only with endpoint-specific threat model                          |
| Secrets                  | Server-only environment store, least-privilege credentials, rotation, no real values in repo, no secret in `NEXT_PUBLIC_*`                                                                     | Inventory exists; deployed secret store/rotation not verified                                            |
| Cache leakage            | Authenticated/private responses are no-store; keys include tenant/scope and data classification; availability and authorization never use stale cache                                          | No application cache exists; auth change owns response caching                                           |
| Direct provider failure  | Explicit timeout, bounded retry for transient errors, idempotency/reconciliation, redacted diagnostics                                                                                         | Must be implemented at each adapter                                                                      |

## Append-oriented audit evidence

Application logs and audit records are different products. Logs support operations and can be sampled/retained by an operational policy. Audit records provide accountability and are append-oriented, access-controlled business/security evidence.

For material state and authority changes, the target owning transaction records or transactionally enqueues:

- event/action name and outcome;
- UTC timestamp;
- tenant and property scope;
- actor type and stable actor/membership identifier;
- target type and identifier;
- safe old/new state summary or changed-field names where appropriate;
- reason/source channel;
- request, correlation, causation, and idempotency identifiers;
- impersonation/session context where applicable;
- privacy classification and integrity/version metadata.

Audit records never contain raw credentials, provider tokens, payment instrument data, full identity documents, smart-lock secrets, cookie values, private signed URLs, or unnecessary PII. Reads, exports, retention, and legal holds are separately permissioned and audited. Audit capture for a required mutation occurs in the same PostgreSQL transaction or transactional outbox; a remote audit service is not a synchronous dependency.

The audit table/domain is not implemented in the current repository.

## Security verification requirements

Each implementing phase must use risk-based negative tests, including:

- unauthenticated, inactive, other-user, other-tenant, and other-property denial;
- spoofed headers, caller-selected IDs/actors/roles, and mass-assignment attempts;
- cross-tenant role assignment and platform/tenant scope mismatch;
- minimum DTO fields and forbidden sensitive fields in responses, logs, events, and errors;
- CSRF, redirect, webhook replay/signature, SSRF, upload/path, XSS, and rate-limit cases where those boundaries exist;
- concurrency/idempotency failures for reservations, inventory, payments, and consumers;
- disposable PostgreSQL integration tests for schema constraints and isolation;
- dependency and static security checks, with exact command/outcome recorded.

### Formal scan limitation

The mandatory preflight for the repository's formal Codex security-audit workflow could not find an executable `python` on this Windows host. Therefore the formal automated scan is **BLOCKED / NOT RUN**, not passed. Manual repository observations and ordinary tests are not equivalent coverage. The exact attempted workflow/command and its result must be captured in the change `verification.md`; readiness must carry this limitation until the scanner runs in an environment with supported Python or in CI.

## Open security decisions

- External identity provider production configuration, MFA/recovery/invitation lifecycle, and session duration.
- Property-scope grant data model and platform support/impersonation workflow.
- Indonesian privacy/legal classification, retention, erasure, data residency, and breach-response obligations.
- Object malware scanning, encryption-key ownership, CSP, WAF/rate-limiting provider, audit retention/integrity storage, and security monitoring vendor.
- Whether/where PostgreSQL RLS adds useful defense in depth after application and integration isolation tests are established.

None of these open decisions permits weakening the accepted tenant, authentication, authorization, DTO, or audit boundaries.
