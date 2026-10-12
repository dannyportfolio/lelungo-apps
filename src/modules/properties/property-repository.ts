import 'server-only';

import type { Prisma, PropertyLifecycle } from '@prisma/client';

import type { AuthorizedPropertyListScope } from '@/modules/identity/property-scope-contracts';
import type { TenantIdentity } from '@/modules/tenancy/tenant-context-types';
import type {
  PropertyProjectionSource,
  PublishedPropertyProjectionSource,
  PropertySummaryProjectionSource,
  ResolvedPublishedPropertyIdentity,
} from './property-contracts';
import {
  toInternalPropertyDetail,
  toInternalPropertySummary,
  toResolvedPublishedPropertyIdentity,
  type InternalPropertyDetailDto,
  type InternalPropertySummaryDto,
} from './property-contracts';
import { decodePropertyCursor, encodePropertyCursor } from './property-cursor';
import { PropertyNotFoundError } from './property-errors';

export const propertyProjectionSelect = {
  id: true,
  tenantId: true,
  slug: true,
  name: true,
  classificationKey: true,
  timezone: true,
  lifecycle: true,
  version: true,
  shortDescription: true,
  publicWhatsAppE164: true,
  publishedAt: true,
  deactivatedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { status: true } },
  address: {
    select: {
      line1: true,
      line2: true,
      locality: true,
      adminArea: true,
      postalCode: true,
      countryCode: true,
    },
  },
  amenities: {
    select: { amenity: { select: { key: true, isActive: true } } },
    orderBy: { amenityKey: 'asc' },
  },
} as const satisfies Prisma.PropertySelect;

export type PropertyProjectionRecord = Prisma.PropertyGetPayload<{
  select: typeof propertyProjectionSelect;
}>;

export const publishedPropertyProjectionSelect = {
  id: true,
  tenantId: true,
  slug: true,
  name: true,
  classificationKey: true,
  timezone: true,
  lifecycle: true,
  shortDescription: true,
  publicWhatsAppE164: true,
  tenant: { select: { status: true } },
  classification: { select: { isActive: true } },
  address: { select: { locality: true, adminArea: true } },
  amenities: {
    select: { amenity: { select: { key: true, isActive: true } } },
    orderBy: { amenityKey: 'asc' },
  },
} as const satisfies Prisma.PropertySelect;

type PublishedPropertyProjectionRecord = Prisma.PropertyGetPayload<{
  select: typeof publishedPropertyProjectionSelect;
}>;

export const propertySummarySelect = {
  id: true,
  slug: true,
  name: true,
  classificationKey: true,
  timezone: true,
  lifecycle: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { status: true } },
  address: { select: { locality: true, adminArea: true } },
} as const satisfies Prisma.PropertySelect;

type PropertySummaryRecord = Prisma.PropertyGetPayload<{
  select: typeof propertySummarySelect;
}>;

export interface PropertyPage {
  items: readonly InternalPropertySummaryDto[];
  nextCursor: string | null;
}

export interface PropertyRepositoryPort {
  listAuthorized(input: {
    scope: AuthorizedPropertyListScope;
    pageSize: number;
    cursor?: string;
    includeArchived?: boolean;
  }): Promise<PropertyPage>;
  findAuthorizedDetail(
    authority: import('@/modules/identity/property-scope-contracts').AuthorizedPropertyContext,
  ): Promise<InternalPropertyDetailDto | null>;
  resolvePublished(
    tenant: TenantIdentity,
    slug: string,
  ): Promise<ResolvedPublishedPropertyIdentity | null>;
}

function mapProjection(record: PropertyProjectionRecord): PropertyProjectionSource {
  if (!record.address || record.address.countryCode !== 'ID') {
    throw new PropertyNotFoundError();
  }

  return {
    ...record,
    lifecycle: record.lifecycle,
    tenantIsActive: record.tenant.status === 'ACTIVE',
    address: { ...record.address, countryCode: 'ID' },
    amenities: record.amenities.map(({ amenity }) => amenity),
  };
}

function mapSummary(record: PropertySummaryRecord): PropertySummaryProjectionSource {
  if (!record.address) throw new PropertyNotFoundError();
  return {
    ...record,
    tenantIsActive: record.tenant.status === 'ACTIVE',
    address: record.address,
  };
}

function mapPublishedProjection(
  record: PublishedPropertyProjectionRecord,
  trustedTenantId: string,
): PublishedPropertyProjectionSource | null {
  if (
    record.tenantId !== trustedTenantId ||
    record.lifecycle !== 'PUBLISHED' ||
    record.tenant.status !== 'ACTIVE' ||
    !record.classification.isActive ||
    !record.address ||
    record.amenities.some(({ amenity }) => !amenity.isActive)
  ) {
    return null;
  }

  return {
    id: record.id,
    tenantId: record.tenantId,
    slug: record.slug,
    name: record.name,
    classificationKey: record.classificationKey,
    timezone: record.timezone,
    lifecycle: record.lifecycle,
    shortDescription: record.shortDescription,
    publicWhatsAppE164: record.publicWhatsAppE164,
    tenantIsActive: true,
    address: record.address,
    amenities: record.amenities.map(({ amenity }) => amenity),
  };
}

function scopeWhere(scope: AuthorizedPropertyListScope): Prisma.PropertyWhereInput {
  return scope.kind === 'ALL_PROPERTIES'
    ? {}
    : {
        membershipScopes: {
          some: { tenantId: scope.tenantId, membershipId: scope.membershipId },
        },
      };
}

export class PrismaPropertyRepository implements PropertyRepositoryPort {
  constructor(private readonly database: Prisma.TransactionClient) {}

  async listAuthorized(input: {
    scope: AuthorizedPropertyListScope;
    pageSize: number;
    cursor?: string;
    includeArchived?: boolean;
  }): Promise<PropertyPage> {
    const position = input.cursor
      ? decodePropertyCursor(input.cursor, {
          tenantId: input.scope.tenantId,
          membershipId: input.scope.membershipId,
          accessMode: input.scope.kind,
          scopeVersion: input.scope.propertyScopeVersion,
          filters: { includeArchived: input.includeArchived ?? false },
        })
      : null;
    const records = await this.database.property.findMany({
      where: {
        tenantId: input.scope.tenantId,
        ...(input.includeArchived ? {} : { lifecycle: { not: 'ARCHIVED' } }),
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: input.scope.membershipId,
              tenantId: input.scope.tenantId,
              status: 'ACTIVE',
              propertyAccessMode: input.scope.kind,
              propertyScopeVersion: input.scope.propertyScopeVersion,
              roles: {
                some: {
                  tenantId: input.scope.tenantId,
                  role: {
                    tenantId: input.scope.tenantId,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: 'property.read' } } },
                  },
                },
              },
            },
          },
        },
        ...scopeWhere(input.scope),
        ...(position
          ? {
              OR: [
                { slug: { gt: position.slug } },
                { slug: position.slug, id: { gt: position.propertyId } },
              ],
            }
          : {}),
      },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      take: input.pageSize + 1,
      select: propertySummarySelect,
    });
    const hasMore = records.length > input.pageSize;
    const page = records.slice(0, input.pageSize);
    const last = page.at(-1);

    return {
      items: page.map((record) => toInternalPropertySummary(mapSummary(record))),
      nextCursor:
        hasMore && last
          ? encodePropertyCursor(
              { slug: last.slug, propertyId: last.id },
              {
                tenantId: input.scope.tenantId,
                membershipId: input.scope.membershipId,
                accessMode: input.scope.kind,
                scopeVersion: input.scope.propertyScopeVersion,
                filters: { includeArchived: input.includeArchived ?? false },
              },
            )
          : null,
    };
  }

  async findDetail(
    tenantId: string,
    propertyId: string,
  ): Promise<InternalPropertyDetailDto | null> {
    const record = await this.database.property.findFirst({
      where: { tenantId, id: propertyId },
      select: propertyProjectionSelect,
    });
    return record ? toInternalPropertyDetail(mapProjection(record)) : null;
  }

  async findAuthorizedDetail(
    authority: import('@/modules/identity/property-scope-contracts').AuthorizedPropertyContext,
  ): Promise<InternalPropertyDetailDto | null> {
    const record = await this.database.property.findFirst({
      where: {
        tenantId: authority.tenantId,
        id: authority.propertyId,
        tenant: {
          status: 'ACTIVE',
          memberships: {
            some: {
              id: authority.membershipId,
              tenantId: authority.tenantId,
              status: 'ACTIVE',
              propertyAccessMode: authority.propertyAccessMode,
              propertyScopeVersion: authority.propertyScopeVersion,
              roles: {
                some: {
                  tenantId: authority.tenantId,
                  role: {
                    tenantId: authority.tenantId,
                    scope: 'TENANT',
                    permissions: { some: { permission: { key: 'property.read' } } },
                  },
                },
              },
            },
          },
        },
        ...(authority.propertyAccessMode === 'SELECTED_PROPERTIES'
          ? {
              membershipScopes: {
                some: { tenantId: authority.tenantId, membershipId: authority.membershipId },
              },
            }
          : {}),
      },
      select: propertyProjectionSelect,
    });
    return record ? toInternalPropertyDetail(mapProjection(record)) : null;
  }

  async findProjection(
    tenantId: string,
    propertyId: string,
  ): Promise<PropertyProjectionRecord | null> {
    return this.database.property.findFirst({
      where: { tenantId, id: propertyId },
      select: propertyProjectionSelect,
    });
  }

  async resolvePublished(
    tenant: TenantIdentity,
    slug: string,
  ): Promise<ResolvedPublishedPropertyIdentity | null> {
    if (tenant.status !== 'ACTIVE') return null;

    const record = await this.database.property.findFirst({
      where: {
        tenantId: tenant.id,
        slug,
        lifecycle: 'PUBLISHED',
        tenant: { status: 'ACTIVE' },
        classification: { isActive: true },
        amenities: { every: { amenity: { isActive: true } } },
      },
      select: publishedPropertyProjectionSelect,
    });
    const source = record ? mapPublishedProjection(record, tenant.id) : null;
    return source ? toResolvedPublishedPropertyIdentity(source) : null;
  }

  async isCatalogSelectionActive(
    classificationKey: string,
    amenityKeys: readonly string[],
  ): Promise<boolean> {
    const [classification, amenities] = await Promise.all([
      this.database.propertyClassification.findFirst({
        where: { key: classificationKey, isActive: true },
        select: { key: true },
      }),
      this.database.amenity.count({ where: { key: { in: [...amenityKeys] }, isActive: true } }),
    ]);
    return classification !== null && amenities === new Set(amenityKeys).size;
  }

  async isCatalogReferencedByPublishedProperty(input: {
    kind: 'CLASSIFICATION' | 'AMENITY';
    key: string;
  }): Promise<boolean> {
    const count = await this.database.property.count({
      where: {
        lifecycle: 'PUBLISHED',
        ...(input.kind === 'CLASSIFICATION'
          ? { classificationKey: input.key }
          : { amenities: { some: { amenityKey: input.key } } }),
      },
    });
    return count > 0;
  }

  async transitionLifecycle(input: {
    tenantId: string;
    propertyId: string;
    expectedVersion: number;
    from: PropertyLifecycle;
    to: PropertyLifecycle;
    occurredAt: Date;
  }): Promise<boolean> {
    const timestampData: Prisma.PropertyUpdateManyMutationInput =
      input.to === 'PUBLISHED'
        ? { publishedAt: input.occurredAt, deactivatedAt: null }
        : input.to === 'INACTIVE'
          ? { deactivatedAt: input.occurredAt }
          : input.to === 'ARCHIVED'
            ? { archivedAt: input.occurredAt }
            : {};
    const updated = await this.database.property.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.propertyId,
        version: input.expectedVersion,
        lifecycle: input.from,
      },
      data: { lifecycle: input.to, version: { increment: 1 }, ...timestampData },
    });
    return updated.count === 1;
  }
}
