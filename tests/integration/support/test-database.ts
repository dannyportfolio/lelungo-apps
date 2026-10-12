const POSTGRESQL_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const EXPLICIT_TEST_DATABASE_NAME = /(?:^|[_-])(?:test|tests|testing)(?:$|[_-])/i;

export interface TestDatabaseEnvironment {
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
}

export interface ValidatedTestDatabase {
  databaseUrl: string;
  databaseName: string;
}

export class TestDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestDatabaseConfigurationError';
  }
}

function parsePostgresqlUrl(value: string, variableName: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new TestDatabaseConfigurationError(
      `${variableName} must be a valid PostgreSQL connection URL.`,
    );
  }

  if (!POSTGRESQL_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
    throw new TestDatabaseConfigurationError(
      `${variableName} must be a valid PostgreSQL connection URL.`,
    );
  }

  return parsed;
}

function readDatabaseName(parsed: URL, variableName: string): string {
  const encodedName = parsed.pathname.replace(/^\/+/, '');
  let databaseName: string;

  try {
    databaseName = decodeURIComponent(encodedName);
  } catch {
    throw new TestDatabaseConfigurationError(
      `${variableName} must identify one explicit PostgreSQL database.`,
    );
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new TestDatabaseConfigurationError(
      `${variableName} must identify one explicit PostgreSQL database.`,
    );
  }

  return databaseName;
}

function databaseTarget(parsed: URL, databaseName: string): string {
  const port = parsed.port || '5432';
  return `${parsed.hostname.toLowerCase()}:${port}/${databaseName.toLowerCase()}`;
}

/**
 * Validates the destructive integration-test boundary without logging either URL.
 * The caller may map the returned URL to DATABASE_URL only for the test process.
 */
export function validateTestDatabaseEnvironment(
  environment: TestDatabaseEnvironment,
): Readonly<ValidatedTestDatabase> {
  const testDatabaseUrl = environment.TEST_DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    throw new TestDatabaseConfigurationError(
      'TEST_DATABASE_URL is required for PostgreSQL integration tests.',
    );
  }

  const parsedTestUrl = parsePostgresqlUrl(testDatabaseUrl, 'TEST_DATABASE_URL');
  const databaseName = readDatabaseName(parsedTestUrl, 'TEST_DATABASE_URL');

  if (!EXPLICIT_TEST_DATABASE_NAME.test(databaseName)) {
    throw new TestDatabaseConfigurationError(
      'TEST_DATABASE_URL database name must contain a standalone test marker.',
    );
  }

  const applicationDatabaseUrl = environment.DATABASE_URL?.trim();

  if (applicationDatabaseUrl) {
    const parsedApplicationUrl = parsePostgresqlUrl(applicationDatabaseUrl, 'DATABASE_URL');
    const applicationDatabaseName = readDatabaseName(parsedApplicationUrl, 'DATABASE_URL');

    if (
      databaseTarget(parsedTestUrl, databaseName) ===
      databaseTarget(parsedApplicationUrl, applicationDatabaseName)
    ) {
      throw new TestDatabaseConfigurationError(
        'TEST_DATABASE_URL must not target the same PostgreSQL database as DATABASE_URL.',
      );
    }
  }

  return Object.freeze({ databaseUrl: testDatabaseUrl, databaseName });
}
