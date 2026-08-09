import 'server-only';

import { headers } from 'next/headers';
import type { TenantStatus } from '@prisma/client';

import type { MembershipAuthorization } from '@/modules/identity/authorization';
import { TenantRepository } from './tenant-repository';
import { normalizeTenantSubdomain } from './subdomain';

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

export async function getRequestTenantContext(actor: ActorContext): Promise<RequestTenantContext> {
  const requestHeaders = await headers();
  return resolveTenantContext({
    tenantSubdomain: requestHeaders.get('x-lelungo-tenant-subdomain'),
    correlationId: requestHeaders.get('x-request-id') ?? crypto.randomUUID(),
    actor,
  });
}

export async function resolveTenantContext(input: {
  tenantSubdomain: string | null;
  correlationId: string;
  actor: ActorContext;
  repository?: TenantRepository;
}): Promise<RequestTenantContext> {
  if (!input.tenantSubdomain) {
    return { kind: 'platform', actor: input.actor, correlationId: input.correlationId };
  }

  const subdomain = normalizeTenantSubdomain(input.tenantSubdomain);
  const repository = input.repository ?? new TenantRepository();
  const tenant = await repository.findBySubdomain(subdomain);

  if (!tenant) {
    throw new TenantResolutionError('The requested tenant domain is not configured.');
  }

  const membership = input.actor.userId
    ? await repository.findMembership(input.actor.userId, tenant.id)
    : null;

  return {
    kind: 'tenant',
    actor: input.actor,
    correlationId: input.correlationId,
    tenant,
    membership: membership
      ? {
          tenantId: membership.tenantId,
          status: membership.status,
          permissions: membership.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        }
      : null,
  };
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
