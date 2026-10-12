import Link from 'next/link';

import { requirePersistedPropertyPermission } from '@/modules/identity/property-authorization-service';
import { getPropertyDetail } from '@/modules/properties/property-service';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';
import { updatePropertyAction } from '../actions';
import { PropertyLifecycleForm } from '../lifecycle-form';
import { PropertyForm } from '../property-form';

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
  const authority = await requirePersistedPropertyPermission({
    membership: context.membership,
    tenantId: context.tenant.id,
    propertyId,
    permission: 'property.read',
    includeArchived: true,
  });
  const property = await getPropertyDetail(authority);
  const canManage = context.membership.permissions.includes('property.manage');

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <Link href="/staff/properties" className="text-sm font-semibold text-primary">
        ← Kembali
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label">{property.lifecycle}</p>
          <h1 className="mt-2 text-3xl font-black">{property.name}</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Versi {property.version} · {property.timezone}
          </p>
        </div>
        {canManage && property.lifecycle !== 'ARCHIVED' ? (
          <div className="flex flex-wrap gap-2">
            {property.lifecycle === 'DRAFT' ? (
              <PropertyLifecycleForm
                propertyId={property.id}
                version={property.version}
                intent="PUBLISH"
                label="Publish"
              />
            ) : null}
            {property.lifecycle === 'PUBLISHED' ? (
              <PropertyLifecycleForm
                propertyId={property.id}
                version={property.version}
                intent="DEACTIVATE"
                label="Nonaktifkan"
              />
            ) : null}
            {property.lifecycle === 'INACTIVE' ? (
              <PropertyLifecycleForm
                propertyId={property.id}
                version={property.version}
                intent="REPUBLISH"
                label="Publish ulang"
              />
            ) : null}
            <PropertyLifecycleForm
              propertyId={property.id}
              version={property.version}
              intent="ARCHIVE"
              label="Arsipkan"
            />
          </div>
        ) : null}
      </div>
      {canManage && property.lifecycle !== 'ARCHIVED' ? (
        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <PropertyForm action={updatePropertyAction} property={property} />
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-border p-6">
          <h2 className="font-bold">Profil tersimpan</h2>
          <p className="mt-2 text-sm text-foreground/60">
            {property.address.line1}, {property.address.locality}, {property.address.adminArea}
          </p>
        </section>
      )}
    </main>
  );
}
