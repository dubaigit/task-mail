import { test, expect } from '@playwright/test';

test('login form', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Task-First Email Manager/);

  // create a locator
  const email = page.locator('input[name="email"]');
  const password = page.locator('input[name="password"]');
  const submit = page.locator('button[type="submit"]');

  // set the email and password
  await email.fill('demo@example.com');
  await password.fill('demo123');

  // click the submit button
  await submit.click();

  // expect the url to be /tasks
  await expect(page).toHaveURL('http://localhost:3000/tasks');
});
