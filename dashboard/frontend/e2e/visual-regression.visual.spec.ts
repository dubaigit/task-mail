import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('should match main interface layout', async ({ page }) => {
    // Wait for content to load
    await page.waitForSelector('[data-testid="modern-email-interface"]', { timeout: 10000 });
    
    // Hide dynamic content that changes between runs
    await page.addStyleTag({
      content: `
        [data-testid="current-time"],
        [data-testid="unread-count"],
        .timestamp {
          visibility: hidden !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('main-interface.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match task view layout', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for Kanban board to render
    await page.waitForSelector('[data-testid="kanban-column-todo"]', { timeout: 10000 });
    
    await expect(page.getByTestId('task-view')).toHaveScreenshot('task-view.png', {
      threshold: 0.1,
    });
  });

  test('should match email view layout', async ({ page }) => {
    await page.getByTestId('view-toggle-email').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for email list to render
    await page.waitForSelector('[data-testid="email-list"]', { timeout: 10000 });
    
    await expect(page.getByTestId('email-view')).toHaveScreenshot('email-view.png', {
      threshold: 0.1,
    });
  });

  test('should match dark mode interface', async ({ page }) => {
    // Toggle dark mode
    const darkModeToggle = page.getByTestId('dark-mode-toggle');
    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
      
      await expect(page).toHaveScreenshot('dark-mode-interface.png', {
        fullPage: true,
        threshold: 0.15, // Slightly higher threshold for dark mode
      });
    }
  });

  test('should match mobile viewport layout', async ({ page, browserName }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('[data-testid="modern-email-interface"]', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot(`mobile-interface-${browserName}.png`, {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match task detail panel', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    await page.waitForSelector('[data-testid^="task-card-"]', { timeout: 10000 });
    
    // Click on first task to open detail panel
    const firstTask = page.getByTestId('task-card').first();
    if (await firstTask.count() > 0) {
      await firstTask.click();
      await page.waitForSelector('[data-testid="task-detail-panel"]', { timeout: 5000 });
      
      await expect(page.getByTestId('task-detail-panel')).toHaveScreenshot('task-detail-panel.png', {
        threshold: 0.1,
      });
    }
  });

  test('should match Kanban column states', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    await page.waitForSelector('[data-testid="kanban-column-todo"]', { timeout: 10000 });
    
    // Screenshot each column individually
    const columns = ['todo', 'in-progress', 'waiting-for-reply', 'done'];
    
    for (const column of columns) {
      const columnElement = page.getByTestId(`kanban-column-${column}`);
      if (await columnElement.count() > 0) {
        await expect(columnElement).toHaveScreenshot(`kanban-column-${column}.png`, {
          threshold: 0.1,
        });
      }
    }
  });

  test('should match loading states', async ({ page }) => {
    // Intercept API calls to simulate loading
    await page.route('**/api/emails**', route => {
      // Delay response to capture loading state
      setTimeout(() => route.continue(), 2000);
    });
    
    await page.goto('/');
    
    // Screenshot loading state
    await expect(page.locator('[data-testid="loading-spinner"], .loading')).toHaveScreenshot('loading-state.png', {
      threshold: 0.1,
    });
  });

  test('should match empty states', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/emails**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('empty-state.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match error states', async ({ page }) => {
    // Mock error response
    await page.route('**/api/emails**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for error state to appear
    await page.waitForSelector('[data-testid="error-message"], .error-state', { timeout: 10000 });
    
    await expect(page).toHaveScreenshot('error-state.png', {
      fullPage: true,
      threshold: 0.1,
    });
  });

  test('should match high contrast mode', async ({ page, context }) => {
    // Simulate high contrast preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-contrast: high'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('high-contrast-mode.png', {
      fullPage: true,
      threshold: 0.2, // Higher threshold for contrast differences
    });
  });
});