import { redirect } from 'next/navigation';

import { UnauthenticatedError } from '@/modules/identity/authenticated-subject';
import { AuthorizationError } from '@/modules/identity/authorization';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext, TenantResolutionError } from '@/modules/tenancy/tenant-context';

export default async function PropertiesLayout({ children }: { children: React.ReactNode }) {
  let denied = false;
  try {
    requireAuthenticatedTenantMembership(await getRequestTenantContext());
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/staff/sign-in?next=/staff/properties');
    if (error instanceof AuthorizationError || error instanceof TenantResolutionError)
      denied = true;
    else throw error;
  }
  if (denied) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
        <section className="rounded-3xl border border-border bg-card p-8">
          <p className="section-label">Akses ditolak</p>
          <h1 className="mt-2 text-2xl font-black">Workspace Property tidak tersedia</h1>
          <p className="mt-3 text-sm text-foreground/60">
            Keanggotaan aktif pada tenant ini diperlukan.
          </p>
        </section>
      </main>
    );
  }
  return children;
}
