import { describe, expect, it } from 'vitest';

import {
  TestDatabaseConfigurationError,
  validateTestDatabaseEnvironment,
} from '../../integration/support/test-database';

describe('integration test database preflight', () => {
  it('accepts a PostgreSQL URL with an explicit test database name', () => {
    expect(
      validateTestDatabaseEnvironment({
        TEST_DATABASE_URL:
          'postgresql://integration:secret@localhost:5432/lelungo_integration_test',
        DATABASE_URL: 'postgresql://application:secret@localhost:5432/lelungo_application',
      }),
    ).toEqual({
      databaseUrl: 'postgresql://integration:secret@localhost:5432/lelungo_integration_test',
      databaseName: 'lelungo_integration_test',
    });
  });

  it('requires TEST_DATABASE_URL instead of silently skipping', () => {
    expect(() => validateTestDatabaseEnvironment({})).toThrow(
      new TestDatabaseConfigurationError(
        'TEST_DATABASE_URL is required for PostgreSQL integration tests.',
      ),
    );
  });

  it.each([
    ['non-PostgreSQL protocol', 'mysql://localhost/lelungo_test'],
    ['malformed URL', 'not-a-url'],
    ['missing database name', 'postgresql://localhost'],
    ['non-test database name', 'postgresql://localhost/lelungo_production'],
    ['test substring without a standalone marker', 'postgresql://localhost/contest_data'],
  ])('rejects a %s', (_caseName, testDatabaseUrl) => {
    expect(() => validateTestDatabaseEnvironment({ TEST_DATABASE_URL: testDatabaseUrl })).toThrow(
      TestDatabaseConfigurationError,
    );
  });

  it('rejects the application database even when credentials and URL options differ', () => {
    expect(() =>
      validateTestDatabaseEnvironment({
        TEST_DATABASE_URL:
          'postgres://integration:other-secret@LOCALHOST/lelungo_test?schema=test_runner',
        DATABASE_URL: 'postgresql://application:secret@localhost:5432/lelungo_test?schema=public',
      }),
    ).toThrow('must not target the same PostgreSQL database');
  });

  it('does not include connection values in configuration failures', () => {
    const secretBearingUrl = 'mysql://user:super-secret@database.internal/lelungo_test';

    try {
      validateTestDatabaseEnvironment({ TEST_DATABASE_URL: secretBearingUrl });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(String(error)).not.toContain(secretBearingUrl);
      expect(String(error)).not.toContain('super-secret');
    }
  });
});
