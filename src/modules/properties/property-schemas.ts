import { z } from 'zod';

import {
  PROPERTY_ADDRESS_LINE_MAX_LENGTH,
  PROPERTY_ADMIN_AREA_MAX_LENGTH,
  PROPERTY_CATALOG_KEY_PATTERN,
  PROPERTY_COUNTRY_CODE,
  PROPERTY_CURSOR_MAX_LENGTH,
  PROPERTY_LIST_MAX_PAGE_SIZE,
  PROPERTY_LIST_MIN_PAGE_SIZE,
  PROPERTY_LOCALITY_MAX_LENGTH,
  PROPERTY_MAX_AMENITIES,
  PROPERTY_NAME_MAX_LENGTH,
  PROPERTY_POSTAL_CODE_MAX_LENGTH,
  PROPERTY_PUBLIC_WHATSAPP_E164_PATTERN,
  PROPERTY_PUBLIC_WHATSAPP_MAX_LENGTH,
  PROPERTY_RAW_SLUG_MAX_LENGTH,
  PROPERTY_SHORT_DESCRIPTION_MAX_LENGTH,
  PROPERTY_TIMEZONE_MAX_LENGTH,
} from './property-constants';
import { normalizePropertySlug, requireCanonicalIanaTimezone } from './property-domain';

function codePointLength(value: string): number {
  return [...value].length;
}

function requiredTrimmedString(maxLength: number) {
  return z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1)
        .refine((value) => codePointLength(value) <= maxLength, { message: 'String is too long.' }),
    );
}

function optionalTrimmedString(maxLength: number) {
  return requiredTrimmedString(maxLength).nullable().optional();
}

export const propertyIdSchema = z.string().uuid();
export const propertyVersionSchema = z.number().int().positive().safe();
export const propertyCatalogKeySchema = z.string().max(64).regex(PROPERTY_CATALOG_KEY_PATTERN);

export const propertyNameSchema = requiredTrimmedString(PROPERTY_NAME_MAX_LENGTH);
export const propertySlugSchema = z
  .string()
  .refine((value) => codePointLength(value) <= PROPERTY_RAW_SLUG_MAX_LENGTH, {
    message: 'Raw Property slug is too long.',
  })
  .transform((value, context) => {
    try {
      return normalizePropertySlug(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Property slug.' });
      return z.NEVER;
    }
  });

export const propertyTimezoneSchema = z
  .string()
  .min(1)
  .max(PROPERTY_TIMEZONE_MAX_LENGTH)
  .transform((value, context) => {
    try {
      return requireCanonicalIanaTimezone(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid canonical IANA timezone.',
      });
      return z.NEVER;
    }
  });

export const propertyAddressSchema = z
  .object({
    line1: requiredTrimmedString(PROPERTY_ADDRESS_LINE_MAX_LENGTH),
    line2: optionalTrimmedString(PROPERTY_ADDRESS_LINE_MAX_LENGTH),
    locality: requiredTrimmedString(PROPERTY_LOCALITY_MAX_LENGTH),
    adminArea: requiredTrimmedString(PROPERTY_ADMIN_AREA_MAX_LENGTH),
    postalCode: optionalTrimmedString(PROPERTY_POSTAL_CODE_MAX_LENGTH),
    countryCode: z.literal(PROPERTY_COUNTRY_CODE),
  })
  .strict();

export const propertyAmenityKeysSchema = z.preprocess(
  (value) => (Array.isArray(value) ? [...new Set(value)] : value),
  z.array(propertyCatalogKeySchema).max(PROPERTY_MAX_AMENITIES),
);

export const propertyShortDescriptionSchema = optionalTrimmedString(
  PROPERTY_SHORT_DESCRIPTION_MAX_LENGTH,
);
export const propertyPublicWhatsAppSchema = z
  .string()
  .max(PROPERTY_PUBLIC_WHATSAPP_MAX_LENGTH)
  .regex(PROPERTY_PUBLIC_WHATSAPP_E164_PATTERN)
  .nullable()
  .optional();

const propertyProfileFields = {
  name: propertyNameSchema,
  slug: propertySlugSchema,
  classificationKey: propertyCatalogKeySchema,
  timezone: propertyTimezoneSchema,
  address: propertyAddressSchema,
  amenityKeys: propertyAmenityKeysSchema,
  shortDescription: propertyShortDescriptionSchema,
  publicWhatsAppE164: propertyPublicWhatsAppSchema,
} as const;

export const createPropertyCommandSchema = z.object(propertyProfileFields).strict();

export const updatePropertyCommandSchema = z
  .object({
    propertyId: propertyIdSchema,
    expectedVersion: propertyVersionSchema,
    name: propertyNameSchema.optional(),
    slug: propertySlugSchema.optional(),
    classificationKey: propertyCatalogKeySchema.optional(),
    timezone: propertyTimezoneSchema.optional(),
    address: propertyAddressSchema.optional(),
    amenityKeys: propertyAmenityKeysSchema.optional(),
    shortDescription: propertyShortDescriptionSchema,
    publicWhatsAppE164: propertyPublicWhatsAppSchema,
  })
  .strict()
  .refine(
    (command) =>
      Object.entries(command).some(
        ([key, value]) => key !== 'propertyId' && key !== 'expectedVersion' && value !== undefined,
      ),
    { message: 'At least one Property field must be changed.' },
  );

export const propertyLifecycleCommandSchema = z
  .object({
    propertyId: propertyIdSchema,
    expectedVersion: propertyVersionSchema,
  })
  .strict();

export const propertyListQuerySchema = z
  .object({
    pageSize: z.number().int().min(PROPERTY_LIST_MIN_PAGE_SIZE).max(PROPERTY_LIST_MAX_PAGE_SIZE),
    cursor: z.string().min(1).max(PROPERTY_CURSOR_MAX_LENGTH).optional(),
  })
  .strict();

export const publishedPropertyResolutionSchema = z
  .object({
    slug: propertySlugSchema,
  })
  .strict();

export type CreatePropertyCommand = z.output<typeof createPropertyCommandSchema>;
export type UpdatePropertyCommand = z.output<typeof updatePropertyCommandSchema>;
export type PropertyLifecycleCommand = z.output<typeof propertyLifecycleCommandSchema>;
export type PropertyListQuery = z.output<typeof propertyListQuerySchema>;
export type PropertyAddressInput = z.output<typeof propertyAddressSchema>;
