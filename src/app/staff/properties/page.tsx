import Link from 'next/link';

import { requireAuthorizedPropertyListScope } from '@/modules/identity/property-authorization';
import { listProperties } from '@/modules/properties/property-service';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
  const scope = requireAuthorizedPropertyListScope(context.membership, context.tenant.id);
  const { cursor } = await searchParams;
  const page = await listProperties(scope, { pageSize: 25, ...(cursor ? { cursor } : {}) });
  const canCreate =
    context.membership.permissions.includes('property.manage') &&
    context.membership.propertyAccessMode === 'ALL_PROPERTIES';

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">Property foundation</p>
          <h1 className="mt-2 text-3xl font-black">Properties</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Daftar ini dibatasi oleh tenant, izin, dan scope Property Anda.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/staff/properties/new"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Tambah Property
          </Link>
        ) : null}
      </div>
      {page.items.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <h2 className="font-bold">Belum ada Property yang dapat diakses</h2>
          <p className="mt-2 text-sm text-foreground/60">
            Property baru tidak dibuat otomatis dari data prototipe.
          </p>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4">
          {page.items.map((property) => (
            <li key={property.id}>
              <Link
                href={`/staff/properties/${property.id}`}
                className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{property.name}</h2>
                    <p className="text-sm text-foreground/60">
                      {property.slug} · {property.locality}, {property.adminArea}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
                    {property.lifecycle}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <Link
          className="mt-6 inline-block text-sm font-semibold text-primary"
          href={`/staff/properties?cursor=${encodeURIComponent(page.nextCursor)}`}
        >
          Halaman berikutnya →
        </Link>
      ) : null}
    </main>
  );
}
