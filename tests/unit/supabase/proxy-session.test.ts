import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getOptionalAuthenticationProviderConfig: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/modules/identity/authentication-config', () => ({
  getOptionalAuthenticationProviderConfig: mocks.getOptionalAuthenticationProviderConfig,
}));

import {
  isAuthenticationRequest,
  refreshSupabaseSession,
  requestMayContainSupabaseAuthentication,
} from '@/lib/supabase/proxy';
import { proxy } from '../../../src/proxy';

describe('Supabase Proxy session refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptionalAuthenticationProviderConfig.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublicKey: 'public-key',
    });
  });

  it('recognizes only authentication paths and Supabase-owned cookies', () => {
    expect(isAuthenticationRequest('/staff')).toBe(true);
    expect(isAuthenticationRequest('/staff/sign-in')).toBe(true);
    expect(isAuthenticationRequest('/auth/callback')).toBe(true);
    expect(isAuthenticationRequest('/dashboard')).toBe(false);

    expect(
      requestMayContainSupabaseAuthentication(
        new NextRequest('https://melati.lelungo.com/', {
          headers: { cookie: 'sb-project-auth-token=token' },
        }),
      ),
    ).toBe(true);
    expect(
      requestMayContainSupabaseAuthentication(
        new NextRequest('https://melati.lelungo.com/', {
          headers: { cookie: 'theme=dark' },
        }),
      ),
    ).toBe(false);
  });

  it('copies rotated cookies downstream and to the browser with private cache headers', async () => {
    mocks.createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll(
              cookies: Array<{ name: string; value: string; options: { path: string } }>,
              headers: Record<string, string>,
            ): void;
          };
        },
      ) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [{ name: 'sb-project-auth-token', value: 'rotated', options: { path: '/' } }],
              {
                'Cache-Control': 'private, no-store',
                Expires: '0',
                Pragma: 'no-cache',
              },
            );
            return { data: { claims: { sub: 'user-id' } }, error: null };
          },
        },
      }),
    );

    const request = new NextRequest('https://melati.lelungo.com/staff', {
      headers: { cookie: 'sb-project-auth-token=old' },
    });
    const response = await refreshSupabaseSession(request, new Headers(request.headers));

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'public-key',
      expect.objectContaining({
        cookieOptions: {
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
          secure: false,
        },
      }),
    );
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('rotated');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'sb-project-auth-token=rotated',
    );
  });

  it('degrades safely when optional provider configuration is absent', async () => {
    mocks.getOptionalAuthenticationProviderConfig.mockReturnValue(null);
    const request = new NextRequest('https://melati.lelungo.com/staff');

    const response = await refreshSupabaseSession(request, new Headers(request.headers));

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('keeps a configured request private when the provider reports no session', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('No active provider session.'),
    });
    mocks.createServerClient.mockReturnValue({ auth: { getClaims } });
    const request = new NextRequest('https://melati.lelungo.com/staff');

    const response = await refreshSupabaseSession(request, new Headers(request.headers));

    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get('x-middleware-request-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('does not grant authority when provider refresh throws', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: async () => {
          throw new Error('provider unavailable');
        },
      },
    });
    const request = new NextRequest('https://melati.lelungo.com/staff');

    const response = await refreshSupabaseSession(request, new Headers(request.headers));

    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});

describe('root Proxy composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('overwrites a spoofed tenant header using the actual hostname', async () => {
    const request = new NextRequest('https://melati.lelungo.com/dashboard', {
      headers: {
        'x-lelungo-tenant-subdomain': 'attacker',
        'x-request-id': 'attacker-controlled-request-id',
        'x-forwarded-host': 'attacker.example',
      },
    });

    const response = await proxy(request);

    expect(response.headers.get('x-middleware-request-x-lelungo-tenant-subdomain')).toBe('melati');
    expect(response.headers.get('x-middleware-request-x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    expect(response.headers.get('x-middleware-request-x-request-id')).not.toBe(
      'attacker-controlled-request-id',
    );
    expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('uses the routed Host when Next normalizes nextUrl to the local server origin', async () => {
    vi.stubEnv('LELUNGO_ENABLE_LOCAL_TENANT_HOSTS', 'true');
    const request = new NextRequest('http://localhost:3004/dashboard', {
      headers: {
        host: 'melati.localhost:3004',
        'x-forwarded-host': 'attacker.example',
        'x-lelungo-tenant-subdomain': 'attacker',
      },
    });

    const response = await proxy(request);

    expect(request.nextUrl.hostname).toBe('localhost');
    expect(response.headers.get('x-middleware-request-x-lelungo-tenant-subdomain')).toBe('melati');
    expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBeNull();
  });

  it('preserves tenant normalization while rotating an authentication cookie', async () => {
    mocks.getOptionalAuthenticationProviderConfig.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublicKey: 'public-key',
    });
    mocks.createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll(
              cookies: Array<{ name: string; value: string; options: { path: string } }>,
              headers: Record<string, string>,
            ): void;
          };
        },
      ) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [{ name: 'sb-project-auth-token', value: 'rotated', options: { path: '/' } }],
              { 'Cache-Control': 'private, no-store' },
            );
            return { data: { claims: {} }, error: null };
          },
        },
      }),
    );

    const response = await proxy(
      new NextRequest('https://melati.lelungo.com/staff', {
        headers: {
          cookie: 'sb-project-auth-token=old',
          'x-lelungo-tenant-subdomain': 'attacker',
        },
      }),
    );

    expect(response.headers.get('x-middleware-request-x-lelungo-tenant-subdomain')).toBe('melati');
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'sb-project-auth-token=rotated',
    );
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('rotated');
  });
});
