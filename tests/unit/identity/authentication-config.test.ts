import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getAuthenticationProviderConfig,
  getOptionalAuthenticationProviderConfig,
} from '@/modules/identity/authentication-config';
import { AuthenticationConfigurationError } from '@/modules/identity/authenticated-subject';

describe('authentication provider configuration', () => {
  it('returns trimmed configured provider values when an auth path requests them', () => {
    expect(
      getAuthenticationProviderConfig({
        NEXT_PUBLIC_SUPABASE_URL: '  https://project.supabase.co  ',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '  public-key  ',
      }),
    ).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabasePublicKey: 'public-key',
    });
  });

  it('permits loopback HTTP for a local Supabase development service', () => {
    expect(
      getAuthenticationProviderConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-public-key',
      }).supabaseUrl,
    ).toBe('http://127.0.0.1:54321');
  });

  it('fails closed with a stable redacted error when required values are missing', () => {
    expect(() => getAuthenticationProviderConfig({})).toThrowError(
      new AuthenticationConfigurationError(),
    );
  });

  it.each([
    {
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-provider-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'do-not-leak-this-key',
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://username:password@project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'do-not-leak-this-key',
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co?secret=value',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'do-not-leak-this-key',
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ',
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: 'http://remote-supabase.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'do-not-leak-this-key',
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public key with whitespace',
    },
  ])('rejects malformed values without disclosing them: %#', (environment) => {
    try {
      getAuthenticationProviderConfig(environment);
      throw new Error('Expected invalid authentication configuration to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationConfigurationError);
      expect(String(error)).toBe(
        'AuthenticationConfigurationError: Authentication is unavailable.',
      );
      expect(String(error)).not.toContain('do-not-leak-this-key');
      expect(String(error)).not.toContain(environment.NEXT_PUBLIC_SUPABASE_URL);
    }
  });

  it('allows unrelated public paths to observe wholly absent optional configuration', () => {
    expect(getOptionalAuthenticationProviderConfig({})).toBeNull();
  });

  it('treats partial optional configuration as a sanitized configuration failure', () => {
    expect(() =>
      getOptionalAuthenticationProviderConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toThrow(AuthenticationConfigurationError);
  });
});
