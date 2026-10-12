import 'server-only';

import { AuthorizationError, requireTenantPermission } from '@/modules/identity/authorization';
import { UnauthenticatedError } from '@/modules/identity/authenticated-subject';
import type { PermissionKey } from '@/modules/identity/role-catalog';
import type { RequestTenantContext } from './tenant-context-types';

export type AuthenticatedTenantRequestContext = Omit<
  Extract<RequestTenantContext, { kind: 'tenant' }>,
  'actor' | 'membership' | 'tenant'
> & {
  actor: { userId: string };
  tenant: Extract<RequestTenantContext, { kind: 'tenant' }>['tenant'] & { status: 'ACTIVE' };
  membership: {
    membershipId: string;
    tenantId: string;
    status: 'ACTIVE';
    propertyAccessMode: 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES';
    propertyScopeVersion: number;
    permissions: readonly string[];
  };
};

export function requireAuthenticatedTenantMembership(
  context: RequestTenantContext,
): AuthenticatedTenantRequestContext {
  if (!context.actor.userId) {
    throw new UnauthenticatedError();
  }

  if (
    context.kind !== 'tenant' ||
    context.tenant.status !== 'ACTIVE' ||
    context.membership?.status !== 'ACTIVE' ||
    context.membership.tenantId !== context.tenant.id
  ) {
    throw new AuthorizationError();
  }

  return {
    ...context,
    actor: { userId: context.actor.userId },
    tenant: { ...context.tenant, status: 'ACTIVE' },
    membership: {
      membershipId: context.membership.membershipId,
      tenantId: context.tenant.id,
      status: 'ACTIVE',
      propertyAccessMode: context.membership.propertyAccessMode,
      propertyScopeVersion: context.membership.propertyScopeVersion,
      permissions: context.membership.permissions,
    },
  };
}

export function requireAuthenticatedTenantPermission(
  context: RequestTenantContext,
  permission: PermissionKey,
): AuthenticatedTenantRequestContext {
  const authorizedContext = requireAuthenticatedTenantMembership(context);
  requireTenantPermission(authorizedContext.membership, authorizedContext.tenant.id, permission);
  return authorizedContext;
}

export async function withTenantPermission<Result>(
  context: RequestTenantContext,
  permission: PermissionKey,
  protectedOperation: (context: AuthenticatedTenantRequestContext) => Promise<Result> | Result,
): Promise<Result> {
  const authorizedContext = requireAuthenticatedTenantPermission(context, permission);
  return protectedOperation(authorizedContext);
}
