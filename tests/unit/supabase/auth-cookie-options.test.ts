import { describe, expect, it } from 'vitest';

import { getAuthenticationCookieOptions } from '@/lib/supabase/auth-cookie-options';

describe('staff authentication cookie policy', () => {
  it('keeps local and test cookies server-only without requiring HTTPS', () => {
    expect(getAuthenticationCookieOptions('test')).toEqual({
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: false,
    });
  });

  it('requires secure transport in production', () => {
    expect(getAuthenticationCookieOptions('production')).toEqual({
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
    });
  });
});
