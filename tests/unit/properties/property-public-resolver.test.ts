import type { TenantStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantIdentity } from '@/modules/tenancy/tenant-context-types';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: { property: { findFirst: mocks.findFirst } },
}));

import { PropertyNotFoundError } from '@/modules/properties/property-errors';
import { publishedPropertyProjectionSelect } from '@/modules/properties/property-repository';
import { resolvePublishedPropertyIdentity } from '@/modules/properties/property-service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_TENANT_ID = '22222222-2222-4222-8222-222222222222';

function tenant(status: TenantStatus = 'ACTIVE'): TenantIdentity {
  return {
    id: TENANT_ID,
    name: 'Trusted Tenant',
    slug: 'trusted-tenant',
    status,
  };
}

function publishedRecord() {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: TENANT_ID,
    slug: 'villa-merapi',
    name: 'Villa Merapi',
    classificationKey: 'VILLA',
    timezone: 'Asia/Jakarta',
    lifecycle: 'PUBLISHED' as const,
    shortDescription: 'Mountain stay',
    publicWhatsAppE164: '+6281234567890',
    tenant: { status: 'ACTIVE' as const },
    classification: { isActive: true },
    address: { locality: 'Sleman', adminArea: 'DI Yogyakarta' },
    amenities: [
      { amenity: { key: 'WIFI', isActive: true } },
      { amenity: { key: 'PARKING', isActive: true } },
    ],
  };
}

describe('published Property resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(publishedRecord());
  });

  it('resolves through the trusted active Tenant and public-only query', async () => {
    await expect(resolvePublishedPropertyIdentity(tenant(), 'Villa_Merapi')).resolves.toMatchObject(
      {
        context: { tenantId: TENANT_ID, publiclyResolvable: true },
        identity: {
          slug: 'villa-merapi',
          amenityKeys: ['PARKING', 'WIFI'],
          locality: 'Sleman',
        },
      },
    );

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        slug: 'villa-merapi',
        lifecycle: 'PUBLISHED',
        tenant: { status: 'ACTIVE' },
        classification: { isActive: true },
        amenities: { every: { amenity: { isActive: true } } },
      },
      select: publishedPropertyProjectionSelect,
    });
  });

  it('fails closed before persistence for a non-active trusted Tenant identity', async () => {
    await expect(
      resolvePublishedPropertyIdentity(tenant('SUSPENDED'), 'villa-merapi'),
    ).rejects.toBeInstanceOf(PropertyNotFoundError);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['foreign ownership', { tenantId: FOREIGN_TENANT_ID }],
    ['draft lifecycle', { lifecycle: 'DRAFT' as const }],
    ['inactive lifecycle', { lifecycle: 'INACTIVE' as const }],
    ['archived lifecycle', { lifecycle: 'ARCHIVED' as const }],
    ['inactive persisted Tenant', { tenant: { status: 'SUSPENDED' as const } }],
    ['inactive classification', { classification: { isActive: false } }],
    ['inactive amenity', { amenities: [{ amenity: { key: 'WIFI', isActive: false } }] }],
  ])('returns the same not-found outcome for %s', async (_case, override) => {
    mocks.findFirst.mockResolvedValue({ ...publishedRecord(), ...override });

    const resolution = resolvePublishedPropertyIdentity(tenant(), 'villa-merapi');

    await expect(resolution).rejects.toMatchObject({
      name: 'PropertyNotFoundError',
      code: 'PROPERTY_NOT_FOUND',
      message: 'Property not found.',
    });
  });
});
