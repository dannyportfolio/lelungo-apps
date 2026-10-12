import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedSubjectProvider } from '@/modules/identity/authenticated-subject';
import {
  composeRequestTenantContext,
  type TenantContextRepositoryPort,
} from '@/modules/tenancy/tenant-context-composer';
import { createActiveMembershipQuery } from '@/modules/tenancy/tenant-repository-query';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT_ID = '33333333-3333-4333-8333-333333333333';
const MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444';

const tenant = {
  id: TENANT_ID,
  name: 'Lelungo Test',
  slug: 'lelungo-test',
  status: 'ACTIVE' as const,
};

type MembershipRecord = Awaited<ReturnType<TenantContextRepositoryPort['findActiveMembership']>>;

function createSubjectProvider(userId: string | null): AuthenticatedSubjectProvider {
  return {
    getAuthenticatedSubject: vi.fn().mockResolvedValue(userId ? { userId } : null),
  };
}

function createRepository(membership: MembershipRecord): TenantContextRepositoryPort {
  return {
    findBySubdomain: vi.fn().mockResolvedValue(tenant),
    findActiveMembership: vi.fn().mockResolvedValue(membership),
  };
}

function activeMembership(tenantId = TENANT_ID): NonNullable<MembershipRecord> {
  return {
    id: MEMBERSHIP_ID,
    tenantId,
    status: 'ACTIVE',
    propertyAccessMode: 'ALL_PROPERTIES',
    propertyScopeVersion: 1,
    roles: [
      {
        role: {
          permissions: [
            { permission: { key: 'property.read' } },
            { permission: { key: 'property.read' } },
            { permission: { key: 'property.manage' } },
          ],
        },
      },
    ],
  };
}

describe('request tenant context composition', () => {
  it('derives the actor and active membership from the verified subject', async () => {
    const repository = createRepository(activeMembership());

    const context = await composeRequestTenantContext({
      tenantSubdomain: 'Lelungo-Test',
      correlationId: 'request-1',
      authenticatedSubjectProvider: createSubjectProvider(USER_ID),
      repository,
    });

    expect(repository.findBySubdomain).toHaveBeenCalledWith('lelungo-test');
    expect(repository.findActiveMembership).toHaveBeenCalledWith(USER_ID, TENANT_ID);
    expect(context).toMatchObject({
      kind: 'tenant',
      actor: { userId: USER_ID },
      membership: {
        membershipId: MEMBERSHIP_ID,
        tenantId: TENANT_ID,
        status: 'ACTIVE',
        propertyAccessMode: 'ALL_PROPERTIES',
        propertyScopeVersion: 1,
        permissions: ['property.read', 'property.manage'],
      },
    });
  });

  it('ignores a caller-selected actor ID when authentication returns no subject', async () => {
    const repository = createRepository(activeMembership());
    const inputWithUntrustedActor = {
      tenantSubdomain: 'lelungo-test',
      correlationId: 'request-2',
      authenticatedSubjectProvider: createSubjectProvider(null),
      repository,
      actor: { userId: USER_ID },
    };

    const context = await composeRequestTenantContext(inputWithUntrustedActor);

    expect(repository.findActiveMembership).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      kind: 'tenant',
      actor: { userId: null },
      membership: null,
    });
  });

  it.each([
    ['inactive', { ...activeMembership(), status: 'SUSPENDED' as const }],
    ['other-tenant', activeMembership(OTHER_TENANT_ID)],
    ['missing Property scope', { ...activeMembership(), propertyAccessMode: null }],
    ['invalid Property scope version', { ...activeMembership(), propertyScopeVersion: 0 }],
  ])('does not attach an %s membership returned by a repository', async (_name, membership) => {
    const repository = createRepository(membership);

    const context = await composeRequestTenantContext({
      tenantSubdomain: 'lelungo-test',
      correlationId: 'request-3',
      authenticatedSubjectProvider: createSubjectProvider(USER_ID),
      repository,
    });

    expect(context).toMatchObject({ kind: 'tenant', membership: null });
  });

  it('keeps authenticated platform context separate from tenant authority', async () => {
    const repository = createRepository(activeMembership());

    const context = await composeRequestTenantContext({
      tenantSubdomain: null,
      correlationId: 'request-4',
      authenticatedSubjectProvider: createSubjectProvider(USER_ID),
      repository,
    });

    expect(repository.findBySubdomain).not.toHaveBeenCalled();
    expect(repository.findActiveMembership).not.toHaveBeenCalled();
    expect(context).toEqual({
      kind: 'platform',
      actor: { userId: USER_ID },
      correlationId: 'request-4',
    });
  });
});

describe('active membership repository query', () => {
  it('uses verified user, trusted tenant, ACTIVE status, same-scope roles, and minimum selects', () => {
    const query = createActiveMembershipQuery(USER_ID, TENANT_ID);

    expect(query.where).toEqual({ userId: USER_ID, tenantId: TENANT_ID, status: 'ACTIVE' });
    expect(Object.keys(query.select)).toEqual([
      'id',
      'tenantId',
      'status',
      'propertyAccessMode',
      'propertyScopeVersion',
      'roles',
    ]);
    expect(query.select.roles.where).toEqual({
      tenantId: TENANT_ID,
      role: { tenantId: TENANT_ID, scope: 'TENANT' },
    });
    expect(query.select.roles.select).toEqual({
      role: {
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    });
  });
});
