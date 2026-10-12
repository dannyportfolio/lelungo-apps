import type { PermissionKey } from './role-catalog';

export interface MembershipAuthorization {
  membershipId: string;
  tenantId: string | null;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
  propertyAccessMode: 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES';
  propertyScopeVersion: number;
  permissions: readonly string[];
}

export const AUTHORIZATION_DENIED_MESSAGE = 'Access denied.';

export class AuthorizationError extends Error {
  readonly code = 'AUTHORIZATION_DENIED';

  constructor() {
    super(AUTHORIZATION_DENIED_MESSAGE);
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
    throw new AuthorizationError();
  }

  if (!hasPermission(membership, permission)) {
    throw new AuthorizationError();
  }

  return membership;
}
