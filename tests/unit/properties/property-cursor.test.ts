import { describe, expect, it } from 'vitest';

import {
  createPropertyCursorBinding,
  decodePropertyCursor,
  encodePropertyCursor,
  type PropertyCursorBindingContext,
} from '@/modules/properties/property-cursor';
import { PropertyValidationError } from '@/modules/properties/property-errors';

const context: PropertyCursorBindingContext = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  membershipId: '00000000-0000-4000-8000-000000000002',
  accessMode: 'SELECTED_PROPERTIES',
  scopeVersion: 7,
  filters: { includeArchived: false, query: null },
};

const position = {
  slug: 'villa-merapi',
  propertyId: '00000000-0000-4000-8000-000000000003',
};

describe('Property cursor', () => {
  it('round-trips an opaque cursor in the same authorization context', () => {
    const cursor = encodePropertyCursor(position, context);

    expect(cursor).not.toContain('villa-merapi');
    expect(decodePropertyCursor(cursor, context)).toEqual(position);
  });

  it('canonicalizes filter key order for a deterministic binding', () => {
    expect(createPropertyCursorBinding(context)).toBe(
      createPropertyCursorBinding({
        ...context,
        filters: { query: null, includeArchived: false },
      }),
    );
  });

  it.each([
    ['tenant', { tenantId: '00000000-0000-4000-8000-000000000010' }],
    ['membership', { membershipId: '00000000-0000-4000-8000-000000000011' }],
    ['access mode', { accessMode: 'ALL_PROPERTIES' as const }],
    ['scope version', { scopeVersion: 8 }],
    ['filters', { filters: { includeArchived: true, query: null } }],
  ])('rejects reuse under a different %s binding', (_label, override) => {
    const cursor = encodePropertyCursor(position, context);

    expect(() => decodePropertyCursor(cursor, { ...context, ...override })).toThrow(
      PropertyValidationError,
    );
  });

  it('rejects malformed, oversized, and payload-tampered cursors generically', () => {
    const cursor = encodePropertyCursor(position, context);
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const tampered = Buffer.from(JSON.stringify({ ...decoded, binding: '0'.repeat(64) })).toString(
      'base64url',
    );

    for (const candidate of ['not+base64url', 'a'.repeat(1025), tampered]) {
      expect(() => decodePropertyCursor(candidate, context)).toThrow(PropertyValidationError);
    }
  });
});
