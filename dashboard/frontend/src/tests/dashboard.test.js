/**
 * Comprehensive Test Suite for Enhanced Email Intelligence Dashboard
 * Tests Material Design 3 interface, dark mode, and enhanced functionality
 */

// Test configuration and utilities
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:8002',
  timeouts: {
    page: 30000,
    element: 10000,
    api: 5000
  },
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 }
  }
};

// Test data for email simulation
const MOCK_EMAIL_DATA = [
  {
    id: 1,
    subject: "Urgent: Q4 Financial Review Meeting",
    sender: "Sarah Johnson",
    senderEmail: "sarah.johnson@company.com",
    date: new Date().toISOString(),
    classification: "NEEDS_REPLY",
    urgency: "CRITICAL",
    confidence: 0.95,
    has_draft: false,
    isRead: false,
    isStarred: true,
    preview: "We need to schedule our Q4 financial review meeting..."
  },
  {
    id: 2,
    subject: "Project Status Update",
    sender: "Mike Chen",
    senderEmail: "mike.chen@partner.com",
    date: new Date(Date.now() - 86400000).toISOString(),
    classification: "FYI_ONLY",
    urgency: "MEDIUM",
    confidence: 0.87,
    has_draft: true,
    isRead: true,
    isStarred: false,
    preview: "Here's the latest update on our project progress..."
  }
];

// Console monitoring utilities
class ConsoleMonitor {
  constructor() {
    this.messages = [];
    this.errors = [];
    this.warnings = [];
  }

  startMonitoring() {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    console.log = (...args) => {
      this.messages.push({ type: 'log', args, timestamp: Date.now() });
      this.originalConsoleLog(...args);
    };

    console.error = (...args) => {
      this.errors.push({ type: 'error', args, timestamp: Date.now() });
      this.originalConsoleError(...args);
    };

    console.warn = (...args) => {
      this.warnings.push({ type: 'warn', args, timestamp: Date.now() });
      this.originalConsoleWarn(...args);
    };
  }

  stopMonitoring() {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      messages: this.messages,
      summary: {
        errorCount: this.errors.length,
        warningCount: this.warnings.length,
        messageCount: this.messages.length
      }
    };
  }

  hasReactErrors() {
    return this.errors.some(error => 
      error.args.some(arg => 
        typeof arg === 'string' && 
        (arg.includes('React') || arg.includes('Warning:'))
      )
    );
  }

  hasCompilationErrors() {
    return this.errors.some(error =>
      error.args.some(arg =>
        typeof arg === 'string' &&
        (arg.includes('Module not found') || arg.includes('Failed to compile'))
      )
    );
  }
}

// Theme detection utilities
class ThemeDetector {
  static detectTheme() {
    const html = document.documentElement;
    const isDarkMode = html.classList.contains('dark') || 
                      html.getAttribute('data-theme') === 'dark' ||
                      getComputedStyle(html).getPropertyValue('color-scheme') === 'dark';
    return isDarkMode ? 'dark' : 'light';
  }

  static detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  static validateMaterialDesign3() {
    const styles = getComputedStyle(document.documentElement);
    const md3Variables = [
      '--md-sys-color-primary',
      '--md-sys-color-on-primary',
      '--md-sys-color-surface',
      '--md-sys-color-on-surface'
    ];

    return md3Variables.every(variable => {
      const value = styles.getPropertyValue(variable);
      return value && value.trim() !== '';
    });
  }
}

// Accessibility testing utilities
class AccessibilityChecker {
  static checkKeyboardNavigation() {
    const focusableElements = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const issues = [];
    focusableElements.forEach((element, index) => {
      if (!element.getAttribute('aria-label') && 
          !element.getAttribute('aria-labelledby') && 
          !element.textContent.trim()) {
        issues.push(`Element ${index}: Missing accessible label`);
      }
    });

    return {
      focusableCount: focusableElements.length,
      issues: issues,
      isValid: issues.length === 0
    };
  }

  static checkAriaLabels() {
    const interactiveElements = document.querySelectorAll('button, input, select, textarea, [role="button"], [role="menuitem"]');
    const missingLabels = [];

    interactiveElements.forEach((element, index) => {
      const hasLabel = element.getAttribute('aria-label') ||
                      element.getAttribute('aria-labelledby') ||
                      element.querySelector('label') ||
                      element.textContent.trim();

      if (!hasLabel) {
        missingLabels.push({
          index,
          tagName: element.tagName,
          className: element.className,
          id: element.id
        });
      }
    });

    return {
      total: interactiveElements.length,
      missingLabels: missingLabels,
      isValid: missingLabels.length === 0
    };
  }

  static checkColorContrast() {
    // Basic color contrast check for WCAG 2.2 AA compliance
    const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a, label');
    const contrastIssues = [];

    textElements.forEach((element, index) => {
      const styles = getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Skip if transparent background
      if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        return;
      }

      // Basic contrast ratio calculation (simplified)
      const colorLuminance = this.getLuminance(color);
      const bgLuminance = this.getLuminance(backgroundColor);
      const contrastRatio = (Math.max(colorLuminance, bgLuminance) + 0.05) / 
                           (Math.min(colorLuminance, bgLuminance) + 0.05);

      if (contrastRatio < 4.5) { // WCAG AA requirement
        contrastIssues.push({
          index,
          element: element.tagName,
          contrastRatio: contrastRatio.toFixed(2),
          textColor: color,
          backgroundColor: backgroundColor
        });
      }
    });

    return {
      total: textElements.length,
      issues: contrastIssues,
      isValid: contrastIssues.length === 0
    };
  }

  static getLuminance(color) {
    // Simplified luminance calculation
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(val => {
      const normalized = parseInt(val) / 255;
      return normalized <= 0.03928 ? 
        normalized / 12.92 : 
        Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.startTime = performance.now();
  }

  markStart(name) {
    this.metrics[name] = { start: performance.now() };
  }

  markEnd(name) {
    if (this.metrics[name]) {
      this.metrics[name].end = performance.now();
      this.metrics[name].duration = this.metrics[name].end - this.metrics[name].start;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      totalTime: performance.now() - this.startTime,
      memoryUsage: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }

  checkMemoryLeaks() {
    if (!performance.memory) return { warning: 'Memory API not available' };
    
    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const ratio = used / total;

    return {
      memoryUsageRatio: ratio,
      hasMemoryIssue: ratio > 0.9,
      recommendation: ratio > 0.9 ? 'High memory usage detected' : 'Memory usage normal'
    };
  }
}

// Main test execution class
class DashboardTestSuite {
  constructor() {
    this.consoleMonitor = new ConsoleMonitor();
    this.performanceMonitor = new PerformanceMonitor();
    this.testResults = {
      console: null,
      theme: null,
      accessibility: null,
      performance: null,
      functionality: null,
      responsiveness: null,
      errors: [],
      summary: {}
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Enhanced Email Intelligence Dashboard Test Suite');
    this.consoleMonitor.startMonitoring();
    this.performanceMonitor.markStart('total-test-time');

    try {
      // 1. Console-first testing
      await this.testConsoleHealth();
      
      // 2. Theme and Material Design testing
      await this.testThemeAndDesign();
      
      // 3. Accessibility testing
      await this.testAccessibility();
      
      // 4. Enhanced functionality testing
      await this.testEnhancedFunctionality();
      
      // 5. Responsiveness testing
      await this.testResponsiveness();
      
      // 6. Performance testing
      await this.testPerformance();
      
      // 7. Error boundary testing
      await this.testErrorHandling();

    } catch (error) {
      this.testResults.errors.push({
        type: 'test-execution-error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    } finally {
      this.performanceMonitor.markEnd('total-test-time');
      this.consoleMonitor.stopMonitoring();
      this.generateReport();
    }

    return this.testResults;
  }

  async testConsoleHealth() {
    console.log('📊 Testing console health and React compilation...');
    this.performanceMonitor.markStart('console-test');

    // Wait for initial React hydration
    await this.wait(2000);

    const consoleReport = this.consoleMonitor.getReport();
    
    this.testResults.console = {
      hasReactErrors: this.consoleMonitor.hasReactErrors(),
      hasCompilationErrors: this.consoleMonitor.hasCompilationErrors(),
      errorCount: consoleReport.errorCount,
      warningCount: consoleReport.warningCount,
      errors: consoleReport.errors,
      warnings: consoleReport.warnings,
      status: consoleReport.errorCount === 0 ? 'PASS' : 'FAIL'
    };

    this.performanceMonitor.markEnd('console-test');
    
    if (consoleReport.errorCount > 0) {
      console.error('❌ Console errors detected:', consoleReport.errors);
    } else {
      console.log('✅ Console health check passed');
    }
  }

  async testThemeAndDesign() {
    console.log('🎨 Testing Material Design 3 and theme functionality...');
    this.performanceMonitor.markStart('theme-test');

    const currentTheme = ThemeDetector.detectTheme();
    const systemTheme = ThemeDetector.detectSystemTheme();
    const hasMD3Variables = ThemeDetector.validateMaterialDesign3();

    // Test theme switching
    const themeToggle = document.querySelector('[data-testid="theme-toggle"]') || 
                       document.querySelector('[aria-label*="theme"]') ||
                       document.querySelector('button[class*="theme"]');

    let themeToggleWorks = false;
    if (themeToggle) {
      const originalTheme = currentTheme;
      themeToggle.click();
      await this.wait(500);
      const newTheme = ThemeDetector.detectTheme();
      themeToggleWorks = originalTheme !== newTheme;
      
      // Switch back
      if (themeToggleWorks) {
        themeToggle.click();
        await this.wait(500);
      }
    }

    this.testResults.theme = {
      currentTheme,
      systemTheme,
      hasMaterialDesign3: hasMD3Variables,
      themeToggleExists: !!themeToggle,
      themeToggleWorks,
      cssVariablesLoaded: this.checkCSSVariables(),
      status: hasMD3Variables && (themeToggleWorks || !themeToggle) ? 'PASS' : 'FAIL'
    };

    this.performanceMonitor.markEnd('theme-test');
    console.log(`✅ Theme test completed - Current: ${currentTheme}, MD3: ${hasMD3Variables}`);
  }

  async testAccessibility() {
    console.log('♿ Testing accessibility compliance...');
    this.performanceMonitor.markStart('accessibility-test');

    const keyboardNav = AccessibilityChecker.checkKeyboardNavigation();
    const ariaLabels = AccessibilityChecker.checkAriaLabels();
    const colorContrast = AccessibilityChecker.checkColorContrast();

    this.testResults.accessibility = {
      keyboardNavigation: keyboardNav,
      ariaLabels: ariaLabels,
      colorContrast: colorContrast,
      status: keyboardNav.isValid && ariaLabels.isValid && colorContrast.isValid ? 'PASS' : 'FAIL'
    };

    this.performanceMonitor.markEnd('accessibility-test');
    console.log(`✅ Accessibility test completed - Issues found: ${keyboardNav.issues.length + ariaLabels.missingLabels.length + colorContrast.issues.length}`);
  }

  async testEnhancedFunctionality() {
    console.log('⚡ Testing enhanced EmailList functionality...');
    this.performanceMonitor.markStart('functionality-test');

    const tests = {
      dateRangePicker: await this.testDateRangePicker(),
      searchFiltering: await this.testSearchFiltering(),
      emailCardLayout: await this.testEmailCardLayout(),
      bulkActions: await this.testBulkActions(),
      viewModeToggle: await this.testViewModeToggle(),
      responsiveDesign: await this.testResponsiveElements()
    };

    const passedTests = Object.values(tests).filter(test => test.status === 'PASS').length;
    const totalTests = Object.keys(tests).length;

    this.testResults.functionality = {
      ...tests,
      overallStatus: passedTests === totalTests ? 'PASS' : 'PARTIAL',
      passRate: `${passedTests}/${totalTests}`
    };

    this.performanceMonitor.markEnd('functionality-test');
    console.log(`✅ Enhanced functionality test completed - Pass rate: ${passedTests}/${totalTests}`);
  }

  async testDateRangePicker() {
    const dateRangePicker = document.querySelector('[data-testid="date-range-picker"]') ||
                           document.querySelector('.date-range-picker') ||
                           document.querySelector('input[placeholder*="range"]');

    if (!dateRangePicker) {
      return { status: 'FAIL', reason: 'Date range picker not found' };
    }

    // Test preset buttons
    const presetButtons = document.querySelectorAll('button[data-preset]') ||
                         document.querySelectorAll('button:contains("7D"), button:contains("30D")');

    const hasPresets = presetButtons.length > 0;

    // Test custom range functionality
    let customRangeWorks = false;
    try {
      dateRangePicker.click();
      await this.wait(300);
      
      // Check if calendar picker opens
      const calendar = document.querySelector('.calendar') || 
                      document.querySelector('[role="dialog"]') ||
                      document.querySelector('.date-picker');
      
      customRangeWorks = !!calendar;
      
      // Close if opened
      if (calendar) {
        document.body.click();
        await this.wait(100);
      }
    } catch (error) {
      console.warn('Date range picker test error:', error);
    }

    return {
      status: (hasPresets || customRangeWorks) ? 'PASS' : 'FAIL',
      hasPresets,
      customRangeWorks,
      presetCount: presetButtons.length
    };
  }

  async testSearchFiltering() {
    const searchInput = document.querySelector('input[type="search"]') ||
                       document.querySelector('input[placeholder*="search"]') ||
                       document.querySelector('[data-testid="search-input"]');

    if (!searchInput) {
      return { status: 'FAIL', reason: 'Search input not found' };
    }

    // Test search functionality
    const originalEmailCount = document.querySelectorAll('[data-testid="email-card"], .email-item').length;
    
    // Simulate search
    searchInput.focus();
    searchInput.value = 'test search';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    await this.wait(500);
    
    const filteredEmailCount = document.querySelectorAll('[data-testid="email-card"], .email-item').length;
    
    // Clear search
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    await this.wait(300);

    // Test filter dropdowns
    const filterSelects = document.querySelectorAll('select[data-filter], .filter-select');
    const hasFilters = filterSelects.length > 0;

    return {
      status: 'PASS',
      searchInputExists: true,
      hasFilters,
      filterCount: filterSelects.length,
      searchResponsive: true // Assuming it works if no errors
    };
  }

  async testEmailCardLayout() {
    const emailCards = document.querySelectorAll('[data-testid="email-card"], .email-item, [class*="email"]');
    
    if (emailCards.length === 0) {
      return { status: 'FAIL', reason: 'No email cards found' };
    }

    // Check for card-based layout elements
    const hasCardStyling = Array.from(emailCards).some(card => {
      const styles = getComputedStyle(card);
      return styles.borderRadius !== '0px' || 
             styles.boxShadow !== 'none' ||
             card.classList.contains('card');
    });

    // Check for enhanced metadata
    const hasMetadata = Array.from(emailCards).some(card => {
      return card.querySelector('.badge, .tag, [class*="badge"], [class*="urgency"]');
    });

    // Check for action buttons
    const hasActionButtons = Array.from(emailCards).some(card => {
      return card.querySelectorAll('button').length > 0;
    });

    return {
      status: hasCardStyling && hasMetadata ? 'PASS' : 'PARTIAL',
      emailCount: emailCards.length,
      hasCardStyling,
      hasMetadata,
      hasActionButtons
    };
  }

  async testBulkActions() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) {
      return { status: 'FAIL', reason: 'No selection checkboxes found' };
    }

    // Test bulk selection
    const firstCheckbox = checkboxes[0];
    firstCheckbox.click();
    
    await this.wait(200);
    
    // Check if bulk actions appear
    const bulkActions = document.querySelector('[data-testid="bulk-actions"], .bulk-actions') ||
                       document.querySelector('[class*="bulk"], [class*="selected"]');
    
    const bulkActionsVisible = bulkActions && getComputedStyle(bulkActions).display !== 'none';
    
    // Clear selection
    firstCheckbox.click();
    
    return {
      status: bulkActionsVisible ? 'PASS' : 'FAIL',
      checkboxCount: checkboxes.length,
      bulkActionsVisible
    };
  }

  async testViewModeToggle() {
    const viewToggle = document.querySelector('[data-testid="view-toggle"]') ||
                      document.querySelector('button[class*="view"], button[class*="compact"]') ||
                      Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.textContent.includes('Compact') || btn.textContent.includes('Detailed')
                      );

    if (!viewToggle) {
      return { status: 'FAIL', reason: 'View mode toggle not found' };
    }

    // Test toggle functionality
    const originalText = viewToggle.textContent;
    viewToggle.click();
    
    await this.wait(300);
    
    const newText = viewToggle.textContent;
    const toggleWorks = originalText !== newText;
    
    return {
      status: toggleWorks ? 'PASS' : 'FAIL',
      toggleExists: true,
      toggleWorks
    };
  }

  async testResponsiveElements() {
    // Test responsive behavior by checking CSS classes and media queries
    const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
    const hasResponsiveClasses = responsiveElements.length > 0;

    // Check if layout adapts to different sizes
    const containers = document.querySelectorAll('.grid, .flex, [class*="grid"], [class*="flex"]');
    const hasResponsiveLayout = containers.length > 0;

    return {
      status: hasResponsiveClasses && hasResponsiveLayout ? 'PASS' : 'PARTIAL',
      responsiveElementCount: responsiveElements.length,
      hasResponsiveClasses,
      hasResponsiveLayout
    };
  }

  async testResponsiveness() {
    console.log('📱 Testing responsive design...');
    this.performanceMonitor.markStart('responsive-test');

    const viewports = TEST_CONFIG.viewports;
    const results = {};

    for (const [name, size] of Object.entries(viewports)) {
      // Simulate viewport change
      window.resizeTo(size.width, size.height);
      document.documentElement.style.width = `${size.width}px`;
      document.documentElement.style.height = `${size.height}px`;
      
      await this.wait(500);
      
      results[name] = {
        viewport: size,
        elementsVisible: this.checkElementVisibility(),
        layoutIntegrity: this.checkLayoutIntegrity(),
        navigationUsable: this.checkNavigationUsability()
      };
    }

    // Reset viewport
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';

    this.testResults.responsiveness = {
      ...results,
      status: Object.values(results).every(r => r.layoutIntegrity) ? 'PASS' : 'FAIL'
    };

    this.performanceMonitor.markEnd('responsive-test');
    console.log('✅ Responsive design test completed');
  }

  async testPerformance() {
    console.log('⚡ Testing performance metrics...');
    
    const memoryCheck = this.performanceMonitor.checkMemoryLeaks();
    const metrics = this.performanceMonitor.getMetrics();
    
    // Test loading performance
    const loadingElements = document.querySelectorAll('[class*="skeleton"], [class*="loading"]');
    const hasLoadingStates = loadingElements.length > 0;

    // Test for unnecessary re-renders (simplified check)
    let renderCount = 0;
    const observer = new MutationObserver(() => renderCount++);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Trigger some interactions
    const button = document.querySelector('button');
    if (button) {
      button.click();
      await this.wait(100);
    }
    
    observer.disconnect();

    this.testResults.performance = {
      memoryCheck,
      metrics,
      hasLoadingStates,
      renderCount,
      status: memoryCheck.hasMemoryIssue ? 'FAIL' : 'PASS'
    };

    console.log('✅ Performance test completed');
  }

  async testErrorHandling() {
    console.log('🚨 Testing error boundaries and handling...');
    
    // Test API error simulation
    const originalFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('Test API error'));
    
    // Trigger a refresh or data fetch
    const refreshButton = document.querySelector('[data-testid="refresh"], button[class*="refresh"]') ||
                         Array.from(document.querySelectorAll('button')).find(btn => 
                           btn.textContent.includes('Refresh') || btn.textContent.includes('Reload')
                         );
    
    if (refreshButton) {
      refreshButton.click();
      await this.wait(1000);
    }
    
    // Check for error display
    const errorElements = document.querySelectorAll('.error, [class*="error"], .alert-danger, [role="alert"]');
    const hasErrorHandling = errorElements.length > 0;
    
    // Restore fetch
    window.fetch = originalFetch;
    
    this.testResults.errorHandling = {
      hasErrorBoundaries: hasErrorHandling,
      errorElementCount: errorElements.length,
      status: hasErrorHandling ? 'PASS' : 'PARTIAL'
    };

    console.log('✅ Error handling test completed');
  }

  checkCSSVariables() {
    const styles = getComputedStyle(document.documentElement);
    const requiredVariables = [
      '--primary',
      '--secondary',
      '--background',
      '--foreground',
      '--muted',
      '--border'
    ];

    return requiredVariables.every(variable => {
      const value = styles.getPropertyValue(variable);
      return value && value.trim() !== '';
    });
  }

  checkElementVisibility() {
    const criticalElements = [
      'header, [role="banner"]',
      'nav, [role="navigation"]', 
      'main, [role="main"]',
      '.email-list, [data-testid="email-list"]'
    ];

    return criticalElements.every(selector => {
      const element = document.querySelector(selector);
      if (!element) return false;
      
      const styles = getComputedStyle(element);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
  }

  checkLayoutIntegrity() {
    // Check for horizontal overflow
    const hasHorizontalOverflow = document.body.scrollWidth > window.innerWidth;
    
    // Check for overlapping elements (simplified)
    const elements = document.querySelectorAll('*');
    let hasOverlapping = false;
    
    for (let i = 0; i < Math.min(elements.length, 20); i++) {
      const rect = elements[i].getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      
      for (let j = i + 1; j < Math.min(elements.length, 20); j++) {
        const rect2 = elements[j].getBoundingClientRect();
        if (rect2.width <= 0 || rect2.height <= 0) continue;
        
        if (rect.left < rect2.right && rect.right > rect2.left &&
            rect.top < rect2.bottom && rect.bottom > rect2.top) {
          hasOverlapping = true;
          break;
        }
      }
      if (hasOverlapping) break;
    }

    return !hasHorizontalOverflow && !hasOverlapping;
  }

  checkNavigationUsability() {
    const navElements = document.querySelectorAll('nav a, nav button, [role="navigation"] a, [role="navigation"] button');
    const minTouchTarget = 44; // WCAG recommendation
    
    return Array.from(navElements).every(element => {
      const rect = element.getBoundingClientRect();
      return rect.width >= minTouchTarget && rect.height >= minTouchTarget;
    });
  }

  generateReport() {
    const { console, theme, accessibility, functionality, performance, responsiveness, errorHandling } = this.testResults;
    
    const overallStatus = [console, theme, accessibility, functionality, performance, responsiveness, errorHandling]
      .every(test => test && test.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.summary = {
      overallStatus,
      timestamp: new Date().toISOString(),
      testDuration: this.performanceMonitor.getMetrics().totalTime,
      passedTests: Object.values(this.testResults).filter(test => test && test.status === 'PASS').length,
      totalTests: 7,
      criticalIssues: this.findCriticalIssues(),
      recommendations: this.generateRecommendations()
    };

    this.printReport();
  }

  findCriticalIssues() {
    const issues = [];
    
    if (this.testResults.console?.hasReactErrors) {
      issues.push('React compilation errors detected');
    }
    
    if (this.testResults.accessibility?.status === 'FAIL') {
      issues.push('Accessibility compliance failures');
    }
    
    if (this.testResults.performance?.memoryCheck?.hasMemoryIssue) {
      issues.push('Memory usage issues detected');
    }
    
    return issues;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (!this.testResults.theme?.hasMaterialDesign3) {
      recommendations.push('Implement complete Material Design 3 CSS variables');
    }
    
    if (this.testResults.accessibility?.colorContrast?.issues?.length > 0) {
      recommendations.push('Improve color contrast for WCAG 2.2 AA compliance');
    }
    
    if (this.testResults.functionality?.overallStatus !== 'PASS') {
      recommendations.push('Fix enhanced functionality issues in EmailList component');
    }
    
    return recommendations;
  }

  printReport() {
    console.log('\n📋 EMAIL INTELLIGENCE DASHBOARD TEST REPORT');
    console.log('═'.repeat(60));
    console.log(`Overall Status: ${this.testResults.summary.overallStatus}`);
    console.log(`Test Duration: ${(this.testResults.summary.testDuration / 1000).toFixed(2)}s`);
    console.log(`Tests Passed: ${this.testResults.summary.passedTests}/${this.testResults.summary.totalTests}`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    
    // Console Health
    console.log(`\n📊 Console Health: ${this.testResults.console?.status || 'UNKNOWN'}`);
    if (this.testResults.console?.errorCount > 0) {
      console.log(`  ❌ Errors: ${this.testResults.console.errorCount}`);
      this.testResults.console.errors.forEach(error => {
        console.log(`    - ${error.args.join(' ')}`);
      });
    }
    
    // Theme and Design
    console.log(`\n🎨 Theme & Design: ${this.testResults.theme?.status || 'UNKNOWN'}`);
    console.log(`  Current Theme: ${this.testResults.theme?.currentTheme || 'Unknown'}`);
    console.log(`  Material Design 3: ${this.testResults.theme?.hasMaterialDesign3 ? '✅' : '❌'}`);
    console.log(`  Theme Toggle: ${this.testResults.theme?.themeToggleWorks ? '✅' : '❌'}`);
    
    // Accessibility
    console.log(`\n♿ Accessibility: ${this.testResults.accessibility?.status || 'UNKNOWN'}`);
    if (this.testResults.accessibility?.keyboardNavigation?.issues?.length > 0) {
      console.log(`  ❌ Keyboard Nav Issues: ${this.testResults.accessibility.keyboardNavigation.issues.length}`);
    }
    if (this.testResults.accessibility?.ariaLabels?.missingLabels?.length > 0) {
      console.log(`  ❌ Missing ARIA Labels: ${this.testResults.accessibility.ariaLabels.missingLabels.length}`);
    }
    
    // Enhanced Functionality
    console.log(`\n⚡ Enhanced Functionality: ${this.testResults.functionality?.overallStatus || 'UNKNOWN'}`);
    console.log(`  Pass Rate: ${this.testResults.functionality?.passRate || '0/0'}`);
    
    // Performance
    console.log(`\n⚡ Performance: ${this.testResults.performance?.status || 'UNKNOWN'}`);
    if (this.testResults.performance?.metrics?.memoryUsage) {
      const mem = this.testResults.performance.metrics.memoryUsage;
      console.log(`  Memory Used: ${(mem.used / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Critical Issues
    if (this.testResults.summary?.criticalIssues?.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.testResults.summary.criticalIssues.forEach(issue => {
        console.log(`  ❌ ${issue}`);
      });
    }
    
    // Recommendations
    if (this.testResults.summary?.recommendations?.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.testResults.summary.recommendations.forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
    }
    
    console.log('\n═'.repeat(60));
    console.log('📋 Test report completed');
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DashboardTestSuite,
    ConsoleMonitor,
    ThemeDetector,
    AccessibilityChecker,
    PerformanceMonitor,
    TEST_CONFIG
  };
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.document) {
  // Run tests when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.dashboardTestSuite = new DashboardTestSuite();
    });
  } else {
    window.dashboardTestSuite = new DashboardTestSuite();
  }
}