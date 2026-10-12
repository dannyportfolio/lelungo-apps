import { gotoApp, test } from './test-utils';
import { expect } from '@playwright/test';

test.describe('Homepage Load', () => {
  test('should load without console errors and hero section is visible', async ({ page }) => {
    await gotoApp(page);

    // Ensure hero section visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    
    const searchDeals = page.getByText('Search Deals').first();
    await expect(searchDeals).toBeVisible();
  });
});
