import { describe, expect, it, vi } from 'vitest';

import {
  requireAuthorizedPropertyListScope,
  requirePropertyCreationPermission,
  requirePropertyPermission,
  requirePropertyScopeAdministrator,
  withPropertyPermission,
} from '@/modules/identity/property-authorization';
import { AuthorizationError } from '@/modules/identity/authorization';
import type {
  PropertyMembershipAuthorization,
  PropertyScopeAuthorizationPort,
} from '@/modules/identity/property-scope-contracts';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_MEMBERSHIP_ID = '33333333-3333-4333-8333-333333333333';
const PROPERTY_ID = '44444444-4444-4444-8444-444444444444';

function membership(
  overrides: Partial<PropertyMembershipAuthorization> = {},
): PropertyMembershipAuthorization {
  return {
    membershipId: MEMBERSHIP_ID,
    tenantId: TENANT_ID,
    status: 'ACTIVE',
    permissions: ['property.read', 'property.manage', 'staff.manage'],
    propertyAccessMode: 'ALL_PROPERTIES',
    propertyScopeVersion: 3,
    ...overrides,
  };
}

function scopePort(authorized: boolean): PropertyScopeAuthorizationPort & {
  isPropertyAuthorized: ReturnType<typeof vi.fn>;
} {
  return { isPropertyAuthorized: vi.fn().mockResolvedValue(authorized) };
}

describe('Property authorization', () => {
  it('checks Tenant ownership/scope before invoking an ALL_PROPERTIES callback', async () => {
    const scopeAuthorization = scopePort(true);
    const protectedOperation = vi.fn().mockResolvedValue('allowed');

    await expect(
      withPropertyPermission(
        {
          membership: membership(),
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          permission: 'property.read',
          scopeAuthorization,
        },
        protectedOperation,
      ),
    ).resolves.toBe('allowed');

    expect(scopeAuthorization.isPropertyAuthorized).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      propertyId: PROPERTY_ID,
      permission: 'property.read',
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: 3,
      includeArchived: false,
    });
    expect(scopeAuthorization.isPropertyAuthorized.mock.invocationCallOrder[0]).toBeLessThan(
      protectedOperation.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('denies a selected membership without a grant before the callback', async () => {
    const scopeAuthorization = scopePort(false);
    const protectedOperation = vi.fn();

    await expect(
      withPropertyPermission(
        {
          membership: membership({ propertyAccessMode: 'SELECTED_PROPERTIES' }),
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          permission: 'property.read',
          scopeAuthorization,
        },
        protectedOperation,
      ),
    ).rejects.toEqual(new AuthorizationError());

    expect(protectedOperation).not.toHaveBeenCalled();
  });

  it('denies missing permission before querying ownership or grant state', async () => {
    const scopeAuthorization = scopePort(true);

    await expect(
      requirePropertyPermission({
        membership: membership({ permissions: [] }),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        permission: 'property.read',
        scopeAuthorization,
      }),
    ).rejects.toEqual(new AuthorizationError());

    expect(scopeAuthorization.isPropertyAuthorized).not.toHaveBeenCalled();
  });

  it.each([
    ['missing mode', { propertyAccessMode: null }],
    ['unknown mode', { propertyAccessMode: 'OWNER' }],
    ['missing version', { propertyScopeVersion: null }],
    ['invalid version', { propertyScopeVersion: 0 }],
    ['missing membership identity', { membershipId: '' }],
  ])('fails closed for %s before querying a Property', async (_name, override) => {
    const scopeAuthorization = scopePort(true);

    await expect(
      requirePropertyPermission({
        membership: membership(override as unknown as Partial<PropertyMembershipAuthorization>),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        permission: 'property.read',
        scopeAuthorization,
      }),
    ).rejects.toEqual(new AuthorizationError());
    expect(scopeAuthorization.isPropertyAuthorized).not.toHaveBeenCalled();
  });

  it('creates a set-based list scope without treating scope as permission', () => {
    expect(
      requireAuthorizedPropertyListScope(
        membership({ propertyAccessMode: 'SELECTED_PROPERTIES' }),
        TENANT_ID,
      ),
    ).toEqual({
      kind: 'SELECTED_PROPERTIES',
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      propertyScopeVersion: 3,
    });

    expect(() =>
      requireAuthorizedPropertyListScope(
        membership({ permissions: [], propertyAccessMode: 'ALL_PROPERTIES' }),
        TENANT_ID,
      ),
    ).toThrow(AuthorizationError);
  });

  it('requires property.manage and ALL_PROPERTIES for creation', () => {
    expect(requirePropertyCreationPermission(membership(), TENANT_ID)).toMatchObject({
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      propertyAccessMode: 'ALL_PROPERTIES',
    });

    expect(() =>
      requirePropertyCreationPermission(
        membership({ propertyAccessMode: 'SELECTED_PROPERTIES' }),
        TENANT_ID,
      ),
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePropertyCreationPermission(membership({ permissions: ['property.read'] }), TENANT_ID),
    ).toThrow(AuthorizationError);
  });

  it('requires staff.manage, ALL_PROPERTIES, and a different target for scope administration', () => {
    expect(
      requirePropertyScopeAdministrator(membership(), TENANT_ID, TARGET_MEMBERSHIP_ID),
    ).toMatchObject({
      tenantId: TENANT_ID,
      actorMembershipId: MEMBERSHIP_ID,
      targetMembershipId: TARGET_MEMBERSHIP_ID,
    });

    expect(() =>
      requirePropertyScopeAdministrator(
        membership({ permissions: ['property.read'], propertyAccessMode: 'ALL_PROPERTIES' }),
        TENANT_ID,
        TARGET_MEMBERSHIP_ID,
      ),
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePropertyScopeAdministrator(
        membership({ propertyAccessMode: 'SELECTED_PROPERTIES' }),
        TENANT_ID,
        TARGET_MEMBERSHIP_ID,
      ),
    ).toThrow(AuthorizationError);
    expect(() => requirePropertyScopeAdministrator(membership(), TENANT_ID, MEMBERSHIP_ID)).toThrow(
      AuthorizationError,
    );
  });
});
