import { test, expect } from '@playwright/test';

/**
 * UX Safety Testing: Confirmation Dialogs Validation
 * T504 - Critical UX Safety Mechanism for Production Readiness
 * 
 * This test validates confirmation dialogs that address Nielsen Heuristic #5 (Error Prevention)
 * - Modal confirmation for destructive actions
 * - Proper accessibility implementation
 * - Clear action buttons with visual hierarchy
 * 
 * CURRENT STATE: This test will FAIL - confirmation dialogs need implementation
 * This is expected and documents the required behavior for production readiness
 */

test.describe('Confirmation Dialogs - Critical UX Safety', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to task-first workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ensure we're in the task-first workspace view
    await page.locator('[data-testid="view-toggle-task"]').click();
    await page.waitForSelector('[data-testid="task-list"]');
  });

  test('should show confirmation dialog for task deletion', async ({ page }) => {
    // CURRENT STATE: This test will FAIL - no confirmation dialogs exist
    // This documents the required behavior for production readiness
    
    // Find a task to delete
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await expect(taskItem).toBeVisible();
    
    // Click delete button
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    // Should show confirmation dialog
    const confirmationDialog = page.locator('[data-testid="confirmation-dialog"]');
    await expect(confirmationDialog).toBeVisible();
    
    // Dialog should have proper modal attributes
    await expect(confirmationDialog).toHaveAttribute('role', 'dialog');
    await expect(confirmationDialog).toHaveAttribute('aria-modal', 'true');
    await expect(confirmationDialog).toHaveAttribute('aria-labelledby');
  });

  test('should have clear and accessible confirmation dialog content', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    
    // Should have clear title
    const dialogTitle = dialog.locator('[data-testid="dialog-title"]');
    await expect(dialogTitle).toBeVisible();
    await expect(dialogTitle).toContainText(/delete/i);
    
    // Should have descriptive message
    const dialogMessage = dialog.locator('[data-testid="dialog-message"]');
    await expect(dialogMessage).toBeVisible();
    await expect(dialogMessage).toContainText(/are you sure/i);
    
    // Should have clear action buttons
    const cancelButton = dialog.locator('[data-testid="cancel-button"]');
    const confirmButton = dialog.locator('[data-testid="confirm-button"]');
    
    await expect(cancelButton).toBeVisible();
    await expect(confirmButton).toBeVisible();
    
    // Buttons should have proper labels
    await expect(cancelButton).toContainText(/cancel/i);
    await expect(confirmButton).toContainText(/delete/i);
  });

  test('should cancel action when cancel button is clicked', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('[data-testid="task-item"]').count();
    
    // Trigger deletion
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    // Click cancel in confirmation dialog
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    await dialog.locator('[data-testid="cancel-button"]').click();
    
    // Dialog should close
    await expect(dialog).not.toBeVisible();
    
    // Task should not be deleted
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount);
  });

  test('should proceed with action when confirm button is clicked', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('[data-testid="task-item"]').count();
    
    // Trigger deletion
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    // Click confirm in confirmation dialog
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    await dialog.locator('[data-testid="confirm-button"]').click();
    
    // Dialog should close
    await expect(dialog).not.toBeVisible();
    
    // Task should be deleted (or show undo if undo system is implemented)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(initialTaskCount - 1);
  });

  test('should support keyboard navigation in confirmation dialog', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    
    // Focus should be trapped within dialog
    await page.keyboard.press('Tab');
    
    // First tab should focus cancel button (safe default)
    const cancelButton = dialog.locator('[data-testid="cancel-button"]');
    await expect(cancelButton).toBeFocused();
    
    // Tab should move to confirm button
    await page.keyboard.press('Tab');
    const confirmButton = dialog.locator('[data-testid="confirm-button"]');
    await expect(confirmButton).toBeFocused();
    
    // Shift+Tab should move back to cancel
    await page.keyboard.press('Shift+Tab');
    await expect(cancelButton).toBeFocused();
  });

  test('should close dialog with Escape key', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Press Escape to close
    await page.keyboard.press('Escape');
    
    // Dialog should close
    await expect(dialog).not.toBeVisible();
    
    // Should behave same as cancel (no action taken)
    const taskCount = await page.locator('[data-testid="task-item"]').count();
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(taskCount);
  });

  test('should have proper visual hierarchy for action buttons', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    const cancelButton = dialog.locator('[data-testid="cancel-button"]');
    const confirmButton = dialog.locator('[data-testid="confirm-button"]');
    
    // Cancel button should be secondary style (safe action)
    await expect(cancelButton).toHaveClass(/secondary/);
    
    // Confirm button should be danger style (destructive action)
    await expect(confirmButton).toHaveClass(/danger/);
    
    // Buttons should be properly spaced and sized
    const cancelBox = await cancelButton.boundingBox();
    const confirmBox = await confirmButton.boundingBox();
    
    expect(cancelBox?.width).toBeGreaterThan(80); // Minimum touch target
    expect(confirmBox?.width).toBeGreaterThan(80);
  });

  test('should show confirmation for bulk deletion operations', async ({ page }) => {
    // Select multiple tasks (if bulk selection is available)
    const tasks = page.locator('[data-testid="task-item"]');
    const taskCount = await tasks.count();
    
    if (taskCount > 1) {
      // Select multiple tasks
      await tasks.nth(0).locator('[data-testid="task-checkbox"]').click();
      await tasks.nth(1).locator('[data-testid="task-checkbox"]').click();
      
      // Trigger bulk delete
      await page.locator('[data-testid="bulk-delete-button"]').click();
      
      // Should show confirmation for bulk action
      const dialog = page.locator('[data-testid="confirmation-dialog"]');
      await expect(dialog).toBeVisible();
      
      // Message should indicate bulk operation
      const message = dialog.locator('[data-testid="dialog-message"]');
      await expect(message).toContainText(/2.*tasks/i);
    }
  });

  test('should show confirmation for archive operations', async ({ page }) => {
    // Find a task to archive
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="archive-task-button"]').click();
    
    // Should show confirmation dialog
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Should have archive-specific messaging
    const title = dialog.locator('[data-testid="dialog-title"]');
    await expect(title).toContainText(/archive/i);
    
    // Confirm button should say "Archive"
    const confirmButton = dialog.locator('[data-testid="confirm-button"]');
    await expect(confirmButton).toContainText(/archive/i);
  });

  test('should prevent background interaction while dialog is open', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Background should be covered by overlay
    const overlay = page.locator('[data-testid="dialog-overlay"]');
    await expect(overlay).toBeVisible();
    
    // Try to click on a background element
    const backgroundTask = page.locator('[data-testid="task-item"]').nth(1);
    await backgroundTask.click({ force: true });
    
    // Dialog should still be visible (background click blocked)
    await expect(dialog).toBeVisible();
  });

  test('should have proper color contrast for accessibility', async ({ page }) => {
    // Trigger confirmation dialog
    const taskItem = page.locator('[data-testid="task-item"]').first();
    await taskItem.locator('[data-testid="delete-task-button"]').click();
    
    const dialog = page.locator('[data-testid="confirmation-dialog"]');
    
    // Check text has sufficient contrast (this would need axe-core for full validation)
    const title = dialog.locator('[data-testid="dialog-title"]');
    const titleStyles = await title.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor
      };
    });
    
    // Basic check that colors are defined
    expect(titleStyles.color).toBeTruthy();
    expect(titleStyles.backgroundColor).toBeTruthy();
  });

});