import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createPropertyAuditMetadata } from '@/modules/audit/audit-metadata';
import {
  grantPropertyScope,
  replacePropertyAccessMode,
  revokePropertyScope,
} from '@/modules/identity/property-scope-service';
import {
  createProperty as createPropertyService,
  transitionPropertyLifecycle,
  updateProperty,
} from '@/modules/properties/property-service';
import { createTenant } from '@/modules/tenancy/tenant-service';
import { prisma } from '@/shared/database/prisma';
import { IntegrationTestRecordRegistry } from './support/test-record-registry';

const records = new IntegrationTestRecordRegistry();

async function trackedTenant() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const ownerUserId = randomUUID();
  const tenant = await createTenant({
    name: `Property integration ${suffix}`,
    subdomain: `property-${suffix}`,
    ownerUserId,
  });
  records.trackTenant(tenant.id);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'ACTIVE' } });
  const owner = await prisma.staffMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, propertyAccessMode: 'ALL_PROPERTIES' },
    select: { id: true, propertyScopeVersion: true },
  });
  if (owner.propertyScopeVersion === null) {
    throw new Error('Tenant owner bootstrap must persist a Property scope version.');
  }
  return {
    tenant,
    owner: { id: owner.id, propertyScopeVersion: owner.propertyScopeVersion },
    ownerUserId,
  };
}

async function createPropertyRecord(
  tenantId: string,
  slug = `property-${randomUUID().slice(0, 8)}`,
) {
  return prisma.property.create({
    data: {
      tenantId,
      name: 'Villa Integrasi',
      slug,
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        create: {
          line1: 'Jalan Uji 1',
          locality: 'Sleman',
          adminArea: 'DI Yogyakarta',
          countryCode: 'ID',
        },
      },
    },
    select: { id: true, version: true },
  });
}

afterEach(async () => records.cleanup(prisma));
afterAll(async () => prisma.$disconnect());

describe('committed Phase 2 PostgreSQL boundaries', () => {
  it('re-deploys every committed migration idempotently', () => {
    execFileSync(
      process.execPath,
      [resolve(process.cwd(), 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      },
    );
  });

  it('seeds the bounded system catalogs and explicit owner scope', async () => {
    const { tenant, owner } = await trackedTenant();
    const [classifications, amenities] = await Promise.all([
      prisma.propertyClassification.findMany({ where: { isActive: true }, select: { key: true } }),
      prisma.amenity.findMany({ where: { isActive: true }, select: { key: true } }),
    ]);
    expect(classifications.map(({ key }) => key)).toEqual(
      expect.arrayContaining(['VILLA', 'HOMESTAY', 'GUESTHOUSE', 'SMALL_HOTEL']),
    );
    expect(amenities.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'WIFI',
        'PARKING',
        'POOL',
        'AIR_CONDITIONING',
        'BREAKFAST',
        'KITCHEN',
      ]),
    );
    expect(owner.propertyScopeVersion).toBe(1);
    await expect(
      prisma.auditEvent.findFirstOrThrow({
        where: {
          tenantId: tenant.id,
          targetId: owner.id,
          action: 'TENANT_OWNER_PROPERTY_SCOPE_BOOTSTRAPPED',
        },
        select: {
          previousScopeVersion: true,
          resultingScopeVersion: true,
          changedFields: true,
        },
      }),
    ).resolves.toEqual({
      previousScopeVersion: null,
      resultingScopeVersion: 1,
      changedFields: ['propertyAccessMode', 'propertyScopeVersion'],
    });
  });

  it('rejects cross-tenant and platform role assignments at the database boundary', async () => {
    const first = await trackedTenant();
    const second = await trackedTenant();
    const secondRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: second.tenant.id, key: 'PROPERTY_MANAGER' },
      select: { id: true },
    });
    await expect(
      prisma.staffMembershipRole.create({
        data: {
          tenantId: first.tenant.id,
          membershipId: first.owner.id,
          roleId: secondRole.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });

    const platformRole = await prisma.role.create({
      data: { key: `PLATFORM_${randomUUID()}`, name: 'Platform test', scope: 'PLATFORM' },
      select: { id: true },
    });
    records.trackPlatformRole(platformRole.id);
    await expect(
      prisma.staffMembershipRole.create({
        data: {
          tenantId: first.tenant.id,
          membershipId: first.owner.id,
          roleId: platformRole.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects duplicate slugs and cross-tenant Property grants', async () => {
    const first = await trackedTenant();
    const second = await trackedTenant();
    const property = await createPropertyRecord(first.tenant.id, 'same-slug');
    await expect(createPropertyRecord(first.tenant.id, 'same-slug')).rejects.toMatchObject({
      code: 'P2002',
    });
    const targetMembership = await prisma.staffMembership.create({
      data: {
        userId: randomUUID(),
        tenantId: second.tenant.id,
        status: 'ACTIVE',
        propertyAccessMode: 'SELECTED_PROPERTIES',
        propertyScopeVersion: 1,
      },
      select: { id: true },
    });
    await expect(
      prisma.membershipPropertyScope.create({
        data: {
          tenantId: second.tenant.id,
          membershipId: targetMembership.id,
          propertyId: property.id,
          grantedByMembershipId: second.owner.id,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('allows only one expected-version writer and rolls back a failed audit transaction', async () => {
    const { tenant, owner } = await trackedTenant();
    const property = await createPropertyRecord(tenant.id);
    const first = prisma.property.updateMany({
      where: { tenantId: tenant.id, id: property.id, version: 1 },
      data: { name: 'Accepted writer', version: { increment: 1 } },
    });
    const second = prisma.property.updateMany({
      where: { tenantId: tenant.id, id: property.id, version: 1 },
      data: { name: 'Stale writer', version: { increment: 1 } },
    });
    const results = await Promise.all([first, second]);
    expect(results.map(({ count }) => count).sort()).toEqual([0, 1]);
    const acceptedName = results[0].count === 1 ? 'Accepted writer' : 'Stale writer';

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.property.update({
          where: { id: property.id },
          data: { name: 'Must roll back', version: { increment: 1 } },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: tenant.id,
            propertyId: property.id,
            actorType: 'STAFF',
            actorId: 'integration-user',
            actorMembershipId: owner.id,
            action: 'PROPERTY_PROFILE_UPDATED',
            targetType: 'PROPERTY',
            targetId: property.id,
            correlationId: randomUUID(),
            changedFields: [...createPropertyAuditMetadata(['name']).changedFields],
            aggregateVersion: -1,
          },
        });
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.property.findUniqueOrThrow({
        where: { id: property.id },
        select: { name: true, version: true },
      }),
    ).resolves.toEqual({ name: acceptedName, version: 2 });
  });

  it('commits Property service lifecycle and audit atomically, including rollback on audit failure', async () => {
    const { tenant, owner, ownerUserId } = await trackedTenant();
    const creationAuthority = {
      tenantId: tenant.id,
      membershipId: owner.id,
      propertyAccessMode: 'ALL_PROPERTIES' as const,
      propertyScopeVersion: 1,
    };
    const actor = {
      userId: ownerUserId,
      membershipId: owner.id,
      correlationId: randomUUID(),
    };
    const created = await createPropertyService(creationAuthority, actor, {
      name: 'Service Property',
      slug: 'service-property',
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        line1: 'Jalan Service 1',
        locality: 'Sleman',
        adminArea: 'DI Yogyakarta',
        countryCode: 'ID',
      },
      amenityKeys: ['WIFI'],
      shortDescription: null,
      publicWhatsAppE164: null,
    });
    const propertyAuthority = {
      ...creationAuthority,
      propertyId: created.id,
    };
    const updated = await updateProperty(propertyAuthority, actor, {
      propertyId: created.id,
      expectedVersion: created.version,
      name: 'Service Property Updated',
    });
    const published = await transitionPropertyLifecycle(propertyAuthority, actor, 'PUBLISH', {
      propertyId: created.id,
      expectedVersion: updated.version,
    });
    expect(published).toMatchObject({ lifecycle: 'PUBLISHED', version: 3 });
    await expect(
      prisma.auditEvent.findMany({
        where: { tenantId: tenant.id, propertyId: created.id },
        select: { action: true, aggregateVersion: true },
        orderBy: { aggregateVersion: 'asc' },
      }),
    ).resolves.toEqual([
      { action: 'PROPERTY_CREATED', aggregateVersion: 1 },
      { action: 'PROPERTY_PROFILE_UPDATED', aggregateVersion: 2 },
      { action: 'PROPERTY_PUBLISHED', aggregateVersion: 3 },
    ]);

    await expect(
      updateProperty(
        propertyAuthority,
        { ...actor, correlationId: 'not-a-uuid' },
        {
          propertyId: created.id,
          expectedVersion: published.version,
          name: 'Must roll back with audit',
        },
      ),
    ).rejects.toBeDefined();
    await expect(
      prisma.property.findUniqueOrThrow({
        where: { id: created.id },
        select: { name: true, version: true },
      }),
    ).resolves.toEqual({ name: 'Service Property Updated', version: 3 });
  });

  it('records every accepted scope change with its exact prior and resulting version', async () => {
    const { tenant, owner, ownerUserId } = await trackedTenant();
    const property = await createPropertyRecord(tenant.id);
    const target = await prisma.staffMembership.create({
      data: {
        userId: randomUUID(),
        tenantId: tenant.id,
        status: 'ACTIVE',
        propertyAccessMode: 'SELECTED_PROPERTIES',
        propertyScopeVersion: 1,
      },
      select: { id: true },
    });
    const authority = {
      tenantId: tenant.id,
      actorMembershipId: owner.id,
      targetMembershipId: target.id,
      propertyScopeVersion: owner.propertyScopeVersion,
    };

    await expect(
      grantPropertyScope(
        authority,
        { userId: ownerUserId, correlationId: 'not-a-uuid' },
        {
          targetMembershipId: target.id,
          propertyId: property.id,
          expectedVersion: 1,
        },
      ),
    ).rejects.toBeDefined();
    await expect(
      prisma.staffMembership.findUniqueOrThrow({
        where: { id: target.id },
        select: { propertyScopeVersion: true, propertyScopes: { select: { propertyId: true } } },
      }),
    ).resolves.toEqual({ propertyScopeVersion: 1, propertyScopes: [] });

    const grantCorrelationId = randomUUID();
    const revokeCorrelationId = randomUUID();
    const modeCorrelationId = randomUUID();
    const granted = await grantPropertyScope(
      authority,
      { userId: ownerUserId, correlationId: grantCorrelationId },
      {
        targetMembershipId: target.id,
        propertyId: property.id,
        expectedVersion: 1,
      },
    );
    const revoked = await revokePropertyScope(
      authority,
      { userId: ownerUserId, correlationId: revokeCorrelationId },
      {
        targetMembershipId: target.id,
        propertyId: property.id,
        expectedVersion: granted.propertyScopeVersion,
      },
    );
    const organizationWide = await replacePropertyAccessMode(
      authority,
      { userId: ownerUserId, correlationId: modeCorrelationId },
      {
        targetMembershipId: target.id,
        propertyAccessMode: 'ALL_PROPERTIES',
        selectedPropertyIds: [],
        expectedVersion: revoked.propertyScopeVersion,
      },
    );

    expect(organizationWide).toMatchObject({
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: 4,
      selectedPropertyIds: [],
    });
    await expect(
      prisma.auditEvent.findMany({
        where: {
          tenantId: tenant.id,
          targetType: 'STAFF_MEMBERSHIP',
          targetId: target.id,
        },
        select: {
          action: true,
          propertyId: true,
          actorType: true,
          actorMembershipId: true,
          result: true,
          aggregateVersion: true,
          previousScopeVersion: true,
          resultingScopeVersion: true,
          correlationId: true,
          changedFields: true,
        },
        orderBy: { aggregateVersion: 'asc' },
      }),
    ).resolves.toEqual([
      {
        action: 'MEMBERSHIP_PROPERTY_GRANTED',
        propertyId: property.id,
        actorType: 'STAFF',
        actorMembershipId: owner.id,
        result: 'SUCCEEDED',
        aggregateVersion: 2,
        previousScopeVersion: 1,
        resultingScopeVersion: 2,
        correlationId: grantCorrelationId,
        changedFields: ['propertyGrant', 'propertyScopeVersion'],
      },
      {
        action: 'MEMBERSHIP_PROPERTY_REVOKED',
        propertyId: property.id,
        actorType: 'STAFF',
        actorMembershipId: owner.id,
        result: 'SUCCEEDED',
        aggregateVersion: 3,
        previousScopeVersion: 2,
        resultingScopeVersion: 3,
        correlationId: revokeCorrelationId,
        changedFields: ['propertyGrant', 'propertyScopeVersion'],
      },
      {
        action: 'MEMBERSHIP_PROPERTY_ACCESS_MODE_CHANGED',
        propertyId: null,
        actorType: 'STAFF',
        actorMembershipId: owner.id,
        result: 'SUCCEEDED',
        aggregateVersion: 4,
        previousScopeVersion: 3,
        resultingScopeVersion: 4,
        correlationId: modeCorrelationId,
        changedFields: ['propertyAccessMode', 'propertyScopeVersion', 'selectedPropertySet'],
      },
    ]);
  });

  it('exposes the expected same-tenant checks, indexes, and foreign keys', async () => {
    await trackedTenant();
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'properties_tenant_id_slug_key',
        'properties_tenant_id_lifecycle_slug_id_idx',
        'audit_events_tenant_id_occurred_at_id_idx',
      ]),
    );
    expect(constraints.map(({ conname }) => conname)).toEqual(
      expect.arrayContaining([
        'roles_scope_tenant_coherence_check',
        'staff_memberships_property_scope_check',
        'membership_property_scopes_property_id_fkey',
        'audit_events_actor_check',
      ]),
    );
  });
});
