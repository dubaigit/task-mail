import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Test pattern
  testMatch: '**/*.spec.ts',
  
  // Global timeout
  timeout: 30000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
  
  // Test configuration
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  
  // Reporter
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Global setup
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:3000',
    
    // Browser settings
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  // Define projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});