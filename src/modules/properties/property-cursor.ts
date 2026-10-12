import { createHash, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import {
  PROPERTY_CURSOR_MAX_LENGTH,
  PROPERTY_CURSOR_VERSION,
  PROPERTY_LIST_ORDER,
  PROPERTY_SLUG_MAX_LENGTH,
  PROPERTY_SLUG_PATTERN,
} from './property-constants';
import { PropertyValidationError } from './property-errors';

export type PropertyCursorAccessMode = 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES';
export type PropertyCursorFilterValue = string | number | boolean | null;

export interface PropertyCursorBindingContext {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly accessMode: PropertyCursorAccessMode;
  readonly scopeVersion: number;
  readonly filters?: Readonly<Record<string, PropertyCursorFilterValue>>;
  readonly order?: typeof PROPERTY_LIST_ORDER;
}

export interface PropertyCursorPosition {
  readonly slug: string;
  readonly propertyId: string;
}

const propertyCursorPayloadSchema = z
  .object({
    v: z.literal(PROPERTY_CURSOR_VERSION),
    slug: z.string().min(1).max(PROPERTY_SLUG_MAX_LENGTH).regex(PROPERTY_SLUG_PATTERN),
    propertyId: z.string().uuid(),
    binding: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function createPropertyCursorBinding(context: PropertyCursorBindingContext): string {
  if (
    context.tenantId.length === 0 ||
    context.membershipId.length === 0 ||
    (context.accessMode !== 'ALL_PROPERTIES' && context.accessMode !== 'SELECTED_PROPERTIES') ||
    !Number.isSafeInteger(context.scopeVersion) ||
    context.scopeVersion < 1
  ) {
    throw new PropertyValidationError();
  }

  const filters = Object.entries(context.filters ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const serialized = JSON.stringify({
    tenantId: context.tenantId,
    membershipId: context.membershipId,
    accessMode: context.accessMode,
    scopeVersion: context.scopeVersion,
    filters,
    order: context.order ?? PROPERTY_LIST_ORDER,
  });

  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

export function encodePropertyCursor(
  position: PropertyCursorPosition,
  context: PropertyCursorBindingContext,
): string {
  const parsedPosition = propertyCursorPayloadSchema
    .pick({ slug: true, propertyId: true })
    .safeParse({
      slug: position.slug,
      propertyId: position.propertyId,
    });

  if (!parsedPosition.success) {
    throw new PropertyValidationError();
  }

  const encoded = Buffer.from(
    JSON.stringify({
      v: PROPERTY_CURSOR_VERSION,
      ...parsedPosition.data,
      binding: createPropertyCursorBinding(context),
    }),
    'utf8',
  ).toString('base64url');

  if (encoded.length > PROPERTY_CURSOR_MAX_LENGTH) {
    throw new PropertyValidationError();
  }

  return encoded;
}

export function decodePropertyCursor(
  cursor: string,
  context: PropertyCursorBindingContext,
): PropertyCursorPosition {
  if (
    cursor.length === 0 ||
    cursor.length > PROPERTY_CURSOR_MAX_LENGTH ||
    !BASE64URL_PATTERN.test(cursor)
  ) {
    throw new PropertyValidationError();
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = propertyCursorPayloadSchema.parse(JSON.parse(decoded) as unknown);
    const expectedBinding = createPropertyCursorBinding(context);

    if (!bindingsMatch(payload.binding, expectedBinding)) {
      throw new PropertyValidationError();
    }

    return { slug: payload.slug, propertyId: payload.propertyId };
  } catch (error) {
    if (error instanceof PropertyValidationError) {
      throw error;
    }

    throw new PropertyValidationError();
  }
}

function bindingsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
