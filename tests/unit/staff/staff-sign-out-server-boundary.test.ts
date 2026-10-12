import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => [
      {
        name: 'sb-example-auth-token',
        // A stale cookie with no session fields represents a browser that is
        // already signed out while still requiring server-side cleanup.
        value: 'base64-e30',
      },
    ]),
    set: mocks.cookieSet,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/modules/identity/authentication-config', () => ({
  getAuthenticationProviderConfig: vi.fn(() => ({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublicKey: 'public-key',
  })),
}));

import { signOutStaffAction } from '@/app/staff/actions';

describe('staff sign-out Supabase server boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats an already-signed-out provider session idempotently and propagates cookie removal', async () => {
    await signOutStaffAction({ status: 'idle' }, new FormData());

    expect(mocks.redirect).toHaveBeenCalledWith('/staff/sign-in');
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'sb-example-auth-token',
      '',
      expect.objectContaining({
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: false,
        maxAge: 0,
      }),
    );
  });
});
