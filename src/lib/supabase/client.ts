import { createBrowserClient } from '@supabase/ssr';

// Browser-side helper retained for non-authenticated legacy integrations only.
// Staff authentication is server-initiated and uses HttpOnly cookies; do not use
// this client for staff sessions or the same auth storage key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
