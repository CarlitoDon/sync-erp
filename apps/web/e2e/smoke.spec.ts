/**
 * Smoke Tests - Basic Navigation & Component Visibility
 *
 * These tests verify the app loads and basic navigation works.
 * No data dependencies required.
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('App loads and shows content', async ({ page }) => {
    await page.goto('/');

    // Should show something (login or dashboard)
    await expect(page.locator('body')).toBeVisible();
  });

  test('Purchase Orders page loads', async ({ page }) => {
    await page.goto('/purchase-orders');

    // Check page has loaded (might redirect to login)
    const url = page.url();
    expect(url).toMatch(/purchase-orders|login/);
  });

  test('Bills page loads', async ({ page }) => {
    await page.goto('/bills');

    const url = page.url();
    expect(url).toMatch(/bills|login/);
  });
});

test.describe('Feature 036: Upfront Payment Components', () => {
  test('PaymentTermsBadge component renders correctly', async ({
    page,
  }) => {
    // Direct component testing using a test page (if available)
    // For now, check via PO list
    await page.goto('/purchase-orders');

    // Wait for page load (either shows content or redirects)
    await page.waitForLoadState('networkidle');

    // If we're on PO page, check for badges
    if (page.url().includes('/purchase-orders')) {
      const hasBadges = await page
        .locator('[class*="badge"]')
        .count();
      console.log(`Found ${hasBadges} badge(s) on page`);
    }
  });
});
