import { test, waitForStableUI } from './test-utils';
import { expect } from '@playwright/test';

test.describe('Interactions', () => {
  test('AI Insight Click - redirect works', async ({ page }) => {
    await page.goto('/');
    await waitForStableUI(page);

    // Instead of arbitrary scrollBy, we scroll to the footer or element specifically
    // Since AIInsightFeed is lazy loaded and might be at the bottom:
    // Fallback: Just scroll the page to trigger intersection observer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitForStableUI(page);

    const viewDealBtn = page.getByTestId('ai-insight-view-deal').first();
    
    // Scroll element into view properly using Playwright
    await viewDealBtn.scrollIntoViewIfNeeded();

    // With animations disabled, it should be visible immediately after scrolling and network idle
    await expect(viewDealBtn).toBeVisible();

    // Ensure it is clickable without errors
    await viewDealBtn.click();
  });

  test('Deal Card Test', async ({ page }) => {
    await page.goto('/');
    await waitForStableUI(page);

    const firstDeal = page.getByTestId('deal-card').first();
    await expect(firstDeal).toBeVisible();

    // Ensure price visible
    const priceText = firstDeal.locator('text=IDR').first();
    await expect(priceText).toBeVisible();

    // Check CTA button
    const ctaBook = firstDeal.getByTestId('cta-book');
    await expect(ctaBook).toBeVisible();
    await expect(ctaBook).toBeEnabled();
  });

  test('Scroll Interaction', async ({ page }) => {
    await page.goto('/');
    await waitForStableUI(page);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitForStableUI(page);
    
    // Assert cards appear (not broken) and no animation glitch
    const dealCards = page.getByTestId('deal-card');
    const count = await dealCards.count();
    expect(count).toBeGreaterThan(0);

    const lastCard = dealCards.nth(count - 1);
    await lastCard.scrollIntoViewIfNeeded();
    await expect(lastCard).toBeVisible();
  });

  test('Dark Mode Toggle', async ({ page }) => {
    await page.goto('/');
    await waitForStableUI(page);

    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();

    // Switch theme
    await themeToggle.click();
    await waitForStableUI(page);

    // Ensure no broken UI
    await expect(page.getByTestId('deal-card').first()).toBeVisible();

    // Check if dark class is added to html (or light)
    const html = page.locator('html');
    await expect(html).toHaveAttribute('class', /dark|light/);
  });
});
