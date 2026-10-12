import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '@/modules/identity/authorization';
import { requirePersistedPropertyPermission } from '@/modules/identity/property-authorization-service';
import type { PropertyMembershipAuthorization } from '@/modules/identity/property-scope-contracts';
import { PropertyScopeConflictError } from '@/modules/identity/property-scope-errors';
import { PrismaPropertyScopeRepository } from '@/modules/identity/property-scope-repository';
import {
  grantPropertyScope,
  replacePropertyAccessMode,
} from '@/modules/identity/property-scope-service';
import {
  PropertyConflictError,
  PropertyValidationError,
} from '@/modules/properties/property-errors';
import {
  createProperty,
  listProperties,
  updateProperty,
  type PropertyStaffActor,
} from '@/modules/properties/property-service';
import { createTenant } from '@/modules/tenancy/tenant-service';
import { prisma } from '@/shared/database/prisma';
import { IntegrationTestRecordRegistry } from './support/test-record-registry';

const records = new IntegrationTestRecordRegistry();

async function trackedTenant() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const ownerUserId = randomUUID();
  const tenant = await createTenant({
    name: `Property regression ${suffix}`,
    subdomain: `regression-${suffix}`,
    ownerUserId,
  });
  records.trackTenant(tenant.id);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE' } });
  const persistedOwner = await prisma.staffMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, userId: ownerUserId, propertyAccessMode: 'ALL_PROPERTIES' },
    select: { id: true, propertyScopeVersion: true },
  });
  if (persistedOwner.propertyScopeVersion === null) {
    throw new Error('Tenant owner bootstrap must persist a Property scope version.');
  }
  return {
    tenant,
    ownerUserId,
    owner: {
      id: persistedOwner.id,
      propertyScopeVersion: persistedOwner.propertyScopeVersion,
    },
  };
}

async function createPropertyRecord(
  tenantId: string,
  slug = `property-${randomUUID().slice(0, 8)}`,
) {
  return prisma.property.create({
    data: {
      tenantId,
      name: 'Property regression',
      slug,
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        create: {
          line1: 'Jalan Regression 1',
          locality: 'Sleman',
          adminArea: 'DI Yogyakarta',
          countryCode: 'ID',
        },
      },
    },
    select: { id: true, name: true, version: true },
  });
}

async function createTargetMembership(input: {
  tenantId: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  propertyAccessMode?: 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES';
  roleKey?: 'TENANT_OWNER' | 'PROPERTY_MANAGER';
}) {
  const userId = randomUUID();
  const membership = await prisma.staffMembership.create({
    data: {
      tenantId: input.tenantId,
      userId,
      status: input.status ?? 'ACTIVE',
      propertyAccessMode: input.propertyAccessMode ?? 'SELECTED_PROPERTIES',
      propertyScopeVersion: 1,
    },
    select: { id: true },
  });
  if (input.roleKey) {
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: input.tenantId, key: input.roleKey },
      select: { id: true },
    });
    await prisma.staffMembershipRole.create({
      data: {
        tenantId: input.tenantId,
        membershipId: membership.id,
        roleId: role.id,
      },
    });
  }
  return { id: membership.id, userId };
}

function ownerActor(owner: Awaited<ReturnType<typeof trackedTenant>>): PropertyStaffActor {
  return {
    userId: owner.ownerUserId,
    membershipId: owner.owner.id,
    correlationId: randomUUID(),
  };
}

function ownerScopeAuthority(
  owner: Awaited<ReturnType<typeof trackedTenant>>,
  targetMembershipId: string,
) {
  return {
    tenantId: owner.tenant.id,
    actorMembershipId: owner.owner.id,
    targetMembershipId,
    propertyScopeVersion: owner.owner.propertyScopeVersion,
  };
}

afterEach(async () => records.cleanup(prisma));
afterAll(async () => prisma.$disconnect());

describe('Property service PostgreSQL regressions', () => {
  it('denies a known cross-Tenant Property before mutation or audit', async () => {
    const first = await trackedTenant();
    const second = await trackedTenant();
    const foreignProperty = await createPropertyRecord(second.tenant.id);

    await expect(
      updateProperty(
        {
          tenantId: first.tenant.id,
          membershipId: first.owner.id,
          propertyId: foreignProperty.id,
          propertyAccessMode: 'ALL_PROPERTIES',
          propertyScopeVersion: first.owner.propertyScopeVersion,
        },
        ownerActor(first),
        {
          propertyId: foreignProperty.id,
          expectedVersion: foreignProperty.version,
          name: 'Cross-Tenant overwrite',
        },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await expect(
      prisma.property.findUniqueOrThrow({
        where: { id: foreignProperty.id },
        select: { name: true, version: true },
      }),
    ).resolves.toEqual({ name: foreignProperty.name, version: 1 });
    await expect(
      prisma.auditEvent.count({
        where: {
          tenantId: second.tenant.id,
          propertyId: foreignProperty.id,
          action: 'PROPERTY_PROFILE_UPDATED',
        },
      }),
    ).resolves.toBe(0);
  });

  it('accepts exactly one of two concurrent Property service writers', async () => {
    const owner = await trackedTenant();
    const property = await createPropertyRecord(owner.tenant.id);
    const authority = {
      tenantId: owner.tenant.id,
      membershipId: owner.owner.id,
      propertyId: property.id,
      propertyAccessMode: 'ALL_PROPERTIES' as const,
      propertyScopeVersion: owner.owner.propertyScopeVersion,
    };

    const results = await Promise.allSettled([
      updateProperty(authority, ownerActor(owner), {
        propertyId: property.id,
        expectedVersion: property.version,
        name: 'Concurrent writer A',
      }),
      updateProperty(authority, ownerActor(owner), {
        propertyId: property.id,
        expectedVersion: property.version,
        name: 'Concurrent writer B',
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(PropertyConflictError);
    }
    const persisted = await prisma.property.findUniqueOrThrow({
      where: { id: property.id },
      select: { name: true, version: true },
    });
    expect(['Concurrent writer A', 'Concurrent writer B']).toContain(persisted.name);
    expect(persisted.version).toBe(2);
    await expect(
      prisma.auditEvent.findMany({
        where: {
          tenantId: owner.tenant.id,
          propertyId: property.id,
          action: 'PROPERTY_PROFILE_UPDATED',
        },
        select: { aggregateVersion: true },
      }),
    ).resolves.toEqual([{ aggregateVersion: 2 }]);
  });

  it('rejects inactive classifications and amenities without partial creation or audit', async () => {
    const owner = await trackedTenant();
    const authority = {
      tenantId: owner.tenant.id,
      membershipId: owner.owner.id,
      propertyAccessMode: 'ALL_PROPERTIES' as const,
      propertyScopeVersion: owner.owner.propertyScopeVersion,
    };
    const classificationSlug = `inactive-classification-${randomUUID().slice(0, 8)}`;
    const amenitySlug = `inactive-amenity-${randomUUID().slice(0, 8)}`;
    const input = (slug: string) => ({
      name: 'Inactive catalog Property',
      slug,
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        line1: 'Jalan Catalog 1',
        locality: 'Sleman',
        adminArea: 'DI Yogyakarta',
        countryCode: 'ID',
      },
      amenityKeys: [] as string[],
      shortDescription: null,
      publicWhatsAppE164: null,
    });

    try {
      await prisma.propertyClassification.update({
        where: { key: 'VILLA' },
        data: { isActive: false },
      });
      await expect(
        createProperty(authority, ownerActor(owner), input(classificationSlug)),
      ).rejects.toBeInstanceOf(PropertyValidationError);
      await prisma.propertyClassification.update({
        where: { key: 'VILLA' },
        data: { isActive: true },
      });

      await prisma.amenity.update({ where: { key: 'KITCHEN' }, data: { isActive: false } });
      await expect(
        createProperty(authority, ownerActor(owner), {
          ...input(amenitySlug),
          amenityKeys: ['KITCHEN'],
        }),
      ).rejects.toBeInstanceOf(PropertyValidationError);
    } finally {
      await Promise.all([
        prisma.propertyClassification.update({
          where: { key: 'VILLA' },
          data: { isActive: true },
        }),
        prisma.amenity.update({ where: { key: 'KITCHEN' }, data: { isActive: true } }),
      ]);
    }

    await expect(
      prisma.property.count({
        where: { tenantId: owner.tenant.id, slug: { in: [classificationSlug, amenitySlug] } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditEvent.count({
        where: { tenantId: owner.tenant.id, action: 'PROPERTY_CREATED' },
      }),
    ).resolves.toBe(0);
  });

  it('paginates an authorized Property list deterministically with minimum summary fields', async () => {
    const owner = await trackedTenant();
    const suffix = randomUUID().slice(0, 8);
    await Promise.all([
      createPropertyRecord(owner.tenant.id, `page-${suffix}-c`),
      createPropertyRecord(owner.tenant.id, `page-${suffix}-a`),
      createPropertyRecord(owner.tenant.id, `page-${suffix}-b`),
    ]);
    const scope = {
      kind: 'ALL_PROPERTIES' as const,
      tenantId: owner.tenant.id,
      membershipId: owner.owner.id,
      propertyScopeVersion: owner.owner.propertyScopeVersion,
    };

    const firstPage = await listProperties(scope, { pageSize: 2 });
    const repeatedPage = await listProperties(scope, { pageSize: 2 });
    expect(repeatedPage).toEqual(firstPage);
    expect(firstPage.items.map(({ slug }) => slug)).toEqual([
      `page-${suffix}-a`,
      `page-${suffix}-b`,
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const secondPage = await listProperties(scope, {
      pageSize: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.items.map(({ slug }) => slug)).toEqual([`page-${suffix}-c`]);
    expect(secondPage.nextCursor).toBeNull();

    for (const summary of [...firstPage.items, ...secondPage.items]) {
      expect(Object.keys(summary).sort()).toEqual(
        [
          'adminArea',
          'classificationKey',
          'configurable',
          'createdAt',
          'id',
          'lifecycle',
          'locality',
          'name',
          'serviceableForSale',
          'slug',
          'timezone',
          'updatedAt',
          'version',
        ].sort(),
      );
    }
  });
});

describe('Property scope service PostgreSQL regressions', () => {
  it('rejects a stale target scope version without changing grants, version, or audit', async () => {
    const owner = await trackedTenant();
    const target = await createTargetMembership({ tenantId: owner.tenant.id });
    const property = await createPropertyRecord(owner.tenant.id);

    await expect(
      grantPropertyScope(
        ownerScopeAuthority(owner, target.id),
        { userId: owner.ownerUserId, correlationId: randomUUID() },
        {
          targetMembershipId: target.id,
          propertyId: property.id,
          expectedVersion: 2,
        },
      ),
    ).rejects.toBeInstanceOf(PropertyScopeConflictError);

    await expect(
      prisma.staffMembership.findUniqueOrThrow({
        where: { id: target.id },
        select: {
          propertyScopeVersion: true,
          propertyScopes: { select: { propertyId: true } },
        },
      }),
    ).resolves.toEqual({ propertyScopeVersion: 1, propertyScopes: [] });
    await expect(
      prisma.auditEvent.count({
        where: { tenantId: owner.tenant.id, targetId: target.id },
      }),
    ).resolves.toBe(0);
  });

  it('denies non-active targets and an administrator suspended after authorization', async () => {
    const owner = await trackedTenant();
    const suspendedTarget = await createTargetMembership({
      tenantId: owner.tenant.id,
      status: 'SUSPENDED',
    });
    const activeTarget = await createTargetMembership({ tenantId: owner.tenant.id });
    const property = await createPropertyRecord(owner.tenant.id);
    const actor = { userId: owner.ownerUserId, correlationId: randomUUID() };

    await expect(
      grantPropertyScope(ownerScopeAuthority(owner, suspendedTarget.id), actor, {
        targetMembershipId: suspendedTarget.id,
        propertyId: property.id,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await prisma.staffMembership.update({
      where: { id: owner.owner.id },
      data: { status: 'SUSPENDED' },
    });
    try {
      await expect(
        grantPropertyScope(ownerScopeAuthority(owner, activeTarget.id), actor, {
          targetMembershipId: activeTarget.id,
          propertyId: property.id,
          expectedVersion: 1,
        }),
      ).rejects.toBeInstanceOf(AuthorizationError);
    } finally {
      await prisma.staffMembership.update({
        where: { id: owner.owner.id },
        data: { status: 'ACTIVE' },
      });
    }

    await expect(
      prisma.membershipPropertyScope.count({
        where: {
          tenantId: owner.tenant.id,
          membershipId: { in: [suspendedTarget.id, activeTarget.id] },
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditEvent.count({
        where: {
          tenantId: owner.tenant.id,
          targetId: { in: [suspendedTarget.id, activeTarget.id] },
        },
      }),
    ).resolves.toBe(0);
  });

  it('replaces the exact selected set across a complete access-mode round trip', async () => {
    const owner = await trackedTenant();
    const target = await createTargetMembership({
      tenantId: owner.tenant.id,
      propertyAccessMode: 'ALL_PROPERTIES',
    });
    const [propertyA, propertyB, propertyC] = await Promise.all([
      createPropertyRecord(owner.tenant.id),
      createPropertyRecord(owner.tenant.id),
      createPropertyRecord(owner.tenant.id),
    ]);
    const authority = ownerScopeAuthority(owner, target.id);
    const actor = { userId: owner.ownerUserId, correlationId: randomUUID() };

    const selected = await replacePropertyAccessMode(authority, actor, {
      targetMembershipId: target.id,
      expectedVersion: 1,
      propertyAccessMode: 'SELECTED_PROPERTIES',
      selectedPropertyIds: [propertyB.id, propertyA.id, propertyB.id],
    });
    expect(selected).toMatchObject({
      propertyAccessMode: 'SELECTED_PROPERTIES',
      propertyScopeVersion: 2,
    });
    await expect(
      prisma.membershipPropertyScope.findMany({
        where: { tenantId: owner.tenant.id, membershipId: target.id },
        select: { propertyId: true },
        orderBy: { propertyId: 'asc' },
      }),
    ).resolves.toEqual([propertyA.id, propertyB.id].sort().map((propertyId) => ({ propertyId })));

    const all = await replacePropertyAccessMode(authority, actor, {
      targetMembershipId: target.id,
      expectedVersion: selected.propertyScopeVersion,
      propertyAccessMode: 'ALL_PROPERTIES',
      selectedPropertyIds: [],
    });
    expect(all).toMatchObject({ propertyAccessMode: 'ALL_PROPERTIES', propertyScopeVersion: 3 });
    await expect(
      prisma.membershipPropertyScope.count({
        where: { tenantId: owner.tenant.id, membershipId: target.id },
      }),
    ).resolves.toBe(0);

    const selectedAgain = await replacePropertyAccessMode(authority, actor, {
      targetMembershipId: target.id,
      expectedVersion: all.propertyScopeVersion,
      propertyAccessMode: 'SELECTED_PROPERTIES',
      selectedPropertyIds: [propertyC.id],
    });
    expect(selectedAgain).toMatchObject({
      propertyAccessMode: 'SELECTED_PROPERTIES',
      propertyScopeVersion: 4,
      selectedPropertyIds: [propertyC.id],
    });
    await expect(
      prisma.membershipPropertyScope.findMany({
        where: { tenantId: owner.tenant.id, membershipId: target.id },
        select: { propertyId: true },
      }),
    ).resolves.toEqual([{ propertyId: propertyC.id }]);
    await expect(
      prisma.auditEvent.findMany({
        where: {
          tenantId: owner.tenant.id,
          targetId: target.id,
          action: 'MEMBERSHIP_PROPERTY_ACCESS_MODE_CHANGED',
        },
        select: { previousScopeVersion: true, resultingScopeVersion: true },
        orderBy: { resultingScopeVersion: 'asc' },
      }),
    ).resolves.toEqual([
      { previousScopeVersion: 1, resultingScopeVersion: 2 },
      { previousScopeVersion: 2, resultingScopeVersion: 3 },
      { previousScopeVersion: 3, resultingScopeVersion: 4 },
    ]);
  });

  it('retains an archived grant but excludes it from current scope authority', async () => {
    const owner = await trackedTenant();
    const target = await createTargetMembership({
      tenantId: owner.tenant.id,
      roleKey: 'PROPERTY_MANAGER',
    });
    const property = await createPropertyRecord(owner.tenant.id);
    const ungrantedProperty = await createPropertyRecord(owner.tenant.id);
    const granted = await grantPropertyScope(
      ownerScopeAuthority(owner, target.id),
      { userId: owner.ownerUserId, correlationId: randomUUID() },
      {
        targetMembershipId: target.id,
        propertyId: property.id,
        expectedVersion: 1,
      },
    );
    await prisma.property.update({
      where: { id: property.id },
      data: {
        lifecycle: 'ARCHIVED',
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await expect(
      prisma.membershipPropertyScope.count({
        where: {
          tenantId: owner.tenant.id,
          membershipId: target.id,
          propertyId: property.id,
        },
      }),
    ).resolves.toBe(1);
    const currentScope = await prisma.$transaction((transaction) =>
      new PrismaPropertyScopeRepository(transaction).findActiveScope(owner.tenant.id, target.id),
    );
    expect(currentScope).toMatchObject({
      propertyScopeVersion: granted.propertyScopeVersion,
      selectedPropertyIds: [],
    });

    const membership: PropertyMembershipAuthorization = {
      membershipId: target.id,
      tenantId: owner.tenant.id,
      status: 'ACTIVE',
      propertyAccessMode: 'SELECTED_PROPERTIES',
      propertyScopeVersion: granted.propertyScopeVersion,
      permissions: ['property.read'],
    };
    await expect(
      requirePersistedPropertyPermission({
        membership,
        tenantId: owner.tenant.id,
        propertyId: ungrantedProperty.id,
        permission: 'property.read',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      requirePersistedPropertyPermission({
        membership,
        tenantId: owner.tenant.id,
        propertyId: property.id,
        permission: 'property.read',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      requirePersistedPropertyPermission({
        membership,
        tenantId: owner.tenant.id,
        propertyId: property.id,
        permission: 'property.read',
        includeArchived: true,
      }),
    ).resolves.toMatchObject({ propertyId: property.id });
  });
});
