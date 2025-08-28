const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
  });

  test('should display login form correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Task Mail/);
    
    // Check main heading
    await expect(page.getByText('Task Mail')).toBeVisible();
    await expect(page.getByText('AI-Powered Email Management')).toBeVisible();
    
    // Check form elements
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    
    // Check demo credentials section
    await expect(page.getByText('Demo Credentials:')).toBeVisible();
    await expect(page.getByText('Email: user@example.com')).toBeVisible();
    await expect(page.getByText('Password: SecureUser@2024')).toBeVisible();
    await expect(page.getByText('Use demo credentials')).toBeVisible();
  });

  test('should auto-fill demo credentials', async ({ page }) => {
    // Click demo credentials button
    await page.getByText('Use demo credentials').click();
    
    // Check that fields are filled
    await expect(page.getByLabel('Email')).toHaveValue('user@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('SecureUser@2024');
  });

  test('should login successfully with demo credentials', async ({ page }) => {
    // Fill in demo credentials
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    
    // Click sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Should see dashboard elements
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    await expect(page.getByText('Pending Tasks')).toBeVisible();
    await expect(page.getByText('Completed Tasks')).toBeVisible();
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    // Fill invalid email
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('SecureUser@2024');
    
    // Try to submit
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show validation error
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('should show validation errors for short password', async ({ page }) => {
    // Fill short password
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('123');
    
    // Try to submit
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show validation error
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should handle login failure gracefully', async ({ page }) => {
    // Fill wrong credentials
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    
    // Try to submit
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show error message
    await expect(page.getByText(/Invalid credentials/)).toBeVisible();
    
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show loading state during login', async ({ page }) => {
    // Fill credentials
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    
    // Click sign in and immediately check loading state
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await signInButton.click();
    
    // Should show loading state (might be brief)
    await expect(page.getByText('Signing in...')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  });

  test('should submit form with Enter key', async ({ page }) => {
    // Fill credentials
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    
    // Press Enter in password field
    await page.getByLabel('Password').press('Enter');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should maintain session after page refresh', async ({ page }) => {
    // Login first
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Find and click logout button (this depends on your UI implementation)
    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.getByText('Logout').click();
    } else {
      // Alternative: look for logout button in header/nav
      await page.getByRole('button', { name: 'Logout' }).click();
    }
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Task Mail')).toBeVisible();
  });

  test('should handle session expiration', async ({ page }) => {
    // Login first
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Simulate session expiration by clearing localStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access a protected resource
    await page.reload();
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('http://localhost:3000/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Task Mail')).toBeVisible();
  });

  test('should handle network errors during login', async ({ page }) => {
    // Intercept login request and make it fail
    await page.route('**/api/auth/login', route => {
      route.abort('failed');
    });
    
    // Try to login
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show network error
    await expect(page.getByText(/Network error/)).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that login form is still usable
    await expect(page.getByText('Task Mail')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    
    // Demo credentials should still work
    await page.getByText('Use demo credentials').click();
    await expect(page.getByLabel('Email')).toHaveValue('user@example.com');
    await expect(page.getByLabel('Password')).toHaveValue('SecureUser@2024');
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check ARIA labels and roles
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(submitButton).toHaveAttribute('type', 'submit');
    
    // Check for proper form structure
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });
});