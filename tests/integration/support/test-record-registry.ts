import type { PrismaClient } from '@prisma/client';

/**
 * Tracks only primary keys created by the current test. Cleanup never truncates,
 * drops a schema/database, or selects records by an unresolved broad pattern.
 */
export class IntegrationTestRecordRegistry {
  private readonly tenantIds = new Set<string>();
  private readonly platformMembershipIds = new Set<string>();
  private readonly platformRoleIds = new Set<string>();

  trackTenant(tenantId: string): void {
    this.tenantIds.add(tenantId);
  }

  trackPlatformMembership(membershipId: string): void {
    this.platformMembershipIds.add(membershipId);
  }

  trackPlatformRole(roleId: string): void {
    this.platformRoleIds.add(roleId);
  }

  async cleanup(database: PrismaClient): Promise<void> {
    const platformMembershipIds = [...this.platformMembershipIds];
    const platformRoleIds = [...this.platformRoleIds];
    const tenantIds = [...this.tenantIds];

    if (platformMembershipIds.length > 0) {
      await database.staffMembership.deleteMany({
        where: { id: { in: platformMembershipIds } },
      });
    }

    if (platformRoleIds.length > 0) {
      await database.role.deleteMany({
        where: { id: { in: platformRoleIds } },
      });
    }

    if (tenantIds.length > 0) {
      await database.auditEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await database.membershipPropertyScope.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await database.propertyAmenity.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await database.propertyAddress.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await database.property.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await database.tenantDomain.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await database.tenant.deleteMany({
        where: { id: { in: tenantIds } },
      });
    }

    this.platformMembershipIds.clear();
    this.platformRoleIds.clear();
    this.tenantIds.clear();
  }
}
