export const PROPERTY_AUDIT_CHANGED_FIELDS = [
  'name',
  'slug',
  'classificationKey',
  'timezone',
  'shortDescription',
  'publicWhatsAppE164',
  'address.line1',
  'address.line2',
  'address.locality',
  'address.adminArea',
  'address.postalCode',
  'address.countryCode',
  'amenityIds',
  'lifecycleStatus',
  'publishedAt',
  'deactivatedAt',
  'archivedAt',
] as const;

export type PropertyAuditChangedField = (typeof PROPERTY_AUDIT_CHANGED_FIELDS)[number];

export const PROPERTY_SCOPE_AUDIT_CHANGED_FIELDS = [
  'propertyAccessMode',
  'selectedPropertySet',
  'propertyGrant',
  'propertyScopeVersion',
] as const;

export type PropertyScopeAuditChangedField = (typeof PROPERTY_SCOPE_AUDIT_CHANGED_FIELDS)[number];

export type AuditMetadata =
  | {
      kind: 'PROPERTY_CHANGE';
      changedFields: readonly PropertyAuditChangedField[];
    }
  | {
      kind: 'PROPERTY_SCOPE_CHANGE';
      changedFields: readonly PropertyScopeAuditChangedField[];
      previousScopeVersion: number;
      resultingScopeVersion: number;
    };

function requireAllowlistedFields<Field extends string>(
  fields: readonly string[],
  allowlist: readonly Field[],
): readonly Field[] {
  const allowed = new Set<string>(allowlist);

  if (fields.some((field) => !allowed.has(field))) {
    throw new TypeError('Audit metadata contains an unsupported changed field.');
  }

  return [...new Set(fields)].sort() as Field[];
}

export function createPropertyAuditMetadata(
  changedFields: readonly string[],
): Extract<AuditMetadata, { kind: 'PROPERTY_CHANGE' }> {
  return {
    kind: 'PROPERTY_CHANGE',
    changedFields: requireAllowlistedFields(changedFields, PROPERTY_AUDIT_CHANGED_FIELDS),
  };
}

export function createPropertyScopeAuditMetadata(input: {
  changedFields: readonly string[];
  previousScopeVersion: number;
  resultingScopeVersion: number;
}): Extract<AuditMetadata, { kind: 'PROPERTY_SCOPE_CHANGE' }> {
  if (
    !Number.isSafeInteger(input.previousScopeVersion) ||
    input.previousScopeVersion < 1 ||
    !Number.isSafeInteger(input.resultingScopeVersion) ||
    input.resultingScopeVersion !== input.previousScopeVersion + 1
  ) {
    throw new TypeError('Audit scope versions must describe exactly one positive version advance.');
  }

  return {
    kind: 'PROPERTY_SCOPE_CHANGE',
    changedFields: requireAllowlistedFields(
      input.changedFields,
      PROPERTY_SCOPE_AUDIT_CHANGED_FIELDS,
    ),
    previousScopeVersion: input.previousScopeVersion,
    resultingScopeVersion: input.resultingScopeVersion,
  };
}
