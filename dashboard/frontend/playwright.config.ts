import { defineConfig, devices } from '@playwright/test';

/**
 * Comprehensive Playwright configuration for E2E, visual regression, and accessibility testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { 
      outputFolder: 'test-results/playwright-report',
      open: 'never' 
    }],
    ['json', { 
      outputFile: 'test-results/playwright-results.json' 
    }],
    ['junit', { 
      outputFile: 'test-results/junit.xml' 
    }],
    ['line'],
    ['github'] // For GitHub Actions
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
    /* Global timeout for all assertions */
    actionTimeout: 10000,
    /* Global timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable accessibility testing
        contextOptions: {
          reducedMotion: 'reduce'
        }
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        contextOptions: {
          reducedMotion: 'reduce'
        }
      },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* High contrast and accessibility testing */
    {
      name: 'accessibility-chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          reducedMotion: 'reduce',
          forcedColors: 'active',
        },
        colorScheme: 'dark',
      },
      testMatch: '**/*.a11y.spec.ts',
    },

    /* Visual regression testing */
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: '**/*.visual.spec.ts',
    },

    /* Performance testing */
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/*.perf.spec.ts',
    },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/artifacts',

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm start',
      port: 3000,
      cwd: '/Users/iamomen/apple-mcp/dashboard/frontend',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'python -m uvicorn main:app --host localhost --port 8001',
      port: 8001,
      cwd: '/Users/iamomen/apple-mcp',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],

  /* Global setup and teardown */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  /* Test timeout */
  timeout: 30000,
  expect: {
    /* Timeout for expect() calls */
    timeout: 5000,
    /* Threshold for visual comparisons */
    threshold: 0.1,
    /* Animation handling for visual tests */
    animations: 'disabled',
  },

  /* Maximum time one test can run for. */
  testTimeout: 60000,
});