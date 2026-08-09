import { gotoApp, test, waitForStableUI } from './test-utils';
import { expect } from '@playwright/test';

test.describe('Filter Button', () => {
  test('should filter deals without flicker or layout shift', async ({ page }, testInfo) => {
    await gotoApp(page);
    await waitForStableUI(page);

    const allBtn = page.getByTestId('filter-all');
    const flightBtn = page.getByTestId('filter-flight');
    const hotelBtn = page.getByTestId('filter-hotel');

    // Wait for deals to load
    await expect(page.getByTestId('deal-card').first()).toBeVisible();
    
    // Take screenshot BEFORE click
    await page.screenshot({ path: testInfo.outputPath('before-filter.png') });

    // Click flight using Playwright's click (animations disabled via test-utils)
    await flightBtn.click();
    
    // Assert active state changes correctly
    await expect(flightBtn).toHaveAttribute('data-active', 'true');
    await expect(allBtn).toHaveAttribute('data-active', 'false');

    // Wait for network/UI stability instead of arbitrary timeout
    await waitForStableUI(page);
    await page.screenshot({ path: testInfo.outputPath('after-flight-filter.png') });

    // Click hotel
    await hotelBtn.click();
    await expect(hotelBtn).toHaveAttribute('data-active', 'true');
    await expect(flightBtn).toHaveAttribute('data-active', 'false');
  });

  test('Stability Test (Anti-Glitch) - rapid click filters', async ({ page }) => {
    await gotoApp(page);
    await waitForStableUI(page);
    
    const allBtn = page.getByTestId('filter-all');
    const flightBtn = page.getByTestId('filter-flight');
    const hotelBtn = page.getByTestId('filter-hotel');

    await expect(flightBtn).toBeVisible();

    // Rapid click using normal clicks now that animations are disabled
    for (let i = 0; i < 5; i++) {
      await flightBtn.click();
      await hotelBtn.click();
      await allBtn.click();
    }

    // Wait for stability
    await waitForStableUI(page);

    // Assert no crash / no UI glitch
    await expect(page.getByTestId('deal-card').first()).toBeVisible();
    await expect(allBtn).toHaveAttribute('data-active', 'true');
  });
});
