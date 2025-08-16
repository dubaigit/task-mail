import { test, expect } from '@playwright/test';

test.describe('Task-Centric Email Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the modern email interface', async ({ page }) => {
    // Check if the main interface loads
    await expect(page.getByTestId('modern-email-interface')).toBeVisible();
    
    // Verify the task-centric banner is displayed
    await expect(page.getByText('Task-Centric Email Interface')).toBeVisible();
    await expect(page.getByText('AI-Powered')).toBeVisible();
  });

  test('should switch between Email, Task, and Draft views', async ({ page }) => {
    // Check initial view (should default to task view)
    await expect(page.getByTestId('task-view')).toBeVisible();
    
    // Switch to email view
    await page.getByTestId('view-toggle-email').click();
    await expect(page.getByTestId('email-view')).toBeVisible();
    
    // Switch to draft view
    await page.getByTestId('view-toggle-draft').click();
    await expect(page.getByTestId('draft-view')).toBeVisible();
    
    // Switch back to task view
    await page.getByTestId('view-toggle-task').click();
    await expect(page.getByTestId('task-view')).toBeVisible();
  });

  test('should display tasks in Kanban board format', async ({ page }) => {
    // Ensure we're in task view
    await page.getByTestId('view-toggle-task').click();
    
    // Check for Kanban columns
    await expect(page.getByTestId('kanban-column-todo')).toBeVisible();
    await expect(page.getByTestId('kanban-column-in-progress')).toBeVisible();
    await expect(page.getByTestId('kanban-column-waiting-for-reply')).toBeVisible();
    await expect(page.getByTestId('kanban-column-done')).toBeVisible();
  });

  test('should show task cards with proper information', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    
    // Wait for tasks to load
    await page.waitForSelector('[data-testid^="task-card-"]', { timeout: 10000 });
    
    const taskCard = page.getByTestId('task-card').first();
    
    // Check task card elements
    await expect(taskCard.getByTestId('task-title')).toBeVisible();
    await expect(taskCard.getByTestId('task-priority')).toBeVisible();
    await expect(taskCard.getByTestId('task-category')).toBeVisible();
  });

  test('should support drag and drop between Kanban columns', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    
    // Wait for tasks to load
    await page.waitForSelector('[data-testid^="task-card-"]', { timeout: 10000 });
    
    const sourceCard = page.getByTestId('task-card').first();
    const targetColumn = page.getByTestId('kanban-column-in-progress');
    
    // Perform drag and drop
    await sourceCard.dragTo(targetColumn);
    
    // Verify the card moved to the target column
    await expect(targetColumn.getByTestId('task-card').first()).toBeVisible();
  });

  test('should filter tasks by priority and category', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    
    // Test priority filter
    await page.getByTestId('priority-filter').click();
    await page.getByTestId('filter-priority-high').click();
    
    // Check that only high priority tasks are shown
    const visibleTasks = page.getByTestId('task-card');
    const count = await visibleTasks.count();
    
    for (let i = 0; i < count; i++) {
      const task = visibleTasks.nth(i);
      await expect(task.getByTestId('task-priority')).toContainText('HIGH');
    }
  });

  test('should open task detail panel when clicking a task', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    await page.waitForSelector('[data-testid^="task-card-"]', { timeout: 10000 });
    
    // Click on a task card
    await page.getByTestId('task-card').first().click();
    
    // Verify task detail panel opens
    await expect(page.getByTestId('task-detail-panel')).toBeVisible();
    await expect(page.getByTestId('task-detail-title')).toBeVisible();
    await expect(page.getByTestId('task-detail-description')).toBeVisible();
  });

  test('should show colleague tracking in waiting column', async ({ page }) => {
    await page.getByTestId('view-toggle-task').click();
    
    // Check for colleague tracking elements in waiting column
    const waitingColumn = page.getByTestId('kanban-column-waiting-for-reply');
    const waitingTasks = waitingColumn.getByTestId('task-card');
    
    if (await waitingTasks.count() > 0) {
      const firstWaitingTask = waitingTasks.first();
      await expect(firstWaitingTask.getByTestId('colleague-info')).toBeVisible();
    }
  });
});