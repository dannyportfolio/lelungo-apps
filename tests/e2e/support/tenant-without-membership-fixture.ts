import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { validateTestDatabaseEnvironment } from '../../integration/support/test-database';

export interface TenantWithoutMembershipFixture {
  applicationURL: string;
  close(): Promise<void>;
}

export async function createTenantWithoutMembershipFixture(
  baseApplicationURL: string,
): Promise<TenantWithoutMembershipFixture> {
  const validatedDatabase = validateTestDatabaseEnvironment({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  const baseURL = new URL(baseApplicationURL);

  if (baseURL.protocol !== 'http:' || !isLoopbackHost(baseURL.hostname)) {
    throw new Error('The built-in tenant E2E fixture requires a local HTTP application URL.');
  }

  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const tenantId = randomUUID();
  const domainId = randomUUID();
  const subdomain = `staff-e2e-${suffix}`;
  const database = new PrismaClient({ datasourceUrl: validatedDatabase.databaseUrl });

  try {
    await database.tenant.create({
      data: {
        id: tenantId,
        name: 'Staff authentication E2E tenant',
        slug: subdomain,
        status: 'ACTIVE',
        domains: {
          create: {
            id: domainId,
            subdomain,
            isPrimary: true,
          },
        },
      },
      select: { id: true },
    });
  } catch (error) {
    await database.$disconnect();
    throw error;
  }

  const tenantApplicationURL = new URL(baseURL);
  tenantApplicationURL.hostname = `${subdomain}.localhost`;
  let closed = false;

  return {
    applicationURL: tenantApplicationURL.origin,
    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      try {
        await database.tenantDomain.deleteMany({
          where: { id: domainId, tenantId },
        });
        await database.tenant.deleteMany({
          where: { id: tenantId, slug: subdomain },
        });
      } finally {
        await database.$disconnect();
      }
    },
  };
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
