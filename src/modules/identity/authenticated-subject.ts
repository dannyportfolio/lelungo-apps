import 'server-only';

export interface AuthenticatedSubject {
  readonly userId: string;
}

export interface AuthenticatedSubjectProvider {
  getAuthenticatedSubject(): Promise<AuthenticatedSubject | null>;
}

export class UnauthenticatedError extends Error {
  readonly code = 'UNAUTHENTICATED';

  constructor() {
    super('Authentication is required.');
    this.name = 'UnauthenticatedError';
  }
}

export class AuthenticationConfigurationError extends Error {
  readonly code = 'AUTHENTICATION_CONFIGURATION_ERROR';

  constructor() {
    super('Authentication is unavailable.');
    this.name = 'AuthenticationConfigurationError';
  }
}
