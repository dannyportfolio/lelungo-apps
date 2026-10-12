import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { retirePropertyCatalogValue } from '@/modules/properties/property-catalog-service';
import { PropertyConflictError } from '@/modules/properties/property-errors';
import { transitionPropertyLifecycle } from '@/modules/properties/property-service';
import { createTenant } from '@/modules/tenancy/tenant-service';
import { prisma } from '@/shared/database/prisma';
import { IntegrationTestRecordRegistry } from './support/test-record-registry';

const records = new IntegrationTestRecordRegistry();
const classificationKeys = new Set<string>();
const amenityKeys = new Set<string>();

async function trackedTenant() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const ownerUserId = randomUUID();
  const tenant = await createTenant({
    name: `Catalog retirement ${suffix}`,
    subdomain: `catalog-${suffix}`,
    ownerUserId,
  });
  records.trackTenant(tenant.id);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE' } });
  const owner = await prisma.staffMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, userId: ownerUserId },
    select: { id: true, propertyScopeVersion: true },
  });
  if (owner.propertyScopeVersion === null) {
    throw new Error('Catalog integration owner requires explicit Property scope.');
  }
  return {
    tenant,
    owner: { id: owner.id, propertyScopeVersion: owner.propertyScopeVersion },
    ownerUserId,
    suffix,
  };
}

async function createCatalogPair(suffix: string) {
  const catalogSuffix = suffix.toUpperCase();
  const classificationKey = `TEST_CLASS_${catalogSuffix}`;
  const amenityKey = `TEST_AMENITY_${catalogSuffix}`;
  classificationKeys.add(classificationKey);
  amenityKeys.add(amenityKey);
  await prisma.propertyClassification.create({
    data: { key: classificationKey, displayName: 'Test classification' },
  });
  await prisma.amenity.create({ data: { key: amenityKey, displayName: 'Test amenity' } });
  return { classificationKey, amenityKey };
}

afterEach(async () => {
  try {
    await records.cleanup(prisma);
  } finally {
    const trackedAmenities = [...amenityKeys];
    const trackedClassifications = [...classificationKeys];
    if (trackedAmenities.length > 0) {
      await prisma.amenity.deleteMany({ where: { key: { in: trackedAmenities } } });
    }
    if (trackedClassifications.length > 0) {
      await prisma.propertyClassification.deleteMany({
        where: { key: { in: trackedClassifications } },
      });
    }
    amenityKeys.clear();
    classificationKeys.clear();
  }
});
afterAll(async () => prisma.$disconnect());

describe('Property catalog retirement PostgreSQL boundary', () => {
  it('preserves classification and amenity values referenced by a published Property', async () => {
    const { tenant, suffix } = await trackedTenant();
    const { classificationKey, amenityKey } = await createCatalogPair(suffix);
    const property = await prisma.property.create({
      data: {
        tenantId: tenant.id,
        name: 'Published catalog reference',
        slug: `published-${suffix}`,
        classificationKey,
        timezone: 'Asia/Jakarta',
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        address: {
          create: {
            line1: 'Jalan Catalog 1',
            locality: 'Sleman',
            adminArea: 'DI Yogyakarta',
            countryCode: 'ID',
          },
        },
        amenities: { create: { amenityKey } },
      },
      select: { id: true },
    });

    await expect(
      retirePropertyCatalogValue({ kind: 'CLASSIFICATION', key: classificationKey }),
    ).rejects.toBeInstanceOf(PropertyConflictError);
    await expect(
      retirePropertyCatalogValue({ kind: 'AMENITY', key: amenityKey }),
    ).rejects.toBeInstanceOf(PropertyConflictError);
    await expect(
      Promise.all([
        prisma.propertyClassification.findUniqueOrThrow({
          where: { key: classificationKey },
          select: { isActive: true },
        }),
        prisma.amenity.findUniqueOrThrow({
          where: { key: amenityKey },
          select: { isActive: true },
        }),
      ]),
    ).resolves.toEqual([{ isActive: true }, { isActive: true }]);

    await prisma.property.update({
      where: { id: property.id },
      data: { lifecycle: 'ARCHIVED', archivedAt: new Date() },
    });
    await retirePropertyCatalogValue({ kind: 'CLASSIFICATION', key: classificationKey });
    await retirePropertyCatalogValue({ kind: 'AMENITY', key: amenityKey });
    await expect(
      Promise.all([
        prisma.propertyClassification.findUniqueOrThrow({
          where: { key: classificationKey },
          select: { isActive: true },
        }),
        prisma.amenity.findUniqueOrThrow({
          where: { key: amenityKey },
          select: { isActive: true },
        }),
      ]),
    ).resolves.toEqual([{ isActive: false }, { isActive: false }]);
  });

  it('serializes concurrent publication and classification retirement without an invalid published state', async () => {
    const { tenant, owner, ownerUserId, suffix } = await trackedTenant();
    const { classificationKey } = await createCatalogPair(suffix);
    const property = await prisma.property.create({
      data: {
        tenantId: tenant.id,
        name: 'Concurrent catalog reference',
        slug: `concurrent-${suffix}`,
        classificationKey,
        timezone: 'Asia/Jakarta',
        address: {
          create: {
            line1: 'Jalan Race 1',
            locality: 'Sleman',
            adminArea: 'DI Yogyakarta',
            countryCode: 'ID',
          },
        },
      },
      select: { id: true },
    });
    const authority = {
      tenantId: tenant.id,
      membershipId: owner.id,
      propertyId: property.id,
      propertyAccessMode: 'ALL_PROPERTIES' as const,
      propertyScopeVersion: owner.propertyScopeVersion,
    };

    const results = await Promise.allSettled([
      transitionPropertyLifecycle(
        authority,
        { userId: ownerUserId, membershipId: owner.id, correlationId: randomUUID() },
        'PUBLISH',
        { propertyId: property.id, expectedVersion: 1 },
      ),
      retirePropertyCatalogValue({ kind: 'CLASSIFICATION', key: classificationKey }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const [persistedProperty, persistedClassification] = await Promise.all([
      prisma.property.findUniqueOrThrow({
        where: { id: property.id },
        select: { lifecycle: true, version: true },
      }),
      prisma.propertyClassification.findUniqueOrThrow({
        where: { key: classificationKey },
        select: { isActive: true },
      }),
    ]);
    expect(
      (persistedProperty.lifecycle === 'PUBLISHED' &&
        persistedProperty.version === 2 &&
        persistedClassification.isActive) ||
        (persistedProperty.lifecycle === 'DRAFT' &&
          persistedProperty.version === 1 &&
          !persistedClassification.isActive),
    ).toBe(true);
  });
});
