import Link from 'next/link';

import { resolveSafeStaffRedirect } from '@/modules/identity/staff-redirect';
import { StaffSignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';

interface StaffSignInPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

export default async function StaffSignInPage({ searchParams }: StaffSignInPageProps) {
  const query = await searchParams;
  const redirectTo = resolveSafeStaffRedirect(
    typeof query.next === 'string' ? query.next : undefined,
  );
  const callbackFailed = query.error === 'authentication_failed';

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div className="orb -left-28 top-0 h-72 w-72 bg-primary/10" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <div className="mb-8">
          <p className="section-label mb-2">Lelungo PMS</p>
          <h1 className="text-3xl font-black tracking-tight">Masuk sebagai staf</h1>
          <p className="mt-3 text-sm leading-6 text-foreground/60">
            Gunakan akun staf yang sudah memiliki keanggotaan aktif pada tenant ini.
          </p>
        </div>

        {callbackFailed ? (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Autentikasi tidak dapat diselesaikan. Silakan coba kembali.
          </p>
        ) : null}

        <StaffSignInForm redirectTo={redirectTo} />

        <p className="mt-7 text-center text-xs leading-5 text-foreground/50">
          Belum memiliki akses? Hubungi pemilik atau pengelola tenant Anda.
        </p>
        <Link
          href="/"
          className="mt-4 block text-center text-sm font-semibold text-primary hover:underline"
        >
          Kembali ke Lelungo
        </Link>
      </div>
    </main>
  );
}
