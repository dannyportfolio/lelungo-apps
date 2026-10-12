import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getOptionalAuthenticationProviderConfig } from '@/modules/identity/authentication-config';
import { getAuthenticationCookieOptions } from './auth-cookie-options';

const privateAuthenticationHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
} as const;

type CookieMutation = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function requestMayContainSupabaseAuthentication(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));
}

export function isAuthenticationRequest(pathname: string): boolean {
  return pathname === '/staff' || pathname.startsWith('/staff/') || pathname.startsWith('/auth/');
}

export async function refreshSupabaseSession(
  request: NextRequest,
  downstreamHeaders: Headers,
): Promise<NextResponse> {
  let response = createDownstreamResponse(downstreamHeaders);
  applyPrivateAuthenticationHeaders(response.headers);

  const configuration = getOptionalAuthenticationProviderConfig();
  if (!configuration) {
    return response;
  }

  const supabase = createServerClient(configuration.supabaseUrl, configuration.supabasePublicKey, {
    cookieOptions: getAuthenticationCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieMutation[], responseHeaders: Record<string, string>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        downstreamHeaders.set('cookie', request.cookies.toString());
        response = createDownstreamResponse(downstreamHeaders);

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        for (const [name, value] of Object.entries(responseHeaders)) {
          response.headers.set(name, value);
        }

        applyPrivateAuthenticationHeaders(response.headers);
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    // Proxy refresh is optimistic only. The authoritative identity adapter
    // independently verifies the subject and fails closed on protected paths.
  }

  return response;
}

function createDownstreamResponse(downstreamHeaders: Headers): NextResponse {
  return NextResponse.next({ request: { headers: downstreamHeaders } });
}

function applyPrivateAuthenticationHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(privateAuthenticationHeaders)) {
    headers.set(name, value);
  }
}
