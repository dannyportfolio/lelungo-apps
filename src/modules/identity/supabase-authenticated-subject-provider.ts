import 'server-only';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  AuthenticationConfigurationError,
  type AuthenticatedSubject,
  type AuthenticatedSubjectProvider,
} from './authenticated-subject';
import { getAuthenticationProviderConfig } from './authentication-config';

interface SupabaseVerifiedUserClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: unknown } | null };
      error: unknown;
    }>;
  };
}

type SupabaseVerifiedUserClientFactory = () => Promise<SupabaseVerifiedUserClient>;

const verifiedUserIdSchema = z.string().uuid();

async function createVerifiedUserClient(): Promise<SupabaseVerifiedUserClient> {
  return createClient(getAuthenticationProviderConfig());
}

export class SupabaseAuthenticatedSubjectProvider implements AuthenticatedSubjectProvider {
  constructor(
    private readonly clientFactory: SupabaseVerifiedUserClientFactory = createVerifiedUserClient,
  ) {}

  async getAuthenticatedSubject(): Promise<AuthenticatedSubject | null> {
    try {
      const client = await this.clientFactory();
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      const userId = verifiedUserIdSchema.safeParse(data.user.id);
      return userId.success ? { userId: userId.data } : null;
    } catch (error) {
      if (error instanceof AuthenticationConfigurationError) {
        throw error;
      }

      return null;
    }
  }
}

export function createSupabaseAuthenticatedSubjectProvider(): AuthenticatedSubjectProvider {
  return new SupabaseAuthenticatedSubjectProvider();
}
