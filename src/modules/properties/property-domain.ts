import {
  PROPERTY_INITIAL_VERSION,
  PROPERTY_RAW_SLUG_MAX_LENGTH,
  PROPERTY_SLUG_MAX_LENGTH,
  PROPERTY_SLUG_PATTERN,
  type PropertyLifecycle,
  type PropertyLifecycleIntent,
} from './property-constants';
import { PropertyConflictError, PropertyValidationError } from './property-errors';

export interface PropertyLifecycleState {
  readonly lifecycle: PropertyLifecycle;
  readonly version: number;
  readonly publishedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly archivedAt: Date | null;
}

const ALLOWED_LIFECYCLE_INTENTS: Readonly<
  Record<PropertyLifecycle, readonly PropertyLifecycleIntent[]>
> = {
  DRAFT: ['PUBLISH', 'ARCHIVE'],
  PUBLISHED: ['DEACTIVATE', 'ARCHIVE'],
  INACTIVE: ['REPUBLISH', 'ARCHIVE'],
  ARCHIVED: [],
};

function countUnicodeCodePoints(value: string): number {
  return [...value].length;
}

export function normalizePropertySlug(rawSlug: string): string {
  if (
    typeof rawSlug !== 'string' ||
    countUnicodeCodePoints(rawSlug) > PROPERTY_RAW_SLUG_MAX_LENGTH
  ) {
    throw new PropertyValidationError();
  }

  const normalized = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');

  if (
    normalized.length === 0 ||
    normalized.length > PROPERTY_SLUG_MAX_LENGTH ||
    !PROPERTY_SLUG_PATTERN.test(normalized)
  ) {
    throw new PropertyValidationError();
  }

  return normalized;
}

export function isCanonicalIanaTimezone(timezone: string): boolean {
  if (typeof timezone !== 'string' || timezone.length === 0) {
    return false;
  }

  try {
    const resolvedTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
    }).resolvedOptions().timeZone;

    return resolvedTimezone === timezone;
  } catch {
    return false;
  }
}

export function requireCanonicalIanaTimezone(timezone: string): string {
  if (!isCanonicalIanaTimezone(timezone)) {
    throw new PropertyValidationError();
  }

  return timezone;
}

export function assertExpectedPropertyVersion(
  currentVersion: number,
  expectedVersion: number,
): void {
  if (
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < PROPERTY_INITIAL_VERSION ||
    currentVersion === Number.MAX_SAFE_INTEGER ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < PROPERTY_INITIAL_VERSION ||
    currentVersion !== expectedVersion
  ) {
    throw new PropertyConflictError();
  }
}

export function canTransitionPropertyLifecycle(
  lifecycle: PropertyLifecycle,
  intent: PropertyLifecycleIntent,
): boolean {
  return ALLOWED_LIFECYCLE_INTENTS[lifecycle].includes(intent);
}

export function applyPropertyLifecycleTransition(
  current: PropertyLifecycleState,
  intent: PropertyLifecycleIntent,
  expectedVersion: number,
  occurredAt: Date,
): PropertyLifecycleState {
  assertExpectedPropertyVersion(current.version, expectedVersion);

  if (!canTransitionPropertyLifecycle(current.lifecycle, intent) || !isValidDate(occurredAt)) {
    throw new PropertyConflictError();
  }

  const transitionTime = new Date(occurredAt.getTime());
  const nextVersion = current.version + 1;

  switch (intent) {
    case 'PUBLISH':
    case 'REPUBLISH':
      return {
        lifecycle: 'PUBLISHED',
        version: nextVersion,
        publishedAt: transitionTime,
        deactivatedAt: null,
        archivedAt: current.archivedAt,
      };
    case 'DEACTIVATE':
      return {
        lifecycle: 'INACTIVE',
        version: nextVersion,
        publishedAt: copyDate(current.publishedAt),
        deactivatedAt: transitionTime,
        archivedAt: current.archivedAt,
      };
    case 'ARCHIVE':
      return {
        lifecycle: 'ARCHIVED',
        version: nextVersion,
        publishedAt: copyDate(current.publishedAt),
        deactivatedAt: copyDate(current.deactivatedAt),
        archivedAt: transitionTime,
      };
  }
}

export function isPropertyConfigurable(
  lifecycle: PropertyLifecycle,
  tenantIsActive: boolean,
): boolean {
  return tenantIsActive && lifecycle !== 'ARCHIVED';
}

export function isPropertyServiceableForSale(
  lifecycle: PropertyLifecycle,
  tenantIsActive: boolean,
): boolean {
  return tenantIsActive && lifecycle === 'PUBLISHED';
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function copyDate(value: Date | null): Date | null {
  return value ? new Date(value.getTime()) : null;
}
