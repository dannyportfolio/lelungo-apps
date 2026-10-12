import 'server-only';

import type { Prisma } from '@prisma/client';

import { PrismaAuditRepository } from '@/modules/audit/prisma-audit-repository';
import { createStaffAuditActor } from '@/modules/audit/audit-contracts';
import { createPropertyScopeAuditMetadata } from '@/modules/audit/audit-metadata';
import { prisma } from '@/shared/database/prisma';
import { AuthorizationError } from './authorization';
import type {
  AuthorizedPropertyScopeAdministrator,
  BoundedPage,
  MembershipPropertyScopeSummary,
  PropertyScopeGrantSummary,
  PropertyScopeState,
} from './property-scope-contracts';
import { PropertyScopeConflictError, PropertyScopeValidationError } from './property-scope-errors';
import { PrismaPropertyScopeRepository } from './property-scope-repository';
import {
  propertyGrantMutationSchema,
  propertyScopePageSchema,
  replacePropertyAccessModeSchema,
} from './property-scope-schemas';

export interface PropertyScopeStaffActor {
  userId: string;
  correlationId: string;
}

interface CurrentPropertyScopeAdministrator {
  tenantId: string;
  actorMembershipId: string;
  actorUserId: string;
  actorScopeVersion: number;
}

async function requireCurrentAdministrator(
  transaction: Prisma.TransactionClient,
  administrator: CurrentPropertyScopeAdministrator,
  targetMembershipId?: string,
): Promise<void> {
  if (targetMembershipId === administrator.actorMembershipId) {
    throw new AuthorizationError();
  }
  const count = await transaction.staffMembership.count({
    where: {
      id: administrator.actorMembershipId,
      tenantId: administrator.tenantId,
      status: 'ACTIVE',
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: administrator.actorScopeVersion,
      userId: administrator.actorUserId,
      tenant: { status: 'ACTIVE' },
      roles: {
        some: {
          tenantId: administrator.tenantId,
          role: {
            tenantId: administrator.tenantId,
            scope: 'TENANT',
            permissions: { some: { permission: { key: 'staff.manage' } } },
          },
        },
      },
    },
  });
  if (count !== 1) throw new AuthorizationError();
}

function currentAdministrator(
  authority: AuthorizedPropertyScopeAdministrator,
  actor: PropertyScopeStaffActor,
): CurrentPropertyScopeAdministrator {
  return {
    tenantId: authority.tenantId,
    actorMembershipId: authority.actorMembershipId,
    actorUserId: actor.userId,
    actorScopeVersion: authority.propertyScopeVersion,
  };
}

async function requireCurrentTarget(
  repository: PrismaPropertyScopeRepository,
  authority: AuthorizedPropertyScopeAdministrator,
  expectedVersion: number,
): Promise<PropertyScopeState> {
  const state = await repository.findActiveScope(authority.tenantId, authority.targetMembershipId);
  if (!state) throw new AuthorizationError();
  if (state.propertyScopeVersion !== expectedVersion) throw new PropertyScopeConflictError();
  return state;
}

function auditActor(
  authority: AuthorizedPropertyScopeAdministrator,
  actor: PropertyScopeStaffActor,
) {
  return createStaffAuditActor(actor.userId, authority.actorMembershipId);
}

export async function replacePropertyAccessMode(
  authority: AuthorizedPropertyScopeAdministrator,
  actor: PropertyScopeStaffActor,
  rawInput: unknown,
): Promise<PropertyScopeState> {
  const input = replacePropertyAccessModeSchema.parse(rawInput);
  if (input.targetMembershipId !== authority.targetMembershipId) {
    throw new PropertyScopeValidationError();
  }
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const repository = new PrismaPropertyScopeRepository(transaction);
        await requireCurrentAdministrator(
          transaction,
          currentAdministrator(authority, actor),
          authority.targetMembershipId,
        );
        const current = await requireCurrentTarget(repository, authority, input.expectedVersion);
        if (current.propertyAccessMode === input.propertyAccessMode) {
          throw new PropertyScopeValidationError();
        }
        if (
          input.propertyAccessMode === 'SELECTED_PROPERTIES' &&
          input.selectedPropertyIds.length > 0
        ) {
          const propertyCount = await transaction.property.count({
            where: {
              tenantId: authority.tenantId,
              id: { in: input.selectedPropertyIds },
              lifecycle: { not: 'ARCHIVED' },
            },
          });
          if (propertyCount !== input.selectedPropertyIds.length) {
            throw new PropertyScopeValidationError();
          }
        }
        const updated = await transaction.staffMembership.updateMany({
          where: {
            tenantId: authority.tenantId,
            id: authority.targetMembershipId,
            status: 'ACTIVE',
            propertyScopeVersion: input.expectedVersion,
          },
          data: {
            propertyAccessMode: input.propertyAccessMode,
            propertyScopeVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new PropertyScopeConflictError();
        await transaction.membershipPropertyScope.deleteMany({
          where: { tenantId: authority.tenantId, membershipId: authority.targetMembershipId },
        });
        if (
          input.propertyAccessMode === 'SELECTED_PROPERTIES' &&
          input.selectedPropertyIds.length > 0
        ) {
          await transaction.membershipPropertyScope.createMany({
            data: input.selectedPropertyIds.map((propertyId) => ({
              tenantId: authority.tenantId,
              membershipId: authority.targetMembershipId,
              propertyId,
              grantedByMembershipId: authority.actorMembershipId,
            })),
          });
        }
        const resultingVersion = input.expectedVersion + 1;
        await new PrismaAuditRepository(transaction).append({
          tenantId: authority.tenantId,
          propertyId: null,
          actor: auditActor(authority, actor),
          action: 'MEMBERSHIP_PROPERTY_ACCESS_MODE_CHANGED',
          targetType: 'STAFF_MEMBERSHIP',
          targetId: authority.targetMembershipId,
          result: 'SUCCEEDED',
          aggregateVersion: resultingVersion,
          correlationId: actor.correlationId,
          metadata: createPropertyScopeAuditMetadata({
            changedFields: ['propertyAccessMode', 'selectedPropertySet', 'propertyScopeVersion'],
            previousScopeVersion: input.expectedVersion,
            resultingScopeVersion: resultingVersion,
          }),
        });
        return {
          tenantId: authority.tenantId,
          membershipId: authority.targetMembershipId,
          status: 'ACTIVE',
          propertyAccessMode: input.propertyAccessMode,
          propertyScopeVersion: resultingVersion,
          selectedPropertyIds:
            input.propertyAccessMode === 'SELECTED_PROPERTIES' ? input.selectedPropertyIds : [],
        };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isPrismaConcurrencyConflict(error)) throw new PropertyScopeConflictError();
    throw error;
  }
}

async function mutateGrant(
  operation: 'GRANT' | 'REVOKE',
  authority: AuthorizedPropertyScopeAdministrator,
  actor: PropertyScopeStaffActor,
  rawInput: unknown,
): Promise<PropertyScopeState> {
  const input = propertyGrantMutationSchema.parse(rawInput);
  if (input.targetMembershipId !== authority.targetMembershipId) {
    throw new PropertyScopeValidationError();
  }
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const repository = new PrismaPropertyScopeRepository(transaction);
        await requireCurrentAdministrator(
          transaction,
          currentAdministrator(authority, actor),
          authority.targetMembershipId,
        );
        const current = await requireCurrentTarget(repository, authority, input.expectedVersion);
        if (current.propertyAccessMode !== 'SELECTED_PROPERTIES')
          throw new PropertyScopeValidationError();
        if (operation === 'GRANT' && current.selectedPropertyIds.length >= 100) {
          throw new PropertyScopeValidationError();
        }
        const property = await transaction.property.findFirst({
          where: {
            tenantId: authority.tenantId,
            id: input.propertyId,
            lifecycle: { not: 'ARCHIVED' },
          },
          select: { id: true },
        });
        if (!property) throw new AuthorizationError();
        const contains = current.selectedPropertyIds.includes(input.propertyId);
        if ((operation === 'GRANT' && contains) || (operation === 'REVOKE' && !contains)) {
          throw new PropertyScopeValidationError();
        }
        const updated = await transaction.staffMembership.updateMany({
          where: {
            tenantId: authority.tenantId,
            id: authority.targetMembershipId,
            status: 'ACTIVE',
            propertyAccessMode: 'SELECTED_PROPERTIES',
            propertyScopeVersion: input.expectedVersion,
          },
          data: { propertyScopeVersion: { increment: 1 } },
        });
        if (updated.count !== 1) throw new PropertyScopeConflictError();
        if (operation === 'GRANT') {
          await transaction.membershipPropertyScope.create({
            data: {
              tenantId: authority.tenantId,
              membershipId: authority.targetMembershipId,
              propertyId: input.propertyId,
              grantedByMembershipId: authority.actorMembershipId,
            },
          });
        } else {
          const removed = await transaction.membershipPropertyScope.deleteMany({
            where: {
              tenantId: authority.tenantId,
              membershipId: authority.targetMembershipId,
              propertyId: input.propertyId,
            },
          });
          if (removed.count !== 1) throw new PropertyScopeConflictError();
        }
        const resultingVersion = input.expectedVersion + 1;
        await new PrismaAuditRepository(transaction).append({
          tenantId: authority.tenantId,
          propertyId: input.propertyId,
          actor: auditActor(authority, actor),
          action:
            operation === 'GRANT' ? 'MEMBERSHIP_PROPERTY_GRANTED' : 'MEMBERSHIP_PROPERTY_REVOKED',
          targetType: 'STAFF_MEMBERSHIP',
          targetId: authority.targetMembershipId,
          result: 'SUCCEEDED',
          aggregateVersion: resultingVersion,
          correlationId: actor.correlationId,
          metadata: createPropertyScopeAuditMetadata({
            changedFields: ['propertyGrant', 'propertyScopeVersion'],
            previousScopeVersion: input.expectedVersion,
            resultingScopeVersion: resultingVersion,
          }),
        });
        return {
          ...current,
          propertyScopeVersion: resultingVersion,
          selectedPropertyIds:
            operation === 'GRANT'
              ? [...current.selectedPropertyIds, input.propertyId].sort()
              : current.selectedPropertyIds.filter((propertyId) => propertyId !== input.propertyId),
        };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isPrismaConcurrencyConflict(error)) throw new PropertyScopeConflictError();
    throw error;
  }
}

function isPrismaConcurrencyConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

export const grantPropertyScope = mutateGrant.bind(null, 'GRANT');
export const revokePropertyScope = mutateGrant.bind(null, 'REVOKE');

export async function listActiveMembershipScopes(input: {
  tenantId: string;
  actorMembershipId: string;
  actorUserId: string;
  actorScopeVersion: number;
  pageSize: number;
  cursor?: string | null;
}): Promise<BoundedPage<MembershipPropertyScopeSummary>> {
  const query = propertyScopePageSchema.parse({ pageSize: input.pageSize, cursor: input.cursor });
  return prisma.$transaction(
    async (transaction) => {
      await requireCurrentAdministrator(transaction, input);
      return new PrismaPropertyScopeRepository(transaction).listActiveMembershipScopes({
        tenantId: input.tenantId,
        actorMembershipId: input.actorMembershipId,
        actorUserId: input.actorUserId,
        actorScopeVersion: input.actorScopeVersion,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null,
      });
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

export async function listSelectedPropertyScopes(input: {
  tenantId: string;
  actorMembershipId: string;
  actorUserId: string;
  actorScopeVersion: number;
  membershipId: string;
  propertyScopeVersion: number;
  pageSize: number;
  cursor?: string | null;
}): Promise<BoundedPage<PropertyScopeGrantSummary>> {
  const query = propertyScopePageSchema.parse({ pageSize: input.pageSize, cursor: input.cursor });
  return prisma.$transaction(
    async (transaction) => {
      await requireCurrentAdministrator(transaction, input);
      const repository = new PrismaPropertyScopeRepository(transaction);
      const target = await repository.findActiveScope(input.tenantId, input.membershipId);
      if (
        !target ||
        target.propertyAccessMode !== 'SELECTED_PROPERTIES' ||
        target.propertyScopeVersion !== input.propertyScopeVersion
      ) {
        throw new AuthorizationError();
      }
      return repository.listSelectedPropertyScopes({
        tenantId: input.tenantId,
        actorMembershipId: input.actorMembershipId,
        actorUserId: input.actorUserId,
        actorScopeVersion: input.actorScopeVersion,
        membershipId: input.membershipId,
        propertyScopeVersion: input.propertyScopeVersion,
        pageSize: query.pageSize,
        cursor: query.cursor ?? null,
      });
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
