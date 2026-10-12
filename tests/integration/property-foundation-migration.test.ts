import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/shared/database/prisma';

const PHASE_ONE_MIGRATION = '20260808100000_saas_tenancy_foundation';
const PHASE_TWO_MIGRATION = '20260812090000_property_foundation';
const PRISMA_CLI = resolve(process.cwd(), 'node_modules/prisma/build/index.js');
const MIGRATION_STAGING_ROOT = resolve(process.cwd(), 'tests/integration/.tmp');

interface UpgradeHarness {
  database: PrismaClient;
  deployStagedMigrations(): void;
  stagePhaseTwo(): void;
  dispose(): Promise<void>;
}

function isolatedDatabaseUrl(schemaName: string): string {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) throw new Error('TEST_DATABASE_URL must be installed by integration preflight.');

  const databaseUrl = new URL(baseUrl);
  databaseUrl.searchParams.set('schema', schemaName);
  return databaseUrl.toString();
}

function stageMigration(migrationsDirectory: string, migrationName: string): void {
  cpSync(
    resolve(process.cwd(), 'prisma/migrations', migrationName),
    resolve(migrationsDirectory, migrationName),
    { recursive: true },
  );
}

async function createUpgradeHarness(): Promise<UpgradeHarness> {
  const schemaName = `phase2_upgrade_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  mkdirSync(MIGRATION_STAGING_ROOT, { recursive: true });
  const stagingDirectory = mkdtempSync(resolve(MIGRATION_STAGING_ROOT, 'phase2-upgrade-'));
  const prismaDirectory = resolve(stagingDirectory, 'prisma');
  const migrationsDirectory = resolve(prismaDirectory, 'migrations');
  const schemaPath = resolve(prismaDirectory, 'schema.prisma');
  const databaseUrl = isolatedDatabaseUrl(schemaName);

  mkdirSync(migrationsDirectory, { recursive: true });
  copyFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), schemaPath);
  copyFileSync(
    resolve(process.cwd(), 'prisma/migrations/migration_lock.toml'),
    resolve(migrationsDirectory, 'migration_lock.toml'),
  );
  stageMigration(migrationsDirectory, PHASE_ONE_MIGRATION);

  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

  const database = new PrismaClient({ datasourceUrl: databaseUrl });
  const deployStagedMigrations = (): void => {
    execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy', '--schema', schemaPath], {
      cwd: stagingDirectory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  };

  try {
    deployStagedMigrations();
  } catch (error) {
    await database.$disconnect();
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    database,
    deployStagedMigrations,
    stagePhaseTwo() {
      stageMigration(migrationsDirectory, PHASE_TWO_MIGRATION);
    },
    async dispose() {
      await database.$disconnect();
      if (!/^phase2_upgrade_[a-f0-9]{12}$/.test(schemaName)) {
        throw new Error('Refusing to remove an unexpected integration-test schema.');
      }
      await prisma.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);

      const resolvedStagingDirectory = resolve(stagingDirectory);
      if (
        !resolvedStagingDirectory.startsWith(`${MIGRATION_STAGING_ROOT}${sep}`) ||
        !basename(resolvedStagingDirectory).startsWith('phase2-upgrade-')
      ) {
        throw new Error('Refusing to remove an unexpected migration staging directory.');
      }
      rmSync(resolvedStagingDirectory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    },
  };
}

interface ValidPhaseOneRecords {
  tenantId: string;
  ownerMembershipId: string;
  staffMembershipId: string;
  suspendedOwnerMembershipId: string;
  platformMembershipId: string;
}

async function seedValidPhaseOneAuthority(database: PrismaClient): Promise<ValidPhaseOneRecords> {
  const tenantId = randomUUID();
  const ownerMembershipId = randomUUID();
  const staffMembershipId = randomUUID();
  const suspendedOwnerMembershipId = randomUUID();
  const platformMembershipId = randomUUID();
  const ownerRoleId = randomUUID();
  const managerRoleId = randomUUID();

  await database.$transaction([
    database.$executeRaw`
      INSERT INTO "tenants" ("id", "name", "slug", "status", "updated_at")
      VALUES (${tenantId}::UUID, 'Upgrade Tenant', ${`upgrade-${tenantId}`} , 'ACTIVE', CURRENT_TIMESTAMP)
    `,
    database.$executeRaw`
      INSERT INTO "roles" ("id", "key", "name", "scope", "tenant_id")
      VALUES
        (${ownerRoleId}::UUID, 'TENANT_OWNER', 'Tenant owner', 'TENANT', ${tenantId}::UUID),
        (${managerRoleId}::UUID, 'PROPERTY_MANAGER', 'Property manager', 'TENANT', ${tenantId}::UUID)
    `,
    database.$executeRaw`
      INSERT INTO "staff_memberships"
        ("id", "user_id", "tenant_id", "status", "updated_at")
      VALUES
        (${ownerMembershipId}::UUID, ${randomUUID()}::UUID, ${tenantId}::UUID, 'ACTIVE', CURRENT_TIMESTAMP),
        (${staffMembershipId}::UUID, ${randomUUID()}::UUID, ${tenantId}::UUID, 'ACTIVE', CURRENT_TIMESTAMP),
        (${suspendedOwnerMembershipId}::UUID, ${randomUUID()}::UUID, ${tenantId}::UUID, 'SUSPENDED', CURRENT_TIMESTAMP),
        (${platformMembershipId}::UUID, ${randomUUID()}::UUID, NULL, 'ACTIVE', CURRENT_TIMESTAMP)
    `,
    database.$executeRaw`
      INSERT INTO "staff_membership_roles" ("membership_id", "role_id")
      VALUES
        (${ownerMembershipId}::UUID, ${ownerRoleId}::UUID),
        (${staffMembershipId}::UUID, ${managerRoleId}::UUID),
        (${suspendedOwnerMembershipId}::UUID, ${ownerRoleId}::UUID)
    `,
  ]);

  return {
    tenantId,
    ownerMembershipId,
    staffMembershipId,
    suspendedOwnerMembershipId,
    platformMembershipId,
  };
}

function migrationFailureDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const commandError = error as Error & { stderr?: Buffer | string; stdout?: Buffer | string };
  return [commandError.message, commandError.stdout, commandError.stderr]
    .filter((part) => part !== undefined)
    .map(String)
    .join('\n');
}

afterAll(async () => prisma.$disconnect());

describe('Phase 2 migration upgrade and authority backfill', () => {
  it('backfills only the active verified owner and records exact SYSTEM scope versions', async () => {
    const harness = await createUpgradeHarness();

    try {
      const seeded = await seedValidPhaseOneAuthority(harness.database);
      harness.stagePhaseTwo();
      harness.deployStagedMigrations();

      const memberships = await harness.database.$queryRaw<
        Array<{
          id: string;
          property_access_mode: 'ALL_PROPERTIES' | 'SELECTED_PROPERTIES' | null;
          property_scope_version: number | null;
        }>
      >`
        SELECT "id"::TEXT, "property_access_mode"::TEXT, "property_scope_version"
        FROM "staff_memberships"
        ORDER BY "id"
      `;
      const byId = new Map(memberships.map((membership) => [membership.id, membership]));

      expect(byId.get(seeded.ownerMembershipId)).toMatchObject({
        property_access_mode: 'ALL_PROPERTIES',
        property_scope_version: 2,
      });
      expect(byId.get(seeded.staffMembershipId)).toMatchObject({
        property_access_mode: 'SELECTED_PROPERTIES',
        property_scope_version: 1,
      });
      expect(byId.get(seeded.suspendedOwnerMembershipId)).toMatchObject({
        property_access_mode: 'SELECTED_PROPERTIES',
        property_scope_version: 1,
      });
      expect(byId.get(seeded.platformMembershipId)).toMatchObject({
        property_access_mode: null,
        property_scope_version: null,
      });

      const assignments = await harness.database.$queryRaw<
        Array<{ tenant_id: string; membership_id: string; role_tenant_id: string }>
      >`
        SELECT assignment."tenant_id"::TEXT,
               assignment."membership_id"::TEXT,
               role."tenant_id"::TEXT AS "role_tenant_id"
        FROM "staff_membership_roles" assignment
        JOIN "roles" role ON role."id" = assignment."role_id"
        ORDER BY assignment."membership_id"
      `;
      expect(assignments).toHaveLength(3);
      expect(
        assignments.every(
          (assignment) =>
            assignment.tenant_id === seeded.tenantId &&
            assignment.role_tenant_id === seeded.tenantId,
        ),
      ).toBe(true);

      await expect(
        harness.database.$queryRaw<
          Array<{
            actor_type: string;
            actor_id: string;
            actor_membership_id: string | null;
            action: string;
            target_id: string;
            aggregate_version: number | null;
            previous_scope_version: number | null;
            resulting_scope_version: number | null;
            changed_fields: string[];
          }>
        >`
          SELECT "actor_type"::TEXT,
                 "actor_id",
                 "actor_membership_id"::TEXT,
                 "action",
                 "target_id",
                 "aggregate_version",
                 "previous_scope_version",
                 "resulting_scope_version",
                 "changed_fields"
          FROM "audit_events"
          ORDER BY "occurred_at", "id"
        `,
      ).resolves.toEqual([
        {
          actor_type: 'SYSTEM',
          actor_id: PHASE_TWO_MIGRATION,
          actor_membership_id: null,
          action: 'TENANT_OWNER_PROPERTY_SCOPE_BACKFILLED',
          target_id: seeded.ownerMembershipId,
          aggregate_version: 2,
          previous_scope_version: 1,
          resulting_scope_version: 2,
          changed_fields: ['propertyAccessMode', 'propertyScopeVersion'],
        },
      ]);

      harness.deployStagedMigrations();
      await expect(
        harness.database.auditEvent.count({
          where: { tenantId: seeded.tenantId, action: 'TENANT_OWNER_PROPERTY_SCOPE_BACKFILLED' },
        }),
      ).resolves.toBe(1);
    } finally {
      await harness.dispose();
    }
  });

  it('aborts before changing authority when a Phase 1 assignment crosses Tenants', async () => {
    const harness = await createUpgradeHarness();

    try {
      const firstTenantId = randomUUID();
      const secondTenantId = randomUUID();
      const membershipId = randomUUID();
      const roleId = randomUUID();

      await harness.database.$transaction([
        harness.database.$executeRaw`
          INSERT INTO "tenants" ("id", "name", "slug", "status", "updated_at")
          VALUES
            (${firstTenantId}::UUID, 'First Tenant', ${`first-${firstTenantId}`}, 'ACTIVE', CURRENT_TIMESTAMP),
            (${secondTenantId}::UUID, 'Second Tenant', ${`second-${secondTenantId}`}, 'ACTIVE', CURRENT_TIMESTAMP)
        `,
        harness.database.$executeRaw`
          INSERT INTO "staff_memberships"
            ("id", "user_id", "tenant_id", "status", "updated_at")
          VALUES (${membershipId}::UUID, ${randomUUID()}::UUID, ${firstTenantId}::UUID, 'ACTIVE', CURRENT_TIMESTAMP)
        `,
        harness.database.$executeRaw`
          INSERT INTO "roles" ("id", "key", "name", "scope", "tenant_id")
          VALUES (${roleId}::UUID, 'TENANT_OWNER', 'Foreign owner', 'TENANT', ${secondTenantId}::UUID)
        `,
        harness.database.$executeRaw`
          INSERT INTO "staff_membership_roles" ("membership_id", "role_id")
          VALUES (${membershipId}::UUID, ${roleId}::UUID)
        `,
      ]);

      await expect(
        harness.database.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::INTEGER AS "count"
          FROM "staff_membership_roles" assignment
          JOIN "staff_memberships" membership
            ON membership."id" = assignment."membership_id"
          JOIN "roles" role
            ON role."id" = assignment."role_id"
          WHERE membership."tenant_id" IS NOT NULL
            AND role."tenant_id" IS NOT NULL
            AND membership."tenant_id" <> role."tenant_id"
        `,
      ).resolves.toEqual([{ count: 1 }]);

      harness.stagePhaseTwo();
      let failure: unknown;
      try {
        harness.deployStagedMigrations();
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeDefined();
      expect(migrationFailureDetails(failure)).toContain('current transaction is aborted');

      await expect(
        harness.database.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::INTEGER AS "count"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'staff_memberships'
            AND column_name = 'property_access_mode'
        `,
      ).resolves.toEqual([{ count: 0 }]);
      await expect(
        harness.database.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::INTEGER AS "count"
          FROM "staff_membership_roles"
          WHERE "membership_id" = ${membershipId}::UUID
            AND "role_id" = ${roleId}::UUID
        `,
      ).resolves.toEqual([{ count: 1 }]);
    } finally {
      await harness.dispose();
    }
  });
});
