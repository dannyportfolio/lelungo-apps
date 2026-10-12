import 'server-only';

import type { Prisma } from '@prisma/client';

import type { AppendAuditEventInput, AppendedAuditEvent, AuditWritePort } from './audit-contracts';

export class PrismaAuditRepository implements AuditWritePort {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async append(event: AppendAuditEventInput): Promise<AppendedAuditEvent> {
    const created = await this.transaction.auditEvent.create({
      data: {
        tenantId: event.tenantId,
        propertyId: event.propertyId,
        actorType: event.actor.type,
        actorId: event.actor.actorId,
        actorMembershipId: event.actor.type === 'STAFF' ? event.actor.membershipId : null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        result: event.result,
        aggregateVersion: event.aggregateVersion,
        previousScopeVersion:
          event.metadata.kind === 'PROPERTY_SCOPE_CHANGE'
            ? event.metadata.previousScopeVersion
            : null,
        resultingScopeVersion:
          event.metadata.kind === 'PROPERTY_SCOPE_CHANGE'
            ? event.metadata.resultingScopeVersion
            : null,
        correlationId: event.correlationId,
        changedFields: [...event.metadata.changedFields],
      },
      select: { id: true, occurredAt: true },
    });

    return created;
  }
}
