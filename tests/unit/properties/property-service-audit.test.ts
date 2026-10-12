import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { createProperty } from '@/modules/properties/property-service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const PROPERTY_ID = '44444444-4444-4444-8444-444444444444';
const CORRELATION_ID = '55555555-5555-4555-8555-555555555555';

describe('Property creation audit metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const transaction = {
      staffMembership: {
        count: vi.fn().mockResolvedValue(1),
      },
      propertyClassification: {
        findFirst: vi.fn().mockResolvedValue({ key: 'VILLA' }),
      },
      amenity: {
        count: vi.fn().mockResolvedValue(2),
      },
      property: {
        create: vi.fn().mockResolvedValue({ id: PROPERTY_ID, version: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: PROPERTY_ID,
          tenantId: TENANT_ID,
          slug: 'villa-audit',
          name: 'Villa Audit',
          classificationKey: 'VILLA',
          timezone: 'Asia/Jakarta',
          lifecycle: 'DRAFT',
          version: 1,
          shortDescription: 'Private test description',
          publicWhatsAppE164: '+6281234567890',
          publishedAt: null,
          deactivatedAt: null,
          archivedAt: null,
          createdAt: new Date('2026-08-12T00:00:00.000Z'),
          updatedAt: new Date('2026-08-12T00:00:00.000Z'),
          tenant: { status: 'ACTIVE' },
          address: {
            line1: 'Jalan Audit 1',
            line2: 'Private second line',
            locality: 'Sleman',
            adminArea: 'DI Yogyakarta',
            postalCode: '55581',
            countryCode: 'ID',
          },
          amenities: [
            { amenity: { key: 'PARKING', isActive: true } },
            { amenity: { key: 'WIFI', isActive: true } },
          ],
        }),
      },
      auditEvent: {
        create: mocks.auditCreate.mockResolvedValue({
          id: '66666666-6666-4666-8666-666666666666',
          occurredAt: new Date('2026-08-12T00:00:00.000Z'),
        }),
      },
    };

    mocks.transaction.mockImplementation(
      async (operation: (database: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
  });

  it('names supplied optional fields without copying their values', async () => {
    await createProperty(
      {
        tenantId: TENANT_ID,
        membershipId: MEMBERSHIP_ID,
        propertyAccessMode: 'ALL_PROPERTIES',
        propertyScopeVersion: 3,
      },
      { userId: USER_ID, membershipId: MEMBERSHIP_ID, correlationId: CORRELATION_ID },
      {
        name: 'Villa Audit',
        slug: 'villa-audit',
        classificationKey: 'VILLA',
        timezone: 'Asia/Jakarta',
        address: {
          line1: 'Jalan Audit 1',
          line2: 'Private second line',
          locality: 'Sleman',
          adminArea: 'DI Yogyakarta',
          postalCode: '55581',
          countryCode: 'ID',
        },
        amenityKeys: ['WIFI', 'PARKING'],
        shortDescription: 'Private test description',
        publicWhatsAppE164: '+6281234567890',
      },
    );

    const auditWrite = mocks.auditCreate.mock.calls[0]?.[0];
    expect(auditWrite?.data.changedFields).toEqual(
      expect.arrayContaining([
        'address.line2',
        'address.postalCode',
        'shortDescription',
        'publicWhatsAppE164',
      ]),
    );

    const serializedAudit = JSON.stringify(auditWrite);
    expect(serializedAudit).not.toContain('Private second line');
    expect(serializedAudit).not.toContain('55581');
    expect(serializedAudit).not.toContain('Private test description');
    expect(serializedAudit).not.toContain('+6281234567890');
  });
});
