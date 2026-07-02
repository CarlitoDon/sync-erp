import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('should display hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Sync ERP');
  });

  test('should have CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Mulai pakai Sync ERP')).toBeVisible();
    await expect(page.getByText('Lihat modul')).toBeVisible();
  });
});
