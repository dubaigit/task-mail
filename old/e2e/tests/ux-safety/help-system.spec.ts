import { test, expect } from '@playwright/test';

/**
 * UX Safety Testing: Help System Validation
 * T504 - Critical UX Safety Mechanism for Production Readiness
 * 
 * This test validates the help system that addresses Nielsen Heuristic #10 (Help and Documentation)
 * - Onboarding tour for task-centric paradigm
 * - Contextual help and tooltips
 * - Accessible help button and content
 * 
 * CURRENT STATE: This test will FAIL - help system needs implementation
 * This is expected and documents the required behavior for production readiness
 */

test.describe('Help System - Critical UX Safety', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display help button in header', async ({ page }) => {
    // CURRENT STATE: This test will FAIL - no help system exists
    // This documents the required behavior for production readiness
    
    // Should have accessible help button in header
    const helpButton = page.locator('[data-testid="help-button"]');
    await expect(helpButton).toBeVisible();
    
    // Button should have proper accessibility attributes
    await expect(helpButton).toHaveAttribute('aria-label', /help/i);
    await expect(helpButton).toHaveAttribute('type', 'button');
    
    // Should be keyboard accessible
    await helpButton.focus();
    await expect(helpButton).toBeFocused();
  });

  test('should start onboarding tour for new users', async ({ page }) => {
    // Clear any existing tour completion flags
    await page.evaluate(() => {
      localStorage.removeItem('onboarding-completed');
      localStorage.removeItem('tour-completed');
    });
    
    // Reload page to trigger new user experience
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should automatically start onboarding tour
    const tourOverlay = page.locator('[data-testid="onboarding-tour"]');
    await expect(tourOverlay).toBeVisible();
    
    // Should show step 1 of the tour
    const stepIndicator = page.locator('[data-testid="tour-step-indicator"]');
    await expect(stepIndicator).toContainText('1');
    
    // Should have tour content explaining task-centric paradigm
    const tourContent = page.locator('[data-testid="tour-content"]');
    await expect(tourContent).toContainText(/task-centric/i);
  });

  test('should guide through 6-step onboarding tour', async ({ page }) => {
    // Start tour manually
    await page.locator('[data-testid="help-button"]').click();
    await page.locator('[data-testid="start-tour-button"]').click();
    
    const tour = page.locator('[data-testid="onboarding-tour"]');
    const nextButton = page.locator('[data-testid="tour-next-button"]');
    const stepIndicator = page.locator('[data-testid="tour-step-indicator"]');
    
    // Step 1: Introduction to task-centric approach
    await expect(stepIndicator).toContainText('1 of 6');
    await expect(tour).toContainText(/task-centric/i);
    await nextButton.click();
    
    // Step 2: Email/Task/Draft toggle explanation
    await expect(stepIndicator).toContainText('2 of 6');
    await expect(tour).toContainText(/toggle/i);
    await nextButton.click();
    
    // Step 3: Task categorization system
    await expect(stepIndicator).toContainText('3 of 6');
    await expect(tour).toContainText(/categor/i);
    await nextButton.click();
    
    // Step 4: Priority system
    await expect(stepIndicator).toContainText('4 of 6');
    await expect(tour).toContainText(/priority/i);
    await nextButton.click();
    
    // Step 5: AI-powered features
    await expect(stepIndicator).toContainText('5 of 6');
    await expect(tour).toContainText(/AI/i);
    await nextButton.click();
    
    // Step 6: Getting help and support
    await expect(stepIndicator).toContainText('6 of 6');
    await expect(tour).toContainText(/help/i);
    
    // Final step should have "Complete Tour" button
    const completeButton = page.locator('[data-testid="tour-complete-button"]');
    await expect(completeButton).toBeVisible();
    await completeButton.click();
    
    // Tour should close
    await expect(tour).not.toBeVisible();
  });

  test('should allow skipping onboarding tour', async ({ page }) => {
    // Start tour
    await page.locator('[data-testid="help-button"]').click();
    await page.locator('[data-testid="start-tour-button"]').click();
    
    const tour = page.locator('[data-testid="onboarding-tour"]');
    
    // Should have skip option
    const skipButton = page.locator('[data-testid="tour-skip-button"]');
    await expect(skipButton).toBeVisible();
    
    // Clicking skip should close tour
    await skipButton.click();
    await expect(tour).not.toBeVisible();
    
    // Should mark tour as completed to prevent auto-start
    const tourCompleted = await page.evaluate(() => {
      return localStorage.getItem('onboarding-completed') === 'true';
    });
    expect(tourCompleted).toBe(true);
  });

  test('should provide contextual tooltips for task-centric features', async ({ page }) => {
    // Navigate to task view
    await page.locator('[data-testid="view-toggle-task"]').click();
    
    // Hover over task category badges to show tooltips
    const categoryBadge = page.locator('[data-testid="task-category-badge"]').first();
    await categoryBadge.hover();
    
    // Should show tooltip explaining the category
    const tooltip = page.locator('[data-testid="category-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/category/i);
    
    // Tooltip should have proper ARIA attributes
    await expect(tooltip).toHaveAttribute('role', 'tooltip');
  });

  test('should explain Email/Task/Draft toggle functionality', async ({ page }) => {
    // Click help on the view toggle
    const viewToggle = page.locator('[data-testid="view-toggle"]');
    await viewToggle.locator('[data-testid="toggle-help-icon"]').click();
    
    // Should show explanation modal
    const helpModal = page.locator('[data-testid="help-modal"]');
    await expect(helpModal).toBeVisible();
    
    // Should explain each view mode
    await expect(helpModal).toContainText(/email view/i);
    await expect(helpModal).toContainText(/task view/i);
    await expect(helpModal).toContainText(/draft view/i);
    
    // Should have visual examples or diagrams
    const exampleImage = page.locator('[data-testid="help-example-image"]');
    await expect(exampleImage).toBeVisible();
  });

  test('should provide help for AI-powered features', async ({ page }) => {
    // Navigate to draft view
    await page.locator('[data-testid="view-toggle-draft"]').click();
    
    // Click help for AI draft generation
    const aiHelpButton = page.locator('[data-testid="ai-features-help"]');
    await aiHelpButton.click();
    
    // Should show AI help content
    const aiHelp = page.locator('[data-testid="ai-help-content"]');
    await expect(aiHelp).toBeVisible();
    
    // Should explain AI confidence levels
    await expect(aiHelp).toContainText(/confidence/i);
    
    // Should explain how to improve AI suggestions
    await expect(aiHelp).toContainText(/improve/i);
  });

  test('should have keyboard accessible help navigation', async ({ page }) => {
    // Help button should be keyboard accessible
    await page.keyboard.press('Tab');
    const helpButton = page.locator('[data-testid="help-button"]');
    await expect(helpButton).toBeFocused();
    
    // Enter should open help
    await page.keyboard.press('Enter');
    
    const helpModal = page.locator('[data-testid="help-modal"]');
    await expect(helpModal).toBeVisible();
    
    // Focus should be trapped in help modal
    await page.keyboard.press('Tab');
    const firstFocusable = helpModal.locator('button, a, input, [tabindex]:not([tabindex="-1"])').first();
    await expect(firstFocusable).toBeFocused();
    
    // Escape should close help
    await page.keyboard.press('Escape');
    await expect(helpModal).not.toBeVisible();
  });

  test('should provide search functionality in help system', async ({ page }) => {
    // Open help system
    await page.locator('[data-testid="help-button"]').click();
    
    // Should have search input
    const searchInput = page.locator('[data-testid="help-search"]');
    await expect(searchInput).toBeVisible();
    
    // Search for specific topic
    await searchInput.fill('task categories');
    
    // Should show relevant results
    const searchResults = page.locator('[data-testid="help-search-results"]');
    await expect(searchResults).toBeVisible();
    await expect(searchResults).toContainText(/category/i);
    
    // Should highlight search terms
    const highlightedTerm = page.locator('[data-testid="search-highlight"]');
    await expect(highlightedTerm).toBeVisible();
  });

  test('should remember help preferences', async ({ page }) => {
    // Complete onboarding tour
    await page.locator('[data-testid="help-button"]').click();
    await page.locator('[data-testid="start-tour-button"]').click();
    
    // Skip to end
    await page.locator('[data-testid="tour-skip-button"]').click();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Tour should not auto-start again
    const tour = page.locator('[data-testid="onboarding-tour"]');
    await expect(tour).not.toBeVisible();
    
    // But should be accessible from help menu
    await page.locator('[data-testid="help-button"]').click();
    const restartTourButton = page.locator('[data-testid="restart-tour-button"]');
    await expect(restartTourButton).toBeVisible();
  });

  test('should provide contextual help for error states', async ({ page }) => {
    // Simulate an error state (e.g., network failure)
    await page.route('**/api/**', route => route.abort());
    
    // Try to perform an action that would fail
    await page.locator('[data-testid="refresh-button"]').click();
    
    // Should show error with help context
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    
    // Should have help link for troubleshooting
    const troubleshootingLink = errorMessage.locator('[data-testid="troubleshooting-help"]');
    await expect(troubleshootingLink).toBeVisible();
    
    // Clicking should show relevant help
    await troubleshootingLink.click();
    
    const troubleshootingHelp = page.locator('[data-testid="troubleshooting-content"]');
    await expect(troubleshootingHelp).toBeVisible();
    await expect(troubleshootingHelp).toContainText(/network/i);
  });

  test('should have proper ARIA labels for screen readers', async ({ page }) => {
    // Open help system
    await page.locator('[data-testid="help-button"]').click();
    
    const helpModal = page.locator('[data-testid="help-modal"]');
    
    // Modal should have proper ARIA attributes
    await expect(helpModal).toHaveAttribute('role', 'dialog');
    await expect(helpModal).toHaveAttribute('aria-modal', 'true');
    await expect(helpModal).toHaveAttribute('aria-labelledby');
    
    // Help sections should have proper headings
    const helpSection = page.locator('[data-testid="help-section"]').first();
    await expect(helpSection).toHaveAttribute('aria-labelledby');
    
    // Tour steps should announce current position
    if (await page.locator('[data-testid="start-tour-button"]').isVisible()) {
      await page.locator('[data-testid="start-tour-button"]').click();
      
      const tourStep = page.locator('[data-testid="tour-step"]');
      await expect(tourStep).toHaveAttribute('aria-live', 'polite');
    }
  });

});