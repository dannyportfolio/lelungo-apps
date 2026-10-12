import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  publishedPropertyCount: vi.fn(),
  classificationUpdate: vi.fn(),
  amenityUpdate: vi.fn(),
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}));

import {
  ensurePropertyCatalogs,
  retirePropertyCatalogValue,
} from '@/modules/properties/property-catalog-service';
import {
  PROPERTY_AMENITY_KEYS,
  PROPERTY_CLASSIFICATION_KEYS,
} from '@/modules/properties/property-constants';
import { PropertyConflictError } from '@/modules/properties/property-errors';

describe('Property catalog service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const transaction = {
      property: { count: mocks.publishedPropertyCount },
      propertyClassification: { update: mocks.classificationUpdate },
      amenity: { update: mocks.amenityUpdate },
    };
    mocks.transaction.mockImplementation(
      async (operation: (database: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
  });

  it('provisions every baseline key idempotently without reactivating retired values', async () => {
    const classificationUpsert = vi.fn().mockResolvedValue(undefined);
    const amenityUpsert = vi.fn().mockResolvedValue(undefined);
    const database = {
      propertyClassification: { upsert: classificationUpsert },
      amenity: { upsert: amenityUpsert },
    };

    await ensurePropertyCatalogs(database as never);
    await ensurePropertyCatalogs(database as never);

    expect(classificationUpsert).toHaveBeenCalledTimes(PROPERTY_CLASSIFICATION_KEYS.length * 2);
    expect(amenityUpsert).toHaveBeenCalledTimes(PROPERTY_AMENITY_KEYS.length * 2);
    expect(classificationUpsert.mock.calls.map(([input]) => input.where.key)).toEqual([
      ...PROPERTY_CLASSIFICATION_KEYS,
      ...PROPERTY_CLASSIFICATION_KEYS,
    ]);
    expect(amenityUpsert.mock.calls.map(([input]) => input.where.key)).toEqual([
      ...PROPERTY_AMENITY_KEYS,
      ...PROPERTY_AMENITY_KEYS,
    ]);

    for (const [input] of [...classificationUpsert.mock.calls, ...amenityUpsert.mock.calls]) {
      expect(input.update).not.toHaveProperty('isActive');
    }
  });

  it.each([
    ['CLASSIFICATION' as const, 'VILLA'],
    ['AMENITY' as const, 'WIFI'],
  ])('rejects retiring a %s referenced by a published Property', async (kind, key) => {
    mocks.publishedPropertyCount.mockResolvedValue(1);

    await expect(retirePropertyCatalogValue({ kind, key })).rejects.toBeInstanceOf(
      PropertyConflictError,
    );

    expect(mocks.classificationUpdate).not.toHaveBeenCalled();
    expect(mocks.amenityUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it.each([
    ['CLASSIFICATION' as const, 'VILLA', 'classificationUpdate' as const],
    ['AMENITY' as const, 'WIFI', 'amenityUpdate' as const],
  ])(
    'retires an unreferenced %s inside the serializable transaction',
    async (kind, key, update) => {
      mocks.publishedPropertyCount.mockResolvedValue(0);
      mocks[update].mockResolvedValue(undefined);

      await retirePropertyCatalogValue({ kind, key });

      expect(mocks[update]).toHaveBeenCalledWith({
        where: { key },
        data: { isActive: false },
      });
    },
  );

  it('maps a serialization failure to the stable catalog conflict', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' });

    await expect(
      retirePropertyCatalogValue({ kind: 'CLASSIFICATION', key: 'VILLA' }),
    ).rejects.toBeInstanceOf(PropertyConflictError);
  });
});
