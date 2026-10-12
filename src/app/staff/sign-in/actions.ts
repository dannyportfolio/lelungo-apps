'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticationProviderConfig } from '@/modules/identity/authentication-config';
import { resolveSafeStaffRedirect } from '@/modules/identity/staff-redirect';

const staffSignInSchema = z
  .object({
    email: z.string().trim().email('Masukkan alamat email yang valid.').max(254),
    password: z.string().min(1, 'Masukkan kata sandi.').max(1_024),
    next: z.string().optional(),
  })
  .strict();

export interface StaffSignInState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export async function signInStaffAction(
  _previousState: StaffSignInState,
  formData: FormData,
): Promise<StaffSignInState> {
  void _previousState;

  const parsed = staffSignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: 'error',
      message: 'Periksa kembali data masuk Anda.',
      fieldErrors: {
        email: fieldErrors.email,
        password: fieldErrors.password,
      },
    };
  }

  let authenticated = false;

  try {
    const client = await createClient(getAuthenticationProviderConfig());
    const { error } = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    authenticated = !error;
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    return {
      status: 'error',
      message: 'Email atau kata sandi tidak valid, atau layanan sedang tidak tersedia.',
    };
  }

  redirect(resolveSafeStaffRedirect(parsed.data.next));
}
