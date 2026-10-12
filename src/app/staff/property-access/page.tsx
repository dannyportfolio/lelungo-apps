import Link from 'next/link';

import { AuthorizationError } from '@/modules/identity/authorization';
import { requireAuthorizedPropertyListScope } from '@/modules/identity/property-authorization';
import { listActiveMembershipScopes } from '@/modules/identity/property-scope-service';
import { requireAuthenticatedTenantMembership } from '@/modules/tenancy/tenant-access';
import { getRequestTenantContext } from '@/modules/tenancy/tenant-context';
import { ScopeAdministrationForms } from './scope-administration-forms';

export const dynamic = 'force-dynamic';

export default async function PropertyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const context = requireAuthenticatedTenantMembership(await getRequestTenantContext());
  const scope = requireAuthorizedPropertyListScope(
    context.membership,
    context.tenant.id,
    'staff.manage',
  );
  if (scope.kind !== 'ALL_PROPERTIES') throw new AuthorizationError();
  const { cursor } = await searchParams;
  const page = await listActiveMembershipScopes({
    tenantId: context.tenant.id,
    actorMembershipId: context.membership.membershipId,
    actorUserId: context.actor.userId,
    actorScopeVersion: context.membership.propertyScopeVersion,
    pageSize: 25,
    cursor,
  });
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/staff" className="text-sm font-semibold text-primary">
        ← Workspace staff
      </Link>
      <h1 className="mt-5 text-3xl font-black">Scope akses Property</h1>
      <p className="mt-2 max-w-3xl text-sm text-foreground/60">
        Daftar minimum ini sengaja hanya menampilkan membership ID dan scope. Profil, email, dan
        data provider tidak diambil.
      </p>
      <ul className="mt-8 grid gap-4">
        {page.items.map((membership) => (
          <li
            key={membership.membershipId}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="break-all font-mono text-sm">{membership.membershipId}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  {membership.status} · versi {membership.propertyScopeVersion} ·{' '}
                  {membership.selectedPropertyCount} grant aktif
                </p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
                {membership.propertyAccessMode}
              </span>
            </div>
            {membership.membershipId !== context.membership.membershipId ? (
              <ScopeAdministrationForms
                membershipId={membership.membershipId}
                version={membership.propertyScopeVersion}
              />
            ) : (
              <p className="mt-4 text-xs text-foreground/60">
                Scope sendiri tidak dapat diubah dari capability ini.
              </p>
            )}
          </li>
        ))}
      </ul>
      {page.nextCursor ? (
        <Link
          href={`/staff/property-access?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="mt-6 inline-block text-sm font-semibold text-primary"
        >
          Halaman berikutnya →
        </Link>
      ) : null}
    </main>
  );
}
