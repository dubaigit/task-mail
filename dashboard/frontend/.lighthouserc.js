/**
 * Lighthouse CI Configuration
 * 
 * Performance budget enforcement for CI/CD pipeline integration.
 * Defines performance thresholds and monitoring rules for automated testing.
 */

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/analytics',
        'http://localhost:3000/email'
      ],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'webpack compiled',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        }
      }
    },
    assert: {
      assertions: {
        // Core Web Vitals - Critical Performance Metrics
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals Thresholds (2024 Standards)
        'metrics:largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s
        'metrics:interaction-to-next-paint': ['error', { maxNumericValue: 200 }],  // 200ms
        'metrics:cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],   // 0.1
        'metrics:first-contentful-paint': ['warn', { maxNumericValue: 1800 }],    // 1.8s
        'metrics:total-blocking-time': ['warn', { maxNumericValue: 300 }],        // 300ms

        // Resource Budget Enforcement
        'metrics:total-byte-weight': ['error', { maxNumericValue: 512000 }],      // 500KB
        'metrics:unused-css-rules': ['warn', { maxNumericValue: 20000 }],         // 20KB
        'metrics:unused-javascript': ['warn', { maxNumericValue: 20000 }],        // 20KB
        'metrics:dom-size': ['warn', { maxNumericValue: 1500 }],                  // 1500 nodes

        // Network Performance
        'metrics:server-response-time': ['warn', { maxNumericValue: 600 }],       // 600ms TTFB
        'metrics:redirects': ['warn', { maxNumericValue: 0 }],                    // No redirects
        'metrics:main-thread-tasks': ['warn', { maxNumericValue: 50 }],           // 50ms tasks

        // Progressive Web App (if applicable)
        'metrics:speed-index': ['warn', { maxNumericValue: 3000 }],               // 3s
        'metrics:interactive': ['error', { maxNumericValue: 3000 }],              // 3s TTI

        // Modern Web Standards
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'uses-optimized-images': 'warn',
        'uses-text-compression': 'error',
        'uses-responsive-images': 'warn',

        // Accessibility Requirements
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'tabindex': 'warn',
        'heading-order': 'warn',

        // Security
        'is-on-https': 'error',
        'uses-https': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    },
    server: {
      port: 9001,
      storage: './lighthouse-reports'
    }
  }
};