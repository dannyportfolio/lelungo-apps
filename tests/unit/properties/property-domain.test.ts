import { describe, expect, it } from 'vitest';

import {
  applyPropertyLifecycleTransition,
  isCanonicalIanaTimezone,
  isPropertyConfigurable,
  isPropertyServiceableForSale,
  normalizePropertySlug,
} from '@/modules/properties/property-domain';
import {
  PROPERTY_CONFLICT_ERROR_MESSAGE,
  PROPERTY_VALIDATION_ERROR_MESSAGE,
  PropertyConflictError,
  PropertyNotFoundError,
  PropertyValidationError,
} from '@/modules/properties/property-errors';

describe('Property domain', () => {
  it('normalizes only the approved slug transformations', () => {
    expect(normalizePropertySlug('  Villa__Merapi  ')).toBe('villa-merapi');
    expect(normalizePropertySlug('villa---merapi')).toBe('villa-merapi');
  });

  it('rejects malformed, empty, and oversized normalized slugs generically', () => {
    for (const slug of ['', '---', 'villa@merapi', 'écolodge', 'a'.repeat(81)]) {
      expect(() => normalizePropertySlug(slug)).toThrow(PropertyValidationError);
    }

    expect(() => normalizePropertySlug('---')).toThrow(PROPERTY_VALIDATION_ERROR_MESSAGE);
  });

  it('accepts canonical Intl timezones and rejects aliases, offsets, and abbreviations', () => {
    expect(isCanonicalIanaTimezone('Asia/Jakarta')).toBe(true);
    expect(isCanonicalIanaTimezone('America/Los_Angeles')).toBe(true);
    expect(isCanonicalIanaTimezone('US/Pacific')).toBe(false);
    expect(isCanonicalIanaTimezone('UTC+7')).toBe(false);
    expect(isCanonicalIanaTimezone('WIB')).toBe(false);
  });

  it('publishes a draft with a database-supplied timestamp and one version advance', () => {
    const occurredAt = new Date('2026-08-12T02:00:00.000Z');
    const result = applyPropertyLifecycleTransition(
      {
        lifecycle: 'DRAFT',
        version: 1,
        publishedAt: null,
        deactivatedAt: null,
        archivedAt: null,
      },
      'PUBLISH',
      1,
      occurredAt,
    );

    expect(result).toEqual({
      lifecycle: 'PUBLISHED',
      version: 2,
      publishedAt: occurredAt,
      deactivatedAt: null,
      archivedAt: null,
    });
    expect(result.publishedAt).not.toBe(occurredAt);
  });

  it('retains publication history when deactivating and archiving', () => {
    const publishedAt = new Date('2026-08-12T02:00:00.000Z');
    const deactivatedAt = new Date('2026-08-12T03:00:00.000Z');
    const inactive = applyPropertyLifecycleTransition(
      {
        lifecycle: 'PUBLISHED',
        version: 2,
        publishedAt,
        deactivatedAt: null,
        archivedAt: null,
      },
      'DEACTIVATE',
      2,
      deactivatedAt,
    );
    const archivedAt = new Date('2026-08-12T04:00:00.000Z');
    const archived = applyPropertyLifecycleTransition(inactive, 'ARCHIVE', 3, archivedAt);

    expect(inactive).toMatchObject({ lifecycle: 'INACTIVE', version: 3, deactivatedAt });
    expect(archived).toEqual({
      lifecycle: 'ARCHIVED',
      version: 4,
      publishedAt,
      deactivatedAt,
      archivedAt,
    });
  });

  it('republishes an inactive Property with a fresh publication timestamp', () => {
    const result = applyPropertyLifecycleTransition(
      {
        lifecycle: 'INACTIVE',
        version: 8,
        publishedAt: new Date('2026-08-10T00:00:00.000Z'),
        deactivatedAt: new Date('2026-08-11T00:00:00.000Z'),
        archivedAt: null,
      },
      'REPUBLISH',
      8,
      new Date('2026-08-12T00:00:00.000Z'),
    );

    expect(result).toMatchObject({
      lifecycle: 'PUBLISHED',
      version: 9,
      publishedAt: new Date('2026-08-12T00:00:00.000Z'),
      deactivatedAt: null,
    });
  });

  it('rejects stale and invalid transitions with the same stable conflict category', () => {
    const state = {
      lifecycle: 'DRAFT' as const,
      version: 3,
      publishedAt: null,
      deactivatedAt: null,
      archivedAt: null,
    };

    for (const operation of [
      () => applyPropertyLifecycleTransition(state, 'PUBLISH', 2, new Date()),
      () => applyPropertyLifecycleTransition(state, 'DEACTIVATE', 3, new Date()),
    ]) {
      expect(operation).toThrow(PropertyConflictError);
      expect(operation).toThrow(PROPERTY_CONFLICT_ERROR_MESSAGE);
    }
  });

  it('keeps archived Properties terminal and never serviceable', () => {
    const archived = {
      lifecycle: 'ARCHIVED' as const,
      version: 4,
      publishedAt: new Date('2026-08-10T00:00:00.000Z'),
      deactivatedAt: null,
      archivedAt: new Date('2026-08-11T00:00:00.000Z'),
    };

    expect(() => applyPropertyLifecycleTransition(archived, 'PUBLISH', 4, new Date())).toThrow(
      PropertyConflictError,
    );
    expect(isPropertyConfigurable('ARCHIVED', true)).toBe(false);
    expect(isPropertyServiceableForSale('ARCHIVED', true)).toBe(false);
    expect(isPropertyServiceableForSale('PUBLISHED', false)).toBe(false);
  });

  it('exposes stable error codes and generic messages', () => {
    expect(new PropertyValidationError()).toMatchObject({
      code: 'PROPERTY_VALIDATION_FAILED',
      message: 'Property input is invalid.',
    });
    expect(new PropertyNotFoundError()).toMatchObject({
      code: 'PROPERTY_NOT_FOUND',
      message: 'Property not found.',
    });
    expect(new PropertyConflictError()).toMatchObject({
      code: 'PROPERTY_CONFLICT',
      message: 'Property could not be changed.',
    });
  });
});
