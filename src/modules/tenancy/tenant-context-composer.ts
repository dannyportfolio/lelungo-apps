import type { MembershipStatus } from '@prisma/client';

import type { AuthenticatedSubjectProvider } from '@/modules/identity/authenticated-subject';
import { normalizeTenantSubdomain } from './subdomain';
import {
  TenantResolutionError,
  type RequestTenantContext,
  type TenantIdentity,
} from './tenant-context-types';

interface TenantMembershipRecord {
  id: string;
  tenantId: string | null;
  status: MembershipStatus;
  propertyAccessMode: 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES' | null;
  propertyScopeVersion: number | null;
  roles: ReadonlyArray<{
    role: {
      permissions: ReadonlyArray<{ permission: { key: string } }>;
    };
  }>;
}

export interface TenantContextRepositoryPort {
  findBySubdomain(subdomain: string): Promise<TenantIdentity | null>;
  findActiveMembership(userId: string, tenantId: string): Promise<TenantMembershipRecord | null>;
}

interface ComposeRequestTenantContextInput {
  tenantSubdomain: string | null;
  correlationId: string;
  authenticatedSubjectProvider: AuthenticatedSubjectProvider;
  repository: TenantContextRepositoryPort;
}

/**
 * Explicit dependency-injection seam for the production request-context entry and unit tests.
 * Request transports must use getRequestTenantContext() instead of supplying an actor here.
 */
export async function composeRequestTenantContext(
  input: ComposeRequestTenantContextInput,
): Promise<RequestTenantContext> {
  const subject = await input.authenticatedSubjectProvider.getAuthenticatedSubject();
  const actor = { userId: subject?.userId ?? null };

  if (!input.tenantSubdomain) {
    return { kind: 'platform', actor, correlationId: input.correlationId };
  }

  const subdomain = normalizeTenantSubdomain(input.tenantSubdomain);
  const tenant = await input.repository.findBySubdomain(subdomain);

  if (!tenant) {
    throw new TenantResolutionError('The requested tenant domain is not configured.');
  }

  const resolvedMembership = actor.userId
    ? await input.repository.findActiveMembership(actor.userId, tenant.id)
    : null;
  const membership =
    resolvedMembership?.status === 'ACTIVE' &&
    resolvedMembership.tenantId === tenant.id &&
    resolvedMembership.propertyAccessMode !== null &&
    resolvedMembership.propertyScopeVersion !== null &&
    resolvedMembership.propertyScopeVersion >= 1
      ? {
          membershipId: resolvedMembership.id,
          tenantId: resolvedMembership.tenantId,
          status: resolvedMembership.status,
          propertyAccessMode: resolvedMembership.propertyAccessMode,
          propertyScopeVersion: resolvedMembership.propertyScopeVersion,
          permissions: [
            ...new Set(
              resolvedMembership.roles.flatMap(({ role }) =>
                role.permissions.map(({ permission }) => permission.key),
              ),
            ),
          ],
        }
      : null;

  return {
    kind: 'tenant',
    actor,
    correlationId: input.correlationId,
    tenant,
    membership,
  };
}
