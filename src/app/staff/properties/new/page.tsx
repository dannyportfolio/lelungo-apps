import Link from 'next/link';

import { requirePropertyCreationPermission } from '@/modules/identity/property-authorization';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';
import { createPropertyAction } from '../actions';
import { PropertyForm } from '../property-form';

export const dynamic = 'force-dynamic';

export default async function NewPropertyPage() {
  const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
  requirePropertyCreationPermission(context.membership, context.tenant.id);
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <Link href="/staff/properties" className="text-sm font-semibold text-primary">
        ← Kembali
      </Link>
      <h1 className="mt-5 text-3xl font-black">Tambah Property</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Semua identitas inti dan alamat wajib lengkap. Property mulai sebagai DRAFT.
      </p>
      <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <PropertyForm action={createPropertyAction} />
      </section>
    </main>
  );
}
