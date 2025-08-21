import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await expect(page).toHaveTitle(/Task-First Email Manager/);
});

