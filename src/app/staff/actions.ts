'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticationProviderConfig } from '@/modules/identity/authentication-config';

export interface StaffSignOutState {
  status: 'idle' | 'error';
  message?: string;
}

export async function signOutStaffAction(
  _previousState: StaffSignOutState,
  _formData: FormData,
): Promise<StaffSignOutState> {
  void _previousState;
  void _formData;

  let signedOut = false;

  try {
    const client = await createClient(getAuthenticationProviderConfig());

    try {
      const { error } = await client.auth.signOut();
      signedOut = !error;
    } catch {
      signedOut = false;
    }

    if (!signedOut) {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        signedOut = !error;
      } catch {
        signedOut = false;
      }
    }
  } catch {
    signedOut = false;
  }

  if (!signedOut) {
    return {
      status: 'error',
      message: 'Sesi tidak dapat diakhiri. Silakan coba kembali.',
    };
  }

  redirect('/staff/sign-in');
}
