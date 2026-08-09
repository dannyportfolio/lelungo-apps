# Current architecture

## Runtime

Lelungo is a Next.js 16 App Router application on React 19 and strict TypeScript. Node.js 22 is the supported baseline and npm is the only package manager. The frontend and server route handlers deploy as one unit.

## Request path

```text
Browser -> Next.js proxy -> App Router page/API -> legacy library or domain module -> Supabase/PostgreSQL/external API
```

The proxy derives only a normalized tenant subdomain. Server code resolves that subdomain through `TenantRepository`; authorization context is derived from an active staff membership. The client cannot establish tenant authority by submitting a tenant ID.

## Implemented boundaries

- Presentation: Server and Client Components under `src/app` and `src/components`.
- Transport: Next.js route handlers.
- Domain foundation: `src/modules/tenancy` and `src/modules/identity`.
- Persistence: Prisma for the target transactional database; Supabase SDK for legacy click analytics.
- Validation: Zod at the click endpoint and typed pure functions for tenancy/RBAC.

No user authentication adapter is integrated. Staff membership references an external user UUID but does not itself authenticate a request. This is a known boundary, not an implicit authentication system.
