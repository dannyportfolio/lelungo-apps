import { describe, expect, it } from 'vitest';

import {
  propertyGrantMutationSchema,
  propertyScopePageSchema,
  replacePropertyAccessModeSchema,
} from '@/modules/identity/property-scope-schemas';

const TARGET = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '22222222-2222-4222-8222-222222222222';

describe('Property scope boundary schemas', () => {
  it('bounds list pages and rejects unknown input', () => {
    expect(() => propertyScopePageSchema.parse({ pageSize: 101 })).toThrow();
    expect(() => propertyScopePageSchema.parse({ pageSize: 25, tenantId: TARGET })).toThrow();
  });

  it('deduplicates selected identifiers and rejects dormant grants for all access', () => {
    expect(
      replacePropertyAccessModeSchema.parse({
        targetMembershipId: TARGET,
        expectedVersion: 1,
        propertyAccessMode: 'SELECTED_PROPERTIES',
        selectedPropertyIds: [PROPERTY, PROPERTY],
      }).selectedPropertyIds,
    ).toEqual([PROPERTY]);
    expect(() =>
      replacePropertyAccessModeSchema.parse({
        targetMembershipId: TARGET,
        expectedVersion: 1,
        propertyAccessMode: 'ALL_PROPERTIES',
        selectedPropertyIds: [PROPERTY],
      }),
    ).toThrow();
  });

  it('rejects identity and role mass assignment on grant commands', () => {
    expect(() =>
      propertyGrantMutationSchema.parse({
        targetMembershipId: TARGET,
        expectedVersion: 1,
        propertyId: PROPERTY,
        userId: TARGET,
        roleId: TARGET,
      }),
    ).toThrow();
  });
});
