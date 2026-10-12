import { describe, expect, it } from 'vitest';

import {
  createPropertyCommandSchema,
  propertyLifecycleCommandSchema,
  propertyListQuerySchema,
  publishedPropertyResolutionSchema,
  updatePropertyCommandSchema,
} from '@/modules/properties/property-schemas';

const PROPERTY_ID = '00000000-0000-4000-8000-000000000001';

function validCreateInput() {
  return {
    name: ' Villa Merapi ',
    slug: ' Villa_Merapi ',
    classificationKey: 'VILLA',
    timezone: 'Asia/Jakarta',
    address: {
      line1: ' Jalan Kaliurang 1 ',
      locality: ' Sleman ',
      adminArea: ' DI Yogyakarta ',
      countryCode: 'ID',
    },
    amenityKeys: ['WIFI', 'PARKING', 'WIFI'],
    shortDescription: ' Mountain stay ',
    publicWhatsAppE164: '+6281234567890',
  };
}

describe('Property command schemas', () => {
  it('trims bounded profile fields, normalizes the slug, and deduplicates amenities', () => {
    expect(createPropertyCommandSchema.parse(validCreateInput())).toEqual({
      name: 'Villa Merapi',
      slug: 'villa-merapi',
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        line1: 'Jalan Kaliurang 1',
        locality: 'Sleman',
        adminArea: 'DI Yogyakarta',
        countryCode: 'ID',
      },
      amenityKeys: ['WIFI', 'PARKING'],
      shortDescription: 'Mountain stay',
      publicWhatsAppE164: '+6281234567890',
    });
  });

  it.each([
    ['name', { name: 'a'.repeat(121) }],
    ['raw slug', { slug: 'a'.repeat(121) }],
    ['normalized slug', { slug: `${'a'.repeat(80)} b` }],
    ['classification', { classificationKey: 'villa' }],
    ['timezone alias', { timezone: 'US/Pacific' }],
    ['timezone abbreviation', { timezone: 'WIB' }],
    ['address line', { address: { ...validCreateInput().address, line1: 'a'.repeat(201) } }],
    ['locality', { address: { ...validCreateInput().address, locality: 'a'.repeat(101) } }],
    ['admin area', { address: { ...validCreateInput().address, adminArea: 'a'.repeat(101) } }],
    ['country', { address: { ...validCreateInput().address, countryCode: 'US' } }],
    ['description', { shortDescription: 'a'.repeat(501) }],
    ['WhatsApp contact', { publicWhatsAppE164: '+62 812 3456' }],
  ])('rejects the %s boundary', (_label, override) => {
    expect(
      createPropertyCommandSchema.safeParse({ ...validCreateInput(), ...override }).success,
    ).toBe(false);
  });

  it('evaluates the amenity maximum after deduplication', () => {
    const fiftyKeys = Array.from({ length: 50 }, (_, index) => `AMENITY_${index}`);
    expect(
      createPropertyCommandSchema.safeParse({
        ...validCreateInput(),
        amenityKeys: [...fiftyKeys, ...fiftyKeys],
      }).success,
    ).toBe(true);
    expect(
      createPropertyCommandSchema.safeParse({
        ...validCreateInput(),
        amenityKeys: [...fiftyKeys, 'AMENITY_50'],
      }).success,
    ).toBe(false);
  });

  it('rejects mass-assigned ownership, lifecycle, and later-domain fields', () => {
    for (const extra of [
      { tenantId: PROPERTY_ID },
      { lifecycle: 'PUBLISHED' },
      { version: 9 },
      { rooms: [] },
      { prices: [] },
      { media: [] },
      { email: 'owner@example.test' },
    ]) {
      expect(
        createPropertyCommandSchema.safeParse({ ...validCreateInput(), ...extra }).success,
      ).toBe(false);
    }
  });

  it('requires a positive expected version and at least one allowlisted update', () => {
    expect(
      updatePropertyCommandSchema.parse({
        propertyId: PROPERTY_ID,
        expectedVersion: 2,
        shortDescription: null,
      }),
    ).toEqual({ propertyId: PROPERTY_ID, expectedVersion: 2, shortDescription: null });
    expect(
      updatePropertyCommandSchema.safeParse({ propertyId: PROPERTY_ID, expectedVersion: 2 })
        .success,
    ).toBe(false);
    expect(
      updatePropertyCommandSchema.safeParse({
        propertyId: PROPERTY_ID,
        expectedVersion: 0,
        name: 'Changed',
      }).success,
    ).toBe(false);
    expect(
      updatePropertyCommandSchema.safeParse({
        propertyId: PROPERTY_ID,
        expectedVersion: 2,
        lifecycle: 'ARCHIVED',
      }).success,
    ).toBe(false);
  });

  it('keeps lifecycle intent separate from the generic profile update', () => {
    expect(
      propertyLifecycleCommandSchema.parse({ propertyId: PROPERTY_ID, expectedVersion: 3 }),
    ).toEqual({ propertyId: PROPERTY_ID, expectedVersion: 3 });
    expect(
      propertyLifecycleCommandSchema.safeParse({
        propertyId: PROPERTY_ID,
        expectedVersion: 3,
        lifecycle: 'PUBLISHED',
      }).success,
    ).toBe(false);
  });

  it('requires a list bound from 1 through 100 and a bounded cursor', () => {
    expect(propertyListQuerySchema.safeParse({ pageSize: 1 }).success).toBe(true);
    expect(propertyListQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
    expect(propertyListQuerySchema.safeParse({}).success).toBe(false);
    expect(propertyListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(propertyListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(
      propertyListQuerySchema.safeParse({ pageSize: 10, cursor: 'a'.repeat(1025) }).success,
    ).toBe(false);
  });

  it('normalizes only the slug in the published-resolution request', () => {
    expect(publishedPropertyResolutionSchema.parse({ slug: ' Villa_Merapi ' })).toEqual({
      slug: 'villa-merapi',
    });
    expect(
      publishedPropertyResolutionSchema.safeParse({ slug: 'villa', tenantId: PROPERTY_ID }).success,
    ).toBe(false);
  });
});
