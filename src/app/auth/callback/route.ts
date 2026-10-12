import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticationProviderConfig } from '@/modules/identity/authentication-config';
import { resolveSafeStaffRedirect } from '@/modules/identity/staff-redirect';

const callbackQuerySchema = z
  .object({
    code: z.string().trim().min(1).max(4_096),
    next: z.string().max(2_048).optional(),
    sb_flow_id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,64}$/)
      .optional(),
  })
  .strict();

const privateHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = callbackQuerySchema.safeParse({
    code: request.nextUrl.searchParams.get('code'),
    next: request.nextUrl.searchParams.get('next') ?? undefined,
    sb_flow_id: request.nextUrl.searchParams.get('sb_flow_id') ?? undefined,
  });

  if (!parsed.success) {
    return authenticationFailureResponse(request);
  }

  let exchanged = false;

  try {
    const client = await createClient(getAuthenticationProviderConfig());
    const exchangeOptions = parsed.data.sb_flow_id ? { flowId: parsed.data.sb_flow_id } : undefined;
    const { error } = await client.auth.exchangeCodeForSession(parsed.data.code, exchangeOptions);
    exchanged = !error;
  } catch {
    exchanged = false;
  }

  if (!exchanged) {
    return authenticationFailureResponse(request);
  }

  return privateRedirect(resolveSafeStaffRedirect(parsed.data.next), request);
}

function authenticationFailureResponse(request: NextRequest): NextResponse {
  return privateRedirect('/staff/sign-in?error=authentication_failed', request);
}

function privateRedirect(destination: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(destination, request.url), { headers: privateHeaders });
}
