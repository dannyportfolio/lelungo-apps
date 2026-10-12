import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaPropertyScopeRepository } from '@/modules/identity/property-scope-repository';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_USER_ID = '33333333-3333-4333-8333-333333333333';
const TARGET_MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444';

function transactionClient(database: object): Prisma.TransactionClient {
  return database as Prisma.TransactionClient;
}

describe('Property scope repository bounded lists', () => {
  it('returns a bounded minimum-field membership page and an actor-bound cursor', async () => {
    const createdAt = new Date('2026-08-12T00:00:00.000Z');
    const records = [1, 2, 3].map((index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      status: 'ACTIVE' as const,
      propertyAccessMode:
        index === 1 ? ('ALL_PROPERTIES' as const) : ('SELECTED_PROPERTIES' as const),
      propertyScopeVersion: index,
      createdAt,
      _count: { propertyScopes: index - 1 },
    }));
    const findMany = vi.fn().mockResolvedValue(records);
    const repository = new PrismaPropertyScopeRepository(
      transactionClient({ staffMembership: { findMany } }),
    );

    const page = await repository.listActiveMembershipScopes({
      tenantId: TENANT_ID,
      actorMembershipId: ACTOR_MEMBERSHIP_ID,
      actorUserId: ACTOR_USER_ID,
      actorScopeVersion: 5,
      pageSize: 2,
      cursor: null,
    });

    expect(page.items).toEqual([
      {
        membershipId: records[0]?.id,
        status: 'ACTIVE',
        propertyAccessMode: 'ALL_PROPERTIES',
        propertyScopeVersion: 1,
        selectedPropertyCount: 0,
      },
      {
        membershipId: records[1]?.id,
        status: 'ACTIVE',
        propertyAccessMode: 'SELECTED_PROPERTIES',
        propertyScopeVersion: 2,
        selectedPropertyCount: 1,
      },
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
    const query = findMany.mock.calls[0]?.[0];
    expect(query.take).toBe(3);
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(query.where.tenant.memberships.some).toMatchObject({
      id: ACTOR_MEMBERSHIP_ID,
      userId: ACTOR_USER_ID,
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: 5,
    });
    expect(query.select).not.toHaveProperty('userId');
    expect(query.select).not.toHaveProperty('roles');
  });

  it('bounds selected grants and rechecks active target mode/version in the same query', async () => {
    const properties = [1, 2, 3].map((index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      slug: `property-${index}`,
      name: `Property ${index}`,
    }));
    const findMany = vi.fn().mockResolvedValue(properties);
    const repository = new PrismaPropertyScopeRepository(
      transactionClient({ property: { findMany } }),
    );

    const page = await repository.listSelectedPropertyScopes({
      tenantId: TENANT_ID,
      actorMembershipId: ACTOR_MEMBERSHIP_ID,
      actorUserId: ACTOR_USER_ID,
      actorScopeVersion: 5,
      membershipId: TARGET_MEMBERSHIP_ID,
      propertyScopeVersion: 9,
      pageSize: 2,
      cursor: null,
    });

    expect(page.items.map(({ propertyId }) => propertyId)).toEqual([
      properties[0]?.id,
      properties[1]?.id,
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
    const query = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        tenantId: TENANT_ID,
        lifecycle: { not: 'ARCHIVED' },
        membershipScopes: {
          some: {
            tenantId: TENANT_ID,
            membershipId: TARGET_MEMBERSHIP_ID,
            membership: {
              status: 'ACTIVE',
              propertyAccessMode: 'SELECTED_PROPERTIES',
              propertyScopeVersion: 9,
            },
          },
        },
      },
      select: { id: true, slug: true, name: true },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      take: 3,
    });
  });

  it('uses a 101-row overflow sentinel and fails closed on oversized retained scope state', async () => {
    const propertyScopes = Array.from({ length: 101 }, (_, index) => ({
      propertyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }));
    const findFirst = vi.fn().mockResolvedValue({
      tenantId: TENANT_ID,
      id: TARGET_MEMBERSHIP_ID,
      status: 'ACTIVE',
      propertyAccessMode: 'SELECTED_PROPERTIES',
      propertyScopeVersion: 4,
      propertyScopes,
    });
    const repository = new PrismaPropertyScopeRepository(
      transactionClient({ staffMembership: { findFirst } }),
    );

    await expect(repository.findActiveScope(TENANT_ID, TARGET_MEMBERSHIP_ID)).resolves.toBeNull();
    expect(findFirst.mock.calls[0]?.[0].select.propertyScopes.take).toBe(101);
  });
});
