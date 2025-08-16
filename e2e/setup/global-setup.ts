import { FullConfig, chromium, Browser, BrowserContext } from '@playwright/test';

/**
 * Global Setup for 2025 Testing Strategy
 * T504 - Comprehensive Testing with UX Safety Mechanism Validation
 * 
 * This setup:
 * - Initializes performance monitoring
 * - Sets up test data and authentication
 * - Configures Core Web Vitals tracking
 * - Prepares UX safety testing environment
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 T504 Global Setup: Initializing 2025 Testing Strategy...');
  
  // Launch browser for setup operations
  const browser: Browser = await chromium.launch();
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Configure performance monitoring for Core Web Vitals
    await page.addInitScript(() => {
      // Initialize performance metrics tracking
      (window as any).performanceMetrics = {
        LCP: 0,
        FID: 0,
        CLS: 0,
        INP: 0,
        TTFB: 0
      };
      
      // Core Web Vitals observer
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              (window as any).performanceMetrics.LCP = entry.startTime;
              break;
            case 'first-input':
              (window as any).performanceMetrics.FID = entry.processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                (window as any).performanceMetrics.CLS += (entry as any).value;
              }
              break;
          }
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      
      // Navigation timing for TTFB
      window.addEventListener('load', () => {
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        (window as any).performanceMetrics.TTFB = navTiming.responseStart - navTiming.requestStart;
      });
    });
    
    // Initialize test data for UX safety scenarios
    await page.addInitScript(() => {
      // Mock test data for consistent testing
      (window as any).testData = {
        mockEmails: [
          {
            id: 'test-1',
            subject: 'Test Email for UX Safety',
            sender: 'test@example.com',
            content: 'This is a test email for UX safety mechanism validation',
            category: 'NEEDS_REPLY',
            priority: 'HIGH',
            timestamp: new Date().toISOString()
          },
          {
            id: 'test-2', 
            subject: 'Test Task Assignment',
            sender: 'manager@example.com',
            content: 'Please review and complete this task by end of week',
            category: 'DO_MYSELF',
            priority: 'MEDIUM',
            timestamp: new Date().toISOString()
          }
        ],
        
        // UX safety test scenarios
        uxSafetyScenarios: {
          deleteEmail: {
            emailId: 'test-1',
            expectedUndoWindow: 5000, // 5 seconds
            expectedToastMessage: 'Email deleted. Undo?'
          },
          destructiveAction: {
            confirmationRequired: true,
            confirmationMessage: 'Are you sure you want to delete this email?',
            cancelButtonText: 'Cancel',
            confirmButtonText: 'Delete'
          },
          helpSystem: {
            tourSteps: 6,
            helpButtonSelector: '[data-testid="help-button"]',
            tourStepSelector: '[data-tour-step]'
          },
          errorRecovery: {
            networkFailure: true,
            retryMechanism: true,
            degradedMode: true
          }
        }
      };
    });
    
    // Verify application is accessible
    console.log('📡 Checking application accessibility...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for application to load
    await page.waitForSelector('body', { timeout: 30000 });
    
    console.log('✅ Application is accessible and ready for testing');
    
    // Set up authentication state if needed
    // This can be expanded for actual authentication testing
    await page.evaluate(() => {
      localStorage.setItem('e2e-test-mode', 'true');
      localStorage.setItem('test-session-id', 'e2e-' + Date.now());
    });
    
    console.log('🔐 Test authentication state configured');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('🎯 T504 Global Setup Complete - 2025 Testing Strategy Initialized');
}

export default globalSetup;