import type { Prisma } from '@prisma/client';

export function createActiveMembershipQuery(userId: string, tenantId: string) {
  return {
    where: { userId, tenantId, status: 'ACTIVE' },
    select: {
      id: true,
      tenantId: true,
      status: true,
      propertyAccessMode: true,
      propertyScopeVersion: true,
      roles: {
        where: { tenantId, role: { tenantId, scope: 'TENANT' } },
        select: {
          role: {
            select: {
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  } as const satisfies Prisma.StaffMembershipFindFirstArgs;
}
