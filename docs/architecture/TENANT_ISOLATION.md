# Tenant Isolation

Phase 1 establishes the tenant boundary but deliberately does not add booking or payment data.

1. `proxy.ts` derives a normalized subdomain from the actual request hostname and overwrites `x-lelungo-tenant-subdomain` on every matching request.
2. Server code resolves that normalized subdomain through `TenantRepository`; it never treats a request body, query parameter, or caller-provided tenant ID as authoritative.
3. `RequestTenantContext` contains the resolved tenant, authenticated actor, active membership, and correlation ID. `applyTenantScope` provides the required tenant ID and rejects conflicting values.
4. `requireTenantPermission` confirms an active membership belongs to the resolved tenant before granting an explicit permission.

All future tenant repositories must take a tenant context (or its resolved tenant ID from a context) and use explicit selections/DTOs. Platform queries and future impersonation are separate, explicitly authorized flows.
