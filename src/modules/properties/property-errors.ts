export const PROPERTY_VALIDATION_ERROR_MESSAGE = 'Property input is invalid.';
export const PROPERTY_NOT_FOUND_ERROR_MESSAGE = 'Property not found.';
export const PROPERTY_CONFLICT_ERROR_MESSAGE = 'Property could not be changed.';

export type PropertyErrorCode =
  'PROPERTY_VALIDATION_FAILED' | 'PROPERTY_NOT_FOUND' | 'PROPERTY_CONFLICT';

export abstract class PropertyError extends Error {
  abstract readonly code: PropertyErrorCode;
}

export class PropertyValidationError extends PropertyError {
  readonly code = 'PROPERTY_VALIDATION_FAILED' as const;

  constructor() {
    super(PROPERTY_VALIDATION_ERROR_MESSAGE);
    this.name = 'PropertyValidationError';
  }
}

export class PropertyNotFoundError extends PropertyError {
  readonly code = 'PROPERTY_NOT_FOUND' as const;

  constructor() {
    super(PROPERTY_NOT_FOUND_ERROR_MESSAGE);
    this.name = 'PropertyNotFoundError';
  }
}

export class PropertyConflictError extends PropertyError {
  readonly code = 'PROPERTY_CONFLICT' as const;

  constructor() {
    super(PROPERTY_CONFLICT_ERROR_MESSAGE);
    this.name = 'PropertyConflictError';
  }
}

export function isPropertyError(error: unknown): error is PropertyError {
  return error instanceof PropertyError;
}
