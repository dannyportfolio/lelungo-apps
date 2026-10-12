import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/shared/database/prisma';
import { PROPERTY_AMENITY_KEYS, PROPERTY_CLASSIFICATION_KEYS } from './property-constants';
import { PropertyConflictError } from './property-errors';

const CLASSIFICATION_NAMES: Record<(typeof PROPERTY_CLASSIFICATION_KEYS)[number], string> = {
  VILLA: 'Villa',
  HOMESTAY: 'Homestay',
  GUESTHOUSE: 'Guesthouse',
  SMALL_HOTEL: 'Small Hotel',
};

const AMENITY_NAMES: Record<(typeof PROPERTY_AMENITY_KEYS)[number], string> = {
  WIFI: 'Wi-Fi',
  PARKING: 'Parking',
  POOL: 'Pool',
  AIR_CONDITIONING: 'Air Conditioning',
  BREAKFAST: 'Breakfast',
  KITCHEN: 'Kitchen',
};

export async function ensurePropertyCatalogs(
  database: Prisma.TransactionClient = prisma,
): Promise<void> {
  for (const key of PROPERTY_CLASSIFICATION_KEYS) {
    await database.propertyClassification.upsert({
      where: { key },
      create: { key, displayName: CLASSIFICATION_NAMES[key] },
      update: { displayName: CLASSIFICATION_NAMES[key] },
    });
  }
  for (const key of PROPERTY_AMENITY_KEYS) {
    await database.amenity.upsert({
      where: { key },
      create: { key, displayName: AMENITY_NAMES[key] },
      update: { displayName: AMENITY_NAMES[key] },
    });
  }
}

export async function retirePropertyCatalogValue(input: {
  kind: 'CLASSIFICATION' | 'AMENITY';
  key: string;
}): Promise<void> {
  try {
    await prisma.$transaction(
      async (transaction) => {
        const publishedReferences = await transaction.property.count({
          where: {
            lifecycle: 'PUBLISHED',
            ...(input.kind === 'CLASSIFICATION'
              ? { classificationKey: input.key }
              : { amenities: { some: { amenityKey: input.key } } }),
          },
        });
        if (publishedReferences > 0) throw new PropertyConflictError();

        if (input.kind === 'CLASSIFICATION') {
          await transaction.propertyClassification.update({
            where: { key: input.key },
            data: { isActive: false },
          });
        } else {
          await transaction.amenity.update({
            where: { key: input.key },
            data: { isActive: false },
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      throw new PropertyConflictError();
    }
    throw error;
  }
}
