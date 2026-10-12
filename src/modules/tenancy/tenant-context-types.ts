import type { TenantStatus } from '@prisma/client';

import type { MembershipAuthorization } from '@/modules/identity/authorization';

export interface ActorContext {
  userId: string | null;
}

export interface TenantIdentity {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
}

export type RequestTenantContext =
  | { kind: 'platform'; actor: ActorContext; correlationId: string }
  | {
      kind: 'tenant';
      actor: ActorContext;
      correlationId: string;
      tenant: TenantIdentity;
      membership: MembershipAuthorization | null;
    };

export class TenantResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantResolutionError';
  }
}

export function requireTenantContext(
  context: RequestTenantContext,
): Extract<RequestTenantContext, { kind: 'tenant' }> {
  if (context.kind !== 'tenant') {
    throw new TenantResolutionError('This operation requires a tenant-scoped request.');
  }

  return context;
}

export function applyTenantScope<T extends Record<string, unknown>>(
  context: Extract<RequestTenantContext, { kind: 'tenant' }>,
  where: T,
): T & { tenantId: string } {
  const suppliedTenantId = where.tenantId;
  if (typeof suppliedTenantId === 'string' && suppliedTenantId !== context.tenant.id) {
    throw new TenantResolutionError('Tenant scope cannot be selected by the caller.');
  }

  return { ...where, tenantId: context.tenant.id };
}
