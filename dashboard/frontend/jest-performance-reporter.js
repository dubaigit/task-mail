/**
 * Frontend Jest Performance Reporter
 * Specialized for React component testing performance
 */

const fs = require('fs');
const path = require('path');

class FrontendPerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.componentTestResults = [];
    this.renderPerformance = [];
    this.suiteStartTime = null;
  }

  onRunStart() {
    this.suiteStartTime = Date.now();
    console.log('📊 Frontend performance monitoring started...');
  }

  onTestResult(test, testResult) {
    const { testFilePath, perfStats } = testResult;
    const relativePath = testFilePath.replace(this.globalConfig.rootDir, '');
    
    // Categorize tests by component type
    const testCategory = this.categorizeTest(relativePath);
    
    // Track slow component tests (>500ms for frontend)
    const slowTests = testResult.testResults.filter(t => t.duration > 500);
    
    // Track memory usage patterns
    const memoryUsage = process.memoryUsage();
    
    const testData = {
      filePath: relativePath,
      category: testCategory,
      duration: perfStats.end - perfStats.start,
      numTests: testResult.testResults.length,
      slowTests: slowTests.length,
      memoryUsage,
      timestamp: Date.now(),
      coverage: this.extractCoverageInfo(testResult),
      renderingMetrics: this.extractRenderingMetrics(testResult)
    };

    this.componentTestResults.push(testData);

    // Log slow component tests
    if (slowTests.length > 0) {
      console.warn(`⚠️  Slow component tests in ${relativePath}:`);
      slowTests.forEach(test => {
        console.warn(`   - ${test.title}: ${test.duration}ms`);
      });
    }

    // Check for potential performance issues
    this.analyzePerformanceIssues(testData, testResult);
  }

  onRunComplete(contexts, results) {
    const totalTime = Date.now() - this.suiteStartTime;
    const avgTestTime = this.componentTestResults.reduce((sum, r) => sum + r.duration, 0) / this.componentTestResults.length || 0;
    
    // Analyze component categories
    const categoryAnalysis = this.analyzeCategoryPerformance();
    
    // Find slowest components
    const slowestComponents = this.componentTestResults
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const report = {
      summary: {
        totalTime,
        avgTestTime: Math.round(avgTestTime),
        totalTests: results.numTotalTests,
        passedTests: results.numPassedTests,
        failedTests: results.numFailedTests,
        componentCategories: categoryAnalysis
      },
      performance: {
        slowestComponents: slowestComponents.map(c => ({
          file: c.filePath,
          category: c.category,
          duration: c.duration,
          testsCount: c.numTests,
          slowTests: c.slowTests,
          coverage: c.coverage
        })),
        memoryPeaks: this.componentTestResults
          .map(r => r.memoryUsage.heapUsed)
          .sort((a, b) => b - a)
          .slice(0, 5),
        categoryBreakdown: categoryAnalysis,
        renderingIssues: this.renderPerformance.filter(r => r.issues.length > 0)
      },
      recommendations: this.generateRecommendations(totalTime, avgTestTime, categoryAnalysis)
    };

    // Write detailed performance report
    const reportPath = path.join(this.globalConfig.rootDir, 'coverage/frontend-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate performance badge data
    this.generatePerformanceBadge(report);

    // Console summary
    this.displayConsoleSummary(report, totalTime, avgTestTime);
  }

  categorizeTest(filePath) {
    if (filePath.includes('/TaskCentric/')) return 'TaskCentric';
    if (filePath.includes('/Email/')) return 'Email';
    if (filePath.includes('/Analytics/')) return 'Analytics';
    if (filePath.includes('/AI/') || filePath.includes('/AIAssistant/')) return 'AI';
    if (filePath.includes('/ui/')) return 'UI Components';
    if (filePath.includes('/stores/')) return 'State Management';
    if (filePath.includes('/hooks/')) return 'Hooks';
    if (filePath.includes('/utils/')) return 'Utilities';
    return 'Other';
  }

  extractCoverageInfo(testResult) {
    // Extract coverage information if available
    if (testResult.coverage) {
      return {
        lines: testResult.coverage.lines || 0,
        functions: testResult.coverage.functions || 0,
        branches: testResult.coverage.branches || 0,
        statements: testResult.coverage.statements || 0
      };
    }
    return null;
  }

  extractRenderingMetrics(testResult) {
    // Extract React-specific performance metrics
    const renderMetrics = {
      rerenderCount: 0,
      unusedProps: [],
      heavyComputations: []
    };

    // This would be populated by custom React testing utilities
    return renderMetrics;
  }

  analyzePerformanceIssues(testData, testResult) {
    const issues = [];

    // Check for memory growth
    if (testData.memoryUsage.heapUsed > 50 * 1024 * 1024) { // 50MB threshold
      issues.push('High memory usage detected');
    }

    // Check for excessive test duration
    if (testData.duration > 2000) { // 2 second threshold
      issues.push('Component test suite running very slowly');
    }

    // Check for low coverage with slow tests
    if (testData.slowTests > 0 && testData.coverage && testData.coverage.lines < 80) {
      issues.push('Slow tests with low coverage - consider optimization');
    }

    if (issues.length > 0) {
      this.renderPerformance.push({
        file: testData.filePath,
        issues,
        metrics: testData
      });
    }
  }

  analyzeCategoryPerformance() {
    const categories = {};
    
    this.componentTestResults.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          slowTests: 0
        };
      }
      
      const cat = categories[test.category];
      cat.count++;
      cat.totalTime += test.duration;
      cat.slowTests += test.slowTests;
    });

    // Calculate averages
    Object.keys(categories).forEach(key => {
      categories[key].avgTime = Math.round(categories[key].totalTime / categories[key].count);
    });

    return categories;
  }

  generateRecommendations(totalTime, avgTestTime, categoryAnalysis) {
    const recommendations = [];

    if (avgTestTime > 1000) {
      recommendations.push('Average component test time is high - consider mocking heavy dependencies');
    }

    if (totalTime > 120000) { // 2 minutes
      recommendations.push('Total frontend test suite exceeds 2 minutes - consider test parallelization');
    }

    // Category-specific recommendations
    Object.entries(categoryAnalysis).forEach(([category, data]) => {
      if (data.avgTime > 1500) {
        recommendations.push(`${category} tests are slow (${data.avgTime}ms avg) - review for optimization opportunities`);
      }
    });

    if (this.renderPerformance.length > 0) {
      recommendations.push('Performance issues detected in component rendering - review flagged components');
    }

    return recommendations;
  }

  generatePerformanceBadge(report) {
    // Generate performance badge data for README
    const avgTime = report.summary.avgTestTime;
    let color = 'brightgreen';
    let status = 'fast';

    if (avgTime > 1000) {
      color = 'yellow';
      status = 'moderate';
    }
    if (avgTime > 2000) {
      color = 'red';
      status = 'slow';
    }

    const badgeData = {
      schemaVersion: 1,
      label: 'frontend tests',
      message: `${avgTime}ms avg (${status})`,
      color
    };

    const badgePath = path.join(this.globalConfig.rootDir, 'coverage/performance-badge.json');
    fs.writeFileSync(badgePath, JSON.stringify(badgeData, null, 2));
  }

  displayConsoleSummary(report, totalTime, avgTestTime) {
    console.log('\n📊 Frontend Performance Summary:');
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Average component test time: ${Math.round(avgTestTime)}ms`);
    console.log(`   Memory peak: ${Math.round(Math.max(...report.performance.memoryPeaks) / 1024 / 1024)}MB`);
    
    console.log('\n📈 Component Category Performance:');
    Object.entries(report.summary.componentCategories).forEach(([category, data]) => {
      console.log(`   ${category}: ${data.count} tests, ${data.avgTime}ms avg`);
    });

    if (report.performance.slowestComponents.length > 0) {
      console.log('\n🐌 Slowest component tests:');
      report.performance.slowestComponents.slice(0, 5).forEach((component, i) => {
        console.log(`   ${i + 1}. ${component.file} (${component.category}) - ${component.duration}ms`);
      });
    }

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
  }
}

module.exports = FrontendPerformanceReporter;