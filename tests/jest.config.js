/**
 * Jest Configuration for Comprehensive Test Suite
 * Optimized for testing Apple MCP Email Task Manager
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: '../',
  
  // Test directories
  testMatch: [
    '<rootDir>/**/*.test.(js|ts)',
    '<rootDir>/**/*.spec.(js|ts)'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dashboard/frontend/node_modules/',
    '<rootDir>/dashboard/frontend/build/',
    '<rootDir>/tests/e2e/' // E2E tests run separately with Playwright
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/dashboard/frontend/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'clover'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'server.js',
    'ai_service.js',
    'src/**/*.{js,ts}',
    'dashboard/frontend/src/**/*.{js,ts,tsx}',
    '!dashboard/frontend/src/**/*.d.ts',
    '!dashboard/frontend/src/test-utils.tsx',
    '!dashboard/frontend/src/setupTests.ts'
  ],
  
  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Force exit after tests
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Test results processor
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/coverage/html-report',
        filename: 'report.html',
        expand: true
      }
    ]
  ],
  
  // Test suites
  projects: [
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.(js|ts)'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Unit Tests', 
      testMatch: ['<rootDir>/tests/unit/**/*.test.(js|ts)'],
      testEnvironment: 'node'
    },
    {
      displayName: 'System Health',
      testMatch: ['<rootDir>/tests/system-health*.test.(js|ts)'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Monitoring',
      testMatch: ['<rootDir>/tests/monitoring/**/*.test.(js|ts)'],
      testEnvironment: 'node'
    }
  ]
};