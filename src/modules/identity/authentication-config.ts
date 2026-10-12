import 'server-only';

import { z } from 'zod';

import { AuthenticationConfigurationError } from './authenticated-subject';

const authenticationEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().min(1).max(2_048),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1).max(4_096).regex(/^\S+$/),
});

type AuthenticationEnvironment = Partial<
  Record<keyof z.input<typeof authenticationEnvironmentSchema>, string | undefined>
>;

export interface AuthenticationProviderConfig {
  readonly supabaseUrl: string;
  readonly supabasePublicKey: string;
}

function isAllowedProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';

    return (
      (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback)) &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

function parseAuthenticationProviderConfig(
  environment: AuthenticationEnvironment,
): AuthenticationProviderConfig {
  const result = authenticationEnvironmentSchema.safeParse(environment);

  if (!result.success || !isAllowedProviderUrl(result.data.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new AuthenticationConfigurationError();
  }

  return {
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublicKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function getProcessAuthenticationEnvironment(): AuthenticationEnvironment {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getAuthenticationProviderConfig(
  environment: AuthenticationEnvironment = getProcessAuthenticationEnvironment(),
): AuthenticationProviderConfig {
  return parseAuthenticationProviderConfig(environment);
}

export function getOptionalAuthenticationProviderConfig(
  environment: AuthenticationEnvironment = getProcessAuthenticationEnvironment(),
): AuthenticationProviderConfig | null {
  if (
    environment.NEXT_PUBLIC_SUPABASE_URL === undefined &&
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined
  ) {
    return null;
  }

  return parseAuthenticationProviderConfig(environment);
}
