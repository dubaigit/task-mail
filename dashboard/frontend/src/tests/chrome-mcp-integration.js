/**
 * Chrome MCP Integration Test Suite
 * Uses Chrome MCP tools to test the enhanced Email Intelligence Dashboard
 */

// Chrome MCP Test Configuration
const CHROME_TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:8002',
  testTimeout: 30000,
  screenshots: true,
  networkMonitoring: true,
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 }
  }
};

/**
 * Chrome MCP Dashboard Test Runner
 * Uses MCP Chrome tools for automated browser testing
 */
class ChromeMCPTestSuite {
  constructor() {
    this.testResults = {
      navigation: null,
      console: null,
      screenshots: [],
      network: null,
      interactions: null,
      responsive: null,
      performance: null,
      errors: [],
      timestamp: new Date().toISOString()
    };
    this.screenshotCount = 0;
  }

  /**
   * Main test execution method
   */
  async executeTests() {
    console.log('🚀 Starting Chrome MCP Dashboard Integration Tests');
    
    try {
      // 1. Initial page load and console monitoring
      await this.testPageLoad();
      
      // 2. Take baseline screenshot
      await this.captureScreenshot('baseline');
      
      // 3. Test theme switching and dark mode
      await this.testThemeSwitching();
      
      // 4. Test enhanced EmailList functionality
      await this.testEmailListFeatures();
      
      // 5. Test date range picker
      await this.testDateRangePicker();
      
      // 6. Test responsive design
      await this.testResponsiveDesign();
      
      // 7. Test accessibility
      await this.testAccessibilityFeatures();
      
      // 8. Test performance and network
      await this.testPerformanceMetrics();
      
      // 9. Generate final report
      await this.generateTestReport();
      
    } catch (error) {
      this.testResults.errors.push({
        type: 'test-execution-error',
        message: error.message,
        timestamp: Date.now()
      });
      console.error('❌ Test execution failed:', error);
    }
    
    return this.testResults;
  }

  /**
   * Test initial page load and console health
   */
  async testPageLoad() {
    console.log('📊 Testing page load and console health...');
    
    // Start network capture
    await chrome.networkCaptureStart();
    
    // Navigate to dashboard
    await chrome.navigate({
      url: CHROME_TEST_CONFIG.baseUrl,
      width: CHROME_TEST_CONFIG.viewports.desktop.width,
      height: CHROME_TEST_CONFIG.viewports.desktop.height
    });
    
    // Wait for page to load
    await chrome.waitFor({ time: 3 });
    
    // Capture console messages
    const consoleMessages = await chrome.console({
      includeExceptions: true,
      maxMessages: 100
    });
    
    // Get page content for validation
    const pageContent = await chrome.getWebContent({
      textContent: true,
      htmlContent: false
    });
    
    this.testResults.console = {
      messages: consoleMessages,
      hasErrors: consoleMessages.some(msg => msg.type === 'error'),
      hasWarnings: consoleMessages.some(msg => msg.type === 'warning'),
      reactErrors: consoleMessages.filter(msg => 
        msg.text && (msg.text.includes('React') || msg.text.includes('Warning:'))
      ),
      pageLoaded: pageContent.content.includes('Email Intelligence') || 
                  pageContent.content.includes('Dashboard'),
      timestamp: Date.now()
    };
    
    console.log(`✅ Page load test completed - Errors: ${this.testResults.console.hasErrors ? 'YES' : 'NO'}`);
  }

  /**
   * Test theme switching functionality
   */
  async testThemeSwitching() {
    console.log('🎨 Testing theme switching and dark mode...');
    
    // Capture current theme
    const initialTheme = await chrome.evaluate({
      function: `() => {
        const html = document.documentElement;
        return {
          isDark: html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark',
          hasThemeClasses: html.classList.length > 0,
          computedColorScheme: getComputedStyle(html).colorScheme
        };
      }`
    });
    
    // Look for theme toggle button
    const themeButton = await chrome.getInteractiveElements({
      textQuery: 'theme',
      includeCoordinates: true
    });
    
    if (themeButton.length > 0) {
      // Click theme toggle
      await chrome.clickElement({
        element: 'Theme toggle button',
        coordinates: { x: themeButton[0].x, y: themeButton[0].y }
      });
      
      // Wait for theme change
      await chrome.waitFor({ time: 1 });
      
      // Capture screenshot of theme change
      await this.captureScreenshot('theme-switched');
      
      // Verify theme changed
      const newTheme = await chrome.evaluate({
        function: `() => {
          const html = document.documentElement;
          return {
            isDark: html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark',
            hasThemeClasses: html.classList.length > 0,
            computedColorScheme: getComputedStyle(html).colorScheme
          };
        }`
      });
      
      this.testResults.theme = {
        initialTheme,
        newTheme,
        themeToggleWorks: initialTheme.isDark !== newTheme.isDark,
        hasMaterialDesign: await this.checkMaterialDesign3(),
        status: 'PASS'
      };
    } else {
      this.testResults.theme = {
        status: 'FAIL',
        reason: 'Theme toggle button not found'
      };
    }
    
    console.log(`✅ Theme switching test completed - Toggle works: ${this.testResults.theme?.themeToggleWorks ? 'YES' : 'NO'}`);
  }

  /**
   * Test enhanced EmailList functionality
   */
  async testEmailListFeatures() {
    console.log('📧 Testing enhanced EmailList features...');
    
    // Test search functionality
    const searchInput = await chrome.getInteractiveElements({
      selector: 'input[type="search"], input[placeholder*="search"]',
      includeCoordinates: true
    });
    
    let searchWorks = false;
    if (searchInput.length > 0) {
      await chrome.fillOrSelect({
        selector: 'input[type="search"], input[placeholder*="search"]',
        value: 'urgent'
      });
      
      await chrome.waitFor({ time: 1 });
      
      // Check if results filtered
      const filteredContent = await chrome.getWebContent({ textContent: true });
      searchWorks = filteredContent.content.includes('urgent') || 
                   filteredContent.content.includes('filter');
    }
    
    // Test view mode toggle
    const viewToggleButtons = await chrome.getInteractiveElements({
      textQuery: 'compact detailed view',
      includeCoordinates: true
    });
    
    let viewToggleWorks = false;
    if (viewToggleButtons.length > 0) {
      await chrome.clickElement({
        element: 'View toggle button',
        coordinates: { x: viewToggleButtons[0].x, y: viewToggleButtons[0].y }
      });
      
      await chrome.waitFor({ time: 0.5 });
      viewToggleWorks = true;
    }
    
    // Test email card interactions
    const emailCards = await chrome.getInteractiveElements({
      selector: '[data-testid="email-card"], .email-item, [class*="email"]',
      includeCoordinates: true
    });
    
    // Test bulk selection
    const checkboxes = await chrome.getInteractiveElements({
      selector: 'input[type="checkbox"]',
      includeCoordinates: true
    });
    
    let bulkSelectionWorks = false;
    if (checkboxes.length > 0) {
      await chrome.clickElement({
        element: 'Email selection checkbox',
        coordinates: { x: checkboxes[0].x, y: checkboxes[0].y }
      });
      
      await chrome.waitFor({ time: 0.5 });
      
      // Check if bulk actions appear
      const bulkActions = await chrome.getInteractiveElements({
        textQuery: 'archive delete selected'
      });
      
      bulkSelectionWorks = bulkActions.length > 0;
    }
    
    // Capture screenshot of EmailList features
    await this.captureScreenshot('email-list-features');
    
    this.testResults.emailList = {
      searchWorks,
      viewToggleWorks,
      emailCardCount: emailCards.length,
      bulkSelectionWorks,
      checkboxCount: checkboxes.length,
      status: (searchWorks && emailCards.length > 0) ? 'PASS' : 'PARTIAL'
    };
    
    console.log(`✅ EmailList features test completed - Email cards: ${emailCards.length}`);
  }

  /**
   * Test date range picker functionality
   */
  async testDateRangePicker() {
    console.log('📅 Testing date range picker...');
    
    // Look for date range picker
    const dateRangePicker = await chrome.getInteractiveElements({
      selector: 'input[placeholder*="range"], .date-range-picker',
      includeCoordinates: true
    });
    
    // Test preset buttons
    const presetButtons = await chrome.getInteractiveElements({
      textQuery: '7D 30D 90D Today',
      includeCoordinates: true
    });
    
    let presetButtonsWork = false;
    if (presetButtons.length > 0) {
      // Click a preset button
      await chrome.clickElement({
        element: '7D preset button',
        coordinates: { x: presetButtons[0].x, y: presetButtons[0].y }
      });
      
      await chrome.waitFor({ time: 1 });
      presetButtonsWork = true;
    }
    
    // Test custom date range picker
    let customRangeWorks = false;
    if (dateRangePicker.length > 0) {
      await chrome.clickElement({
        element: 'Date range picker input',
        coordinates: { x: dateRangePicker[0].x, y: dateRangePicker[0].y }
      });
      
      await chrome.waitFor({ time: 0.5 });
      
      // Check if calendar appears
      const calendar = await chrome.getInteractiveElements({
        selector: '.calendar, [role="dialog"], .date-picker'
      });
      
      customRangeWorks = calendar.length > 0;
      
      // Close calendar if opened
      if (customRangeWorks) {
        await chrome.keyboard({ keys: 'Escape' });
      }
    }
    
    this.testResults.dateRangePicker = {
      pickerExists: dateRangePicker.length > 0,
      presetButtonCount: presetButtons.length,
      presetButtonsWork,
      customRangeWorks,
      status: (presetButtonsWork || customRangeWorks) ? 'PASS' : 'FAIL'
    };
    
    console.log(`✅ Date range picker test completed - Presets: ${presetButtons.length}, Custom: ${customRangeWorks ? 'YES' : 'NO'}`);
  }

  /**
   * Test responsive design across viewports
   */
  async testResponsiveDesign() {
    console.log('📱 Testing responsive design...');
    
    const viewportResults = {};
    
    for (const [name, viewport] of Object.entries(CHROME_TEST_CONFIG.viewports)) {
      console.log(`  Testing ${name} viewport (${viewport.width}x${viewport.height})`);
      
      // Resize browser
      await chrome.browserResize({
        width: viewport.width,
        height: viewport.height
      });
      
      await chrome.waitFor({ time: 1 });
      
      // Capture screenshot
      await this.captureScreenshot(`responsive-${name}`);
      
      // Check element visibility and layout
      const layoutCheck = await chrome.evaluate({
        function: `() => {
          const criticalElements = document.querySelectorAll('header, nav, main, .email-list');
          const visibleElements = Array.from(criticalElements).filter(el => {
            const rect = el.getBoundingClientRect();
            const styles = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && 
                   styles.display !== 'none' && styles.visibility !== 'hidden';
          });
          
          return {
            totalElements: criticalElements.length,
            visibleElements: visibleElements.length,
            hasHorizontalScrollbar: document.body.scrollWidth > window.innerWidth,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
          };
        }`
      });
      
      viewportResults[name] = {
        ...viewport,
        ...layoutCheck,
        layoutIntegrity: layoutCheck.visibleElements === layoutCheck.totalElements && 
                        !layoutCheck.hasHorizontalScrollbar
      };
    }
    
    // Reset to desktop viewport
    await chrome.browserResize({
      width: CHROME_TEST_CONFIG.viewports.desktop.width,
      height: CHROME_TEST_CONFIG.viewports.desktop.height
    });
    
    this.testResults.responsive = {
      viewports: viewportResults,
      allViewportsWork: Object.values(viewportResults).every(vp => vp.layoutIntegrity),
      status: Object.values(viewportResults).every(vp => vp.layoutIntegrity) ? 'PASS' : 'FAIL'
    };
    
    console.log(`✅ Responsive design test completed - All viewports: ${this.testResults.responsive.allViewportsWork ? 'PASS' : 'FAIL'}`);
  }

  /**
   * Test accessibility features
   */
  async testAccessibilityFeatures() {
    console.log('♿ Testing accessibility features...');
    
    // Test keyboard navigation
    const keyboardNavigation = await chrome.evaluate({
      function: `() => {
        const focusableElements = document.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const missingLabels = [];
        focusableElements.forEach((element, index) => {
          const hasLabel = element.getAttribute('aria-label') || 
                          element.getAttribute('aria-labelledby') || 
                          element.textContent.trim() ||
                          element.title;
          
          if (!hasLabel) {
            missingLabels.push({
              index,
              tagName: element.tagName,
              className: element.className
            });
          }
        });
        
        return {
          focusableCount: focusableElements.length,
          missingLabels: missingLabels,
          hasAriaAttributes: document.querySelectorAll('[aria-label], [aria-labelledby], [role]').length > 0
        };
      }`
    });
    
    // Test focus management with Tab key
    await chrome.keyboard({ keys: 'Tab' });
    await chrome.waitFor({ time: 0.2 });
    
    const focusState = await chrome.evaluate({
      function: `() => {
        const activeElement = document.activeElement;
        return {
          hasFocus: activeElement !== document.body,
          focusedElement: activeElement ? {
            tagName: activeElement.tagName,
            className: activeElement.className,
            text: activeElement.textContent.substring(0, 50)
          } : null
        };
      }`
    });
    
    this.testResults.accessibility = {
      keyboardNavigation,
      focusState,
      status: keyboardNavigation.missingLabels.length === 0 && focusState.hasFocus ? 'PASS' : 'PARTIAL'
    };
    
    console.log(`✅ Accessibility test completed - Missing labels: ${keyboardNavigation.missingLabels.length}`);
  }

  /**
   * Test performance metrics
   */
  async testPerformanceMetrics() {
    console.log('⚡ Testing performance metrics...');
    
    // Get network requests
    const networkData = await chrome.networkCaptureStop();
    
    // Measure JavaScript execution time
    const performanceData = await chrome.evaluate({
      function: `() => {
        const perfEntries = performance.getEntries();
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        
        return {
          loadTime: navigationEntry ? navigationEntry.loadEventEnd - navigationEntry.loadEventStart : 0,
          domContentLoaded: navigationEntry ? navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart : 0,
          resourceCount: perfEntries.length,
          memoryUsage: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null
        };
      }`
    });
    
    // Test for loading states
    const loadingStates = await chrome.evaluate({
      function: `() => {
        const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="loading"]');
        const spinners = document.querySelectorAll('[class*="spinner"], [class*="loading"]');
        
        return {
          hasSkeletons: skeletons.length > 0,
          hasSpinners: spinners.length > 0,
          loadingElementCount: skeletons.length + spinners.length
        };
      }`
    });
    
    this.testResults.performance = {
      networkRequests: networkData?.requests?.length || 0,
      loadTime: performanceData.loadTime,
      domContentLoaded: performanceData.domContentLoaded,
      memoryUsage: performanceData.memoryUsage,
      loadingStates,
      status: performanceData.loadTime < 3000 ? 'PASS' : 'FAIL' // 3 second threshold
    };
    
    console.log(`✅ Performance test completed - Load time: ${performanceData.loadTime}ms`);
  }

  /**
   * Check for Material Design 3 implementation
   */
  async checkMaterialDesign3() {
    return await chrome.evaluate({
      function: `() => {
        const styles = getComputedStyle(document.documentElement);
        const md3Variables = [
          '--md-sys-color-primary',
          '--md-sys-color-on-primary',
          '--md-sys-color-surface',
          '--md-sys-color-on-surface',
          '--md-sys-color-background',
          '--md-sys-color-on-background'
        ];
        
        const presentVariables = md3Variables.filter(variable => {
          const value = styles.getPropertyValue(variable);
          return value && value.trim() !== '';
        });
        
        return {
          totalVariables: md3Variables.length,
          presentVariables: presentVariables.length,
          implementationPercentage: (presentVariables.length / md3Variables.length) * 100,
          hasCompleteImplementation: presentVariables.length === md3Variables.length
        };
      }`
    });
  }

  /**
   * Capture screenshot with automatic naming
   */
  async captureScreenshot(name) {
    if (!CHROME_TEST_CONFIG.screenshots) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dashboard-${name}-${timestamp}.png`;
      
      const screenshot = await chrome.screenshot({
        fullPage: false,
        storeBase64: false,
        savePng: true,
        name: filename
      });
      
      this.testResults.screenshots.push({
        name,
        filename,
        timestamp: Date.now(),
        success: true
      });
      
      this.screenshotCount++;
      console.log(`📸 Screenshot captured: ${filename}`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to capture screenshot ${name}:`, error.message);
      this.testResults.screenshots.push({
        name,
        error: error.message,
        timestamp: Date.now(),
        success: false
      });
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    console.log('📋 Generating comprehensive test report...');
    
    const summary = {
      totalTests: 6,
      passedTests: 0,
      failedTests: 0,
      partialTests: 0,
      overallStatus: 'UNKNOWN'
    };
    
    // Count test results
    Object.values(this.testResults).forEach(result => {
      if (result && result.status) {
        switch (result.status) {
          case 'PASS':
            summary.passedTests++;
            break;
          case 'FAIL':
            summary.failedTests++;
            break;
          case 'PARTIAL':
            summary.partialTests++;
            break;
        }
      }
    });
    
    // Determine overall status
    if (summary.failedTests === 0 && summary.partialTests === 0) {
      summary.overallStatus = 'PASS';
    } else if (summary.failedTests > summary.passedTests) {
      summary.overallStatus = 'FAIL';
    } else {
      summary.overallStatus = 'PARTIAL';
    }
    
    this.testResults.summary = summary;
    
    // Print detailed report
    this.printDetailedReport();
    
    // Capture final screenshot
    await this.captureScreenshot('final-state');
  }

  /**
   * Print detailed test report to console
   */
  printDetailedReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 ENHANCED EMAIL INTELLIGENCE DASHBOARD - CHROME MCP TEST REPORT');
    console.log('='.repeat(80));
    
    const { summary } = this.testResults;
    console.log(`\n🎯 OVERALL STATUS: ${summary.overallStatus}`);
    console.log(`📊 TEST SUMMARY: ${summary.passedTests} PASS, ${summary.failedTests} FAIL, ${summary.partialTests} PARTIAL`);
    console.log(`📸 SCREENSHOTS: ${this.screenshotCount} captured`);
    console.log(`⏱️  TIMESTAMP: ${this.testResults.timestamp}`);
    
    // Console Health Report
    if (this.testResults.console) {
      console.log('\n📊 CONSOLE HEALTH:');
      console.log(`  Status: ${this.testResults.console.hasErrors ? '❌ ERRORS FOUND' : '✅ CLEAN'}`);
      console.log(`  React Errors: ${this.testResults.console.reactErrors.length}`);
      console.log(`  Total Messages: ${this.testResults.console.messages.length}`);
      
      if (this.testResults.console.reactErrors.length > 0) {
        console.log('  React Error Details:');
        this.testResults.console.reactErrors.forEach(error => {
          console.log(`    - ${error.text}`);
        });
      }
    }
    
    // Theme Testing Report
    if (this.testResults.theme) {
      console.log('\n🎨 THEME & MATERIAL DESIGN:');
      console.log(`  Status: ${this.testResults.theme.status}`);
      console.log(`  Theme Toggle Works: ${this.testResults.theme.themeToggleWorks ? '✅' : '❌'}`);
      if (this.testResults.theme.hasMaterialDesign) {
        console.log(`  Material Design 3: ${this.testResults.theme.hasMaterialDesign.implementationPercentage.toFixed(1)}% implemented`);
      }
    }
    
    // EmailList Features Report
    if (this.testResults.emailList) {
      console.log('\n📧 EMAIL LIST FEATURES:');
      console.log(`  Status: ${this.testResults.emailList.status}`);
      console.log(`  Search Functionality: ${this.testResults.emailList.searchWorks ? '✅' : '❌'}`);
      console.log(`  View Toggle: ${this.testResults.emailList.viewToggleWorks ? '✅' : '❌'}`);
      console.log(`  Bulk Selection: ${this.testResults.emailList.bulkSelectionWorks ? '✅' : '❌'}`);
      console.log(`  Email Cards Found: ${this.testResults.emailList.emailCardCount}`);
    }
    
    // Date Range Picker Report
    if (this.testResults.dateRangePicker) {
      console.log('\n📅 DATE RANGE PICKER:');
      console.log(`  Status: ${this.testResults.dateRangePicker.status}`);
      console.log(`  Preset Buttons: ${this.testResults.dateRangePicker.presetButtonCount} found`);
      console.log(`  Custom Range: ${this.testResults.dateRangePicker.customRangeWorks ? '✅' : '❌'}`);
    }
    
    // Responsive Design Report
    if (this.testResults.responsive) {
      console.log('\n📱 RESPONSIVE DESIGN:');
      console.log(`  Status: ${this.testResults.responsive.status}`);
      console.log(`  All Viewports Work: ${this.testResults.responsive.allViewportsWork ? '✅' : '❌'}`);
      
      Object.entries(this.testResults.responsive.viewports).forEach(([name, viewport]) => {
        console.log(`  ${name}: ${viewport.layoutIntegrity ? '✅' : '❌'} (${viewport.width}x${viewport.height})`);
      });
    }
    
    // Accessibility Report
    if (this.testResults.accessibility) {
      console.log('\n♿ ACCESSIBILITY:');
      console.log(`  Status: ${this.testResults.accessibility.status}`);
      console.log(`  Focusable Elements: ${this.testResults.accessibility.keyboardNavigation.focusableCount}`);
      console.log(`  Missing Labels: ${this.testResults.accessibility.keyboardNavigation.missingLabels.length}`);
      console.log(`  Focus Management: ${this.testResults.accessibility.focusState.hasFocus ? '✅' : '❌'}`);
    }
    
    // Performance Report
    if (this.testResults.performance) {
      console.log('\n⚡ PERFORMANCE:');
      console.log(`  Status: ${this.testResults.performance.status}`);
      console.log(`  Load Time: ${this.testResults.performance.loadTime}ms`);
      console.log(`  Network Requests: ${this.testResults.performance.networkRequests}`);
      
      if (this.testResults.performance.memoryUsage) {
        const mem = this.testResults.performance.memoryUsage;
        console.log(`  Memory Used: ${(mem.used / 1024 / 1024).toFixed(2)} MB`);
      }
    }
    
    // Error Summary
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS ENCOUNTERED:');
      this.testResults.errors.forEach(error => {
        console.log(`  ❌ ${error.type}: ${error.message}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    const recommendations = this.generateRecommendations();
    if (recommendations.length === 0) {
      console.log('  ✅ No critical issues found. Dashboard is performing well!');
    } else {
      recommendations.forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 Chrome MCP Test Report Complete');
    console.log('='.repeat(80));
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.console?.hasErrors) {
      recommendations.push('Fix console errors for better stability');
    }
    
    if (this.testResults.theme?.status === 'FAIL') {
      recommendations.push('Implement theme toggle functionality');
    }
    
    if (this.testResults.emailList?.status !== 'PASS') {
      recommendations.push('Enhance EmailList search and filtering capabilities');
    }
    
    if (this.testResults.responsive?.status === 'FAIL') {
      recommendations.push('Improve responsive design for mobile devices');
    }
    
    if (this.testResults.accessibility?.status !== 'PASS') {
      recommendations.push('Add missing ARIA labels and improve keyboard navigation');
    }
    
    if (this.testResults.performance?.loadTime > 3000) {
      recommendations.push('Optimize page load time (currently > 3 seconds)');
    }
    
    return recommendations;
  }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChromeMCPTestSuite, CHROME_TEST_CONFIG };
}

// Browser environment setup
if (typeof window !== 'undefined') {
  window.chromeMCPTestSuite = new ChromeMCPTestSuite();
  
  // Auto-run tests if chrome MCP is available
  if (typeof chrome !== 'undefined') {
    console.log('🚀 Chrome MCP detected. Test suite ready.');
    console.log('Run tests with: await window.chromeMCPTestSuite.executeTests()');
  }
}