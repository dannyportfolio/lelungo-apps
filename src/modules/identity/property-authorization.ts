import type { PermissionKey } from './role-catalog';
import { AuthorizationError, requireTenantPermission } from './authorization';
import {
  isPositiveScopeVersion,
  isPropertyAccessMode,
  type AuthorizedPropertyContext,
  type AuthorizedPropertyCreationContext,
  type AuthorizedPropertyListScope,
  type AuthorizedPropertyScopeAdministrator,
  type PropertyMembershipAuthorization,
  type PropertyScopeAuthorizationPort,
  type ResolvedPropertyMembershipAuthorization,
} from './property-scope-contracts';

function requireResolvedPropertyMembership(
  membership: PropertyMembershipAuthorization | null,
  tenantId: string,
  permission: PermissionKey,
): ResolvedPropertyMembershipAuthorization {
  requireTenantPermission(membership, tenantId, permission);

  if (
    !membership ||
    membership.tenantId !== tenantId ||
    membership.status !== 'ACTIVE' ||
    !membership.membershipId ||
    !isPropertyAccessMode(membership.propertyAccessMode) ||
    !isPositiveScopeVersion(membership.propertyScopeVersion)
  ) {
    throw new AuthorizationError();
  }

  return membership as ResolvedPropertyMembershipAuthorization;
}

export function requireAuthorizedPropertyListScope(
  membership: PropertyMembershipAuthorization | null,
  tenantId: string,
  permission: PermissionKey = 'property.read',
): AuthorizedPropertyListScope {
  const authorizedMembership = requireResolvedPropertyMembership(membership, tenantId, permission);

  return {
    kind: authorizedMembership.propertyAccessMode,
    tenantId,
    membershipId: authorizedMembership.membershipId,
    propertyScopeVersion: authorizedMembership.propertyScopeVersion,
  };
}

export async function requirePropertyPermission(input: {
  membership: PropertyMembershipAuthorization | null;
  tenantId: string;
  propertyId: string;
  permission: PermissionKey;
  scopeAuthorization: PropertyScopeAuthorizationPort;
  includeArchived?: boolean;
}): Promise<AuthorizedPropertyContext> {
  const membership = requireResolvedPropertyMembership(
    input.membership,
    input.tenantId,
    input.permission,
  );

  const authorized = await input.scopeAuthorization.isPropertyAuthorized({
    tenantId: input.tenantId,
    membershipId: membership.membershipId,
    propertyId: input.propertyId,
    permission: input.permission,
    propertyAccessMode: membership.propertyAccessMode,
    propertyScopeVersion: membership.propertyScopeVersion,
    includeArchived: input.includeArchived ?? false,
  });

  if (!authorized) {
    throw new AuthorizationError();
  }

  return {
    tenantId: input.tenantId,
    membershipId: membership.membershipId,
    propertyId: input.propertyId,
    propertyAccessMode: membership.propertyAccessMode,
    propertyScopeVersion: membership.propertyScopeVersion,
  };
}

export async function withPropertyPermission<Result>(
  input: Parameters<typeof requirePropertyPermission>[0],
  protectedOperation: (context: AuthorizedPropertyContext) => Promise<Result> | Result,
): Promise<Result> {
  const context = await requirePropertyPermission(input);
  return protectedOperation(context);
}

export function requirePropertyCreationPermission(
  membership: PropertyMembershipAuthorization | null,
  tenantId: string,
): AuthorizedPropertyCreationContext {
  const authorizedMembership = requireResolvedPropertyMembership(
    membership,
    tenantId,
    'property.manage',
  );

  if (authorizedMembership.propertyAccessMode !== 'ALL_PROPERTIES') {
    throw new AuthorizationError();
  }

  return {
    tenantId,
    membershipId: authorizedMembership.membershipId,
    propertyAccessMode: 'ALL_PROPERTIES',
    propertyScopeVersion: authorizedMembership.propertyScopeVersion,
  };
}

export function requirePropertyScopeAdministrator(
  membership: PropertyMembershipAuthorization | null,
  tenantId: string,
  targetMembershipId: string,
): AuthorizedPropertyScopeAdministrator {
  const authorizedMembership = requireResolvedPropertyMembership(
    membership,
    tenantId,
    'staff.manage',
  );

  if (
    authorizedMembership.propertyAccessMode !== 'ALL_PROPERTIES' ||
    !targetMembershipId ||
    targetMembershipId === authorizedMembership.membershipId
  ) {
    throw new AuthorizationError();
  }

  return {
    tenantId,
    actorMembershipId: authorizedMembership.membershipId,
    targetMembershipId,
    propertyScopeVersion: authorizedMembership.propertyScopeVersion,
  };
}
