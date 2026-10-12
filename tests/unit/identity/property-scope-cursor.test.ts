import { describe, expect, it } from 'vitest';

import {
  decodeMembershipScopeCursor,
  encodeMembershipScopeCursor,
} from '@/modules/identity/property-scope-cursor';

const POSITION = {
  createdAt: new Date('2026-08-12T00:00:00.000Z'),
  membershipId: '11111111-1111-4111-8111-111111111111',
};
const BINDING = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  actorMembershipId: '33333333-3333-4333-8333-333333333333',
  actorUserId: '55555555-5555-4555-8555-555555555555',
  actorScopeVersion: 4,
};

describe('membership scope cursor', () => {
  it('round-trips under the same tenant and actor scope', () => {
    const cursor = encodeMembershipScopeCursor(POSITION, BINDING);
    expect(decodeMembershipScopeCursor(cursor, BINDING)).toEqual(POSITION);
  });

  it('rejects reuse under another tenant, actor membership, actor user, or scope version', () => {
    const cursor = encodeMembershipScopeCursor(POSITION, BINDING);
    expect(() =>
      decodeMembershipScopeCursor(cursor, { ...BINDING, actorScopeVersion: 5 }),
    ).toThrow();
    expect(() =>
      decodeMembershipScopeCursor(cursor, {
        ...BINDING,
        actorMembershipId: '66666666-6666-4666-8666-666666666666',
      }),
    ).toThrow();
    expect(() =>
      decodeMembershipScopeCursor(cursor, {
        ...BINDING,
        actorUserId: '77777777-7777-4777-8777-777777777777',
      }),
    ).toThrow();
    expect(() =>
      decodeMembershipScopeCursor(cursor, {
        ...BINDING,
        tenantId: '44444444-4444-4444-8444-444444444444',
      }),
    ).toThrow();
  });
});
