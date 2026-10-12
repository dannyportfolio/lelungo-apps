import { z } from 'zod';

export const DEFAULT_STAFF_REDIRECT = '/staff';

const LOCAL_APPLICATION_ORIGIN = 'https://lelungo.invalid';
const encodedPathControlPattern = /%(?:00|0a|0d|2e|2f|5c)/i;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function parseStaffRedirect(value: string): string | null {
  const [rawPath] = value.split(/[?#]/, 1);
  const hasDotSegment = rawPath.split('/').some((segment) => segment === '.' || segment === '..');

  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasDotSegment ||
    encodedPathControlPattern.test(rawPath) ||
    controlCharacterPattern.test(value)
  ) {
    return null;
  }

  try {
    decodeURI(rawPath);
    const url = new URL(value, LOCAL_APPLICATION_ORIGIN);
    const isStaffPath = url.pathname === '/staff' || url.pathname.startsWith('/staff/');

    if (url.origin !== LOCAL_APPLICATION_ORIGIN || !isStaffPath) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export const staffRedirectPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => parseStaffRedirect(value) !== null, {
    message: 'Redirect destination is not allowed.',
  })
  .transform((value) => parseStaffRedirect(value) ?? DEFAULT_STAFF_REDIRECT);

export const staffRedirectQuerySchema = z
  .object({
    next: staffRedirectPathSchema.optional(),
  })
  .strict();

export function resolveSafeStaffRedirect(
  value: unknown,
  fallback: string = DEFAULT_STAFF_REDIRECT,
): string {
  const safeValue = staffRedirectPathSchema.safeParse(value);
  if (safeValue.success) {
    return safeValue.data;
  }

  const safeFallback = staffRedirectPathSchema.safeParse(fallback);
  return safeFallback.success ? safeFallback.data : DEFAULT_STAFF_REDIRECT;
}
