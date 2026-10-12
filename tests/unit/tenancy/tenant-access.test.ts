import { describe, expect, it, vi } from 'vitest';

import { AUTHORIZATION_DENIED_MESSAGE, AuthorizationError } from '@/modules/identity/authorization';
import { UnauthenticatedError } from '@/modules/identity/authenticated-subject';
import {
  requireAuthenticatedTenantMembership,
  requireAuthenticatedTenantPermission,
  withTenantPermission,
} from '@/modules/tenancy/tenant-access';
import type { RequestTenantContext } from '@/modules/tenancy/tenant-context-types';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444';

function tenantContext(
  overrides: Partial<Extract<RequestTenantContext, { kind: 'tenant' }>> = {},
): Extract<RequestTenantContext, { kind: 'tenant' }> {
  return {
    kind: 'tenant',
    actor: { userId: USER_ID },
    correlationId: 'request-1',
    tenant: {
      id: TENANT_ID,
      name: 'Lelungo Test',
      slug: 'lelungo-test',
      status: 'ACTIVE',
    },
    membership: {
      membershipId: MEMBERSHIP_ID,
      tenantId: TENANT_ID,
      status: 'ACTIVE',
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: 1,
      permissions: ['property.read'],
    },
    ...overrides,
  };
}

describe('authenticated tenant application boundary', () => {
  it('returns a narrowed active membership context', () => {
    const context = requireAuthenticatedTenantMembership(tenantContext());

    expect(context.actor.userId).toBe(USER_ID);
    expect(context.tenant.status).toBe('ACTIVE');
    expect(context.membership).toMatchObject({ tenantId: TENANT_ID, status: 'ACTIVE' });
  });

  it('uses the stable unauthenticated failure for a missing verified subject', () => {
    const context = tenantContext({ actor: { userId: null }, membership: null });

    expect(() => requireAuthenticatedTenantMembership(context)).toThrowError(
      new UnauthenticatedError(),
    );
  });

  it.each([
    [
      'platform scope',
      { kind: 'platform', actor: { userId: USER_ID }, correlationId: 'request-2' },
    ],
    ['missing membership', tenantContext({ membership: null })],
    [
      'inactive membership',
      tenantContext({
        membership: {
          membershipId: MEMBERSHIP_ID,
          tenantId: TENANT_ID,
          status: 'SUSPENDED',
          propertyAccessMode: 'ALL_PROPERTIES',
          propertyScopeVersion: 1,
          permissions: ['property.read'],
        },
      }),
    ],
    [
      'other-tenant membership',
      tenantContext({
        membership: {
          membershipId: MEMBERSHIP_ID,
          tenantId: '33333333-3333-4333-8333-333333333333',
          status: 'ACTIVE',
          propertyAccessMode: 'ALL_PROPERTIES',
          propertyScopeVersion: 1,
          permissions: ['property.read'],
        },
      }),
    ],
    [
      'inactive tenant',
      tenantContext({
        tenant: {
          id: TENANT_ID,
          name: 'Lelungo Test',
          slug: 'lelungo-test',
          status: 'SUSPENDED',
        },
      }),
    ],
  ] satisfies ReadonlyArray<[string, RequestTenantContext]>)(
    'uses a stable generic authorization failure for %s',
    (_name, context) => {
      expect(() => requireAuthenticatedTenantMembership(context)).toThrowError(
        new AuthorizationError(),
      );
    },
  );

  it('rejects a missing explicit permission without revealing its key', () => {
    expect(() =>
      requireAuthenticatedTenantPermission(tenantContext(), 'property.manage'),
    ).toThrowError(new AuthorizationError());

    try {
      requireAuthenticatedTenantPermission(tenantContext(), 'property.manage');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'AuthorizationError',
        code: 'AUTHORIZATION_DENIED',
        message: AUTHORIZATION_DENIED_MESSAGE,
      });
      expect((error as Error).message).not.toContain('property.manage');
    }
  });

  it.each([
    [
      'unauthenticated caller',
      tenantContext({ actor: { userId: null }, membership: null }),
      UnauthenticatedError,
    ],
    ['missing membership', tenantContext({ membership: null }), AuthorizationError],
    ['missing permission', tenantContext(), AuthorizationError],
  ])(
    'denies %s before the protected repository callback executes',
    async (_name, context, error) => {
      const protectedRepositoryCallback = vi.fn();
      const permission = _name === 'missing permission' ? 'property.manage' : 'property.read';

      await expect(
        withTenantPermission(context, permission, protectedRepositoryCallback),
      ).rejects.toBeInstanceOf(error);
      expect(protectedRepositoryCallback).not.toHaveBeenCalled();
    },
  );

  it('executes a protected callback only after explicit authorization succeeds', async () => {
    const protectedRepositoryCallback = vi.fn().mockResolvedValue({ id: 'record-1' });

    await expect(
      withTenantPermission(tenantContext(), 'property.read', protectedRepositoryCallback),
    ).resolves.toEqual({ id: 'record-1' });
    expect(protectedRepositoryCallback).toHaveBeenCalledOnce();
    expect(protectedRepositoryCallback.mock.calls[0]?.[0]).toMatchObject({
      actor: { userId: USER_ID },
      tenant: { id: TENANT_ID },
      membership: { status: 'ACTIVE' },
    });
  });
});
