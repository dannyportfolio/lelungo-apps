import type { Prisma, RoleScope } from '@prisma/client';

export const PERMISSIONS = [
  ['tenant.read', 'View tenant configuration'],
  ['tenant.manage', 'Manage tenant configuration'],
  ['tenant.impersonate', 'Start an audited tenant support session'],
  ['property.read', 'View property data'],
  ['property.manage', 'Manage property data'],
  ['booking.read', 'View bookings'],
  ['booking.create', 'Create bookings'],
  ['booking.update', 'Update bookings'],
  ['booking.cancel', 'Cancel bookings'],
  ['booking.checkin', 'Check guests in'],
  ['booking.checkout', 'Check guests out'],
  ['payment.read', 'View guest payments'],
  ['payment.create', 'Record guest payments'],
  ['payment.refund', 'Issue guest refunds'],
  ['guest.read', 'View guest records'],
  ['guest.identity.read', 'View sensitive guest identity data'],
  ['room.manage', 'Manage rooms and assignments'],
  ['housekeeping.read', 'View housekeeping tasks'],
  ['housekeeping.update', 'Update housekeeping tasks'],
  ['maintenance.manage', 'Manage maintenance issues'],
  ['report.financial.read', 'View financial reports'],
  ['staff.manage', 'Manage tenant staff'],
  ['integration.manage', 'Manage tenant integrations'],
  ['tenant.billing.read', 'View tenant subscription billing'],
  ['tenant.billing.manage', 'Manage tenant subscription billing'],
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number][0];

export const ROLE_DEFINITIONS: ReadonlyArray<{
  key: string;
  name: string;
  scope: RoleScope;
  permissions: readonly PermissionKey[];
}> = [
  {
    key: 'PLATFORM_SUPER_ADMIN',
    name: 'Platform Super Admin',
    scope: 'PLATFORM',
    permissions: PERMISSIONS.map(([key]) => key),
  },
  {
    key: 'PLATFORM_SUPPORT',
    name: 'Platform Support',
    scope: 'PLATFORM',
    permissions: ['tenant.read', 'tenant.impersonate'],
  },
  {
    key: 'PLATFORM_FINANCE',
    name: 'Platform Finance',
    scope: 'PLATFORM',
    permissions: ['tenant.read', 'tenant.billing.read', 'tenant.billing.manage'],
  },
  {
    key: 'TENANT_OWNER',
    name: 'Tenant Owner',
    scope: 'TENANT',
    permissions: PERMISSIONS.map(([key]) => key).filter((key) => key !== 'tenant.impersonate'),
  },
  {
    key: 'PROPERTY_MANAGER',
    name: 'Property Manager',
    scope: 'TENANT',
    permissions: [
      'property.read',
      'property.manage',
      'booking.read',
      'booking.create',
      'booking.update',
      'booking.cancel',
      'booking.checkin',
      'booking.checkout',
      'payment.read',
      'payment.create',
      'guest.read',
      'room.manage',
      'housekeeping.read',
      'housekeeping.update',
      'maintenance.manage',
    ],
  },
  {
    key: 'FRONT_DESK',
    name: 'Front Desk',
    scope: 'TENANT',
    permissions: [
      'property.read',
      'booking.read',
      'booking.create',
      'booking.update',
      'booking.checkin',
      'booking.checkout',
      'payment.read',
      'payment.create',
      'guest.read',
    ],
  },
  {
    key: 'FINANCE',
    name: 'Finance',
    scope: 'TENANT',
    permissions: [
      'booking.read',
      'payment.read',
      'payment.create',
      'payment.refund',
      'guest.read',
      'report.financial.read',
    ],
  },
  {
    key: 'HOUSEKEEPING',
    name: 'Housekeeping',
    scope: 'TENANT',
    permissions: ['property.read', 'housekeeping.read', 'housekeeping.update'],
  },
  {
    key: 'MAINTENANCE',
    name: 'Maintenance',
    scope: 'TENANT',
    permissions: ['property.read', 'maintenance.manage'],
  },
];

export async function ensureInitialRoles(
  database: Prisma.TransactionClient,
  scope: RoleScope,
  tenantId: string | null,
): Promise<void> {
  const definitions = ROLE_DEFINITIONS.filter((role) => role.scope === scope);

  for (const [key, description] of PERMISSIONS) {
    await database.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  for (const definition of definitions) {
    const role =
      (await database.role.findFirst({
        where: { key: definition.key, scope, tenantId },
      })) ??
      (await database.role.create({
        data: { key: definition.key, name: definition.name, scope, tenantId },
      }));

    const permissions = await database.permission.findMany({
      where: { key: { in: [...definition.permissions] } },
      select: { id: true },
    });

    await database.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }
}
