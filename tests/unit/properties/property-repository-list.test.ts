import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaPropertyRepository } from '@/modules/properties/property-repository';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';

function summaryRecord(index: number, slug: string) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slug,
    name: `Property ${index}`,
    classificationKey: 'VILLA',
    timezone: 'Asia/Jakarta',
    lifecycle: 'DRAFT' as const,
    version: 1,
    createdAt: new Date(`2026-08-${String(index).padStart(2, '0')}T00:00:00.000Z`),
    updatedAt: new Date(`2026-08-${String(index).padStart(2, '0')}T00:00:00.000Z`),
    tenant: { status: 'ACTIVE' as const },
    address: { locality: 'Sleman', adminArea: 'DI Yogyakarta' },
  };
}

function repositoryWith(findMany: ReturnType<typeof vi.fn>): PrismaPropertyRepository {
  return new PrismaPropertyRepository({
    property: { findMany },
  } as unknown as Prisma.TransactionClient);
}

describe('Property repository authorized list', () => {
  it('returns an empty bounded page from a tenant-leading permission query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = repositoryWith(findMany);

    await expect(
      repository.listAuthorized({
        scope: {
          kind: 'ALL_PROPERTIES',
          tenantId: TENANT_ID,
          membershipId: MEMBERSHIP_ID,
          propertyScopeVersion: 3,
        },
        pageSize: 25,
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });

    const query = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        tenantId: TENANT_ID,
        lifecycle: { not: 'ARCHIVED' },
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              status: 'ACTIVE',
              propertyAccessMode: 'ALL_PROPERTIES',
              propertyScopeVersion: 3,
              roles: {
                some: {
                  tenantId: TENANT_ID,
                  role: {
                    tenantId: TENANT_ID,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: 'property.read' } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      take: 26,
    });
    expect(query.where).not.toHaveProperty('membershipScopes');
  });

  it('paginates selected scope by slug and stable Property ID without leaking the lookahead row', async () => {
    const first = summaryRecord(1, 'alpha');
    const second = summaryRecord(2, 'bravo');
    const third = summaryRecord(3, 'charlie');
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([first, second, third])
      .mockResolvedValueOnce([third]);
    const repository = repositoryWith(findMany);
    const scope = {
      kind: 'SELECTED_PROPERTIES' as const,
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      propertyScopeVersion: 7,
    };

    const firstPage = await repository.listAuthorized({ scope, pageSize: 2 });
    expect(firstPage.items.map(({ id }) => id)).toEqual([first.id, second.id]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await repository.listAuthorized({
      scope,
      pageSize: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.items.map(({ id }) => id)).toEqual([third.id]);
    expect(secondPage.nextCursor).toBeNull();

    const firstQuery = findMany.mock.calls[0]?.[0];
    expect(firstQuery.where.membershipScopes).toEqual({
      some: { tenantId: TENANT_ID, membershipId: MEMBERSHIP_ID },
    });
    expect(firstQuery.take).toBe(3);
    const secondQuery = findMany.mock.calls[1]?.[0];
    expect(secondQuery.where.OR).toEqual([
      { slug: { gt: second.slug } },
      { slug: second.slug, id: { gt: second.id } },
    ]);
  });
});
