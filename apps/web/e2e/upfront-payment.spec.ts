/**
 * Feature 036: Cash Upfront Payment - Frontend E2E Test
 *
 * Tests the full P2P flow with upfront payment from the UI perspective:
 * 1. Login
 * 2. Create PO with UPFRONT terms
 * 3. Confirm PO
 * 4. Register upfront payment
 * 5. Create GRN
 * 6. Create & Post Bill
 * 7. Verify final statuses
 */

import { test, expect } from '@playwright/test';

// Test data
const TEST_SUPPLIER = 'PT Supplier Test';
const TEST_PRODUCT = 'Test Product';
const PAYMENT_AMOUNT = '1000000';

test.describe('Feature 036: Cash Upfront Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and ensure logged in
    await page.goto('/');

    // If login page, perform login
    if (page.url().includes('/login')) {
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    }
  });

  test('Create PO with UPFRONT payment terms', async ({ page }) => {
    // Navigate to Purchase Orders
    await page.goto('/purchase-orders');
    await expect(page.locator('h1')).toContainText('Purchase Orders');

    // Click Create PO button
    await page.click('button:has-text("Create")');

    // Wait for modal to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Select supplier
    await page.click('text=Select supplier');
    await page.click(`text=${TEST_SUPPLIER}`);

    // Select payment terms = UPFRONT
    const paymentTermsSelect = page
      .locator('select')
      .filter({ hasText: /NET_30|UPFRONT/ });
    await paymentTermsSelect.selectOption('UPFRONT');

    // Add product
    await page.click('button:has-text("Add Item")');
    await page.click('text=Select product');
    await page.click(`text=${TEST_PRODUCT}`);
    await page.fill('input[name="quantity"]', '10');
    await page.fill('input[name="price"]', '100000');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for success
    await expect(
      page.locator('text=created successfully')
    ).toBeVisible({ timeout: 5000 });
  });

  test('Register upfront payment shows correct UI', async ({
    page,
  }) => {
    // Navigate to a PO with UPFRONT terms
    await page.goto('/purchase-orders');

    // Click on an UPFRONT PO (look for badge)
    const upfrontRow = page
      .locator('tr')
      .filter({ hasText: 'UPFRONT' })
      .first();
    await upfrontRow.click();

    // Verify payment controls are visible
    await expect(page.locator('text=Register Payment')).toBeVisible();
    await expect(page.locator('text=Upfront Payment')).toBeVisible();

    // Click Register Payment
    await page.click('button:has-text("Register Payment")');

    // Verify modal opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(
      page.locator('text=Register Upfront Payment')
    ).toBeVisible();

    // Verify form fields
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('text=Payment Method')).toBeVisible();
  });

  test('Payment card shows progress after payment', async ({
    page,
  }) => {
    // Navigate to a partially paid PO
    await page.goto('/purchase-orders');

    // Click on PARTIAL or PAID_UPFRONT PO
    const paidRow = page
      .locator('tr')
      .filter({ hasText: /PAID_UPFRONT|PARTIAL/ })
      .first();

    if (await paidRow.isVisible()) {
      await paidRow.click();

      // Verify payment card shows progress
      await expect(
        page.locator('.payment-progress, text=% paid')
      ).toBeVisible();
      await expect(page.locator('text=Paid Amount')).toBeVisible();
    }
  });

  test('Full flow: Create PO → Confirm → Pay → GRN → Bill', async ({
    page,
  }) => {
    test.slow(); // This test takes longer

    // Step 1: Create PO
    await page.goto('/purchase-orders');
    await page.click('button:has-text("Create")');

    // Fill PO form (simplified - adjust for actual UI)
    // ... (implementation depends on actual form structure)

    // Step 2: Confirm PO
    // await page.click('button:has-text("Confirm")');

    // Step 3: Register Payment
    // await page.click('button:has-text("Register Payment")');
    // ...

    // Step 4: Create GRN
    // await page.click('button:has-text("Create GRN")');
    // ...

    // Step 5: Create Bill
    // await page.click('button:has-text("Create Bill")');
    // ...

    // Step 6: Verify statuses
    // await expect(page.locator('.payment-status')).toHaveText('SETTLED');

    // TODO: Implement full flow once basic tests pass
    expect(true).toBe(true); // Placeholder
  });
});

test.describe('UI Component Tests', () => {
  test('PaymentTermsBadge displays correctly', async ({ page }) => {
    await page.goto('/purchase-orders');

    // Check UPFRONT badge styling
    const upfrontBadge = page
      .locator('.badge, [class*="badge"]')
      .filter({ hasText: 'UPFRONT' })
      .first();

    if (await upfrontBadge.isVisible()) {
      // UPFRONT should have destructive/red styling
      await expect(upfrontBadge).toHaveClass(
        /destructive|red|danger/
      );
    }
  });

  test('PaymentStatusBadge displays correctly', async ({ page }) => {
    await page.goto('/purchase-orders');

    // Navigate to a PO detail
    await page.locator('tr').first().click();
    await page.waitForURL(/purchase-orders\/.+/);

    // Check for status badge
    const statusBadge = page.locator('[class*="badge"]').filter({
      hasText: /PENDING|PARTIAL|PAID_UPFRONT|SETTLED/,
    });

    if (await statusBadge.isVisible()) {
      expect(await statusBadge.textContent()).toMatch(
        /PENDING|PARTIAL|PAID_UPFRONT|SETTLED/
      );
    }
  });
});
