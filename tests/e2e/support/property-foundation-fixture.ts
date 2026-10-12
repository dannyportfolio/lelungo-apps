import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { ensureInitialRoles } from '@/modules/identity/role-catalog';
import { validateTestDatabaseEnvironment } from '../../integration/support/test-database';

export interface PropertyFoundationFixture {
  applicationURL: string;
  actorMembershipId: string;
  administratorMembershipId: string;
  propertyA: { id: string; name: string };
  propertyB: { id: string; name: string };
  grantActorPermissions(): Promise<void>;
  setActorAllProperties(): Promise<void>;
  advancePropertyVersion(propertyId: string): Promise<void>;
  close(): Promise<void>;
}

export async function createPropertyFoundationFixture(
  baseApplicationURL: string,
  authenticatedUserId: string,
): Promise<PropertyFoundationFixture> {
  const validated = validateTestDatabaseEnvironment({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  const baseURL = new URL(baseApplicationURL);
  if (baseURL.protocol !== 'http:' || !isLoopbackHost(baseURL.hostname)) {
    throw new Error('The built-in Property E2E fixture requires a local HTTP application URL.');
  }

  const database = new PrismaClient({ datasourceUrl: validated.databaseUrl });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const tenantId = randomUUID();
  const actorMembershipId = randomUUID();
  const administratorMembershipId = randomUUID();
  const subdomain = `property-e2e-${suffix}`;

  try {
    await database.$transaction(async (transaction) => {
      await transaction.tenant.create({
        data: {
          id: tenantId,
          name: 'Property foundation E2E tenant',
          slug: subdomain,
          status: 'ACTIVE',
          domains: { create: { subdomain, isPrimary: true } },
        },
      });
      await ensureInitialRoles(transaction, 'TENANT', tenantId);
      const ownerRole = await transaction.role.findFirstOrThrow({
        where: { tenantId, key: 'TENANT_OWNER' },
        select: { id: true },
      });
      await transaction.staffMembership.create({
        data: {
          id: administratorMembershipId,
          userId: randomUUID(),
          tenantId,
          status: 'ACTIVE',
          propertyAccessMode: 'ALL_PROPERTIES',
          propertyScopeVersion: 1,
          roles: { create: { roleId: ownerRole.id } },
        },
      });
      await transaction.staffMembership.create({
        data: {
          id: actorMembershipId,
          userId: authenticatedUserId,
          tenantId,
          status: 'ACTIVE',
          propertyAccessMode: 'SELECTED_PROPERTIES',
          propertyScopeVersion: 1,
        },
      });
    });
    const [propertyA, propertyB] = await Promise.all([
      createProperty(database, tenantId, 'E2E Property A', `e2e-a-${suffix}`),
      createProperty(database, tenantId, 'E2E Property B', `e2e-b-${suffix}`),
    ]);
    await database.membershipPropertyScope.create({
      data: {
        tenantId,
        membershipId: actorMembershipId,
        propertyId: propertyA.id,
        grantedByMembershipId: administratorMembershipId,
      },
    });

    const tenantURL = new URL(baseURL);
    tenantURL.hostname = `${subdomain}.localhost`;
    let closed = false;
    return {
      applicationURL: tenantURL.origin,
      actorMembershipId,
      administratorMembershipId,
      propertyA,
      propertyB,
      async grantActorPermissions(): Promise<void> {
        const ownerRole = await database.role.findFirstOrThrow({
          where: { tenantId, key: 'TENANT_OWNER' },
          select: { id: true },
        });
        await database.staffMembershipRole.upsert({
          where: {
            tenantId_membershipId_roleId: {
              tenantId,
              membershipId: actorMembershipId,
              roleId: ownerRole.id,
            },
          },
          create: { tenantId, membershipId: actorMembershipId, roleId: ownerRole.id },
          update: {},
        });
      },
      async setActorAllProperties(): Promise<void> {
        await database.$transaction([
          database.membershipPropertyScope.deleteMany({
            where: { tenantId, membershipId: actorMembershipId },
          }),
          database.staffMembership.update({
            where: { id: actorMembershipId },
            data: { propertyAccessMode: 'ALL_PROPERTIES', propertyScopeVersion: { increment: 1 } },
          }),
        ]);
      },
      async advancePropertyVersion(propertyId: string): Promise<void> {
        await database.property.update({
          where: { id: propertyId },
          data: { version: { increment: 1 } },
        });
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        try {
          await database.auditEvent.deleteMany({ where: { tenantId } });
          await database.membershipPropertyScope.deleteMany({ where: { tenantId } });
          await database.propertyAmenity.deleteMany({ where: { tenantId } });
          await database.propertyAddress.deleteMany({ where: { tenantId } });
          await database.property.deleteMany({ where: { tenantId } });
          await database.tenantDomain.deleteMany({ where: { tenantId } });
          await database.tenant.delete({ where: { id: tenantId } });
        } finally {
          await database.$disconnect();
        }
      },
    };
  } catch (error) {
    await database.$disconnect();
    throw error;
  }
}

async function createProperty(
  database: PrismaClient,
  tenantId: string,
  name: string,
  slug: string,
): Promise<{ id: string; name: string }> {
  return database.property.create({
    data: {
      tenantId,
      name,
      slug,
      classificationKey: 'VILLA',
      timezone: 'Asia/Jakarta',
      address: {
        create: {
          line1: 'Jalan E2E 1',
          locality: 'Sleman',
          adminArea: 'DI Yogyakarta',
          countryCode: 'ID',
        },
      },
    },
    select: { id: true, name: true },
  });
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
