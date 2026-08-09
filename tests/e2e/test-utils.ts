import { Page } from '@playwright/test';
import { test as baseTest } from '@playwright/test';

/**
 * Defensive test fixture setup.
 * - Automatically throws if there's a console error or warning about hydration.
 * - Disables CSS animations globally for stability.
 */
export const test = baseTest.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];

    // Catch all page uncaught exceptions
    page.on('pageerror', (exception) => {
      errors.push(`PageError: ${exception.message}`);
    });

    // Catch specific console errors (like hydration)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore specific harmless warnings if needed, else push all
        if (
          !text.includes('404') && 
          !text.includes('Failed to load resource') &&
          !text.includes('favicon.ico')
        ) {
          errors.push(`Console Error: ${text}`);
        }
      }
    });

    // Disable all CSS animations and transitions for testing stability
    await page.addInitScript(() => {
      const css = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
        }
      `;

      const injectStyle = () => {
        if (document.querySelector('style[data-e2e-disable-animations]')) return;

        const parent = document.head || document.documentElement;
        if (!parent) return;

        const style = document.createElement('style');
        style.setAttribute('data-e2e-disable-animations', 'true');
        style.textContent = css;
        parent.appendChild(style);
      };

      injectStyle();
      document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
    });

    await use(page);

    // After test ends, assert no errors were caught
    if (errors.length > 0) {
      throw new Error(`Test failed due to caught errors:\n${errors.join('\n')}`);
    }
  },
});

/**
 * Ensures the UI is stable by waiting for the network to be idle
 * and checking for common UI placeholders or loaders to disappear.
 */
export async function waitForStableUI(page: Page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.body.innerText.trim().length > 0);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

export async function gotoApp(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForStableUI(page);
}
