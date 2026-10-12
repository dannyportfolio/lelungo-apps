# Rollback

Trigger rollback for severe availability, authorization, tenant-isolation, corruption, or critical-regression signals. Stop further rollout, preserve logs, and identify application versus data impact.

If schema is backward-compatible, restore the previous application artifact. If data/schema changed, do not edit or reverse an applied migration blindly: disable affected writes, restore from verified backup only under incident control, or deploy a reviewed forward-fix migration. Re-run smoke and isolation checks and document the incident.

For Phase 2, first disable `/staff/properties`, `/staff/property-access`, their Server Actions, and—if public projection safety is involved—the published Property resolver. Preserve Property, address, amenity, membership-scope, and audit rows. Do not hard-delete archived Properties or audit evidence as rollback.

The Phase 2 migration makes `tenant_id` mandatory on the Tenant role-assignment path, so verify an older application artifact is schema-compatible before promotion; otherwise keep the current compatible foundation and disable only the affected Phase 2 surfaces. Correct role/scope/backfill or constraint defects with a reviewed forward migration after backup and reconciliation. A rollback is complete only after authentication, tenant-host resolution, cross-Tenant denial, Property-scope denial, and retained-data reads are smoke-tested and recorded.
