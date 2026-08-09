import { describe, expect, it } from 'vitest';

import {
  AuthorizationError,
  hasPermission,
  requireTenantPermission,
} from '@/modules/identity/authorization';

describe('tenant authorization', () => {
  const membership = {
    tenantId: 'tenant-a',
    status: 'ACTIVE' as const,
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
});
