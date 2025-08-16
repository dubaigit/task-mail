import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Testing: WCAG 2.2 AA Compliance Validation
 * T504 - Comprehensive Accessibility Testing for 2025 Standards
 * 
 * This test validates WCAG 2.2 AA compliance using axe-core integration
 * - Color contrast ≥4.5:1 for normal text, ≥3:1 for large text
 * - Keyboard navigation and focus management
 * - Screen reader compatibility with proper ARIA implementation
 * - Form accessibility and error handling
 * 
 * Target: 100% WCAG 2.2 AA compliance with zero violations
 */

test.describe('WCAG 2.2 AA Compliance - Accessibility Validation', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should pass axe accessibility scan on homepage', async ({ page }) => {
    // Run comprehensive axe scan with WCAG 2.2 AA rules
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    // Should have zero violations for production readiness
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Log any incomplete tests for manual review
    if (accessibilityScanResults.incomplete.length > 0) {
      console.log('Incomplete accessibility tests requiring manual review:', 
        accessibilityScanResults.incomplete.map(item => item.id));
    }
  });

  test('should validate color contrast ratios meet WCAG 2.2 AA standards', async ({ page }) => {
    // Run color contrast specific scan
    const contrastResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(contrastResults.violations).toEqual([]);

    // Additional manual color contrast verification for critical elements
    const criticalElements = [
      '[data-testid="task-item"]',
      '[data-testid="email-subject"]', 
      '[data-testid="task-priority-badge"]',
      '[data-testid="navigation-button"]'
    ];

    for (const selector of criticalElements) {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        const contrastRatio = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          // This would need a contrast calculation library in real implementation
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });
        
        // Basic validation that colors are defined
        expect(contrastRatio.color).toBeTruthy();
        expect(contrastRatio.backgroundColor).toBeTruthy();
      }
    }
  });

  test('should support full keyboard navigation', async ({ page }) => {
    // Test keyboard navigation through main interface elements
    let tabCount = 0;
    const maxTabs = 20; // Prevent infinite loops
    const focusableElements: string[] = [];

    // Tab through all focusable elements
    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;

      // Get currently focused element
      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused ? focused.tagName + (focused.id ? '#' + focused.id : '') + 
               (focused.className ? '.' + focused.className.split(' ').join('.') : '') : null;
      });

      if (focusedElement) {
        focusableElements.push(focusedElement);
        
        // Check if we've wrapped around (focused first element again)
        if (focusableElements.length > 1 && 
            focusedElement === focusableElements[0]) {
          break;
        }
      }
    }

    // Should have found focusable elements
    expect(focusableElements.length).toBeGreaterThan(0);
    
    // Test reverse tab navigation
    await page.keyboard.press('Shift+Tab');
    const reverseTabElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return focused ? focused.tagName : null;
    });
    expect(reverseTabElement).toBeTruthy();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Run ARIA-specific accessibility scan
    const ariaResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .withRules([
        'aria-allowed-attr',
        'aria-required-attr', 
        'aria-valid-attr-value',
        'aria-valid-attr',
        'button-name',
        'link-name',
        'label'
      ])
      .analyze();

    expect(ariaResults.violations).toEqual([]);

    // Verify specific ARIA implementations for task-centric interface
    const ariaElements = [
      { selector: '[data-testid="view-toggle"]', role: 'tablist' },
      { selector: '[data-testid="task-list"]', role: 'list' },
      { selector: '[data-testid="task-item"]', role: 'listitem' },
      { selector: '[data-testid="email-list"]', role: 'list' },
      { selector: '[data-testid="help-button"]', hasAriaLabel: true }
    ];

    for (const element of ariaElements) {
      const locator = page.locator(element.selector).first();
      if (await locator.isVisible()) {
        if (element.role) {
          await expect(locator).toHaveAttribute('role', element.role);
        }
        if (element.hasAriaLabel) {
          const ariaLabel = await locator.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
        }
      }
    }
  });

  test('should provide screen reader compatible form interactions', async ({ page }) => {
    // Navigate to a form (e.g., draft composition)
    const draftButton = page.locator('[data-testid="compose-button"]');
    if (await draftButton.isVisible()) {
      await draftButton.click();
    }

    // Run form-specific accessibility scan
    const formResults = await new AxeBuilder({ page })
      .withRules([
        'label',
        'form-field-multiple-labels',
        'required-attr',
        'aria-required-attr'
      ])
      .analyze();

    expect(formResults.violations).toEqual([]);

    // Test form field associations
    const formFields = [
      '[data-testid="email-to-field"]',
      '[data-testid="email-subject-field"]',
      '[data-testid="email-body-field"]'
    ];

    for (const fieldSelector of formFields) {
      const field = page.locator(fieldSelector);
      if (await field.isVisible()) {
        // Should have associated label
        const labelId = await field.getAttribute('aria-labelledby');
        const ariaLabel = await field.getAttribute('aria-label');
        
        expect(labelId || ariaLabel).toBeTruthy();

        // If required, should be properly indicated
        const required = await field.getAttribute('required');
        if (required !== null) {
          const ariaRequired = await field.getAttribute('aria-required');
          expect(ariaRequired).toBe('true');
        }
      }
    }
  });

  test('should handle error states accessibly', async ({ page }) => {
    // Simulate error state (e.g., form validation error)
    await page.route('**/api/**', route => route.abort());
    
    // Try to trigger an error
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
    }

    // Wait for error state
    await page.waitForTimeout(1000);

    // Run accessibility scan on error state
    const errorResults = await new AxeBuilder({ page })
      .withRules([
        'aria-live-region',
        'role-img-alt',
        'color-contrast'
      ])
      .analyze();

    expect(errorResults.violations).toEqual([]);

    // Verify error announcements
    const errorAlert = page.locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"]');
    if (await errorAlert.count() > 0) {
      const errorElement = errorAlert.first();
      const ariaLive = await errorElement.getAttribute('aria-live');
      const role = await errorElement.getAttribute('role');
      
      expect(ariaLive || role).toBeTruthy();
    }
  });

  test('should support screen reader navigation landmarks', async ({ page }) => {
    // Check for proper landmark structure
    const landmarkResults = await new AxeBuilder({ page })
      .withRules([
        'landmark-one-main',
        'landmark-complementary-is-top-level',
        'landmark-no-duplicate-banner',
        'landmark-no-duplicate-contentinfo'
      ])
      .analyze();

    expect(landmarkResults.violations).toEqual([]);

    // Verify presence of key landmarks
    const landmarks = [
      { selector: 'main, [role="main"]', name: 'main content' },
      { selector: 'nav, [role="navigation"]', name: 'navigation' },
      { selector: 'header, [role="banner"]', name: 'header' }
    ];

    for (const landmark of landmarks) {
      const element = page.locator(landmark.selector);
      if (await element.count() > 0) {
        // Should be properly labeled
        const firstElement = element.first();
        const ariaLabel = await firstElement.getAttribute('aria-label');
        const ariaLabelledby = await firstElement.getAttribute('aria-labelledby');
        
        // Main content areas should have accessible names
        if (landmark.name === 'main content' || landmark.name === 'navigation') {
          expect(ariaLabel || ariaLabelledby).toBeTruthy();
        }
      }
    }
  });

  test('should provide accessible modal and dialog interactions', async ({ page }) => {
    // Try to open a modal (e.g., help system)
    const helpButton = page.locator('[data-testid="help-button"]');
    if (await helpButton.isVisible()) {
      await helpButton.click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"], [data-testid="modal"]', { timeout: 5000 });

      // Run modal-specific accessibility scan
      const modalResults = await new AxeBuilder({ page })
        .withRules([
          'focus-order-semantics',
          'aria-dialog-name',
          'aria-modal-dialog'
        ])
        .analyze();

      expect(modalResults.violations).toEqual([]);

      // Verify modal properties
      const modal = page.locator('[role="dialog"], [data-testid="modal"]').first();
      await expect(modal).toHaveAttribute('aria-modal', 'true');
      
      // Should have accessible name
      const ariaLabel = await modal.getAttribute('aria-label');
      const ariaLabelledby = await modal.getAttribute('aria-labelledby');
      expect(ariaLabel || ariaLabelledby).toBeTruthy();

      // Test focus trap
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      const isWithinModal = await focusedElement.evaluate(el => {
        const modal = document.querySelector('[role="dialog"], [data-testid="modal"]');
        return modal ? modal.contains(el) : false;
      });
      expect(isWithinModal).toBe(true);

      // Test Escape key functionality
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    }
  });

  test('should handle dynamic content updates accessibly', async ({ page }) => {
    // Test live regions for dynamic content
    const liveRegionResults = await new AxeBuilder({ page })
      .withRules(['aria-live-region-text', 'aria-live'])
      .analyze();

    expect(liveRegionResults.violations).toEqual([]);

    // Check for live regions that announce updates
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const liveRegionCount = await liveRegions.count();
    
    if (liveRegionCount > 0) {
      for (let i = 0; i < liveRegionCount; i++) {
        const region = liveRegions.nth(i);
        const ariaLive = await region.getAttribute('aria-live');
        const role = await region.getAttribute('role');
        
        // Should have appropriate announcement level
        if (ariaLive) {
          expect(['polite', 'assertive', 'off']).toContain(ariaLive);
        }
        if (role) {
          expect(['status', 'alert']).toContain(role);
        }
      }
    }
  });

  test('should meet touch target size requirements for mobile accessibility', async ({ page }) => {
    // Switch to mobile viewport for touch target testing
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check interactive elements meet minimum touch target size (44x44px)
    const interactiveElements = [
      'button',
      'a',
      '[role="button"]',
      '[tabindex="0"]',
      'input',
      'select',
      'textarea'
    ];

    for (const selector of interactiveElements) {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < Math.min(count, 10); i++) { // Check first 10 elements
        const element = elements.nth(i);
        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            // WCAG guideline: minimum 44x44 CSS pixels for touch targets
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    }
  });

  test('should provide appropriate heading structure', async ({ page }) => {
    // Check heading hierarchy
    const headingResults = await new AxeBuilder({ page })
      .withRules(['heading-order', 'empty-heading'])
      .analyze();

    expect(headingResults.violations).toEqual([]);

    // Verify logical heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels: number[] = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.substring(1));
      headingLevels.push(level);
    }

    // Should start with h1
    if (headingLevels.length > 0) {
      expect(headingLevels[0]).toBe(1);
    }

    // Check for logical progression (no skipping levels)
    for (let i = 1; i < headingLevels.length; i++) {
      const currentLevel = headingLevels[i];
      const previousLevel = headingLevels[i - 1];
      
      // Should not skip more than one level
      expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1);
    }
  });

  test('should handle task-first workspace accessibility', async ({ page }) => {
    // Navigate to task view
    const taskToggle = page.locator('[data-testid="view-toggle-task"]');
    if (await taskToggle.isVisible()) {
      await taskToggle.click();
      await page.waitForSelector('[data-testid="task-list"]');

      // Run accessibility scan on task-centric interface
      const taskResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(taskResults.violations).toEqual([]);

      // Verify task-specific accessibility features
      const taskItems = page.locator('[data-testid="task-item"]');
      const count = await taskItems.count();

      if (count > 0) {
        const firstTask = taskItems.first();
        
        // Should have proper role
        await expect(firstTask).toHaveAttribute('role', 'listitem');
        
        // Priority badges should be accessible
        const priorityBadge = firstTask.locator('[data-testid="priority-badge"]');
        if (await priorityBadge.isVisible()) {
          const ariaLabel = await priorityBadge.getAttribute('aria-label');
          expect(ariaLabel).toMatch(/priority/i);
        }

        // Category badges should be accessible
        const categoryBadge = firstTask.locator('[data-testid="category-badge"]');
        if (await categoryBadge.isVisible()) {
          const ariaLabel = await categoryBadge.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
        }
      }
    }
  });

});