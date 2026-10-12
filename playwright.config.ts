import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const devServerPort = new URL(baseURL).port || '3000';
const builtInAuthenticationProviderURL = 'http://127.0.0.1:54329';
const authenticationProviderURL = process.env.E2E_SUPABASE_URL || builtInAuthenticationProviderURL;
const nodeExecutable = `"${process.execPath}"`;
const applicationServerCommand =
  process.env.PLAYWRIGHT_USE_PRODUCTION_SERVER === 'true'
    ? `${nodeExecutable} ./node_modules/next/dist/bin/next start -p ${devServerPort}`
    : `${nodeExecutable} ./node_modules/next/dist/bin/next dev -p ${devServerPort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry twice (both CI and local, or you can condition it on CI) */
  retries: 2,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Run headless in CI, but not locally */
    headless: !!process.env.CI,

    /* Collect trace always on failure. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',

    /* Take screenshots on failure */
    screenshot: 'only-on-failure',

    /* Retain video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // We can add Firefox and WebKit later if needed
  ],

  /* Run a local application server before starting the tests. */
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true'
      ? undefined
      : {
          command: applicationServerCommand,
          port: Number(devServerPort),
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          env: {
            NEXT_PUBLIC_SUPABASE_URL: authenticationProviderURL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_PUBLIC_KEY || 'e2e-public-key',
            LELUNGO_ENABLE_LOCAL_TENANT_HOSTS: 'true',
            ...(process.env.TEST_DATABASE_URL
              ? { DATABASE_URL: process.env.TEST_DATABASE_URL }
              : {}),
          },
        },
});
