import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getAuthenticationCookieOptions } from './auth-cookie-options';

export interface SupabasePublicClientConfiguration {
  readonly supabaseUrl: string;
  readonly supabasePublicKey: string;
}

// Server-side Supabase client for request-bound authentication paths.
export async function createClient(configuration: SupabasePublicClientConfiguration) {
  const cookieStore = await cookies();

  return createServerClient(configuration.supabaseUrl, configuration.supabasePublicKey, {
    cookieOptions: getAuthenticationCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll called from Server Component — can be ignored
        }
      },
    },
  });
}

// Admin client with service role key (bypasses RLS — server-only)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
