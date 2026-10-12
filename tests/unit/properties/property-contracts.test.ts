import { describe, expect, it } from 'vitest';

import {
  toInternalPropertyDetail,
  toInternalPropertySummary,
  toPublishedPropertyIdentity,
  toResolvedPublishedPropertyIdentity,
  toTrustedDownstreamPropertyContext,
  type PropertyProjectionSource,
} from '@/modules/properties/property-contracts';
import { PropertyNotFoundError } from '@/modules/properties/property-errors';

function projectionSource(
  overrides: Partial<PropertyProjectionSource> = {},
): PropertyProjectionSource {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    slug: 'villa-merapi',
    name: 'Villa Merapi',
    classificationKey: 'VILLA',
    timezone: 'Asia/Jakarta',
    lifecycle: 'PUBLISHED',
    version: 3,
    shortDescription: 'Mountain stay',
    publicWhatsAppE164: '+6281234567890',
    publishedAt: new Date('2026-08-10T00:00:00.000Z'),
    deactivatedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    tenantIsActive: true,
    address: {
      line1: 'Jalan Kaliurang 1',
      line2: 'Private gate code 4',
      locality: 'Sleman',
      adminArea: 'DI Yogyakarta',
      postalCode: '55581',
      countryCode: 'ID',
    },
    amenities: [
      { key: 'WIFI', isActive: true },
      { key: 'PARKING', isActive: true },
      { key: 'RETIRED_AMENITY', isActive: false },
      { key: 'WIFI', isActive: true },
    ],
    ...overrides,
  };
}

describe('Property DTO contracts', () => {
  it('projects a bounded internal summary without Tenant or full-address leakage', () => {
    expect(toInternalPropertySummary(projectionSource())).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'villa-merapi',
      name: 'Villa Merapi',
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      lifecycle: 'PUBLISHED',
      version: 3,
      locality: 'Sleman',
      adminArea: 'DI Yogyakarta',
      configurable: true,
      serviceableForSale: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    });
  });

  it('projects the allowlisted protected detail with serializable timestamps', () => {
    const detail = toInternalPropertyDetail(projectionSource());

    expect(detail.address).toEqual({
      line1: 'Jalan Kaliurang 1',
      line2: 'Private gate code 4',
      locality: 'Sleman',
      adminArea: 'DI Yogyakarta',
      postalCode: '55581',
      countryCode: 'ID',
    });
    expect(detail.amenityKeys).toEqual(['PARKING', 'RETIRED_AMENITY', 'WIFI']);
    expect(detail.publishedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(detail).not.toHaveProperty('tenantId');
    expect(detail).not.toHaveProperty('rooms');
    expect(detail).not.toHaveProperty('prices');
  });

  it('projects only public identity fields and active amenity identifiers', () => {
    const identity = toPublishedPropertyIdentity(projectionSource());

    expect(identity).toEqual({
      slug: 'villa-merapi',
      name: 'Villa Merapi',
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      amenityKeys: ['PARKING', 'WIFI'],
      locality: 'Sleman',
      adminArea: 'DI Yogyakarta',
      shortDescription: 'Mountain stay',
      publicWhatsAppE164: '+6281234567890',
    });
    for (const privateField of [
      'id',
      'tenantId',
      'version',
      'lifecycle',
      'line1',
      'postalCode',
      'countryCode',
      'publishedAt',
    ]) {
      expect(identity).not.toHaveProperty(privateField);
    }
  });

  it('omits unconfigured optional public fields rather than returning nulls', () => {
    const identity = toPublishedPropertyIdentity(
      projectionSource({ shortDescription: null, publicWhatsAppE164: null }),
    );

    expect(identity).not.toHaveProperty('shortDescription');
    expect(identity).not.toHaveProperty('publicWhatsAppE164');
  });

  it.each([
    ['DRAFT' as const, true],
    ['INACTIVE' as const, true],
    ['ARCHIVED' as const, true],
    ['PUBLISHED' as const, false],
  ])(
    'refuses public projection for lifecycle %s with tenant active=%s',
    (lifecycle, tenantIsActive) => {
      expect(() =>
        toPublishedPropertyIdentity(projectionSource({ lifecycle, tenantIsActive })),
      ).toThrow(PropertyNotFoundError);
    },
  );

  it('provides owner-defined trusted context separately from public identity', () => {
    const source = projectionSource();
    const context = toTrustedDownstreamPropertyContext(source);
    const resolved = toResolvedPublishedPropertyIdentity(source);

    expect(context).toEqual({
      tenantId: source.tenantId,
      propertyId: source.id,
      timezone: 'Asia/Jakarta',
      classificationKey: 'VILLA',
      lifecycle: 'PUBLISHED',
      configurable: true,
      serviceableForSale: true,
      publiclyResolvable: true,
    });
    expect(resolved).toEqual({ context, identity: toPublishedPropertyIdentity(source) });
    expect(context).not.toHaveProperty('address');
    expect(context).not.toHaveProperty('publicWhatsAppE164');
  });
});
