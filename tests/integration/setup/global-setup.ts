import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { validateTestDatabaseEnvironment } from '../support/test-database';

export default function setupIntegrationDatabase(): void {
  const testDatabase = validateTestDatabaseEnvironment({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  if (process.env.DATABASE_URL !== testDatabase.databaseUrl) {
    throw new Error(
      'Integration database preflight was not installed by the Vitest configuration.',
    );
  }

  const prismaCli = resolve(process.cwd(), 'node_modules/prisma/build/index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabase.databaseUrl,
    },
    stdio: 'inherit',
  });
}
