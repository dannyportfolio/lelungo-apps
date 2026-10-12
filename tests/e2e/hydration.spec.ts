import { gotoApp, test } from './test-utils';
import { expect } from '@playwright/test';

test.describe('Hydration Mismatch Defense', () => {
  test('should not have any hydration errors on the homepage with non-US locale', async ({ page, context }) => {
    // Note: The global test wrapper already catches and throws on hydration errors,
    // so we just need to load the page and wait for it to be stable.
    
    // Simulate non-US locale where `toLocaleString` might output differently
    await context.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9',
    });

    await gotoApp(page);

    // If we reached here without the global error handler throwing, the test passes.
    expect(true).toBe(true);
  });
});
