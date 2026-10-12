import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuthenticationProviderConfig: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/modules/identity/authentication-config', () => ({
  getAuthenticationProviderConfig: mocks.getAuthenticationProviderConfig,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

import { GET as handleAuthenticationCallback } from '@/app/auth/callback/route';
import { signOutStaffAction } from '@/app/staff/actions';
import { signInStaffAction } from '@/app/staff/sign-in/actions';

describe('staff sign-in action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticationProviderConfig.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublicKey: 'public-key',
    });
  });

  it('rejects invalid input before calling the authentication provider', async () => {
    const state = await signInStaffAction(
      { status: 'idle' },
      createFormData({ email: 'not-an-email', password: '', next: '/staff' }),
    );

    expect(state.status).toBe('error');
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.fieldErrors?.password).toBeDefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns one generic error for invalid credentials and provider failures', async () => {
    mocks.createClient
      .mockResolvedValueOnce(
        createProviderClient({ signInError: new Error('provider detail: invalid password') }),
      )
      .mockRejectedValueOnce(new Error('secret provider outage detail'));

    const invalidCredentials = await signInStaffAction(
      { status: 'idle' },
      createFormData({ email: 'staff@example.com', password: 'incorrect', next: '/staff' }),
    );
    const providerFailure = await signInStaffAction(
      { status: 'idle' },
      createFormData({ email: 'staff@example.com', password: 'password', next: '/staff' }),
    );

    expect(invalidCredentials).toEqual(providerFailure);
    expect(invalidCredentials.message).not.toContain('provider detail');
    expect(invalidCredentials.message).not.toContain('staff@example.com');
  });

  it('redirects successful authentication only to an allowlisted staff path', async () => {
    mocks.createClient.mockResolvedValue(createProviderClient());

    await signInStaffAction(
      { status: 'idle' },
      createFormData({
        email: 'staff@example.com',
        password: 'password',
        next: 'https://evil.example/collect',
      }),
    );

    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith('/staff');
  });
});

describe('provider code-exchange callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticationProviderConfig.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublicKey: 'public-key',
    });
  });

  it.each([
    ['missing code', 'https://melati.lelungo.com/auth/callback'],
    ['empty code', 'https://melati.lelungo.com/auth/callback?code='],
  ])('fails privately for %s', async (_caseName, url) => {
    const response = await handleAuthenticationCallback(new NextRequest(url));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://melati.lelungo.com/staff/sign-in?error=authentication_failed',
    );
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('uses a generic private failure when code exchange is rejected', async () => {
    mocks.createClient.mockResolvedValue(
      createProviderClient({ exchangeError: new Error('provider exchange detail') }),
    );

    const response = await handleAuthenticationCallback(
      new NextRequest('https://melati.lelungo.com/auth/callback?code=invalid-code'),
    );

    expect(response.headers.get('location')).toBe(
      'https://melati.lelungo.com/staff/sign-in?error=authentication_failed',
    );
    expect(response.headers.get('location')).not.toContain('provider exchange detail');
  });

  it('exchanges a valid code and preserves an allowlisted local destination', async () => {
    const client = createProviderClient();
    mocks.createClient.mockResolvedValue(client);

    const response = await handleAuthenticationCallback(
      new NextRequest(
        'https://melati.lelungo.com/auth/callback?code=valid-code&next=%2Fstaff%2Fprofile',
      ),
    );

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-code', undefined);
    expect(response.headers.get('location')).toBe('https://melati.lelungo.com/staff/profile');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('binds a valid concurrent PKCE flow identifier to the code exchange', async () => {
    const client = createProviderClient();
    mocks.createClient.mockResolvedValue(client);

    await handleAuthenticationCallback(
      new NextRequest(
        'https://melati.lelungo.com/auth/callback?code=valid-code&sb_flow_id=flow_12345678',
      ),
    );

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-code', {
      flowId: 'flow_12345678',
    });
  });

  it('rejects a malformed PKCE flow identifier before provider exchange', async () => {
    const response = await handleAuthenticationCallback(
      new NextRequest('https://melati.lelungo.com/auth/callback?code=valid-code&sb_flow_id=short'),
    );

    expect(response.headers.get('location')).toBe(
      'https://melati.lelungo.com/staff/sign-in?error=authentication_failed',
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('falls back to /staff for an open-redirect attempt', async () => {
    mocks.createClient.mockResolvedValue(createProviderClient());

    const response = await handleAuthenticationCallback(
      new NextRequest(
        'https://melati.lelungo.com/auth/callback?code=valid-code&next=https%3A%2F%2Fevil.example',
      ),
    );

    expect(response.headers.get('location')).toBe('https://melati.lelungo.com/staff');
  });
});

describe('staff sign-out action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticationProviderConfig.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublicKey: 'public-key',
    });
  });

  it('redirects after provider-confirmed sign-out for an authenticated session', async () => {
    const client = createProviderClient();
    mocks.createClient.mockResolvedValue(client);

    await signOutStaffAction({ status: 'idle' }, new FormData());

    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith('/staff/sign-in');
  });

  it('clears the local session and redirects when provider revocation fails', async () => {
    const client = createProviderClient({
      signOutErrors: [new Error('secret provider outage detail'), null],
    });
    mocks.createClient.mockResolvedValue(client);

    await signOutStaffAction({ status: 'idle' }, new FormData());

    expect(client.auth.signOut).toHaveBeenNthCalledWith(1);
    expect(client.auth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(mocks.redirect).toHaveBeenCalledWith('/staff/sign-in');
  });

  it('returns a generic error when provider and local sign-out both fail', async () => {
    const client = createProviderClient({
      signOutErrors: [
        new Error('secret provider outage detail'),
        new Error('secret local cleanup detail'),
      ],
    });
    mocks.createClient.mockResolvedValue(client);

    const state = await signOutStaffAction({ status: 'idle' }, new FormData());

    expect(state).toEqual({
      status: 'error',
      message: 'Sesi tidak dapat diakhiri. Silakan coba kembali.',
    });
    expect(client.auth.signOut).toHaveBeenNthCalledWith(1);
    expect(client.auth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

function createFormData(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }
  return formData;
}

function createProviderClient(options?: {
  signInError?: Error;
  exchangeError?: Error;
  signOutErrors?: ReadonlyArray<Error | null>;
}) {
  const signOut = vi.fn();

  if (options?.signOutErrors) {
    for (const error of options.signOutErrors) {
      signOut.mockResolvedValueOnce({ error });
    }
  } else {
    signOut.mockResolvedValue({ error: null });
  }

  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: options?.signInError ?? null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: options?.exchangeError ?? null }),
      signOut,
    },
  };
}
