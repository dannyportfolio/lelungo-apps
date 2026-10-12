import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import {
  AuthenticationConfigurationError,
  UnauthenticatedError,
} from '@/modules/identity/authenticated-subject';
import { SupabaseAuthenticatedSubjectProvider } from '@/modules/identity/supabase-authenticated-subject-provider';

const USER_ID = '4f11ac8f-bd27-45e7-89f3-d2f5949f5a41';

function providerWithResult(result: {
  data: { user: { id: unknown } | null };
  error: unknown;
}): SupabaseAuthenticatedSubjectProvider {
  return new SupabaseAuthenticatedSubjectProvider(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue(result),
    },
  }));
}

describe('SupabaseAuthenticatedSubjectProvider', () => {
  it('returns only the verified provider UUID for a valid user', async () => {
    const provider = providerWithResult({
      data: { user: { id: USER_ID } },
      error: null,
    });

    await expect(provider.getAuthenticatedSubject()).resolves.toEqual({ userId: USER_ID });
  });

  it('returns no subject when the provider session is absent', async () => {
    const provider = providerWithResult({ data: { user: null }, error: null });

    await expect(provider.getAuthenticatedSubject()).resolves.toBeNull();
  });

  it('returns no subject for an expired or invalid provider session', async () => {
    const provider = providerWithResult({
      data: { user: null },
      error: new Error('provider token detail must stay internal'),
    });

    await expect(provider.getAuthenticatedSubject()).resolves.toBeNull();
  });

  it.each(['not-a-uuid', '', 123, null])(
    'returns no subject for a malformed provider user identifier: %j',
    async (id) => {
      const provider = providerWithResult({ data: { user: { id } }, error: null });

      await expect(provider.getAuthenticatedSubject()).resolves.toBeNull();
    },
  );

  it('fails closed without leaking a provider failure', async () => {
    const provider = new SupabaseAuthenticatedSubjectProvider(async () => ({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('sensitive provider response')),
      },
    }));

    await expect(provider.getAuthenticatedSubject()).resolves.toBeNull();
  });

  it('preserves the stable sanitized configuration failure', async () => {
    const provider = new SupabaseAuthenticatedSubjectProvider(async () => {
      throw new AuthenticationConfigurationError();
    });

    await expect(provider.getAuthenticatedSubject()).rejects.toEqual(
      new AuthenticationConfigurationError(),
    );
  });

  it('keeps the unauthenticated error stable for application boundaries', () => {
    expect(new UnauthenticatedError()).toMatchObject({
      name: 'UnauthenticatedError',
      message: 'Authentication is required.',
      code: 'UNAUTHENTICATED',
    });
  });
});
