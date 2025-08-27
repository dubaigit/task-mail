import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Test pattern - Include both .spec.ts and .test.ts files
  testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e.ts'],
  
  // Global timeout - Increased for comprehensive testing
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 15000,
  },
  
  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 2 : 4,
  
  // Enhanced reporter configuration
  reporter: [
    ['html', { 
      outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['line'],
    ...(process.env.CI ? [['github']] : [])
  ],
  
  // Global setup
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:3000',
    
    // Browser settings
    headless: process.env.CI ? true : false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    
    // Enhanced settings for comprehensive testing
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
    
    // Accept downloads
    acceptDownloads: true,
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Color scheme
    colorScheme: 'dark', // Test dark mode by default
    
    // Viewport - Will be overridden by device-specific settings
    viewport: { width: 1920, height: 1080 },
  },

  // Comprehensive browser and device testing
  projects: [
    // Desktop browsers
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/e2e/**', '**/integration/**', '**/visual/**']
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/e2e/**', '**/visual/**']
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/e2e/**']
    },
    {
      name: 'Desktop Edge',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
      testMatch: ['**/e2e/**']
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/e2e/**', '**/mobile/**']
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: ['**/e2e/**', '**/mobile/**']
    },

    // Tablet devices
    {
      name: 'Tablet iPad',
      use: { ...devices['iPad Pro'] },
      testMatch: ['**/e2e/**', '**/tablet/**']
    },

    // Accessibility testing (Chrome with accessibility tools)
    {
      name: 'Accessibility Tests',
      use: {
        ...devices['Desktop Chrome'],
        // Force motion preference for accessibility testing
        reducedMotion: 'reduce',
        // High contrast for accessibility
        forcedColors: 'active'
      },
      testMatch: ['**/accessibility/**', '**/a11y/**']
    },

    // Performance testing (Chrome with throttling)
    {
      name: 'Performance Tests',
      use: {
        ...devices['Desktop Chrome'],
        // Simulate slower network
        launchOptions: {
          args: [
            '--enable-features=NetworkServiceLogging',
            '--log-level=0'
          ]
        }
      },
      testMatch: ['**/performance/**']
    },

    // Light mode testing
    {
      name: 'Light Mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light'
      },
      testMatch: ['**/visual/**', '**/theme/**']
    },

    // High resolution displays
    {
      name: 'High DPI',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2,
        viewport: { width: 2560, height: 1440 }
      },
      testMatch: ['**/visual/**']
    },

    // Print media testing
    {
      name: 'Print Media',
      use: {
        ...devices['Desktop Chrome'],
        // Force print media type
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      testMatch: ['**/print/**']
    }
  ],

  // Web server configuration - Don't start server, expect it to be running
  webServer: undefined,

  // Global setup and teardown
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/setup/global-teardown.ts'),

  // Test output directory
  outputDir: process.env.PLAYWRIGHT_SCREENSHOTS_DIR || 'test-results',

  // Metadata
  metadata: {
    'test-suite': 'Apple MCP Email Task Manager',
    'coverage-threshold': process.env.COVERAGE_THRESHOLD || '85',
    'environment': process.env.NODE_ENV || 'test'
  }
});