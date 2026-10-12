import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { ensureInitialRoles, ROLE_DEFINITIONS } from '@/modules/identity/role-catalog';
import { TenantRepository } from '@/modules/tenancy/tenant-repository';
import { createTenant } from '@/modules/tenancy/tenant-service';
import { prisma } from '@/shared/database/prisma';
import { IntegrationTestRecordRegistry } from './support/test-record-registry';

const records = new IntegrationTestRecordRegistry();

interface CreatedTenant {
  id: string;
  ownerUserId: string;
  subdomain: string;
}

async function createTrackedTenant(): Promise<CreatedTenant> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const ownerUserId = randomUUID();
  const subdomain = `integration-${suffix}`;
  const tenant = await createTenant({
    name: `Integration ${suffix}`,
    subdomain,
    ownerUserId,
  });

  records.trackTenant(tenant.id);
  return { id: tenant.id, ownerUserId, subdomain };
}

async function expectUniqueConstraint(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code: 'P2002' });
}

afterEach(async () => {
  await records.cleanup(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('committed PostgreSQL tenancy foundation', () => {
  it('applies every committed migration and exposes the expected tables', async () => {
    const committedMigrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const appliedMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
      ORDER BY "migration_name"
    `;
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT "table_name"
      FROM "information_schema"."tables"
      WHERE "table_schema" = 'public'
    `;

    expect(committedMigrations.length).toBeGreaterThan(0);
    expect(appliedMigrations.map(({ migration_name }) => migration_name)).toEqual(
      expect.arrayContaining(committedMigrations),
    );
    expect(tables.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([
        'tenants',
        'tenant_domains',
        'roles',
        'permissions',
        'role_permissions',
        'staff_memberships',
        'staff_membership_roles',
      ]),
    );
  });

  it('creates a tenant, its primary domain, and an active owner membership', async () => {
    const tenant = await createTrackedTenant();
    const persisted = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        status: true,
        domains: { select: { subdomain: true, isPrimary: true } },
        memberships: {
          where: { userId: tenant.ownerUserId },
          select: {
            status: true,
            propertyAccessMode: true,
            propertyScopeVersion: true,
            roles: { select: { role: { select: { key: true } } } },
          },
        },
      },
    });

    expect(persisted).toEqual({
      status: 'PENDING',
      domains: [{ subdomain: tenant.subdomain, isPrimary: true }],
      memberships: [
        {
          status: 'ACTIVE',
          propertyAccessMode: 'ALL_PROPERTIES',
          propertyScopeVersion: 1,
          roles: [{ role: { key: 'TENANT_OWNER' } }],
        },
      ],
    });
  });

  it('provisions the tenant role catalog idempotently', async () => {
    const tenant = await createTrackedTenant();
    const expectedRoles = ROLE_DEFINITIONS.filter(({ scope }) => scope === 'TENANT');

    await prisma.$transaction(async (database) => {
      await ensureInitialRoles(database, 'TENANT', tenant.id);
      await ensureInitialRoles(database, 'TENANT', tenant.id);
    });

    const roles = await prisma.role.findMany({
      where: { tenantId: tenant.id, scope: 'TENANT' },
      select: {
        key: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    expect(roles).toHaveLength(expectedRoles.length);
    for (const definition of expectedRoles) {
      const role = roles.find(({ key }) => key === definition.key);
      expect(role).toBeDefined();
      expect(role?.permissions.map(({ permission }) => permission.key).sort()).toEqual(
        [...definition.permissions].sort(),
      );
    }
  });

  it('resolves only an active membership for the trusted tenant', async () => {
    const tenant = await createTrackedTenant();
    const repository = new TenantRepository();

    const membership = await repository.findActiveMembership(tenant.ownerUserId, tenant.id);

    expect(membership).toMatchObject({
      propertyAccessMode: 'ALL_PROPERTIES',
      propertyScopeVersion: 1,
      tenantId: tenant.id,
      status: 'ACTIVE',
    });
    expect(
      membership?.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    ).toContain('tenant.read');
  });

  it.each(['INVITED', 'SUSPENDED', 'REVOKED'] as const)(
    'denies a %s tenant membership',
    async (status) => {
      const tenant = await createTrackedTenant();
      const userId = randomUUID();
      await prisma.staffMembership.create({
        data: {
          userId,
          tenantId: tenant.id,
          status,
          propertyAccessMode: 'SELECTED_PROPERTIES',
          propertyScopeVersion: 1,
        },
      });

      const repository = new TenantRepository();
      await expect(repository.findActiveMembership(userId, tenant.id)).resolves.toBeNull();
    },
  );

  it('denies absent and cross-tenant memberships', async () => {
    const firstTenant = await createTrackedTenant();
    const secondTenant = await createTrackedTenant();
    const repository = new TenantRepository();

    await expect(repository.findActiveMembership(randomUUID(), firstTenant.id)).resolves.toBeNull();
    await expect(
      repository.findActiveMembership(firstTenant.ownerUserId, secondTenant.id),
    ).resolves.toBeNull();
    await expect(
      repository.findActiveMembership(secondTenant.ownerUserId, firstTenant.id),
    ).resolves.toBeNull();
  });

  it('enforces the migration-only partial unique indexes', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT "indexname"
      FROM "pg_indexes"
      WHERE "schemaname" = 'public'
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'tenant_domains_one_primary_per_tenant',
        'roles_platform_key',
        'staff_memberships_platform_user',
      ]),
    );

    const tenant = await createTrackedTenant();
    await expectUniqueConstraint(
      prisma.tenantDomain.create({
        data: {
          tenantId: tenant.id,
          subdomain: `secondary-${randomUUID().replaceAll('-', '').slice(0, 16)}`,
          isPrimary: true,
        },
      }),
    );

    const platformRoleKey = `INTEGRATION_${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const platformRole = await prisma.role.create({
      data: {
        key: platformRoleKey,
        name: 'Integration platform role',
        scope: 'PLATFORM',
        tenantId: null,
      },
    });
    records.trackPlatformRole(platformRole.id);
    await expectUniqueConstraint(
      prisma.role.create({
        data: {
          key: platformRoleKey,
          name: 'Duplicate integration platform role',
          scope: 'PLATFORM',
          tenantId: null,
        },
      }),
    );

    const platformUserId = randomUUID();
    const platformMembership = await prisma.staffMembership.create({
      data: { userId: platformUserId, tenantId: null, status: 'ACTIVE' },
    });
    records.trackPlatformMembership(platformMembership.id);
    await expectUniqueConstraint(
      prisma.staffMembership.create({
        data: { userId: platformUserId, tenantId: null, status: 'ACTIVE' },
      }),
    );

    await expect(
      prisma.staffMembership.create({
        data: {
          userId: platformUserId,
          tenantId: tenant.id,
          status: 'ACTIVE',
          propertyAccessMode: 'SELECTED_PROPERTIES',
          propertyScopeVersion: 1,
        },
      }),
    ).resolves.toMatchObject({ userId: platformUserId, tenantId: tenant.id });
  });
});
