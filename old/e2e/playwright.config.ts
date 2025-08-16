import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for 2025 Testing Strategy
 * T504 - Comprehensive Testing with UX Safety Mechanism Validation
 * 
 * Features:
 * - Mobile-first validation with cross-device testing
 * - WCAG 2.2 AA accessibility compliance
 * - Core Web Vitals performance monitoring
 * - Visual regression testing with toHaveScreenshot
 * - UX safety mechanisms testing (undo, confirmations, help system, error recovery)
 */

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'ci'
    }
  },
  
  fullyParallel: false, // Sequential for UX safety scenarios
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1,
  
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  outputDir: 'test-results/artifacts',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true
  },

  projects: [
    // Desktop Testing - Primary development target
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    
    // Mobile-First Validation - 2025 Standards
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        deviceScaleFactor: 3
      },
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        deviceScaleFactor: 3
      },
    },
    
    // Cross-browser validation
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
    
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },
    
    // Accessibility Testing Project
    {
      name: 'accessibility-audit',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: '**/accessibility/**/*.spec.ts'
    },
    
    // Performance Testing Project - Core Web Vitals
    {
      name: 'performance-validation',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: '**/performance/**/*.spec.ts'
    },
    
    // UX Safety Testing Project - Critical for Production
    {
      name: 'ux-safety-validation',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Longer timeout for UX safety scenarios
        timeout: 45000
      },
      testMatch: '**/ux-safety/**/*.spec.ts'
    },
    
    // Visual Regression Testing
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: '**/visual/**/*.spec.ts'
    }
  ],

  webServer: {
    command: 'cd dashboard/frontend && npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  
  // Global setup and teardown
  globalSetup: require.resolve('./setup/global-setup.ts'),
  globalTeardown: require.resolve('./setup/global-teardown.ts')
});