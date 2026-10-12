import type { CookieOptions } from '@supabase/ssr';

export function getAuthenticationCookieOptions(
  environment: string | undefined = process.env.NODE_ENV,
): Readonly<CookieOptions> {
  return Object.freeze({
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: environment === 'production',
  });
}
