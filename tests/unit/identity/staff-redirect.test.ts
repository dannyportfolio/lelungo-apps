import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STAFF_REDIRECT,
  resolveSafeStaffRedirect,
  staffRedirectPathSchema,
  staffRedirectQuerySchema,
} from '@/modules/identity/staff-redirect';

describe('staff redirect allowlist', () => {
  it.each([
    ['/staff', '/staff'],
    ['/staff/', '/staff/'],
    ['/staff/reservations', '/staff/reservations'],
    ['/staff/reservations?view=calendar#today', '/staff/reservations?view=calendar#today'],
    ['  /staff/profile  ', '/staff/profile'],
  ])('accepts a local staff destination: %s', (value, expected) => {
    expect(staffRedirectPathSchema.parse(value)).toBe(expected);
  });

  it.each([
    'https://evil.example/staff',
    'http://evil.example/staff',
    '//evil.example/staff',
    'javascript:alert(1)',
    '/dashboard',
    '/staffing',
    '/staff\\evil',
    '/staff/%2e%2e/staff',
    '/staff/../staff',
    '/staff%2F..%2Fdashboard',
    '/staff/%ZZ',
    '/staff\r\nLocation: https://evil.example',
  ])('rejects an unsafe or non-staff destination: %s', (value) => {
    expect(staffRedirectPathSchema.safeParse(value).success).toBe(false);
    expect(resolveSafeStaffRedirect(value)).toBe(DEFAULT_STAFF_REDIRECT);
  });

  it('rejects malformed and unexpected redirect query input', () => {
    expect(staffRedirectQuerySchema.safeParse({ next: '/staff', origin: 'evil' }).success).toBe(
      false,
    );
    expect(staffRedirectQuerySchema.safeParse({ next: ['//evil.example'] }).success).toBe(false);
  });

  it('uses only an allowlisted fallback', () => {
    expect(resolveSafeStaffRedirect(undefined, '/staff/settings')).toBe('/staff/settings');
    expect(resolveSafeStaffRedirect(undefined, 'https://evil.example')).toBe(
      DEFAULT_STAFF_REDIRECT,
    );
  });
});
