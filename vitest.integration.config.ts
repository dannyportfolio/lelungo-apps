import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

import { validateTestDatabaseEnvironment } from './tests/integration/support/test-database';

const testDatabase = validateTestDatabaseEnvironment({
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
});

// Prisma reads DATABASE_URL. This assignment is scoped to the integration Vitest process,
// after the destructive target has passed the explicit test-database preflight.
process.env.DATABASE_URL = testDatabase.databaseUrl;

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./tests/integration/support/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./tests/integration/setup/global-setup.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
