import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  AuthenticationConfigurationError,
  UnauthenticatedError,
} from '@/modules/identity/authenticated-subject';
import { AuthorizationError } from '@/modules/identity/authorization';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext, TenantResolutionError } from '@/modules/tenancy/tenant-context';
import { StaffSignOutForm } from './sign-out-form';

export const dynamic = 'force-dynamic';

export default async function StaffLandingPage() {
  const state = await loadStaffLandingState();

  if (state.status === 'missing-tenant-host') {
    return <StaffMissingTenantHost />;
  }

  if (state.status === 'denied') {
    return <StaffAccessDenied />;
  }

  if (state.status === 'authentication-unavailable') {
    return <AuthenticationUnavailable />;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-border bg-card p-8 shadow-xl sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label mb-2">Staff workspace</p>
            <h1 className="text-3xl font-black tracking-tight">{state.tenantName}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/60">
              Autentikasi dan keanggotaan tenant Anda telah diverifikasi. Fondasi Property kini
              tersedia sesuai izin dan scope yang diberikan.
            </p>
          </div>
          <StaffSignOutForm />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/staff/properties"
            className="rounded-2xl border border-border bg-accent/50 p-5 transition hover:border-primary"
          >
            <h2 className="font-bold">Kelola Property</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/60">
              Profil, alamat, fasilitas, lifecycle, dan publikasi Property.
            </p>
          </Link>
          {state.canManagePropertyAccess ? (
            <Link
              href="/staff/property-access"
              className="rounded-2xl border border-border bg-accent/50 p-5 transition hover:border-primary"
            >
              <h2 className="font-bold">Scope staff</h2>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                Administrasi akses Property dengan izin terpisah.
              </p>
            </Link>
          ) : null}
        </div>
        <p className="mt-6 text-sm leading-6 text-foreground/60">
          Room, inventori, harga, reservasi, tamu, dan pendapatan belum diimplementasikan.
        </p>
      </section>
    </main>
  );
}

type StaffLandingState =
  | { status: 'ready'; tenantName: string; canManagePropertyAccess: boolean }
  | { status: 'denied' }
  | { status: 'missing-tenant-host' }
  | { status: 'authentication-unavailable' };

async function loadStaffLandingState(): Promise<StaffLandingState> {
  try {
    const context = await getRequestTenantContext();

    if (context.kind === 'platform') {
      if (!context.actor.userId) {
        redirect('/staff/sign-in?next=/staff');
      }
      return { status: 'missing-tenant-host' };
    }

    const tenantContext = requireAuthenticatedTenantMembership(context);

    return {
      status: 'ready',
      tenantName: tenantContext.tenant.name,
      canManagePropertyAccess:
        tenantContext.membership.propertyAccessMode === 'ALL_PROPERTIES' &&
        tenantContext.membership.permissions.includes('staff.manage'),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect('/staff/sign-in?next=/staff');
    }

    if (error instanceof AuthorizationError || error instanceof TenantResolutionError) {
      return { status: 'denied' };
    }

    if (error instanceof AuthenticationConfigurationError) {
      return { status: 'authentication-unavailable' };
    }

    throw error;
  }
}

function StaffMissingTenantHost() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-xl sm:p-10">
        <p className="section-label mb-2">Subdomain Tenant Diperlukan</p>
        <h1 className="text-2xl font-black tracking-tight">Buka Alamat Organisasi Anda</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          Staff workspace Lelungo harus diakses melalui subdomain tenant khusus (contoh:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">
            nama-hotel.lelungo.com/staff
          </code>
          ). Anda saat ini sedang mengakses domain utama sistem.
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-accent/40 p-4 text-left text-xs leading-5 text-foreground/70">
          <p className="font-semibold text-foreground">Petunjuk untuk staf:</p>
          <ol className="mt-1.5 list-decimal pl-4 space-y-1">
            <li>Gunakan tautan subdomain organisasi yang diberikan oleh pengelola atau pemilik akomodasi Anda.</li>
            <li>Pastikan URL memuat nama subdomain hotel atau vila tempat Anda terdaftar sebagai staf.</li>
          </ol>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/10 transition"
          >
            Kembali ke Beranda
          </Link>
          <StaffSignOutForm />
        </div>
      </section>
    </main>
  );
}

function StaffAccessDenied() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="section-label mb-2">Akses ditolak</p>
        <h1 className="text-2xl font-black tracking-tight">Keanggotaan tidak tersedia</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          Akun ini tidak memiliki keanggotaan aktif untuk tenant yang sedang dibuka.
        </p>
        <div className="mt-6 flex justify-center">
          <StaffSignOutForm />
        </div>
      </section>
    </main>
  );
}

function AuthenticationUnavailable() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="section-label mb-2">Layanan tidak tersedia</p>
        <h1 className="text-2xl font-black tracking-tight">Autentikasi belum dapat digunakan</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          Konfigurasi autentikasi server perlu diperiksa oleh pengelola sistem.
        </p>
      </section>
    </main>
  );
}
