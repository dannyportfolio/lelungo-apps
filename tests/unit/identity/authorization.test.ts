import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_DENIED_MESSAGE,
  AuthorizationError,
  hasPermission,
  requireTenantPermission,
} from '@/modules/identity/authorization';

describe('tenant authorization', () => {
  const membership = {
    membershipId: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    status: 'ACTIVE' as const,
    propertyAccessMode: 'ALL_PROPERTIES' as const,
    propertyScopeVersion: 1,
    permissions: ['booking.read', 'booking.update'],
  };

  it('grants an active membership its explicit permission', () => {
    expect(hasPermission(membership, 'booking.read')).toBe(true);
    expect(requireTenantPermission(membership, 'tenant-a', 'booking.update')).toBe(membership);
  });

  it('rejects a membership from a different tenant', () => {
    expect(() => requireTenantPermission(membership, 'tenant-b', 'booking.read')).toThrow(
      AuthorizationError,
    );
  });

  it('rejects inactive memberships and missing permissions', () => {
    expect(hasPermission({ ...membership, status: 'SUSPENDED' }, 'booking.read')).toBe(false);
    expect(() => requireTenantPermission(membership, 'tenant-a', 'payment.refund')).toThrow(
      AuthorizationError,
    );
  });

  it('returns a stable generic denial without exposing tenant or permission details', () => {
    try {
      requireTenantPermission(membership, 'tenant-b', 'payment.refund');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'AuthorizationError',
        code: 'AUTHORIZATION_DENIED',
        message: AUTHORIZATION_DENIED_MESSAGE,
      });
      expect((error as Error).message).not.toContain('tenant-b');
      expect((error as Error).message).not.toContain('payment.refund');
    }
  });
});
