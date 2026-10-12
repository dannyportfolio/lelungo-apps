import type { PropertyLifecycle } from './property-constants';
import { isPropertyConfigurable, isPropertyServiceableForSale } from './property-domain';
import { PropertyNotFoundError } from './property-errors';

export interface PropertyAddressDto {
  readonly line1: string;
  readonly line2?: string;
  readonly locality: string;
  readonly adminArea: string;
  readonly postalCode?: string;
  readonly countryCode: 'ID';
}

export interface InternalPropertySummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly classificationKey: string;
  readonly timezone: string;
  readonly lifecycle: PropertyLifecycle;
  readonly version: number;
  readonly locality: string;
  readonly adminArea: string;
  readonly configurable: boolean;
  readonly serviceableForSale: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InternalPropertyDetailDto extends InternalPropertySummaryDto {
  readonly address: PropertyAddressDto;
  readonly amenityKeys: readonly string[];
  readonly shortDescription?: string;
  readonly publicWhatsAppE164?: string;
  readonly publishedAt: string | null;
  readonly deactivatedAt: string | null;
  readonly archivedAt: string | null;
}

export interface TrustedDownstreamPropertyContext {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly timezone: string;
  readonly classificationKey: string;
  readonly lifecycle: PropertyLifecycle;
  readonly configurable: boolean;
  readonly serviceableForSale: boolean;
  readonly publiclyResolvable: boolean;
}

export interface PublishedPropertyIdentityDto {
  readonly slug: string;
  readonly name: string;
  readonly classificationKey: string;
  readonly timezone: string;
  readonly amenityKeys: readonly string[];
  readonly locality: string;
  readonly adminArea: string;
  readonly shortDescription?: string;
  readonly publicWhatsAppE164?: string;
}

export interface ResolvedPublishedPropertyIdentity {
  readonly context: TrustedDownstreamPropertyContext;
  readonly identity: PublishedPropertyIdentityDto;
}

/**
 * Minimum persistence projection required to establish one public Property identity.
 * Private address fields, versions, and lifecycle timestamps do not cross this boundary.
 */
export interface PublishedPropertyProjectionSource {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly classificationKey: string;
  readonly timezone: string;
  readonly lifecycle: PropertyLifecycle;
  readonly shortDescription: string | null;
  readonly publicWhatsAppE164: string | null;
  readonly tenantIsActive: boolean;
  readonly address: {
    readonly locality: string;
    readonly adminArea: string;
  };
  readonly amenities: readonly {
    readonly key: string;
    readonly isActive: boolean;
  }[];
}

export interface PropertySummaryProjectionSource {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly classificationKey: string;
  readonly timezone: string;
  readonly lifecycle: PropertyLifecycle;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly tenantIsActive: boolean;
  readonly address: {
    readonly locality: string;
    readonly adminArea: string;
  };
}

export interface PropertyProjectionSource extends PropertySummaryProjectionSource {
  readonly tenantId: string;
  readonly shortDescription: string | null;
  readonly publicWhatsAppE164: string | null;
  readonly publishedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly address: {
    readonly line1: string;
    readonly line2: string | null;
    readonly locality: string;
    readonly adminArea: string;
    readonly postalCode: string | null;
    readonly countryCode: 'ID';
  };
  readonly amenities: readonly {
    readonly key: string;
    readonly isActive: boolean;
  }[];
}

export function toInternalPropertySummary(
  source: PropertySummaryProjectionSource,
): InternalPropertySummaryDto {
  return {
    id: source.id,
    slug: source.slug,
    name: source.name,
    classificationKey: source.classificationKey,
    timezone: source.timezone,
    lifecycle: source.lifecycle,
    version: source.version,
    locality: source.address.locality,
    adminArea: source.address.adminArea,
    configurable: isPropertyConfigurable(source.lifecycle, source.tenantIsActive),
    serviceableForSale: isPropertyServiceableForSale(source.lifecycle, source.tenantIsActive),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function toInternalPropertyDetail(
  source: PropertyProjectionSource,
): InternalPropertyDetailDto {
  const summary = toInternalPropertySummary(source);

  return {
    ...summary,
    address: {
      line1: source.address.line1,
      ...(source.address.line2 ? { line2: source.address.line2 } : {}),
      locality: source.address.locality,
      adminArea: source.address.adminArea,
      ...(source.address.postalCode ? { postalCode: source.address.postalCode } : {}),
      countryCode: source.address.countryCode,
    },
    amenityKeys: uniqueSortedKeys(source.amenities.map(({ key }) => key)),
    ...(source.shortDescription ? { shortDescription: source.shortDescription } : {}),
    ...(source.publicWhatsAppE164 ? { publicWhatsAppE164: source.publicWhatsAppE164 } : {}),
    publishedAt: source.publishedAt?.toISOString() ?? null,
    deactivatedAt: source.deactivatedAt?.toISOString() ?? null,
    archivedAt: source.archivedAt?.toISOString() ?? null,
  };
}

export function toTrustedDownstreamPropertyContext(
  source: Pick<
    PublishedPropertyProjectionSource,
    'tenantId' | 'id' | 'timezone' | 'classificationKey' | 'lifecycle' | 'tenantIsActive'
  >,
): TrustedDownstreamPropertyContext {
  const serviceableForSale = isPropertyServiceableForSale(source.lifecycle, source.tenantIsActive);

  return {
    tenantId: source.tenantId,
    propertyId: source.id,
    timezone: source.timezone,
    classificationKey: source.classificationKey,
    lifecycle: source.lifecycle,
    configurable: isPropertyConfigurable(source.lifecycle, source.tenantIsActive),
    serviceableForSale,
    publiclyResolvable: serviceableForSale,
  };
}

export function toPublishedPropertyIdentity(
  source: PublishedPropertyProjectionSource,
): PublishedPropertyIdentityDto {
  if (!isPropertyServiceableForSale(source.lifecycle, source.tenantIsActive)) {
    throw new PropertyNotFoundError();
  }

  return {
    slug: source.slug,
    name: source.name,
    classificationKey: source.classificationKey,
    timezone: source.timezone,
    amenityKeys: uniqueSortedKeys(
      source.amenities.filter(({ isActive }) => isActive).map(({ key }) => key),
    ),
    locality: source.address.locality,
    adminArea: source.address.adminArea,
    ...(source.shortDescription ? { shortDescription: source.shortDescription } : {}),
    ...(source.publicWhatsAppE164 ? { publicWhatsAppE164: source.publicWhatsAppE164 } : {}),
  };
}

export function toResolvedPublishedPropertyIdentity(
  source: PublishedPropertyProjectionSource,
): ResolvedPublishedPropertyIdentity {
  return {
    context: toTrustedDownstreamPropertyContext(source),
    identity: toPublishedPropertyIdentity(source),
  };
}

function uniqueSortedKeys(keys: readonly string[]): readonly string[] {
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right));
}
