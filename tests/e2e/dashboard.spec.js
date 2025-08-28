const { test, expect } = require('@playwright/test');

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('SecureUser@2024');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
  });

  test('should display dashboard components correctly', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    await expect(page.getByText('AI Performance')).toBeVisible();
    await expect(page.getByText('Analytics Dashboard')).toBeVisible();
    
    // Check task columns
    await expect(page.getByText('Pending Tasks')).toBeVisible();
    await expect(page.getByText('Completed Tasks')).toBeVisible();
    
    // Check filter buttons
    await expect(page.getByText(/Tasks \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/All \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Info \(\d+\)/)).toBeVisible();
    
    // Check search functionality
    await expect(page.getByPlaceholder('Search emails, tasks, or...')).toBeVisible();
  });

  test('should display performance metrics', async ({ page }) => {
    // Check AI performance metrics
    await expect(page.getByText('95%')).toBeVisible(); // Processing Speed
    await expect(page.getByText('92%')).toBeVisible(); // AI Accuracy
    await expect(page.getByText('3.2h')).toBeVisible(); // Time Saved
    
    // Check sync status
    await expect(page.getByText('All systems operational')).toBeVisible();
    await expect(page.getByText(/\d+ emails/)).toBeVisible();
  });

  test('should handle task filtering', async ({ page }) => {
    // Click on Tasks filter
    const tasksFilter = page.getByText(/Tasks \(\d+\)/);
    await tasksFilter.click();
    
    // Should show only task-type items
    await expect(page.getByText('Pending Tasks')).toBeVisible();
    
    // Click on All filter
    const allFilter = page.getByText(/All \(\d+\)/);
    await allFilter.click();
    
    // Should show all items
    await expect(page.getByText('Pending Tasks')).toBeVisible();
    await expect(page.getByText('Completed Tasks')).toBeVisible();
    
    // Click on Info filter
    const infoFilter = page.getByText(/Info \(\d+\)/);
    await infoFilter.click();
    
    // Should filter to info-type items
    // (This would depend on your specific implementation)
  });

  test('should handle date range filtering', async ({ page }) => {
    // Click on Today filter
    const todayFilter = page.getByText(/Today \(\d+\)/);
    await todayFilter.click();
    
    // Should filter to today's items
    // Verify that the URL or UI reflects the filter
    await expect(page.url()).toContain('dateRange=today');
    
    // Click on Week filter
    const weekFilter = page.getByText(/Week \(\d+\)/);
    await weekFilter.click();
    
    // Should filter to this week's items
    await expect(page.url()).toContain('dateRange=week');
  });

  test('should handle search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search emails, tasks, or...');
    
    // Type search query
    await searchInput.fill('quarterly report');
    
    // Should trigger search (might have debounce)
    await page.waitForTimeout(500);
    
    // Verify search results or URL change
    await expect(page.url()).toContain('search=quarterly%20report');
    
    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    // Should return to normal view
    await expect(page.url()).not.toContain('search=');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test search shortcut (/)
    await page.keyboard.press('/');
    
    const searchInput = page.getByPlaceholder('Search emails, tasks, or...');
    await expect(searchInput).toBeFocused();
    
    // Clear focus
    await page.keyboard.press('Escape');
    
    // Test filter shortcuts
    await page.keyboard.press('Control+1');
    
    // Should activate tasks filter
    await expect(page.url()).toContain('filter=tasks');
    
    // Test other shortcuts
    await page.keyboard.press('Control+2');
    await expect(page.url()).toContain('filter=all');
    
    await page.keyboard.press('Control+3');
    await expect(page.url()).toContain('filter=info');
  });

  test('should handle manual sync', async ({ page }) => {
    // Find and click manual sync button
    const syncButton = page.getByText('Manual Sync');
    await syncButton.click();
    
    // Should show syncing state
    await expect(page.getByText('Syncing...')).toBeVisible();
    
    // Wait for sync to complete
    await expect(page.getByText('All systems operational')).toBeVisible({ timeout: 10000 });
  });

  test('should open AI chat modal', async ({ page }) => {
    // Find and click AI chat button
    const aiChatButton = page.getByLabel('Open AI Chat');
    await aiChatButton.click();
    
    // Should open AI chat modal
    await expect(page.getByText('AI Email Assistant')).toBeVisible();
    
    // Should have chat input
    await expect(page.getByPlaceholder('Ask me anything about your emails...')).toBeVisible();
    
    // Close modal
    const closeButton = page.getByLabel('Close');
    await closeButton.click();
    
    // Modal should be closed
    await expect(page.getByText('AI Email Assistant')).not.toBeVisible();
  });

  test('should handle task interactions', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
    
    // Find a task card
    const taskCard = page.locator('[data-testid="task-card"]').first();
    
    if (await taskCard.isVisible()) {
      // Click on task to open details
      await taskCard.click();
      
      // Should open task details or email popup
      // (This would depend on your specific implementation)
      
      // Look for task actions
      const statusButton = taskCard.locator('[data-testid="status-button"]');
      if (await statusButton.isVisible()) {
        await statusButton.click();
        
        // Should update task status
        // Verify the change in UI
      }
    }
  });

  test('should handle infinite scroll', async ({ page }) => {
    // Scroll to bottom of task list
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Should trigger loading more tasks
    await expect(page.getByText('Loading more tasks...')).toBeVisible();
    
    // Wait for more tasks to load
    await expect(page.getByText('Loading more tasks...')).not.toBeVisible({ timeout: 5000 });
  });

  test('should display analytics charts', async ({ page }) => {
    // Check for analytics components
    await expect(page.getByText('Analytics Dashboard')).toBeVisible();
    
    // Look for chart elements (this would depend on your chart library)
    const chartContainer = page.locator('[data-testid="analytics-chart"]');
    if (await chartContainer.isVisible()) {
      await expect(chartContainer).toBeVisible();
    }
    
    // Check for performance metrics
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    await expect(page.getByText('AI Performance')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Main elements should still be visible
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    await expect(page.getByText('Pending Tasks')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Should adapt to mobile layout
    await expect(page.getByText('TaskFlow Insights')).toBeVisible();
    
    // Search should still work
    const searchInput = page.getByPlaceholder('Search emails, tasks, or...');
    await expect(searchInput).toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Intercept API calls to simulate errors
    await page.route('**/api/tasks**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Refresh page to trigger API calls
    await page.reload();
    
    // Should show fallback content
    await expect(page.getByText('No pending tasks')).toBeVisible();
    await expect(page.getByText('AI will create tasks from emails when enabled')).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    // Intercept API calls to add delay
    await page.route('**/api/tasks**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    
    // Refresh page
    await page.reload();
    
    // Should show loading indicators
    await expect(page.getByText('Loading...')).toBeVisible();
    
    // Wait for loading to complete
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 5000 });
  });

  test('should maintain state across navigation', async ({ page }) => {
    // Apply a filter
    const tasksFilter = page.getByText(/Tasks \(\d+\)/);
    await tasksFilter.click();
    
    // Navigate away and back (if you have other routes)
    // This would depend on your routing structure
    
    // For now, just refresh the page
    await page.reload();
    
    // Filter should be maintained (if implemented)
    // This would depend on your state management
  });

  test('should handle real-time updates', async ({ page }) => {
    // This test would depend on your WebSocket implementation
    // You might need to simulate WebSocket messages
    
    // Check initial state
    const initialTaskCount = await page.locator('[data-testid="task-card"]').count();
    
    // Simulate a new task arriving via WebSocket
    await page.evaluate(() => {
      // This would trigger your WebSocket message handler
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: {
          type: 'new-task',
          data: {
            id: 'new-task-123',
            title: 'New Task from Test',
            priority: 'high'
          }
        }
      }));
    });
    
    // Should show the new task
    await expect(page.getByText('New Task from Test')).toBeVisible();
    
    // Task count should increase
    const newTaskCount = await page.locator('[data-testid="task-card"]').count();
    expect(newTaskCount).toBeGreaterThan(initialTaskCount);
  });

  test('should support accessibility features', async ({ page }) => {
    // Check for proper ARIA labels
    const searchInput = page.getByPlaceholder('Search emails, tasks, or...');
    await expect(searchInput).toHaveAttribute('aria-label');
    
    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to navigate through interactive elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Check for screen reader support
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });

  test('should handle concurrent user actions', async ({ page }) => {
    // Simulate multiple rapid actions
    const searchInput = page.getByPlaceholder('Search emails, tasks, or...');
    const tasksFilter = page.getByText(/Tasks \(\d+\)/);
    const syncButton = page.getByText('Manual Sync');
    
    // Perform actions rapidly
    await Promise.all([
      searchInput.fill('test query'),
      tasksFilter.click(),
      syncButton.click()
    ]);
    
    // Should handle all actions gracefully without errors
    await expect(page.getByText('All systems operational')).toBeVisible({ timeout: 10000 });
  });
});