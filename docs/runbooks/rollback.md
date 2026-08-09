# Rollback

Trigger rollback for severe availability, authorization, tenant-isolation, corruption, or critical-regression signals. Stop further rollout, preserve logs, and identify application versus data impact.

If schema is backward-compatible, restore the previous application artifact. If data/schema changed, do not edit or reverse an applied migration blindly: disable affected writes, restore from verified backup only under incident control, or deploy a reviewed forward-fix migration. Re-run smoke and isolation checks and document the incident.
