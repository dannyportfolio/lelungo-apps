-- Additive Phase 1 foundation. Apply only after a backup and staging rehearsal.
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'TENANT');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED');

CREATE TABLE "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tenant_domains" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL, "subdomain" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "scope" "RoleScope" NOT NULL, "tenant_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "key" TEXT NOT NULL, "description" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL, "permission_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
CREATE TABLE "staff_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "tenant_id" UUID,
  "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "staff_memberships_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "staff_membership_roles" (
  "membership_id" UUID NOT NULL, "role_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_membership_roles_pkey" PRIMARY KEY ("membership_id", "role_id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenant_domains_subdomain_key" ON "tenant_domains"("subdomain");
CREATE INDEX "tenant_domains_tenant_id_idx" ON "tenant_domains"("tenant_id");
CREATE UNIQUE INDEX "tenant_domains_one_primary_per_tenant" ON "tenant_domains"("tenant_id") WHERE "is_primary";
CREATE UNIQUE INDEX "roles_tenant_id_key_key" ON "roles"("tenant_id", "key");
CREATE UNIQUE INDEX "roles_platform_key" ON "roles"("key") WHERE "tenant_id" IS NULL;
CREATE INDEX "roles_scope_tenant_id_idx" ON "roles"("scope", "tenant_id");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE UNIQUE INDEX "staff_memberships_tenant_id_user_id_key" ON "staff_memberships"("tenant_id", "user_id");
CREATE UNIQUE INDEX "staff_memberships_platform_user" ON "staff_memberships"("user_id") WHERE "tenant_id" IS NULL;
CREATE INDEX "staff_memberships_user_id_status_idx" ON "staff_memberships"("user_id", "status");
CREATE INDEX "staff_memberships_tenant_id_status_idx" ON "staff_memberships"("tenant_id", "status");

ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_membership_roles" ADD CONSTRAINT "staff_membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "staff_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_membership_roles" ADD CONSTRAINT "staff_membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
