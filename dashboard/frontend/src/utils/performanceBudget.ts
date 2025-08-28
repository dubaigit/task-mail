/**
 * Performance Budget Enforcement System
 * 
 * Implements automated performance budget monitoring with configurable thresholds,
 * budget alerts, CI/CD integration capabilities, and performance gates.
 */

import { performanceMonitor, PerformanceMetrics, PerformanceBudget } from './performanceMonitor';

export interface BudgetRule {
  metric: string;
  threshold: number;
  unit?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  blocking: boolean; // Whether this rule blocks deployment
  description: string;
}

export interface BudgetConfig {
  rules: BudgetRule[];
  alertWebhook?: string;
  slackChannel?: string;
  emailNotifications?: string[];
  ciIntegration: {
    enabled: boolean;
    failOnCritical: boolean;
    failOnBlocking: boolean;
  };
}

export interface BudgetViolation {
  rule: BudgetRule;
  currentValue: number;
  threshold: number;
  percentage: number;
  timestamp: number;
  blocking: boolean;
}

export interface BudgetReport {
  timestamp: number;
  status: 'pass' | 'warning' | 'fail';
  violations: BudgetViolation[];
  metrics: PerformanceMetrics;
  summary: {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    blockingViolations: number;
  };
}

class PerformanceBudgetEnforcer {
  private config: BudgetConfig;
  private callbacks: Map<string, Function> = new Map();
  private reports: BudgetReport[] = [];
  private isMonitoring: boolean = false;

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  /**
   * Default performance budget configuration
   */
  static getDefaultBudget(): BudgetConfig {
    return {
      rules: [
        // Core Web Vitals
        {
          metric: 'coreWebVitals.lcp',
          threshold: 2500,
          unit: 'ms',
          severity: 'critical',
          blocking: true,
          description: 'Largest Contentful Paint must be under 2.5 seconds'
        },
        {
          metric: 'coreWebVitals.inp',
          threshold: 200,
          unit: 'ms',
          severity: 'critical',
          blocking: true,
          description: 'Interaction to Next Paint must be under 200ms'
        },
        {
          metric: 'coreWebVitals.cls',
          threshold: 0.1,
          severity: 'critical',
          blocking: true,
          description: 'Cumulative Layout Shift must be under 0.1'
        },
        {
          metric: 'coreWebVitals.fcp',
          threshold: 1800,
          unit: 'ms',
          severity: 'warning',
          blocking: false,
          description: 'First Contentful Paint should be under 1.8 seconds'
        },
        {
          metric: 'coreWebVitals.ttfb',
          threshold: 600,
          unit: 'ms',
          severity: 'warning',
          blocking: false,
          description: 'Time to First Byte should be under 600ms'
        },
        
        // Resource Budget
        {
          metric: 'resourceMetrics.totalSize',
          threshold: 500 * 1024, // 500KB
          unit: 'bytes',
          severity: 'error',
          blocking: true,
          description: 'Total bundle size must be under 500KB'
        },
        {
          metric: 'resourceMetrics.totalResources',
          threshold: 100,
          severity: 'warning',
          blocking: false,
          description: 'Total resource count should be under 100'
        },
        {
          metric: 'resourceMetrics.largestResource',
          threshold: 100 * 1024, // 100KB
          unit: 'bytes',
          severity: 'warning',
          blocking: false,
          description: 'Largest resource should be under 100KB'
        },
        
        // Memory Budget
        {
          metric: 'memoryUsage.used',
          threshold: 50 * 1024 * 1024, // 50MB
          unit: 'bytes',
          severity: 'error',
          blocking: true,
          description: 'Memory usage must be under 50MB'
        },
        {
          metric: 'memoryUsage.percentage',
          threshold: 80,
          unit: '%',
          severity: 'warning',
          blocking: false,
          description: 'Memory usage percentage should be under 80%'
        },
        
        // Render Performance
        {
          metric: 'renderMetrics.renderTime',
          threshold: 16,
          unit: 'ms',
          severity: 'warning',
          blocking: false,
          description: 'Render time should be under 16ms (60fps)'
        },
        
        // User Experience
        {
          metric: 'userExperience.timeToInteractive',
          threshold: 3000,
          unit: 'ms',
          severity: 'error',
          blocking: true,
          description: 'Time to Interactive must be under 3 seconds'
        },
        {
          metric: 'userExperience.errorRate',
          threshold: 1,
          unit: '%',
          severity: 'critical',
          blocking: true,
          description: 'Error rate must be under 1%'
        }
      ],
      ciIntegration: {
        enabled: true,
        failOnCritical: true,
        failOnBlocking: true
      }
    };
  }

  /**
   * Start continuous budget monitoring
   */
  startMonitoring(interval: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Initial evaluation
    this.evaluateBudget();

    // Set up periodic monitoring
    const monitoringInterval = setInterval(() => {
      this.evaluateBudget();
    }, interval);

    // Store interval for cleanup
    this.callbacks.set('monitoring-interval', () => clearInterval(monitoringInterval));
  }

  /**
   * Stop budget monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    const cleanup = this.callbacks.get('monitoring-interval');
    if (cleanup) cleanup();
  }

  /**
   * Evaluate current performance against budget
   */
  evaluateBudget(): BudgetReport {
    const currentMetrics = performanceMonitor.getLatestMetrics();
    if (!currentMetrics) {
      throw new Error('No performance metrics available for budget evaluation');
    }

    const violations: BudgetViolation[] = [];
    
    for (const rule of this.config.rules) {
      const currentValue = this.getMetricValue(currentMetrics, rule.metric);
      if (currentValue === null) continue;

      if (currentValue > rule.threshold) {
        const percentage = ((currentValue - rule.threshold) / rule.threshold) * 100;
        
        violations.push({
          rule,
          currentValue,
          threshold: rule.threshold,
          percentage,
          timestamp: Date.now(),
          blocking: rule.blocking
        });
      }
    }

    const report: BudgetReport = {
      timestamp: Date.now(),
      status: this.getReportStatus(violations),
      violations,
      metrics: currentMetrics,
      summary: {
        totalRules: this.config.rules.length,
        passedRules: this.config.rules.length - violations.length,
        failedRules: violations.length,
        blockingViolations: violations.filter(v => v.blocking).length
      }
    };

    // Store report
    this.reports.push(report);
    
    // Keep only last 100 reports
    if (this.reports.length > 100) {
      this.reports = this.reports.slice(-100);
    }

    // Trigger alerts if needed
    if (violations.length > 0) {
      this.handleViolations(report);
    }

    // Notify listeners
    const callback = this.callbacks.get('budget-evaluation');
    if (callback) callback(report);

    return report;
  }

  /**
   * Get metric value from performance data
   */
  private getMetricValue(metrics: PerformanceMetrics, metricPath: string): number | null {
    const value = metricPath.split('.').reduce((obj: any, key: string) => {
      return obj?.[key];
    }, metrics);

    return typeof value === 'number' ? value : null;
  }

  /**
   * Determine overall report status
   */
  private getReportStatus(violations: BudgetViolation[]): 'pass' | 'warning' | 'fail' {
    if (violations.length === 0) return 'pass';
    
    const hasCritical = violations.some(v => v.rule.severity === 'critical');
    const hasBlocking = violations.some(v => v.blocking);
    
    if (hasCritical || (hasBlocking && this.config.ciIntegration.failOnBlocking)) {
      return 'fail';
    }
    
    return 'warning';
  }

  /**
   * Handle budget violations
   */
  private handleViolations(report: BudgetReport): void {
    const criticalViolations = report.violations.filter(v => v.rule.severity === 'critical');
    const blockingViolations = report.violations.filter(v => v.blocking);

    // Console logging
    // 🚨 Performance Budget Violations
    
    report.violations.forEach(violation => {
      const emoji = this.getSeverityEmoji(violation.rule.severity);
      const value = violation.rule.unit ? 
        `${violation.currentValue} ${violation.rule.unit}` : 
        violation.currentValue.toString();
      const threshold = violation.rule.unit ? 
        `${violation.threshold} ${violation.rule.unit}` : 
        violation.threshold.toString();
      
      // ${emoji} ${violation.rule.description}
      //    Current: ${value} | Threshold: ${threshold} | Over by: ${violation.percentage.toFixed(1)}%
    });
    
    // Console group end

    // Send alerts based on configuration
    if (this.config.alertWebhook) {
      this.sendWebhookAlert(report);
    }

    if (this.config.emailNotifications) {
      this.sendEmailAlert(report);
    }

    // Trigger custom callbacks
    const alertCallback = this.callbacks.get('violation-alert');
    if (alertCallback) alertCallback(report);
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'error': return '🟠';
      case 'warning': return '🟡';
      default: return 'ℹ️';
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(report: BudgetReport): Promise<void> {
    if (!this.config.alertWebhook) return;

    try {
      const payload = {
        timestamp: report.timestamp,
        status: report.status,
        summary: report.summary,
        violations: report.violations.map(v => ({
          metric: v.rule.metric,
          description: v.rule.description,
          severity: v.rule.severity,
          currentValue: v.currentValue,
          threshold: v.threshold,
          percentage: v.percentage,
          blocking: v.blocking
        }))
      };

      await fetch(this.config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Failed to send webhook alert: ${error}
    }
  }

  /**
   * Send email alert (mock implementation)
   */
  private sendEmailAlert(report: BudgetReport): void {
    if (!this.config.emailNotifications) return;

    // In a real implementation, this would integrate with an email service
    // 📧 Email alert would be sent to: ${this.config.emailNotifications}
    // Report summary: ${report.summary}
  }

  /**
   * Generate CI/CD compatible report
   */
  generateCIReport(): { success: boolean; exitCode: number; report: string } {
    const latestReport = this.getLatestReport();
    if (!latestReport) {
      return {
        success: false,
        exitCode: 1,
        report: 'No performance data available for budget evaluation'
      };
    }

    const { status, violations, summary } = latestReport;
    
    let reportText = `Performance Budget Report\n`;
    reportText += `========================\n\n`;
    reportText += `Status: ${status.toUpperCase()}\n`;
    reportText += `Total Rules: ${summary.totalRules}\n`;
    reportText += `Passed: ${summary.passedRules}\n`;
    reportText += `Failed: ${summary.failedRules}\n`;
    reportText += `Blocking Violations: ${summary.blockingViolations}\n\n`;

    if (violations.length > 0) {
      reportText += `Violations:\n`;
      reportText += `-----------\n`;
      
      violations.forEach((violation, index) => {
        reportText += `${index + 1}. ${violation.rule.description}\n`;
        reportText += `   Severity: ${violation.rule.severity.toUpperCase()}\n`;
        reportText += `   Current: ${violation.currentValue}${violation.rule.unit || ''}\n`;
        reportText += `   Threshold: ${violation.threshold}${violation.rule.unit || ''}\n`;
        reportText += `   Over by: ${violation.percentage.toFixed(1)}%\n`;
        if (violation.blocking) reportText += `   ⚠️  BLOCKING DEPLOYMENT\n`;
        reportText += `\n`;
      });
    }

    const shouldFail = 
      (this.config.ciIntegration.failOnCritical && violations.some(v => v.rule.severity === 'critical')) ||
      (this.config.ciIntegration.failOnBlocking && summary.blockingViolations > 0);

    return {
      success: !shouldFail,
      exitCode: shouldFail ? 1 : 0,
      report: reportText
    };
  }

  /**
   * Update budget configuration
   */
  updateConfig(newConfig: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Add custom budget rule
   */
  addRule(rule: BudgetRule): void {
    this.config.rules.push(rule);
  }

  /**
   * Remove budget rule
   */
  removeRule(metricPath: string): void {
    this.config.rules = this.config.rules.filter(rule => rule.metric !== metricPath);
  }

  /**
   * Get latest budget report
   */
  getLatestReport(): BudgetReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  /**
   * Get all reports
   */
  getAllReports(): BudgetReport[] {
    return [...this.reports];
  }

  /**
   * Get reports within time range
   */
  getReportsInRange(startTime: number, endTime: number): BudgetReport[] {
    return this.reports.filter(report => 
      report.timestamp >= startTime && report.timestamp <= endTime
    );
  }

  /**
   * Register callback for budget events
   */
  onBudgetEvaluation(callback: (report: BudgetReport) => void): void {
    this.callbacks.set('budget-evaluation', callback);
  }

  /**
   * Register callback for violations
   */
  onViolationAlert(callback: (report: BudgetReport) => void): void {
    this.callbacks.set('violation-alert', callback);
  }

  /**
   * Export budget configuration
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import budget configuration
   */
  importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      this.config = { ...this.config, ...config };
    } catch (error) {
      throw new Error('Invalid budget configuration JSON');
    }
  }
}

// Singleton instance
export const performanceBudget = new PerformanceBudgetEnforcer(
  PerformanceBudgetEnforcer.getDefaultBudget()
);

// React hook for budget monitoring
export function usePerformanceBudget() {
  return {
    budget: performanceBudget,
    evaluateBudget: () => performanceBudget.evaluateBudget(),
    getLatestReport: () => performanceBudget.getLatestReport(),
    getAllReports: () => performanceBudget.getAllReports(),
    generateCIReport: () => performanceBudget.generateCIReport()
  };
}

// CLI integration utility
export function runBudgetCheck(): void {
  const budget = new PerformanceBudgetEnforcer(
    PerformanceBudgetEnforcer.getDefaultBudget()
  );
  
  // Capture current metrics
  performanceMonitor.captureCurrentMetrics();
  
  // Wait a moment for metrics to be captured
  setTimeout(() => {
    const ciReport = budget.generateCIReport();
    // ${ciReport.report}
    process.exit(ciReport.exitCode);
  }, 1000);
}

export default PerformanceBudgetEnforcer;