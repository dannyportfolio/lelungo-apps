import 'server-only';

import { prisma } from '@/shared/database/prisma';

export class TenantRepository {
  async findBySubdomain(subdomain: string) {
    return prisma.tenant.findFirst({
      where: {
        domains: { some: { subdomain } },
        status: { in: ['PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
      },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  async findMembership(userId: string, tenantId: string) {
    return prisma.staffMembership.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        tenantId: true,
        status: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });
  }
}
