import type { MembershipAuthorization } from './authorization';

export const PROPERTY_ACCESS_MODES = ['ALL_PROPERTIES', 'SELECTED_PROPERTIES'] as const;

export type PropertyAccessMode = (typeof PROPERTY_ACCESS_MODES)[number];

/**
 * Minimum authority projection resolved from the verified subject and trusted Tenant.
 * The mode remains a string at this boundary so an unknown persisted value fails closed.
 */
export type PropertyMembershipAuthorization = MembershipAuthorization;

export interface ResolvedPropertyMembershipAuthorization extends PropertyMembershipAuthorization {
  tenantId: string;
  status: 'ACTIVE';
  propertyAccessMode: PropertyAccessMode;
  propertyScopeVersion: number;
}

export interface PropertyScopeAuthorizationQuery {
  tenantId: string;
  membershipId: string;
  propertyId: string;
  permission: import('./role-catalog').PermissionKey;
  propertyAccessMode: PropertyAccessMode;
  propertyScopeVersion: number;
  includeArchived: boolean;
  /** Bind audit-relevant rechecks to the verified provider subject when available. */
  actorUserId?: string;
}

/**
 * A server adapter answers this with one Tenant-leading ownership/scope query. For
 * SELECTED_PROPERTIES it must also require a current same-Tenant grant. A true
 * answer is authorization evidence, not a Property data projection.
 */
export interface PropertyScopeAuthorizationPort {
  isPropertyAuthorized(query: PropertyScopeAuthorizationQuery): Promise<boolean>;
}

export type AuthorizedPropertyListScope =
  | {
      kind: 'ALL_PROPERTIES';
      tenantId: string;
      membershipId: string;
      propertyScopeVersion: number;
    }
  | {
      kind: 'SELECTED_PROPERTIES';
      tenantId: string;
      membershipId: string;
      propertyScopeVersion: number;
    };

export interface AuthorizedPropertyContext {
  tenantId: string;
  membershipId: string;
  propertyId: string;
  propertyAccessMode: PropertyAccessMode;
  propertyScopeVersion: number;
}

export interface AuthorizedPropertyCreationContext {
  tenantId: string;
  membershipId: string;
  propertyAccessMode: 'ALL_PROPERTIES';
  propertyScopeVersion: number;
}

export interface AuthorizedPropertyScopeAdministrator {
  tenantId: string;
  actorMembershipId: string;
  targetMembershipId: string;
  propertyScopeVersion: number;
}

export interface MembershipPropertyScopeSummary {
  membershipId: string;
  status: 'ACTIVE';
  propertyAccessMode: PropertyAccessMode;
  propertyScopeVersion: number;
  selectedPropertyCount: number;
}

export interface MembershipPropertyScopeSummaryRecord extends MembershipPropertyScopeSummary {
  createdAt: Date;
}

export interface PropertyScopeGrantSummary {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
}

export interface PropertyScopeGrantSummaryRecord extends PropertyScopeGrantSummary {
  tenantId: string;
  membershipId: string;
  grantedAt: Date;
}

export interface BoundedPage<Item> {
  items: readonly Item[];
  nextCursor: string | null;
}

export interface ActiveMembershipScopeListQuery {
  tenantId: string;
  actorMembershipId: string;
  actorUserId: string;
  actorScopeVersion: number;
  pageSize: number;
  cursor: string | null;
}

export interface SelectedPropertyScopeListQuery extends ActiveMembershipScopeListQuery {
  membershipId: string;
  propertyScopeVersion: number;
}

export interface PropertyScopeState {
  tenantId: string;
  membershipId: string;
  status: 'ACTIVE';
  propertyAccessMode: PropertyAccessMode;
  propertyScopeVersion: number;
  selectedPropertyIds: readonly string[];
}

export function isPropertyAccessMode(value: unknown): value is PropertyAccessMode {
  return value === 'ALL_PROPERTIES' || value === 'SELECTED_PROPERTIES';
}

export function isPositiveScopeVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

export function toMembershipPropertyScopeSummary(
  record: MembershipPropertyScopeSummaryRecord,
): MembershipPropertyScopeSummary {
  return {
    membershipId: record.membershipId,
    status: record.status,
    propertyAccessMode: record.propertyAccessMode,
    propertyScopeVersion: record.propertyScopeVersion,
    selectedPropertyCount: record.selectedPropertyCount,
  };
}

export function toPropertyScopeGrantSummary(
  record: PropertyScopeGrantSummaryRecord,
): PropertyScopeGrantSummary {
  return {
    propertyId: record.propertyId,
    propertySlug: record.propertySlug,
    propertyName: record.propertyName,
  };
}
