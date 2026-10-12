import 'server-only';

import type { Prisma, PropertyLifecycle } from '@prisma/client';

import { PrismaAuditRepository } from '@/modules/audit/prisma-audit-repository';
import { createStaffAuditActor, type Phase2AuditAction } from '@/modules/audit/audit-contracts';
import { createPropertyAuditMetadata } from '@/modules/audit/audit-metadata';
import { AuthorizationError } from '@/modules/identity/authorization';
import type {
  AuthorizedPropertyContext,
  AuthorizedPropertyCreationContext,
  AuthorizedPropertyListScope,
} from '@/modules/identity/property-scope-contracts';
import { PrismaPropertyScopeRepository } from '@/modules/identity/property-scope-repository';
import type { TenantIdentity } from '@/modules/tenancy/tenant-context-types';
import { prisma } from '@/shared/database/prisma';
import type { PropertyLifecycleIntent } from './property-constants';
import type {
  InternalPropertyDetailDto,
  ResolvedPublishedPropertyIdentity,
} from './property-contracts';
import { canTransitionPropertyLifecycle } from './property-domain';
import { requireCanonicalIanaTimezone } from './property-domain';
import {
  PropertyConflictError,
  PropertyNotFoundError,
  PropertyValidationError,
} from './property-errors';
import { PrismaPropertyRepository, type PropertyPage } from './property-repository';
import {
  createPropertyCommandSchema,
  propertyLifecycleCommandSchema,
  propertyListQuerySchema,
  publishedPropertyResolutionSchema,
  updatePropertyCommandSchema,
  type CreatePropertyCommand,
  type PropertyListQuery,
  type UpdatePropertyCommand,
} from './property-schemas';

export interface PropertyStaffActor {
  userId: string;
  membershipId: string;
  correlationId: string;
}

function changedFields(command: UpdatePropertyCommand): string[] {
  const fields: string[] = [];
  for (const key of [
    'name',
    'slug',
    'classificationKey',
    'timezone',
    'shortDescription',
    'publicWhatsAppE164',
  ] as const) {
    if (command[key] !== undefined) fields.push(key);
  }
  if (command.address !== undefined) {
    fields.push(
      'address.line1',
      'address.line2',
      'address.locality',
      'address.adminArea',
      'address.postalCode',
      'address.countryCode',
    );
  }
  if (command.amenityKeys !== undefined) fields.push('amenityIds');
  return fields;
}

function createdFields(command: CreatePropertyCommand): string[] {
  return [
    'name',
    'slug',
    'classificationKey',
    'timezone',
    'address.line1',
    ...(command.address.line2 ? ['address.line2'] : []),
    'address.locality',
    'address.adminArea',
    ...(command.address.postalCode ? ['address.postalCode'] : []),
    'address.countryCode',
    'amenityIds',
    ...(command.shortDescription ? ['shortDescription'] : []),
    ...(command.publicWhatsAppE164 ? ['publicWhatsAppE164'] : []),
  ];
}

function isPersistenceConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

function buildAddressData(address: CreatePropertyCommand['address']) {
  return {
    line1: address.line1,
    line2: address.line2 ?? null,
    locality: address.locality,
    adminArea: address.adminArea,
    postalCode: address.postalCode ?? null,
    countryCode: address.countryCode,
  };
}

async function requireActiveCatalogs(
  repository: PrismaPropertyRepository,
  classificationKey: string,
  amenityKeys: readonly string[],
): Promise<void> {
  if (!(await repository.isCatalogSelectionActive(classificationKey, amenityKeys))) {
    throw new PropertyValidationError();
  }
}

async function requireCurrentCreationAuthority(
  transaction: Prisma.TransactionClient,
  authority: AuthorizedPropertyCreationContext,
  actor: PropertyStaffActor,
): Promise<void> {
  if (actor.membershipId !== authority.membershipId) throw new AuthorizationError();
  const membership = await transaction.staffMembership.count({
    where: {
      id: authority.membershipId,
      tenantId: authority.tenantId,
      status: 'ACTIVE',
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: authority.propertyScopeVersion,
      userId: actor.userId,
      tenant: { status: 'ACTIVE' },
      roles: {
        some: {
          tenantId: authority.tenantId,
          role: {
            tenantId: authority.tenantId,
            scope: 'TENANT',
            permissions: { some: { permission: { key: 'property.manage' } } },
          },
        },
      },
    },
  });
  if (membership !== 1) throw new AuthorizationError();
}

async function requireCurrentMutationAuthority(
  transaction: Prisma.TransactionClient,
  authority: AuthorizedPropertyContext,
  actor: PropertyStaffActor,
): Promise<void> {
  if (
    actor.membershipId !== authority.membershipId ||
    !(await new PrismaPropertyScopeRepository(transaction).isPropertyAuthorized({
      tenantId: authority.tenantId,
      membershipId: authority.membershipId,
      propertyId: authority.propertyId,
      permission: 'property.manage',
      propertyAccessMode: authority.propertyAccessMode,
      propertyScopeVersion: authority.propertyScopeVersion,
      includeArchived: true,
      actorUserId: actor.userId,
    }))
  ) {
    throw new AuthorizationError();
  }
}

export async function createProperty(
  authority: AuthorizedPropertyCreationContext,
  actor: PropertyStaffActor,
  rawCommand: unknown,
): Promise<InternalPropertyDetailDto> {
  const command = createPropertyCommandSchema.parse(rawCommand);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const repository = new PrismaPropertyRepository(transaction);
        await requireCurrentCreationAuthority(transaction, authority, actor);
        await requireActiveCatalogs(repository, command.classificationKey, command.amenityKeys);
        const created = await transaction.property.create({
          data: {
            tenantId: authority.tenantId,
            name: command.name,
            slug: command.slug,
            classificationKey: command.classificationKey,
            timezone: command.timezone,
            shortDescription: command.shortDescription ?? null,
            publicWhatsAppE164: command.publicWhatsAppE164 ?? null,
            address: {
              create: buildAddressData(command.address),
            },
            amenities: {
              create: command.amenityKeys.map((amenityKey) => ({ amenityKey })),
            },
          },
          select: { id: true, version: true },
        });
        await new PrismaAuditRepository(transaction).append({
          tenantId: authority.tenantId,
          propertyId: created.id,
          actor: createStaffAuditActor(actor.userId, actor.membershipId),
          action: 'PROPERTY_CREATED',
          targetType: 'PROPERTY',
          targetId: created.id,
          result: 'SUCCEEDED',
          aggregateVersion: created.version,
          correlationId: actor.correlationId,
          metadata: createPropertyAuditMetadata(createdFields(command)),
        });
        const detail = await repository.findDetail(authority.tenantId, created.id);
        if (!detail) throw new PropertyNotFoundError();
        return detail;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isPersistenceConflict(error)) throw new PropertyConflictError();
    throw error;
  }
}

export async function updateProperty(
  authority: AuthorizedPropertyContext,
  actor: PropertyStaffActor,
  rawCommand: unknown,
): Promise<InternalPropertyDetailDto> {
  const command = updatePropertyCommandSchema.parse(rawCommand);
  if (command.propertyId !== authority.propertyId) throw new AuthorizationError();
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const repository = new PrismaPropertyRepository(transaction);
        await requireCurrentMutationAuthority(transaction, authority, actor);
        const current = await repository.findProjection(authority.tenantId, command.propertyId);
        if (!current) throw new PropertyNotFoundError();
        if (current.lifecycle === 'ARCHIVED') throw new PropertyConflictError();
        const nextClassification = command.classificationKey ?? current.classificationKey;
        const nextAmenities =
          command.amenityKeys ?? current.amenities.map(({ amenity }) => amenity.key);
        await requireActiveCatalogs(repository, nextClassification, nextAmenities);

        const rootData: Prisma.PropertyUpdateManyMutationInput = {
          ...(command.name !== undefined ? { name: command.name } : {}),
          ...(command.slug !== undefined ? { slug: command.slug } : {}),
          ...(command.classificationKey !== undefined
            ? { classificationKey: command.classificationKey }
            : {}),
          ...(command.timezone !== undefined ? { timezone: command.timezone } : {}),
          ...(command.shortDescription !== undefined
            ? { shortDescription: command.shortDescription }
            : {}),
          ...(command.publicWhatsAppE164 !== undefined
            ? { publicWhatsAppE164: command.publicWhatsAppE164 }
            : {}),
          version: { increment: 1 },
        };
        const updated = await transaction.property.updateMany({
          where: {
            tenantId: authority.tenantId,
            id: command.propertyId,
            version: command.expectedVersion,
            lifecycle: { not: 'ARCHIVED' },
          },
          data: rootData,
        });
        if (updated.count !== 1) throw new PropertyConflictError();

        if (command.address !== undefined) {
          await transaction.propertyAddress.update({
            where: {
              tenantId_propertyId: {
                tenantId: authority.tenantId,
                propertyId: command.propertyId,
              },
            },
            data: buildAddressData(command.address),
          });
        }
        if (command.amenityKeys !== undefined) {
          await transaction.propertyAmenity.deleteMany({
            where: { tenantId: authority.tenantId, propertyId: command.propertyId },
          });
          if (command.amenityKeys.length > 0) {
            await transaction.propertyAmenity.createMany({
              data: command.amenityKeys.map((amenityKey) => ({
                tenantId: authority.tenantId,
                propertyId: command.propertyId,
                amenityKey,
              })),
            });
          }
        }
        await new PrismaAuditRepository(transaction).append({
          tenantId: authority.tenantId,
          propertyId: command.propertyId,
          actor: createStaffAuditActor(actor.userId, actor.membershipId),
          action: 'PROPERTY_PROFILE_UPDATED',
          targetType: 'PROPERTY',
          targetId: command.propertyId,
          result: 'SUCCEEDED',
          aggregateVersion: command.expectedVersion + 1,
          correlationId: actor.correlationId,
          metadata: createPropertyAuditMetadata(changedFields(command)),
        });
        const detail = await repository.findDetail(authority.tenantId, command.propertyId);
        if (!detail) throw new PropertyNotFoundError();
        return detail;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isPersistenceConflict(error)) throw new PropertyConflictError();
    throw error;
  }
}

const lifecycleConfiguration: Record<
  Exclude<PropertyLifecycleIntent, 'ARCHIVE'>,
  { to: PropertyLifecycle; action: Phase2AuditAction }
> = {
  PUBLISH: { to: 'PUBLISHED', action: 'PROPERTY_PUBLISHED' },
  DEACTIVATE: { to: 'INACTIVE', action: 'PROPERTY_DEACTIVATED' },
  REPUBLISH: { to: 'PUBLISHED', action: 'PROPERTY_REPUBLISHED' },
};

export async function transitionPropertyLifecycle(
  authority: AuthorizedPropertyContext,
  actor: PropertyStaffActor,
  intent: PropertyLifecycleIntent,
  rawCommand: unknown,
): Promise<InternalPropertyDetailDto> {
  const command = propertyLifecycleCommandSchema.parse(rawCommand);
  if (command.propertyId !== authority.propertyId) throw new AuthorizationError();
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const repository = new PrismaPropertyRepository(transaction);
        await requireCurrentMutationAuthority(transaction, authority, actor);
        const current = await repository.findProjection(authority.tenantId, command.propertyId);
        if (!current) throw new PropertyNotFoundError();
        if (!canTransitionPropertyLifecycle(current.lifecycle, intent))
          throw new PropertyConflictError();
        if (intent === 'PUBLISH' || intent === 'REPUBLISH') {
          if (current.tenant.status !== 'ACTIVE') throw new PropertyValidationError();
          requireCanonicalIanaTimezone(current.timezone);
          await requireActiveCatalogs(
            repository,
            current.classificationKey,
            current.amenities.map(({ amenity }) => amenity.key),
          );
        }
        const [databaseClock] = await transaction.$queryRaw<Array<{ occurredAt: Date }>>`
      SELECT CURRENT_TIMESTAMP AS "occurredAt"
    `;
        if (!databaseClock) throw new PropertyConflictError();
        const occurredAt = databaseClock.occurredAt;
        const to = intent === 'ARCHIVE' ? 'ARCHIVED' : lifecycleConfiguration[intent].to;
        const accepted = await repository.transitionLifecycle({
          tenantId: authority.tenantId,
          propertyId: command.propertyId,
          expectedVersion: command.expectedVersion,
          from: current.lifecycle,
          to,
          occurredAt,
        });
        if (!accepted) throw new PropertyConflictError();
        await new PrismaAuditRepository(transaction).append({
          tenantId: authority.tenantId,
          propertyId: command.propertyId,
          actor: createStaffAuditActor(actor.userId, actor.membershipId),
          action:
            intent === 'ARCHIVE' ? 'PROPERTY_ARCHIVED' : lifecycleConfiguration[intent].action,
          targetType: 'PROPERTY',
          targetId: command.propertyId,
          result: 'SUCCEEDED',
          aggregateVersion: command.expectedVersion + 1,
          correlationId: actor.correlationId,
          metadata: createPropertyAuditMetadata([
            'lifecycleStatus',
            ...(intent === 'DEACTIVATE'
              ? (['deactivatedAt'] as const)
              : intent === 'ARCHIVE'
                ? (['archivedAt'] as const)
                : (['publishedAt', 'deactivatedAt'] as const)),
          ]),
        });
        const detail = await repository.findDetail(authority.tenantId, command.propertyId);
        if (!detail) throw new PropertyNotFoundError();
        return detail;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isPersistenceConflict(error)) throw new PropertyConflictError();
    throw error;
  }
}

export async function listProperties(
  scope: AuthorizedPropertyListScope,
  rawQuery: PropertyListQuery,
): Promise<PropertyPage> {
  const query = propertyListQuerySchema.parse(rawQuery);
  return new PrismaPropertyRepository(prisma).listAuthorized({
    scope,
    pageSize: query.pageSize,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
}

export async function getPropertyDetail(
  authority: AuthorizedPropertyContext,
): Promise<InternalPropertyDetailDto> {
  const detail = await new PrismaPropertyRepository(prisma).findAuthorizedDetail(authority);
  if (!detail) throw new AuthorizationError();
  return detail;
}

export async function resolvePublishedPropertyIdentity(
  tenant: TenantIdentity,
  rawSlug: string,
): Promise<ResolvedPublishedPropertyIdentity> {
  const { slug } = publishedPropertyResolutionSchema.parse({ slug: rawSlug });
  if (tenant.status !== 'ACTIVE') throw new PropertyNotFoundError();

  const resolved = await new PrismaPropertyRepository(prisma).resolvePublished(tenant, slug);
  if (!resolved) throw new PropertyNotFoundError();
  return resolved;
}
