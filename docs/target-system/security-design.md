# Security design

- Authentication proves an external subject; membership connects it to platform or tenant authority.
- Tenant context is derived from a trusted host and checked against the authenticated membership; a form, route parameter, slug, forwarded header, or client-supplied Tenant ID does not establish ownership.
- Authorization is deny-by-default and permission-based; roles only group permissions. Property operations also require explicit `ALL_PROPERTIES` or an active same-Tenant selected grant, and authorization completes before protected Property lookup/callback execution.
- Data access requires tenant-scoped repository methods. Cross-tenant administration uses separate platform permissions and auditable services.
- Zod validates transport input. Domain services enforce business invariants independently.
- Cookies must be Secure, HttpOnly, SameSite-appropriate, rotated, and protected against CSRF where applicable.
- Webhooks require raw-body signature verification, replay protection, idempotency, and secret rotation.
- PII/payment/identity data is classified, minimized, encrypted by managed infrastructure, redacted from logs, and retained by policy.
- Material Phase 2 Property and Property-authority mutations write one minimal successful audit record in the same PostgreSQL transaction. Changed-field names are allowlisted; request bodies, tokens, full addresses, and private contact values are excluded.

The current Phase 2 working tree fulfills the verified-subject, same-Tenant active-membership, explicit-permission, Property scope, tenant-leading repository, purpose-specific DTO, expected-version, and atomic audit application boundaries. The forward migration adds composite same-Tenant role/grant/audit references and a conservative owner-scope preflight/backfill. Five individually invoked integration files passed 29/29 tests on disposable PostgreSQL 16. Focused real tenant-host authentication and missing-permission Chromium scenarios passed after the Proxy/Host normalization correction, but the complete seven-scenario Property E2E rerun and live-provider/deployed-environment evidence remain open.

The published resolver returns only one `PUBLISHED` Property under a trusted active Tenant context and omits address lines, postal code, internal IDs/version/lifecycle metadata, staff data, and later-domain fields. No public Property enumeration route exists. Webhook security, broad audit browsing/retention, guest/payment data controls, RoomType/Unit ownership, inventory/pricing invariants, and reservation security remain gates for their future phases.
