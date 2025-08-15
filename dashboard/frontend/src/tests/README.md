# Email Intelligence Dashboard Test Suite

Comprehensive testing framework for the enhanced Email Intelligence Dashboard with Material Design 3, dark mode, and enhanced functionality.

## 🧪 Test Components

### 1. Browser-based Test Suite (`dashboard.test.js`)
- **Console-first testing**: Monitors React errors, compilation issues
- **Theme & Material Design 3**: Validates theme switching and MD3 implementation
- **Accessibility compliance**: WCAG 2.2 AA keyboard navigation, ARIA labels, color contrast
- **Enhanced EmailList functionality**: Date range picker, search, filtering, bulk actions
- **Performance monitoring**: Memory usage, loading states, render optimization
- **Responsive design**: Multi-viewport testing

### 2. Chrome MCP Integration (`chrome-mcp-integration.js`)
- **Automated browser testing**: Uses Chrome MCP tools for real browser interactions
- **Network monitoring**: Captures API requests and performance metrics
- **Screenshot capture**: Visual regression testing
- **Interactive element testing**: Clicks, form fills, navigation
- **Cross-viewport testing**: Mobile, tablet, desktop responsiveness
- **Console error detection**: Real-time error monitoring

### 3. Test Runner (`test-runner.html`)
- **Visual test interface**: HTML-based test execution dashboard
- **Real-time results**: Live progress tracking and console output
- **Screenshot gallery**: Visual test evidence
- **Comprehensive reports**: Detailed test summaries with recommendations

## 🚀 Getting Started

### Prerequisites
- React development server running on `http://localhost:3000`
- Backend API server running on `http://localhost:8002` (optional)
- Chrome browser with MCP extension (for Chrome MCP tests)

### Running Tests

#### Option 1: Interactive Test Runner (Recommended)
1. Open `test-runner.html` in your browser
2. Choose test suite:
   - **Browser Tests**: JavaScript-based testing within the page
   - **Chrome MCP Tests**: Automated browser testing with screenshots
   - **Run All Tests**: Complete test suite

#### Option 2: Direct Browser Console
```javascript
// Load the dashboard in your browser first
// Then run in console:

// Browser tests
const testSuite = new DashboardTestSuite();
const results = await testSuite.runAllTests();

// Chrome MCP tests (if available)
const chromeSuite = new ChromeMCPTestSuite();
const chromeResults = await chromeSuite.executeTests();
```

#### Option 3: Node.js Environment
```bash
# For unit testing integration
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

## 📊 Test Categories

### Console Health ✅
- React compilation errors
- Runtime JavaScript errors
- Console warnings
- Component lifecycle issues

### Theme & Material Design 🎨
- Dark/light mode switching
- Material Design 3 CSS variables
- Theme persistence
- System theme detection

### Accessibility ♿
- Keyboard navigation
- ARIA label coverage
- Color contrast compliance
- Focus management
- Touch target sizes

### Enhanced EmailList Features 📧
- **Date Range Picker**: Preset buttons, custom range selection
- **Search & Filtering**: Real-time search, filter dropdowns
- **Card-based Layout**: Enhanced email cards with metadata
- **Bulk Actions**: Multi-select, bulk operations
- **View Modes**: Compact vs detailed views

### Responsive Design 📱
- Mobile (375x667) viewport
- Tablet (768x1024) viewport  
- Desktop (1920x1080) viewport
- Layout integrity across sizes
- Navigation usability

### Performance ⚡
- Page load times
- Memory usage monitoring
- Network request optimization
- Loading state implementations
- Render performance

## 🔍 Test Results

### Status Indicators
- ✅ **PASS**: Test completed successfully
- ❌ **FAIL**: Critical issues found
- ⚠️ **PARTIAL**: Some issues, but functional
- ⏳ **RUNNING**: Test in progress
- ⭕ **PENDING**: Test not started

### Report Sections
1. **Summary**: Overall pass/fail counts
2. **Console Output**: Real-time test logs
3. **Screenshots**: Visual evidence (Chrome MCP only)
4. **Error Details**: Specific failure information
5. **Recommendations**: Suggested improvements

## 🛠️ Customization

### Adding New Tests
```javascript
// In dashboard.test.js
async testNewFeature() {
  console.log('🔧 Testing new feature...');
  
  // Your test logic here
  const result = await this.checkFeature();
  
  this.testResults.newFeature = {
    status: result ? 'PASS' : 'FAIL',
    // Additional test data
  };
}
```

### Modifying Test Configuration
```javascript
// Update TEST_CONFIG in dashboard.test.js
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeouts: {
    page: 30000,
    element: 10000
  },
  // Add your configuration
};
```

### Custom Screenshot Capture
```javascript
// In chrome-mcp-integration.js
await this.captureScreenshot('my-test-step');
```

## 📈 Performance Benchmarks

### Target Metrics
- **Page Load**: < 3 seconds
- **Memory Usage**: < 100MB heap
- **Console Errors**: 0 errors
- **Accessibility**: 100% WCAG 2.2 AA
- **Responsive**: All viewports functional

### Common Issues
- React hydration errors
- Missing ARIA labels
- Color contrast failures
- Memory leaks
- Network request inefficiencies

## 🔧 Troubleshooting

### Test Failures
1. **Console Errors**: Check browser dev tools for detailed stack traces
2. **Theme Issues**: Verify CSS variable definitions
3. **Accessibility**: Use browser accessibility auditing tools
4. **Chrome MCP**: Ensure extension is properly configured

### Performance Issues
1. Check network tab for slow requests
2. Monitor memory usage in dev tools
3. Verify loading states are implemented
4. Test on slower devices/connections

### Responsive Problems
1. Test with browser dev tools device emulation
2. Check CSS breakpoints and media queries
3. Verify touch targets meet minimum sizes
4. Test navigation on mobile devices

## 📚 Resources

- [Material Design 3 Guidelines](https://m3.material.io/)
- [WCAG 2.2 Accessibility Standards](https://www.w3.org/WAI/WCAG22/quickref/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Chrome DevTools Testing](https://developer.chrome.com/docs/devtools/testing/)

## 🤝 Contributing

1. Add new test cases to appropriate test files
2. Update documentation for new features
3. Ensure tests are idempotent and reliable
4. Include both positive and negative test scenarios
5. Add visual regression tests for UI changes

## 📄 License

This test suite is part of the Email Intelligence Dashboard project and follows the same licensing terms.