import { describe, expect, it } from 'vitest';

import { createStaffAuditActor, createSystemAuditActor } from '@/modules/audit/audit-contracts';

describe('audit actor contracts', () => {
  it('requires a verified membership identity for a STAFF actor', () => {
    expect(createStaffAuditActor('user-1', 'membership-1')).toEqual({
      type: 'STAFF',
      actorId: 'user-1',
      membershipId: 'membership-1',
    });
  });

  it('creates a redacted SYSTEM actor without staff membership or provider data', () => {
    expect(createSystemAuditActor('phase-2-owner-scope-backfill')).toEqual({
      type: 'SYSTEM',
      actorId: 'phase-2-owner-scope-backfill',
    });
  });
});
