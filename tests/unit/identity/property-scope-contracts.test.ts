import { describe, expect, it } from 'vitest';

import {
  isPositiveScopeVersion,
  isPropertyAccessMode,
  toMembershipPropertyScopeSummary,
  toPropertyScopeGrantSummary,
} from '@/modules/identity/property-scope-contracts';
import {
  PROPERTY_SCOPE_CONFLICT_MESSAGE,
  PROPERTY_SCOPE_INVALID_MESSAGE,
  PropertyScopeConflictError,
  PropertyScopeValidationError,
} from '@/modules/identity/property-scope-errors';

describe('Property scope contracts', () => {
  it('recognizes only the two explicit access modes and positive safe versions', () => {
    expect(isPropertyAccessMode('ALL_PROPERTIES')).toBe(true);
    expect(isPropertyAccessMode('SELECTED_PROPERTIES')).toBe(true);
    expect(isPropertyAccessMode(null)).toBe(false);
    expect(isPropertyAccessMode('OWNER')).toBe(false);
    expect(isPositiveScopeVersion(1)).toBe(true);
    expect(isPositiveScopeVersion(0)).toBe(false);
    expect(isPositiveScopeVersion(1.5)).toBe(false);
  });

  it('projects a minimum membership summary without provider or role fields', () => {
    const record = {
      membershipId: 'membership-1',
      status: 'ACTIVE' as const,
      propertyAccessMode: 'SELECTED_PROPERTIES' as const,
      propertyScopeVersion: 2,
      selectedPropertyCount: 1,
      createdAt: new Date('2026-08-12T00:00:00.000Z'),
      email: 'private@example.test',
      providerSubject: 'provider-secret',
      roles: ['TENANT_OWNER'],
    };

    expect(toMembershipPropertyScopeSummary(record)).toEqual({
      membershipId: 'membership-1',
      status: 'ACTIVE',
      propertyAccessMode: 'SELECTED_PROPERTIES',
      propertyScopeVersion: 2,
      selectedPropertyCount: 1,
    });
  });

  it('projects only minimum grant-list fields', () => {
    const record = {
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      propertyId: 'property-1',
      propertySlug: 'villa-merapi',
      propertyName: 'Villa Merapi',
      grantedAt: new Date('2026-08-12T00:00:00.000Z'),
      fullAddress: 'must-not-leak',
    };

    expect(toPropertyScopeGrantSummary(record)).toEqual({
      propertyId: 'property-1',
      propertySlug: 'villa-merapi',
      propertyName: 'Villa Merapi',
    });
  });

  it('provides stable conflict and invalid-command categories without identifiers', () => {
    expect(new PropertyScopeConflictError()).toMatchObject({
      code: 'PROPERTY_SCOPE_CONFLICT',
      message: PROPERTY_SCOPE_CONFLICT_MESSAGE,
    });
    expect(new PropertyScopeValidationError()).toMatchObject({
      code: 'PROPERTY_SCOPE_INVALID',
      message: PROPERTY_SCOPE_INVALID_MESSAGE,
    });
  });
});
