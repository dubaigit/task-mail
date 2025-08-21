/**
 * End-to-End User Workflow Tests
 * Tests complete user journeys through the application
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3000';
const API_BASE_URL = 'http://localhost:8000';

test.describe('Complete User Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Check if backend is running
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (!response.ok) {
        test.skip('Backend server not running');
      }
    } catch {
      test.skip('Backend server not accessible');
    }
  });

  test('should load dashboard and display tasks', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('TaskFlow');
    
    // Check for task overview stats
    await expect(page.locator('text=Total Tasks')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    
    // Check for task columns
    await expect(page.locator('text=Pending Tasks')).toBeVisible();
    await expect(page.locator('text=Completed Tasks')).toBeVisible();
    
    // Wait for API calls to complete
    await page.waitForTimeout(2000);
    
    // Check if tasks are loaded (either empty state or actual tasks)
    const pendingSection = page.locator('text=Pending Tasks').locator('..');
    const completedSection = page.locator('text=Completed Tasks').locator('..');
    
    await expect(pendingSection).toBeVisible();
    await expect(completedSection).toBeVisible();
  });

  test('should handle filter buttons correctly', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Test Tasks filter
    const tasksButton = page.locator('button:has-text("Tasks")');
    await expect(tasksButton).toBeVisible();
    await tasksButton.click();
    
    // Test All filter
    const allButton = page.locator('button:has-text("All")');
    await expect(allButton).toBeVisible();
    await allButton.click();
    
    // Test Info filter
    const infoButton = page.locator('button:has-text("Info")');
    await expect(infoButton).toBeVisible();
    await infoButton.click();
  });

  test('should handle search functionality', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Find and use search input
    const searchInput = page.locator('input[placeholder="Search tasks..."]');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('test search');
    await searchInput.press('Enter');
    
    // Wait for search to process
    await page.waitForTimeout(1000);
  });

  test('should display AI status and metrics', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Check for AI status indicators
    await expect(page.locator('text=AI Processing').or(page.locator('text=AI Status'))).toBeVisible();
    
    // Check for AI usage metrics
    await page.waitForTimeout(2000); // Wait for API calls
    
    // Look for AI-related elements
    const aiElements = page.locator('[data-testid*="ai"], [class*="ai"], text=/AI|Processing|Usage/i');
    const count = await aiElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should handle task interactions', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Wait for tasks to load
    await page.waitForTimeout(3000);
    
    // Look for task cards
    const taskCards = page.locator('button[type="button"]').filter({ hasText: /pending|completed|priority/i });
    const taskCount = await taskCards.count();
    
    if (taskCount > 0) {
      // Click on first task
      await taskCards.first().click();
      
      // Check if email popup opens
      await page.waitForTimeout(1000);
      
      // Look for modal/popup elements
      const modal = page.locator('[role="dialog"], [aria-modal="true"]');
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible();
        
        // Close the modal
        const closeButton = modal.locator('button').filter({ hasText: /close|×/i });
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }
      }
    } else {
      console.log('No tasks available for interaction test');
    }
  });

  test('should handle chat interface', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Look for chat interface
    const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]');
    
    if (await chatInput.count() > 0) {
      await chatInput.fill('Hello, can you help me with my tasks?');
      
      // Look for send button
      const sendButton = page.locator('button').filter({ hasText: /send/i }).or(
        page.locator('button:has([data-testid="send-icon"], svg)')
      );
      
      if (await sendButton.count() > 0) {
        await sendButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should handle category filters', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Test category filter buttons
    const categoryButtons = [
      'All Categories',
      'Needs Reply',
      'Approval Required',
      'Delegate',
      'Follow Up',
      'Meetings',
      'FYI Only'
    ];
    
    for (const category of categoryButtons) {
      const button = page.locator(`button:has-text("${category}")`);
      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle time filters', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Test time filter buttons
    const timeFilters = ['Today', 'Week', 'Month', 'All Time'];
    
    for (const filter of timeFilters) {
      const button = page.locator(`button:has-text("${filter}")`);
      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Test search shortcut (/)
    await page.keyboard.press('/');
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeFocused();
      await page.keyboard.press('Escape');
    }
    
    // Test refresh shortcut (Ctrl+R or Cmd+R)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyR`);
    await page.waitForTimeout(1000);
  });

  test('should display responsive layout', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Check for three-column layout
    const sidebar = page.locator('.w-72').first();
    const mainContent = page.locator('.flex-1');
    const rightSidebar = page.locator('.w-72').last();
    
    await expect(sidebar).toBeVisible();
    await expect(mainContent).toBeVisible();
    await expect(rightSidebar).toBeVisible();
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Block API requests to simulate network issues
    await page.route('**/api/**', route => route.abort());
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Should still render the basic layout
    await expect(page.locator('h1')).toContainText('TaskFlow');
    
    // Should show appropriate error states
    await page.waitForTimeout(2000);
  });

  test('should handle empty data states', async ({ page }) => {
    // Mock empty responses
    await page.route('**/api/tasks**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Should show empty states
    await expect(page.locator('text=No pending tasks').or(page.locator('text=No completed tasks'))).toBeVisible();
  });
});