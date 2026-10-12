import 'server-only';

import type { PermissionKey } from '@/modules/identity/role-catalog';
import { prisma } from '@/shared/database/prisma';
import { requirePropertyPermission } from './property-authorization';
import type {
  AuthorizedPropertyContext,
  PropertyMembershipAuthorization,
} from './property-scope-contracts';
import { PrismaPropertyScopeRepository } from './property-scope-repository';

export async function requirePersistedPropertyPermission(input: {
  membership: PropertyMembershipAuthorization | null;
  tenantId: string;
  propertyId: string;
  permission: PermissionKey;
  includeArchived?: boolean;
}): Promise<AuthorizedPropertyContext> {
  return requirePropertyPermission({
    ...input,
    scopeAuthorization: new PrismaPropertyScopeRepository(prisma),
  });
}
