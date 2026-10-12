import type { AuditMetadata } from './audit-metadata';

export const PHASE_2_AUDIT_ACTIONS = [
  'PROPERTY_CREATED',
  'PROPERTY_PROFILE_UPDATED',
  'PROPERTY_PUBLISHED',
  'PROPERTY_DEACTIVATED',
  'PROPERTY_REPUBLISHED',
  'PROPERTY_ARCHIVED',
  'MEMBERSHIP_PROPERTY_ACCESS_MODE_CHANGED',
  'MEMBERSHIP_PROPERTY_GRANTED',
  'MEMBERSHIP_PROPERTY_REVOKED',
  'TENANT_OWNER_PROPERTY_SCOPE_BOOTSTRAPPED',
  'TENANT_OWNER_PROPERTY_SCOPE_BACKFILLED',
] as const;

export type Phase2AuditAction = (typeof PHASE_2_AUDIT_ACTIONS)[number];

export type AuditActor =
  | {
      type: 'STAFF';
      actorId: string;
      membershipId: string;
    }
  | {
      type: 'SYSTEM';
      actorId: string;
    };

export type AuditTargetType = 'PROPERTY' | 'STAFF_MEMBERSHIP';

export interface AppendAuditEventInput {
  tenantId: string;
  propertyId: string | null;
  actor: AuditActor;
  action: Phase2AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  result: 'SUCCEEDED';
  aggregateVersion: number | null;
  correlationId: string;
  metadata: AuditMetadata;
}

export interface AppendedAuditEvent {
  id: string;
  occurredAt: Date;
}

/** Append-only by construction: the application port exposes no update or delete command. */
export interface AuditWritePort {
  append(event: AppendAuditEventInput): Promise<AppendedAuditEvent>;
}

export function createStaffAuditActor(actorId: string, membershipId: string): AuditActor {
  return { type: 'STAFF', actorId, membershipId };
}

export function createSystemAuditActor(actorId: string): AuditActor {
  return { type: 'SYSTEM', actorId };
}
