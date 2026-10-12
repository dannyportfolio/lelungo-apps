import 'server-only';

import { z } from 'zod';

import { ensureInitialRoles } from '@/modules/identity/role-catalog';
import { prisma } from '@/shared/database/prisma';
import { normalizeTenantSubdomain } from './subdomain';

const createTenantInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subdomain: z.string().trim().min(1).max(63),
  ownerUserId: z.string().uuid(),
});

/**
 * Callers must authorize the platform actor before invoking this service;
 * ownerUserId is never accepted directly from an untrusted browser payload.
 */
export async function createTenant(input: z.input<typeof createTenantInputSchema>) {
  const parsed = createTenantInputSchema.parse(input);
  const subdomain = normalizeTenantSubdomain(parsed.subdomain);

  return prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.create({
      data: {
        name: parsed.name,
        slug: subdomain,
        status: 'PENDING',
        domains: { create: { subdomain, isPrimary: true } },
      },
      select: { id: true, name: true, slug: true, status: true },
    });

    await ensureInitialRoles(transaction, 'TENANT', tenant.id);

    const ownerRole = await transaction.role.findFirst({
      where: { tenantId: tenant.id, scope: 'TENANT', key: 'TENANT_OWNER' },
      select: { id: true },
    });

    if (!ownerRole) {
      throw new Error('Tenant owner role was not initialized.');
    }

    const ownerMembership = await transaction.staffMembership.create({
      data: {
        userId: parsed.ownerUserId,
        tenantId: tenant.id,
        status: 'ACTIVE',
        propertyAccessMode: 'ALL_PROPERTIES',
        propertyScopeVersion: 1,
        roles: { create: { roleId: ownerRole.id } },
      },
      select: { id: true, propertyScopeVersion: true },
    });

    await transaction.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorType: 'SYSTEM',
        actorId: 'tenant-provisioning',
        action: 'TENANT_OWNER_PROPERTY_SCOPE_BOOTSTRAPPED',
        targetType: 'STAFF_MEMBERSHIP',
        targetId: ownerMembership.id,
        result: 'SUCCEEDED',
        aggregateVersion: ownerMembership.propertyScopeVersion,
        previousScopeVersion: null,
        resultingScopeVersion: ownerMembership.propertyScopeVersion,
        correlationId: crypto.randomUUID(),
        changedFields: ['propertyAccessMode', 'propertyScopeVersion'],
      },
    });

    return tenant;
  });
}
