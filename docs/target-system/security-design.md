# Security design

- Authentication proves an external subject; membership connects it to platform or tenant authority.
- Tenant context is derived from a trusted host and checked against the authenticated membership.
- Authorization is deny-by-default and permission-based; roles only group permissions.
- Data access requires tenant-scoped repository methods. Cross-tenant administration uses separate platform permissions and auditable services.
- Zod validates transport input. Domain services enforce business invariants independently.
- Cookies must be Secure, HttpOnly, SameSite-appropriate, rotated, and protected against CSRF where applicable.
- Webhooks require raw-body signature verification, replay protection, idempotency, and secret rotation.
- PII/payment/identity data is classified, minimized, encrypted by managed infrastructure, redacted from logs, and retained by policy.
- Security events and state mutations write immutable audit records in the same transaction or outbox.

The current code does not yet fulfill authentication, audit-log, webhook, or sensitive-domain requirements; they are gates for corresponding future features.
