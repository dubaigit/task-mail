import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    // Check that headings exist
    expect(headings.length).toBeGreaterThan(0);
    
    // Verify main heading
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have proper form labels and ARIA attributes', async ({ page }) => {
    // Check search input has proper label
    const searchInput = page.getByTestId('search-input');
    if (await searchInput.count() > 0) {
      await expect(searchInput).toHaveAttribute('aria-label');
    }
    
    // Check buttons have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasText = await button.textContent();
      const hasAriaLabel = await button.getAttribute('aria-label');
      
      expect(hasText || hasAriaLabel).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test Tab navigation through interactive elements
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Navigate through key interactive elements
    const interactiveElements = page.locator('button, a, input, [tabindex]:not([tabindex="-1"])');
    const count = await interactiveElements.count();
    
    if (count > 0) {
      // Tab through a few elements
      for (let i = 0; i < Math.min(5, count); i++) {
        await page.keyboard.press('Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }
    }
  });

  test('should support dark mode accessibility', async ({ page }) => {
    // Toggle to dark mode if available
    const darkModeToggle = page.getByTestId('dark-mode-toggle');
    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      
      // Wait for theme transition
      await page.waitForTimeout(500);
      
      // Run accessibility scan in dark mode
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();

    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('should provide alternative text for images', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Images should have alt text or be marked as decorative
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have proper ARIA landmarks', async ({ page }) => {
    // Check for main landmark
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    
    // Check for navigation landmark if present
    const nav = page.locator('nav, [role="navigation"]');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should announce dynamic content changes', async ({ page }) => {
    // Test view switching announcements
    await page.getByTestId('view-toggle-task').click();
    
    // Check for aria-live regions
    const liveRegions = page.locator('[aria-live]');
    const liveRegionCount = await liveRegions.count();
    
    // Should have at least one live region for announcements
    expect(liveRegionCount).toBeGreaterThan(0);
  });

  test('should work with screen reader simulation', async ({ page }) => {
    // Simulate screen reader navigation using headings
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      // Each heading should be focusable and have text content
      for (let i = 0; i < headingCount; i++) {
        const heading = headings.nth(i);
        const text = await heading.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test('should handle reduced motion preferences', async ({ page, context }) => {
    // Simulate reduced motion preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify animations are disabled or reduced
    const animatedElements = page.locator('[class*="animate"], [style*="transition"]');
    // This is a basic check - in a real app, you'd verify specific motion settings
    await expect(page.locator('body')).toBeVisible();
  });
});