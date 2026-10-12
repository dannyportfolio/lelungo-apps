import { describe, expect, it } from 'vitest';

import {
  createPropertyAuditMetadata,
  createPropertyScopeAuditMetadata,
} from '@/modules/audit/audit-metadata';

describe('audit metadata minimization', () => {
  it('deduplicates and orders allowlisted Property field names without accepting values', () => {
    expect(createPropertyAuditMetadata(['timezone', 'name', 'timezone'])).toEqual({
      kind: 'PROPERTY_CHANGE',
      changedFields: ['name', 'timezone'],
    });
  });

  it.each(['password', 'accessToken', 'requestBody', 'address.fullValue'])(
    'rejects sensitive or oversized metadata field %s',
    (field) => {
      expect(() => createPropertyAuditMetadata(['name', field])).toThrow(TypeError);
    },
  );

  it('records only safe scope field names and one exact version advance', () => {
    expect(
      createPropertyScopeAuditMetadata({
        changedFields: ['propertyScopeVersion', 'propertyAccessMode'],
        previousScopeVersion: 4,
        resultingScopeVersion: 5,
      }),
    ).toEqual({
      kind: 'PROPERTY_SCOPE_CHANGE',
      changedFields: ['propertyAccessMode', 'propertyScopeVersion'],
      previousScopeVersion: 4,
      resultingScopeVersion: 5,
    });
  });

  it.each([
    [0, 1],
    [2, 2],
    [2, 4],
  ])('rejects an invalid scope version transition %s -> %s', (previous, resulting) => {
    expect(() =>
      createPropertyScopeAuditMetadata({
        changedFields: ['propertyScopeVersion'],
        previousScopeVersion: previous,
        resultingScopeVersion: resulting,
      }),
    ).toThrow(TypeError);
  });
});
