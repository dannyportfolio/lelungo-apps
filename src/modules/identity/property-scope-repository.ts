import 'server-only';

import type { Prisma } from '@prisma/client';

import { decodePropertyCursor, encodePropertyCursor } from '@/modules/properties/property-cursor';
import type {
  ActiveMembershipScopeListQuery,
  BoundedPage,
  MembershipPropertyScopeSummary,
  PropertyScopeAuthorizationPort,
  PropertyScopeAuthorizationQuery,
  PropertyScopeGrantSummary,
  PropertyScopeState,
  SelectedPropertyScopeListQuery,
} from './property-scope-contracts';
import { decodeMembershipScopeCursor, encodeMembershipScopeCursor } from './property-scope-cursor';

export class PrismaPropertyScopeRepository implements PropertyScopeAuthorizationPort {
  constructor(private readonly database: Prisma.TransactionClient) {}

  async isPropertyAuthorized(query: PropertyScopeAuthorizationQuery): Promise<boolean> {
    const count = await this.database.property.count({
      where: {
        tenantId: query.tenantId,
        id: query.propertyId,
        ...(query.includeArchived ? {} : { lifecycle: { not: 'ARCHIVED' } }),
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: query.membershipId,
              tenantId: query.tenantId,
              status: 'ACTIVE',
              propertyAccessMode: query.propertyAccessMode,
              propertyScopeVersion: query.propertyScopeVersion,
              ...(query.actorUserId ? { userId: query.actorUserId } : {}),
              roles: {
                some: {
                  tenantId: query.tenantId,
                  role: {
                    tenantId: query.tenantId,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: query.permission } } },
                  },
                },
              },
            },
          },
        },
        ...(query.propertyAccessMode === 'SELECTED_PROPERTIES'
          ? {
              membershipScopes: {
                some: { tenantId: query.tenantId, membershipId: query.membershipId },
              },
            }
          : {}),
      },
    });
    return count === 1;
  }

  async findActiveScope(
    tenantId: string,
    membershipId: string,
  ): Promise<PropertyScopeState | null> {
    const membership = await this.database.staffMembership.findFirst({
      where: { tenantId, id: membershipId, status: 'ACTIVE' },
      select: {
        tenantId: true,
        id: true,
        status: true,
        propertyAccessMode: true,
        propertyScopeVersion: true,
        propertyScopes: {
          where: { tenantId, property: { lifecycle: { not: 'ARCHIVED' } } },
          select: { propertyId: true },
          orderBy: { propertyId: 'asc' },
          take: 101,
        },
      },
    });
    if (
      !membership?.tenantId ||
      !membership.propertyAccessMode ||
      !membership.propertyScopeVersion ||
      membership.propertyScopes.length > 100
    ) {
      return null;
    }
    return {
      tenantId: membership.tenantId,
      membershipId: membership.id,
      status: 'ACTIVE',
      propertyAccessMode: membership.propertyAccessMode,
      propertyScopeVersion: membership.propertyScopeVersion,
      selectedPropertyIds: membership.propertyScopes.map(({ propertyId }) => propertyId),
    };
  }

  async listActiveMembershipScopes(
    query: ActiveMembershipScopeListQuery,
  ): Promise<BoundedPage<MembershipPropertyScopeSummary>> {
    const position = query.cursor
      ? decodeMembershipScopeCursor(query.cursor, {
          tenantId: query.tenantId,
          actorMembershipId: query.actorMembershipId,
          actorUserId: query.actorUserId,
          actorScopeVersion: query.actorScopeVersion,
        })
      : null;
    const records = await this.database.staffMembership.findMany({
      where: {
        tenantId: query.tenantId,
        status: 'ACTIVE',
        propertyAccessMode: { not: null },
        propertyScopeVersion: { not: null },
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: query.actorMembershipId,
              tenantId: query.tenantId,
              userId: query.actorUserId,
              status: 'ACTIVE',
              propertyAccessMode: 'ALL_PROPERTIES',
              propertyScopeVersion: query.actorScopeVersion,
              roles: {
                some: {
                  tenantId: query.tenantId,
                  role: {
                    tenantId: query.tenantId,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: 'staff.manage' } } },
                  },
                },
              },
            },
          },
        },
        ...(position
          ? {
              OR: [
                { createdAt: { gt: position.createdAt } },
                { createdAt: position.createdAt, id: { gt: position.membershipId } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        propertyAccessMode: true,
        propertyScopeVersion: true,
        createdAt: true,
        _count: {
          select: { propertyScopes: { where: { property: { lifecycle: { not: 'ARCHIVED' } } } } },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.pageSize + 1,
    });
    const page = records.slice(0, query.pageSize);
    const last = page.at(-1);
    return {
      items: page.flatMap((record) =>
        record.propertyAccessMode && record.propertyScopeVersion
          ? [
              {
                membershipId: record.id,
                status: 'ACTIVE' as const,
                propertyAccessMode: record.propertyAccessMode,
                propertyScopeVersion: record.propertyScopeVersion,
                selectedPropertyCount: record._count.propertyScopes,
              },
            ]
          : [],
      ),
      nextCursor:
        records.length > query.pageSize && last
          ? encodeMembershipScopeCursor(
              { createdAt: last.createdAt, membershipId: last.id },
              {
                tenantId: query.tenantId,
                actorMembershipId: query.actorMembershipId,
                actorUserId: query.actorUserId,
                actorScopeVersion: query.actorScopeVersion,
              },
            )
          : null,
    };
  }

  async listSelectedPropertyScopes(
    query: SelectedPropertyScopeListQuery,
  ): Promise<BoundedPage<PropertyScopeGrantSummary>> {
    const position = query.cursor
      ? decodePropertyCursor(query.cursor, {
          tenantId: query.tenantId,
          membershipId: query.membershipId,
          accessMode: 'SELECTED_PROPERTIES',
          scopeVersion: query.propertyScopeVersion,
          filters: {
            purpose: 'scope-admin',
            actorMembershipId: query.actorMembershipId,
            actorUserId: query.actorUserId,
            actorScopeVersion: query.actorScopeVersion,
          },
        })
      : null;
    const records = await this.database.property.findMany({
      where: {
        tenantId: query.tenantId,
        lifecycle: { not: 'ARCHIVED' },
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: query.actorMembershipId,
              tenantId: query.tenantId,
              userId: query.actorUserId,
              status: 'ACTIVE',
              propertyAccessMode: 'ALL_PROPERTIES',
              propertyScopeVersion: query.actorScopeVersion,
              roles: {
                some: {
                  tenantId: query.tenantId,
                  role: {
                    tenantId: query.tenantId,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: 'staff.manage' } } },
                  },
                },
              },
            },
          },
        },
        membershipScopes: {
          some: {
            tenantId: query.tenantId,
            membershipId: query.membershipId,
            membership: {
              status: 'ACTIVE',
              propertyAccessMode: 'SELECTED_PROPERTIES',
              propertyScopeVersion: query.propertyScopeVersion,
            },
          },
        },
        ...(position
          ? {
              OR: [
                { slug: { gt: position.slug } },
                { slug: position.slug, id: { gt: position.propertyId } },
              ],
            }
          : {}),
      },
      select: { id: true, slug: true, name: true },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      take: query.pageSize + 1,
    });
    const page = records.slice(0, query.pageSize);
    const last = page.at(-1);
    return {
      items: page.map((property) => ({
        propertyId: property.id,
        propertySlug: property.slug,
        propertyName: property.name,
      })),
      nextCursor:
        records.length > query.pageSize && last
          ? encodePropertyCursor(
              { slug: last.slug, propertyId: last.id },
              {
                tenantId: query.tenantId,
                membershipId: query.membershipId,
                accessMode: 'SELECTED_PROPERTIES',
                scopeVersion: query.propertyScopeVersion,
                filters: {
                  purpose: 'scope-admin',
                  actorMembershipId: query.actorMembershipId,
                  actorUserId: query.actorUserId,
                  actorScopeVersion: query.actorScopeVersion,
                },
              },
            )
          : null,
    };
  }
}
