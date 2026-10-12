import { createHash, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { PropertyScopeValidationError } from './property-scope-errors';

const payloadSchema = z
  .object({
    v: z.literal(1),
    createdAt: z.string().datetime({ offset: true }),
    membershipId: z.string().uuid(),
    binding: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export interface MembershipScopeCursorPosition {
  createdAt: Date;
  membershipId: string;
}

interface MembershipScopeCursorBinding {
  tenantId: string;
  actorMembershipId: string;
  actorUserId: string;
  actorScopeVersion: number;
}

function binding(context: MembershipScopeCursorBinding): string {
  return createHash('sha256')
    .update(JSON.stringify({ ...context, order: 'CREATED_AT_ASC_ID_ASC', version: 1 }))
    .digest('hex');
}

export function encodeMembershipScopeCursor(
  position: MembershipScopeCursorPosition,
  context: MembershipScopeCursorBinding,
): string {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      createdAt: position.createdAt.toISOString(),
      membershipId: position.membershipId,
      binding: binding(context),
    }),
  ).toString('base64url');
}

export function decodeMembershipScopeCursor(
  cursor: string,
  context: MembershipScopeCursorBinding,
): MembershipScopeCursorPosition {
  if (cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new PropertyScopeValidationError();
  }
  try {
    const parsed = payloadSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown,
    );
    const actual = Buffer.from(parsed.binding, 'hex');
    const expected = Buffer.from(binding(context), 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new PropertyScopeValidationError();
    }
    return { createdAt: new Date(parsed.createdAt), membershipId: parsed.membershipId };
  } catch (error) {
    if (error instanceof PropertyScopeValidationError) throw error;
    throw new PropertyScopeValidationError();
  }
}
