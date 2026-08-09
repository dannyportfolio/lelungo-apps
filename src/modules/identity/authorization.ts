import type { PermissionKey } from './role-catalog';

export interface MembershipAuthorization {
  tenantId: string | null;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
  permissions: readonly string[];
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function hasPermission(
  membership: MembershipAuthorization | null,
  permission: PermissionKey,
): boolean {
  return membership?.status === 'ACTIVE' && membership.permissions.includes(permission);
}

export function requireTenantPermission(
  membership: MembershipAuthorization | null,
  tenantId: string,
  permission: PermissionKey,
): MembershipAuthorization {
  if (!membership || membership.tenantId !== tenantId) {
    throw new AuthorizationError('An active membership for this tenant is required.');
  }

  if (!hasPermission(membership, permission)) {
    throw new AuthorizationError(`Missing required permission: ${permission}`);
  }

  return membership;
}
