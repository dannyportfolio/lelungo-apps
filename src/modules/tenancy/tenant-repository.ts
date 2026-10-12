import 'server-only';

import { prisma } from '@/shared/database/prisma';
import type { TenantContextRepositoryPort } from './tenant-context-composer';
import { createActiveMembershipQuery } from './tenant-repository-query';

export class TenantRepository implements TenantContextRepositoryPort {
  async findBySubdomain(subdomain: string) {
    const tenant = await prisma.tenant.findFirst({
      where: {
        domains: { some: { subdomain } },
        status: { in: ['PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
      },
      select: { id: true, name: true, slug: true, status: true },
    });
    return tenant;
  }

  async findActiveMembership(userId: string, tenantId: string) {
    const membership = await prisma.staffMembership.findFirst(
      createActiveMembershipQuery(userId, tenantId),
    );
    return membership;
  }
}
