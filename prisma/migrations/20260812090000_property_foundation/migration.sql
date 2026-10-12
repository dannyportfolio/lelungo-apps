-- Phase 2 Property foundation. This migration is additive and forward-only.
-- It deliberately aborts before changing authority when existing assignments
-- cannot be proven to be valid Tenant-only assignments.

BEGIN;

LOCK TABLE "roles", "staff_memberships", "staff_membership_roles" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  orphaned_assignments BIGINT;
  cross_tenant_assignments BIGINT;
  mixed_scope_assignments BIGINT;
  incoherent_roles BIGINT;
  ambiguous_owner_tenants BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO orphaned_assignments
  FROM "staff_membership_roles" assignment
  LEFT JOIN "staff_memberships" membership ON membership."id" = assignment."membership_id"
  LEFT JOIN "roles" role ON role."id" = assignment."role_id"
  WHERE membership."id" IS NULL OR role."id" IS NULL;

  SELECT COUNT(*)
  INTO cross_tenant_assignments
  FROM "staff_membership_roles" assignment
  JOIN "staff_memberships" membership ON membership."id" = assignment."membership_id"
  JOIN "roles" role ON role."id" = assignment."role_id"
  WHERE membership."tenant_id" IS NOT NULL
    AND role."tenant_id" IS NOT NULL
    AND membership."tenant_id" <> role."tenant_id";

  SELECT COUNT(*)
  INTO mixed_scope_assignments
  FROM "staff_membership_roles" assignment
  JOIN "staff_memberships" membership ON membership."id" = assignment."membership_id"
  JOIN "roles" role ON role."id" = assignment."role_id"
  WHERE membership."tenant_id" IS NULL
     OR role."scope" <> 'TENANT'
     OR role."tenant_id" IS NULL;

  SELECT COUNT(*)
  INTO incoherent_roles
  FROM "roles"
  WHERE ("scope" = 'TENANT' AND "tenant_id" IS NULL)
     OR ("scope" = 'PLATFORM' AND "tenant_id" IS NOT NULL);

  SELECT COUNT(*)
  INTO ambiguous_owner_tenants
  FROM (
    SELECT membership."tenant_id"
    FROM "staff_memberships" membership
    JOIN "staff_membership_roles" assignment
      ON assignment."membership_id" = membership."id"
    JOIN "roles" role ON role."id" = assignment."role_id"
    WHERE membership."tenant_id" IS NOT NULL
      AND membership."status" = 'ACTIVE'
      AND role."scope" = 'TENANT'
      AND role."tenant_id" = membership."tenant_id"
      AND role."key" = 'TENANT_OWNER'
    GROUP BY membership."tenant_id"
    HAVING COUNT(DISTINCT membership."id") > 1
  ) ambiguous;

  IF orphaned_assignments > 0
    OR cross_tenant_assignments > 0
    OR mixed_scope_assignments > 0
    OR incoherent_roles > 0
    OR ambiguous_owner_tenants > 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Phase 2 authority preflight failed: orphaned=%s, cross_tenant=%s, mixed_scope=%s, incoherent_roles=%s, ambiguous_owner_tenants=%s. Review and reconcile rows before retrying; this migration changes no authority on failure.',
        orphaned_assignments,
        cross_tenant_assignments,
        mixed_scope_assignments,
        incoherent_roles,
        ambiguous_owner_tenants
      );
  END IF;
END $$;

CREATE TYPE "PropertyAccessMode" AS ENUM ('ALL_PROPERTIES', 'SELECTED_PROPERTIES');
CREATE TYPE "PropertyLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "AuditActorType" AS ENUM ('STAFF', 'SYSTEM');
CREATE TYPE "AuditResult" AS ENUM ('SUCCEEDED');

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_scope_tenant_coherence_check"
  CHECK (
    ("scope" = 'TENANT' AND "tenant_id" IS NOT NULL)
    OR ("scope" = 'PLATFORM' AND "tenant_id" IS NULL)
  );

CREATE UNIQUE INDEX "roles_tenant_id_id_key" ON "roles"("tenant_id", "id");
CREATE UNIQUE INDEX "staff_memberships_tenant_id_id_key" ON "staff_memberships"("tenant_id", "id");

ALTER TABLE "staff_membership_roles" ADD COLUMN "tenant_id" UUID;

UPDATE "staff_membership_roles" assignment
SET "tenant_id" = membership."tenant_id"
FROM "staff_memberships" membership
WHERE membership."id" = assignment."membership_id";

ALTER TABLE "staff_membership_roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "staff_membership_roles" DROP CONSTRAINT "staff_membership_roles_pkey";
ALTER TABLE "staff_membership_roles" DROP CONSTRAINT "staff_membership_roles_membership_id_fkey";
ALTER TABLE "staff_membership_roles" DROP CONSTRAINT "staff_membership_roles_role_id_fkey";
ALTER TABLE "staff_membership_roles"
  ADD CONSTRAINT "staff_membership_roles_pkey"
  PRIMARY KEY ("tenant_id", "membership_id", "role_id");
ALTER TABLE "staff_membership_roles"
  ADD CONSTRAINT "staff_membership_roles_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id")
  REFERENCES "staff_memberships"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_membership_roles"
  ADD CONSTRAINT "staff_membership_roles_role_id_fkey"
  FOREIGN KEY ("tenant_id", "role_id")
  REFERENCES "roles"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "staff_membership_roles_tenant_id_role_id_idx"
  ON "staff_membership_roles"("tenant_id", "role_id");

ALTER TABLE "staff_memberships"
  ADD COLUMN "property_access_mode" "PropertyAccessMode",
  ADD COLUMN "property_scope_version" INTEGER;

CREATE TABLE "property_classifications" (
  "key" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "property_classifications_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "property_classifications_key_check"
    CHECK ("key" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  CONSTRAINT "property_classifications_display_name_check"
    CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 120)
);

CREATE TABLE "amenities" (
  "key" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "amenities_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "amenities_key_check"
    CHECK ("key" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  CONSTRAINT "amenities_display_name_check"
    CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 120)
);

INSERT INTO "property_classifications"
  ("key", "display_name", "is_active", "created_at", "updated_at")
VALUES
  ('VILLA', 'Villa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('HOMESTAY', 'Homestay', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('GUESTHOUSE', 'Guesthouse', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SMALL_HOTEL', 'Small Hotel', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "display_name" = EXCLUDED."display_name",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "amenities"
  ("key", "display_name", "is_active", "created_at", "updated_at")
VALUES
  ('WIFI', 'Wi-Fi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PARKING', 'Parking', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('POOL', 'Pool', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('AIR_CONDITIONING', 'Air Conditioning', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BREAKFAST', 'Breakfast', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KITCHEN', 'Kitchen', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "display_name" = EXCLUDED."display_name",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;

CREATE INDEX "property_classifications_is_active_key_idx"
  ON "property_classifications"("is_active", "key");
CREATE INDEX "amenities_is_active_key_idx" ON "amenities"("is_active", "key");

CREATE TABLE "properties" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "classification_key" VARCHAR(64) NOT NULL,
  "timezone" VARCHAR(100) NOT NULL,
  "short_description" VARCHAR(500),
  "public_whatsapp_e164" VARCHAR(16),
  "lifecycle" "PropertyLifecycle" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "published_at" TIMESTAMPTZ(6),
  "deactivated_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "properties_name_check"
    CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "properties_slug_check"
    CHECK (char_length("slug") BETWEEN 1 AND 80 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "properties_timezone_check"
    CHECK (char_length(btrim("timezone")) BETWEEN 1 AND 100 AND "timezone" = btrim("timezone")),
  CONSTRAINT "properties_short_description_check"
    CHECK ("short_description" IS NULL OR char_length(btrim("short_description")) BETWEEN 1 AND 500),
  CONSTRAINT "properties_public_whatsapp_e164_check"
    CHECK ("public_whatsapp_e164" IS NULL OR "public_whatsapp_e164" ~ '^\+[1-9][0-9]{1,14}$'),
  CONSTRAINT "properties_version_check" CHECK ("version" > 0),
  CONSTRAINT "properties_lifecycle_timestamps_check"
    CHECK (
      ("lifecycle" = 'DRAFT' AND "published_at" IS NULL AND "deactivated_at" IS NULL AND "archived_at" IS NULL)
      OR ("lifecycle" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "deactivated_at" IS NULL AND "archived_at" IS NULL)
      OR ("lifecycle" = 'INACTIVE' AND "published_at" IS NOT NULL AND "deactivated_at" IS NOT NULL AND "archived_at" IS NULL)
      OR ("lifecycle" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "properties_tenant_id_id_key" ON "properties"("tenant_id", "id");
CREATE UNIQUE INDEX "properties_tenant_id_slug_key" ON "properties"("tenant_id", "slug");
CREATE INDEX "properties_tenant_id_lifecycle_slug_id_idx"
  ON "properties"("tenant_id", "lifecycle", "slug", "id");
CREATE INDEX "properties_classification_key_lifecycle_idx"
  ON "properties"("classification_key", "lifecycle");
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_classification_key_fkey"
  FOREIGN KEY ("classification_key") REFERENCES "property_classifications"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "property_addresses" (
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "line_1" VARCHAR(200) NOT NULL,
  "line_2" VARCHAR(200),
  "locality" VARCHAR(100) NOT NULL,
  "admin_area" VARCHAR(100) NOT NULL,
  "postal_code" VARCHAR(12),
  "country_code" CHAR(2) NOT NULL DEFAULT 'ID',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "property_addresses_pkey" PRIMARY KEY ("tenant_id", "property_id"),
  CONSTRAINT "property_addresses_line_1_check"
    CHECK (char_length(btrim("line_1")) BETWEEN 1 AND 200),
  CONSTRAINT "property_addresses_line_2_check"
    CHECK ("line_2" IS NULL OR char_length(btrim("line_2")) BETWEEN 1 AND 200),
  CONSTRAINT "property_addresses_locality_check"
    CHECK (char_length(btrim("locality")) BETWEEN 1 AND 100),
  CONSTRAINT "property_addresses_admin_area_check"
    CHECK (char_length(btrim("admin_area")) BETWEEN 1 AND 100),
  CONSTRAINT "property_addresses_postal_code_check"
    CHECK ("postal_code" IS NULL OR char_length(btrim("postal_code")) BETWEEN 1 AND 12),
  CONSTRAINT "property_addresses_country_code_check" CHECK ("country_code" = 'ID')
);

CREATE INDEX "property_addresses_tenant_id_locality_admin_area_idx"
  ON "property_addresses"("tenant_id", "locality", "admin_area");
ALTER TABLE "property_addresses"
  ADD CONSTRAINT "property_addresses_tenant_id_property_id_fkey"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "property_amenities" (
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "amenity_key" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("tenant_id", "property_id", "amenity_key")
);

CREATE INDEX "property_amenities_amenity_key_tenant_id_idx"
  ON "property_amenities"("amenity_key", "tenant_id");
ALTER TABLE "property_amenities"
  ADD CONSTRAINT "property_amenities_tenant_id_property_id_fkey"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_amenities"
  ADD CONSTRAINT "property_amenities_amenity_key_fkey"
  FOREIGN KEY ("amenity_key") REFERENCES "amenities"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "membership_property_scopes" (
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "granted_by_membership_id" UUID NOT NULL,
  CONSTRAINT "membership_property_scopes_pkey"
    PRIMARY KEY ("tenant_id", "membership_id", "property_id"),
  CONSTRAINT "membership_property_scopes_no_self_grant_check"
    CHECK ("membership_id" <> "granted_by_membership_id")
);

CREATE INDEX "membership_property_scopes_tenant_id_property_id_membership_id_idx"
  ON "membership_property_scopes"("tenant_id", "property_id", "membership_id");
CREATE INDEX "membership_property_scopes_tenant_id_granted_by_membership_id_idx"
  ON "membership_property_scopes"("tenant_id", "granted_by_membership_id");
ALTER TABLE "membership_property_scopes"
  ADD CONSTRAINT "membership_property_scopes_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "staff_memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membership_property_scopes"
  ADD CONSTRAINT "membership_property_scopes_property_id_fkey"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membership_property_scopes"
  ADD CONSTRAINT "membership_property_scopes_granted_by_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "granted_by_membership_id") REFERENCES "staff_memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "property_id" UUID,
  "actor_type" "AuditActorType" NOT NULL,
  "actor_id" VARCHAR(128) NOT NULL,
  "actor_membership_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "target_type" VARCHAR(64) NOT NULL,
  "target_id" VARCHAR(128) NOT NULL,
  "result" "AuditResult" NOT NULL DEFAULT 'SUCCEEDED',
  "aggregate_version" INTEGER,
  "previous_scope_version" INTEGER,
  "resulting_scope_version" INTEGER,
  "correlation_id" UUID NOT NULL,
  "changed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_actor_check"
    CHECK (
      ("actor_type" = 'STAFF' AND "actor_membership_id" IS NOT NULL)
      OR ("actor_type" = 'SYSTEM' AND "actor_membership_id" IS NULL)
    ),
  CONSTRAINT "audit_events_actor_id_check"
    CHECK (char_length(btrim("actor_id")) BETWEEN 1 AND 128),
  CONSTRAINT "audit_events_action_check"
    CHECK (char_length(btrim("action")) BETWEEN 1 AND 100),
  CONSTRAINT "audit_events_target_type_check"
    CHECK (char_length(btrim("target_type")) BETWEEN 1 AND 64),
  CONSTRAINT "audit_events_target_id_check"
    CHECK (char_length(btrim("target_id")) BETWEEN 1 AND 128),
  CONSTRAINT "audit_events_aggregate_version_check"
    CHECK ("aggregate_version" IS NULL OR "aggregate_version" > 0),
  CONSTRAINT "audit_events_scope_versions_check"
    CHECK (
      ("previous_scope_version" IS NULL AND "resulting_scope_version" IS NULL)
      OR ("previous_scope_version" IS NULL AND "resulting_scope_version" = 1)
      OR (
        "previous_scope_version" > 0
        AND "resulting_scope_version" = "previous_scope_version" + 1
      )
    ),
  CONSTRAINT "audit_events_changed_fields_check"
    CHECK (cardinality("changed_fields") <= 100)
);

CREATE INDEX "audit_events_tenant_id_occurred_at_id_idx"
  ON "audit_events"("tenant_id", "occurred_at", "id");
CREATE INDEX "audit_events_tenant_id_property_id_occurred_at_idx"
  ON "audit_events"("tenant_id", "property_id", "occurred_at");
CREATE INDEX "audit_events_tenant_id_actor_membership_id_occurred_at_idx"
  ON "audit_events"("tenant_id", "actor_membership_id", "occurred_at");
CREATE INDEX "audit_events_tenant_id_target_type_target_id_occurred_at_idx"
  ON "audit_events"("tenant_id", "target_type", "target_id", "occurred_at");
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_property_id_fkey"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_actor_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "staff_memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fail closed for every existing Tenant membership, then widen only one proven
-- active owner per Tenant. Platform memberships deliberately retain NULL scope.
UPDATE "staff_memberships"
SET "property_access_mode" = 'SELECTED_PROPERTIES',
    "property_scope_version" = 1
WHERE "tenant_id" IS NOT NULL;

WITH verified_owners AS (
  SELECT membership."id", membership."tenant_id"
  FROM "staff_memberships" membership
  JOIN "staff_membership_roles" assignment
    ON assignment."tenant_id" = membership."tenant_id"
   AND assignment."membership_id" = membership."id"
  JOIN "roles" role
    ON role."tenant_id" = assignment."tenant_id"
   AND role."id" = assignment."role_id"
  WHERE membership."status" = 'ACTIVE'
    AND role."scope" = 'TENANT'
    AND role."key" = 'TENANT_OWNER'
)
UPDATE "staff_memberships" membership
SET "property_access_mode" = 'ALL_PROPERTIES',
    "property_scope_version" = membership."property_scope_version" + 1
FROM verified_owners owner
WHERE membership."tenant_id" = owner."tenant_id"
  AND membership."id" = owner."id";

ALTER TABLE "staff_memberships"
  ADD CONSTRAINT "staff_memberships_property_scope_check"
  CHECK (
    ("tenant_id" IS NULL AND "property_access_mode" IS NULL AND "property_scope_version" IS NULL)
    OR (
      "tenant_id" IS NOT NULL
      AND "property_access_mode" IS NOT NULL
      AND "property_scope_version" IS NOT NULL
      AND "property_scope_version" > 0
    )
  );

CREATE INDEX "staff_memberships_tenant_id_property_access_mode_status_idx"
  ON "staff_memberships"("tenant_id", "property_access_mode", "status");

INSERT INTO "audit_events" (
  "tenant_id",
  "actor_type",
  "actor_id",
  "action",
  "target_type",
  "target_id",
  "result",
  "aggregate_version",
  "previous_scope_version",
  "resulting_scope_version",
  "correlation_id",
  "changed_fields"
)
SELECT
  membership."tenant_id",
  'SYSTEM',
  '20260812090000_property_foundation',
  'TENANT_OWNER_PROPERTY_SCOPE_BACKFILLED',
  'STAFF_MEMBERSHIP',
  membership."id"::TEXT,
  'SUCCEEDED',
  membership."property_scope_version",
  CASE WHEN membership."property_scope_version" > 1 THEN membership."property_scope_version" - 1 ELSE NULL END,
  membership."property_scope_version",
  'b24b6f66-69bb-4ef0-b3ef-0f8f2f0d0002'::UUID,
  ARRAY['propertyAccessMode', 'propertyScopeVersion']::TEXT[]
FROM "staff_memberships" membership
WHERE membership."tenant_id" IS NOT NULL
  AND membership."property_access_mode" = 'ALL_PROPERTIES';

COMMIT;
