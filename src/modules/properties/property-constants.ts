export const PROPERTY_NAME_MAX_LENGTH = 120;
export const PROPERTY_RAW_SLUG_MAX_LENGTH = 120;
export const PROPERTY_SLUG_MAX_LENGTH = 80;
export const PROPERTY_TIMEZONE_MAX_LENGTH = 100;

export const PROPERTY_ADDRESS_LINE_MAX_LENGTH = 200;
export const PROPERTY_LOCALITY_MAX_LENGTH = 100;
export const PROPERTY_ADMIN_AREA_MAX_LENGTH = 100;
export const PROPERTY_POSTAL_CODE_MAX_LENGTH = 12;
export const PROPERTY_SHORT_DESCRIPTION_MAX_LENGTH = 500;
export const PROPERTY_PUBLIC_WHATSAPP_MAX_LENGTH = 16;

export const PROPERTY_MAX_AMENITIES = 50;
export const PROPERTY_LIST_MIN_PAGE_SIZE = 1;
export const PROPERTY_LIST_MAX_PAGE_SIZE = 100;
export const PROPERTY_CURSOR_MAX_LENGTH = 1_024;
export const PROPERTY_INITIAL_VERSION = 1;

export const PROPERTY_COUNTRY_CODE = 'ID' as const;
export const PROPERTY_LIST_ORDER = 'SLUG_ASC_ID_ASC' as const;
export const PROPERTY_CURSOR_VERSION = 1 as const;

export const PROPERTY_CLASSIFICATION_KEYS = [
  'VILLA',
  'HOMESTAY',
  'GUESTHOUSE',
  'SMALL_HOTEL',
] as const;

export type BaselinePropertyClassificationKey = (typeof PROPERTY_CLASSIFICATION_KEYS)[number];

export const PROPERTY_AMENITY_KEYS = [
  'WIFI',
  'PARKING',
  'POOL',
  'AIR_CONDITIONING',
  'BREAKFAST',
  'KITCHEN',
] as const;

export type BaselinePropertyAmenityKey = (typeof PROPERTY_AMENITY_KEYS)[number];

export const PROPERTY_LIFECYCLES = ['DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED'] as const;
export type PropertyLifecycle = (typeof PROPERTY_LIFECYCLES)[number];

export const PROPERTY_LIFECYCLE_INTENTS = [
  'PUBLISH',
  'DEACTIVATE',
  'REPUBLISH',
  'ARCHIVE',
] as const;
export type PropertyLifecycleIntent = (typeof PROPERTY_LIFECYCLE_INTENTS)[number];

export const PROPERTY_CATALOG_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
export const PROPERTY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROPERTY_PUBLIC_WHATSAPP_E164_PATTERN = /^\+[1-9][0-9]{1,14}$/;
