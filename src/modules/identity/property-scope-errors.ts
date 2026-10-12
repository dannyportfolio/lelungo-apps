export const PROPERTY_SCOPE_CONFLICT_MESSAGE =
  'The property access scope changed. Refresh and try again.';

export class PropertyScopeConflictError extends Error {
  readonly code = 'PROPERTY_SCOPE_CONFLICT';

  constructor() {
    super(PROPERTY_SCOPE_CONFLICT_MESSAGE);
    this.name = 'PropertyScopeConflictError';
  }
}

export const PROPERTY_SCOPE_INVALID_MESSAGE = 'The property access change is invalid.';

export class PropertyScopeValidationError extends Error {
  readonly code = 'PROPERTY_SCOPE_INVALID';

  constructor() {
    super(PROPERTY_SCOPE_INVALID_MESSAGE);
    this.name = 'PropertyScopeValidationError';
  }
}
