import { describe, expect, it } from 'vitest';

import {
  propertySummarySelect,
  publishedPropertyProjectionSelect,
} from '@/modules/properties/property-repository';

describe('Property repository summary projection', () => {
  it('selects only summary fields and excludes protected detail data', () => {
    expect(propertySummarySelect).toEqual({
      id: true,
      slug: true,
      name: true,
      classificationKey: true,
      timezone: true,
      lifecycle: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      tenant: { select: { status: true } },
      address: { select: { locality: true, adminArea: true } },
    });

    for (const detailField of [
      'tenantId',
      'shortDescription',
      'publicWhatsAppE164',
      'publishedAt',
      'deactivatedAt',
      'archivedAt',
      'amenities',
    ]) {
      expect(propertySummarySelect).not.toHaveProperty(detailField);
    }

    for (const privateAddressField of ['line1', 'line2', 'postalCode', 'countryCode']) {
      expect(propertySummarySelect.address.select).not.toHaveProperty(privateAddressField);
    }
  });

  it('uses a dedicated minimum public resolver projection', () => {
    expect(publishedPropertyProjectionSelect).toEqual({
      id: true,
      tenantId: true,
      slug: true,
      name: true,
      classificationKey: true,
      timezone: true,
      lifecycle: true,
      shortDescription: true,
      publicWhatsAppE164: true,
      tenant: { select: { status: true } },
      classification: { select: { isActive: true } },
      address: { select: { locality: true, adminArea: true } },
      amenities: {
        select: { amenity: { select: { key: true, isActive: true } } },
        orderBy: { amenityKey: 'asc' },
      },
    });

    for (const internalField of [
      'version',
      'publishedAt',
      'deactivatedAt',
      'archivedAt',
      'createdAt',
      'updatedAt',
    ]) {
      expect(publishedPropertyProjectionSelect).not.toHaveProperty(internalField);
    }

    for (const privateAddressField of ['line1', 'line2', 'postalCode', 'countryCode']) {
      expect(publishedPropertyProjectionSelect.address.select).not.toHaveProperty(
        privateAddressField,
      );
    }
  });
});
