import { test, expect } from '@playwright/test';

/**
 * UX Safety Testing: Undo Functionality Validation
 * T504 - Critical UX Safety Mechanism for Production Readiness
 * 
 * This test validates the undo functionality that addresses Nielsen Heuristic #3 (User Control)
 * - 5-second grace period for destructive actions
 * - Toast notification with undo option
 * - Proper accessibility implementation
 * 
 * CURRENT STATE: This test will FAIL - undo functionality needs implementation
 * This is expected and documents the required behavior for production readiness
 */

test.describe('Undo Functionality - Critical UX Safety', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to task-first workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ensure we're in the task-first workspace view
    await page.locator('[data-testid="view-toggle-task"]').click();
    await page.waitForSelector('[data-testid="task-list"]');
  });

  test('should display undo option after task deletion', async ({ page }) => {
    // CURRENT STATE: This test will FAIL - no undo functionality exists
    // This documents the required behavior for production readiness
    
    // Find a task to delete (using mock data)
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await expect(taskItem).toBeVisible();
    
    // Click delete button on the task
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    // Should show undo toast notification
    const undoToast = page.locator('[data-testid="undo-toast"]');
    await expect(undoToast).toBeVisible({ timeout: 2000 });
    
    // Toast should contain undo button and descriptive message
    await expect(undoToast).toContainText('deleted');
    await expect(undoToast.locator('[data-testid="undo-button"]')).toBeVisible();
    
    // Toast should have proper ARIA accessibility
    await expect(undoToast).toHaveAttribute('role', 'alert');
    await expect(undoToast).toHaveAttribute('aria-live', 'polite');
  });

  test('should restore task when undo is clicked within 5 seconds', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('[data-testid="task-item"]').count();
    
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    const taskText = await taskToDelete.textContent();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Verify task is removed from list
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount - 1);
    
    // Click undo within the grace period
    const undoButton = page.locator('[data-testid="undo-button"]');
    await undoButton.click();
    
    // Verify task is restored
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount);
    
    // Verify the specific task is back
    await expect(page.locator('[data-testid="task-item"]')).toContainText(taskText || '');
    
    // Undo toast should disappear
    await expect(page.locator('[data-testid="undo-toast"]')).not.toBeVisible();
  });

  test('should permanently delete task after 5-second grace period', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('[data-testid="task-item"]').count();
    
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Wait for the 5-second grace period (with small buffer)
    await page.waitForTimeout(5500);
    
    // Undo toast should disappear
    await expect(page.locator('[data-testid="undo-toast"]')).not.toBeVisible();
    
    // Task count should remain reduced (permanently deleted)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount - 1);
  });

  test('should support keyboard navigation for undo action', async ({ page }) => {
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Focus should move to undo button
    const undoButton = page.locator('[data-testid="undo-button"]');
    await expect(undoButton).toBeFocused();
    
    // Should be able to activate with Enter key
    await page.keyboard.press('Enter');
    
    // Toast should disappear (undo action completed)
    await expect(page.locator('[data-testid="undo-toast"]')).not.toBeVisible();
  });

  test('should display progress indicator during grace period', async ({ page }) => {
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Should show progress indicator
    const progressIndicator = page.locator('[data-testid="undo-progress"]');
    await expect(progressIndicator).toBeVisible();
    
    // Progress should have proper ARIA attributes
    await expect(progressIndicator).toHaveAttribute('role', 'progressbar');
    await expect(progressIndicator).toHaveAttribute('aria-label', /remaining/i);
  });

  test('should handle multiple undo operations correctly', async ({ page }) => {
    // Delete multiple tasks in sequence
    const initialTaskCount = await page.locator('[data-testid="task-item"]').count();
    
    // Delete first task
    await page.locator('[data-testid="task-item"]').first().locator('[data-testid="delete-task-button"]').click();
    await page.waitForTimeout(100);
    
    // Delete second task
    await page.locator('[data-testid="task-item"]').first().locator('[data-testid="delete-task-button"]').click();
    
    // Should show undo toast for most recent deletion
    const undoToasts = page.locator('[data-testid="undo-toast"]');
    await expect(undoToasts).toHaveCount(1); // Only one undo toast visible
    
    // Undo should restore the most recently deleted task
    await page.locator('[data-testid="undo-button"]').click();
    
    // Should have one less deletion than if no undo occurred
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount - 1);
  });

  test('should provide clear visual feedback during undo operation', async ({ page }) => {
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Click undo
    await page.locator('[data-testid="undo-button"]').click();
    
    // Should show loading/restoring state
    const restoringIndicator = page.locator('[data-testid="restoring-task"]');
    await expect(restoringIndicator).toBeVisible();
    
    // Loading indicator should have proper accessibility
    await expect(restoringIndicator).toHaveAttribute('aria-label', /restoring/i);
  });

  test('should announce undo actions to screen readers', async ({ page }) => {
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Should have proper ARIA live region for announcements
    const liveRegion = page.locator('[data-testid="screen-reader-announcements"]');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    
    // Click undo
    await page.locator('[data-testid="undo-button"]').click();
    
    // Should announce the restoration
    await expect(liveRegion).toContainText(/restored/i);
  });

  test('should disable undo button after grace period expires', async ({ page }) => {
    // Delete a task
    const taskToDelete = page.locator('[data-testid="task-item"]').first();
    await taskToDelete.locator('[data-testid="delete-task-button"]').click();
    
    // Undo button should be enabled initially
    const undoButton = page.locator('[data-testid="undo-button"]');
    await expect(undoButton).toBeEnabled();
    
    // Wait for grace period to expire
    await page.waitForTimeout(5500);
    
    // Undo functionality should no longer be available
    await expect(page.locator('[data-testid="undo-toast"]')).not.toBeVisible();
  });

});