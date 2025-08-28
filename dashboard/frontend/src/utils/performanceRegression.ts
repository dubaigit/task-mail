/**
 * Automated Performance Regression Detection System
 * 
 * Monitors performance metrics over time to detect regressions using
 * statistical analysis, trend detection, and machine learning techniques.
 */

import { PerformanceMetrics } from './performanceMonitor';

export interface RegressionConfig {
  sensitivityThreshold: number; // Percentage change to trigger alert (default: 20%)
  minimumSamples: number; // Minimum samples needed for analysis (default: 10)
  trendWindow: number; // Number of recent samples to analyze (default: 20)
  baselineWindow: number; // Number of baseline samples (default: 50)
  enableAnomlyDetection: boolean;
  enableTrendAnalysis: boolean;
  enableSeasonalAdjustment: boolean;
}

export interface RegressionAlert {
  metric: string;
  type: 'regression' | 'improvement' | 'anomaly' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  baselineValue: number;
  percentageChange: number;
  confidence: number; // 0-1 scale
  timestamp: number;
  description: string;
  recommendation?: string;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  percentile95: number;
  percentile99: number;
  outlierCount: number;
}

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  correlation: number;
  confidence: number;
  projection: number; // Projected value for next period
}

export interface RegressionReport {
  timestamp: number;
  metrics: string[];
  alerts: RegressionAlert[];
  summary: {
    totalAlerts: number;
    regressionCount: number;
    improvementCount: number;
    anomalyCount: number;
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  };
  recommendations: string[];
}

class PerformanceRegressionDetector {
  private config: RegressionConfig;
  private metricsHistory: Map<string, number[]> = new Map();
  private alerts: RegressionAlert[] = [];
  private callbacks: Map<string, Function> = new Map();

  constructor(config?: Partial<RegressionConfig>) {
    this.config = {
      sensitivityThreshold: 20,
      minimumSamples: 10,
      trendWindow: 20,
      baselineWindow: 50,
      enableAnomlyDetection: true,
      enableTrendAnalysis: true,
      enableSeasonalAdjustment: false,
      ...config
    };
  }

  /**
   * Add performance metrics for analysis
   */
  addMetrics(metrics: PerformanceMetrics): void {
    const metricPaths = [
      'coreWebVitals.lcp',
      'coreWebVitals.inp',
      'coreWebVitals.cls',
      'coreWebVitals.fcp',
      'coreWebVitals.ttfb',
      'memoryUsage.used',
      'memoryUsage.percentage',
      'resourceMetrics.totalSize',
      'resourceMetrics.totalResources',
      'resourceMetrics.slowestResource',
      'renderMetrics.renderTime',
      'userExperience.timeToInteractive',
      'userExperience.pageResponseTime'
    ];

    for (const path of metricPaths) {
      const value = this.getNestedValue(metrics, path);
      if (value !== null && !isNaN(value)) {
        this.addMetricValue(path, value);
      }
    }

    // Analyze for regressions after adding new data
    this.analyzeRegressions();
  }

  /**
   * Add individual metric value
   */
  private addMetricValue(metricPath: string, value: number): void {
    if (!this.metricsHistory.has(metricPath)) {
      this.metricsHistory.set(metricPath, []);
    }

    const history = this.metricsHistory.get(metricPath)!;
    history.push(value);

    // Keep only recent history to prevent memory bloat
    const maxHistory = this.config.baselineWindow + this.config.trendWindow;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Analyze all metrics for regressions
   */
  analyzeRegressions(): RegressionReport {
    const alerts: RegressionAlert[] = [];
    const analyzedMetrics: string[] = [];

    for (const [metricPath, history] of Array.from(this.metricsHistory.entries())) {
      if (history.length < this.config.minimumSamples) continue;

      analyzedMetrics.push(metricPath);

      // Statistical regression detection
      const regressionAlert = this.detectStatisticalRegression(metricPath, history);
      if (regressionAlert) alerts.push(regressionAlert);

      // Anomaly detection
      if (this.config.enableAnomlyDetection) {
        const anomalyAlert = this.detectAnomaly(metricPath, history);
        if (anomalyAlert) alerts.push(anomalyAlert);
      }

      // Trend analysis
      if (this.config.enableTrendAnalysis) {
        const trendAlert = this.detectTrend(metricPath, history);
        if (trendAlert) alerts.push(trendAlert);
      }
    }

    // Store alerts
    this.alerts.push(...alerts);
    
    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    const report: RegressionReport = {
      timestamp: Date.now(),
      metrics: analyzedMetrics,
      alerts,
      summary: this.generateSummary(alerts),
      recommendations: this.generateRecommendations(alerts)
    };

    // Notify listeners
    if (alerts.length > 0) {
      const callback = this.callbacks.get('regression-detected');
      if (callback) callback(report);
    }

    return report;
  }

  /**
   * Detect statistical regressions using t-test approach
   */
  private detectStatisticalRegression(metricPath: string, history: number[]): RegressionAlert | null {
    if (history.length < this.config.minimumSamples * 2) return null;

    const recentSamples = history.slice(-this.config.trendWindow);
    const baselineSamples = history.slice(
      Math.max(0, history.length - this.config.baselineWindow - this.config.trendWindow),
      history.length - this.config.trendWindow
    );

    if (baselineSamples.length < this.config.minimumSamples) return null;

    const recentStats = this.calculateStatistics(recentSamples);
    const baselineStats = this.calculateStatistics(baselineSamples);

    const percentageChange = ((recentStats.mean - baselineStats.mean) / baselineStats.mean) * 100;
    
    // Calculate statistical significance using Welch's t-test
    const tStatistic = this.calculateTStatistic(recentSamples, baselineSamples);
    const confidence = this.calculateConfidence(tStatistic, recentSamples.length + baselineSamples.length - 2);

    const absPercentageChange = Math.abs(percentageChange);
    
    if (absPercentageChange >= this.config.sensitivityThreshold && confidence > 0.8) {
      const isRegression = this.isMetricRegression(metricPath, percentageChange);
      
      return {
        metric: metricPath,
        type: isRegression ? 'regression' : 'improvement',
        severity: this.calculateSeverity(absPercentageChange, confidence),
        currentValue: recentStats.mean,
        baselineValue: baselineStats.mean,
        percentageChange,
        confidence,
        timestamp: Date.now(),
        description: this.generateDescription(metricPath, percentageChange, isRegression),
        recommendation: this.generateRecommendation(metricPath, isRegression)
      };
    }

    return null;
  }

  /**
   * Detect anomalies using IQR method
   */
  private detectAnomaly(metricPath: string, history: number[]): RegressionAlert | null {
    if (history.length < this.config.minimumSamples) return null;

    const recentValue = history[history.length - 1];
    const stats = this.calculateStatistics(history.slice(0, -1)); // Exclude current value
    
    const q1 = this.calculatePercentile(history.slice(0, -1), 25);
    const q3 = this.calculatePercentile(history.slice(0, -1), 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    if (recentValue < lowerBound || recentValue > upperBound) {
      const percentageFromMedian = ((recentValue - stats.median) / stats.median) * 100;
      
      return {
        metric: metricPath,
        type: 'anomaly',
        severity: this.calculateAnomalySeverity(recentValue, lowerBound, upperBound),
        currentValue: recentValue,
        baselineValue: stats.median,
        percentageChange: percentageFromMedian,
        confidence: 0.9, // High confidence for IQR-based detection
        timestamp: Date.now(),
        description: `Anomalous value detected for ${this.getMetricDisplayName(metricPath)}`,
        recommendation: 'Investigate potential causes for this unusual measurement'
      };
    }

    return null;
  }

  /**
   * Detect trends using linear regression
   */
  private detectTrend(metricPath: string, history: number[]): RegressionAlert | null {
    if (history.length < this.config.trendWindow) return null;

    const recentHistory = history.slice(-this.config.trendWindow);
    const trendAnalysis = this.calculateTrend(recentHistory);
    
    if (Math.abs(trendAnalysis.correlation) > 0.7 && trendAnalysis.confidence > 0.8) {
      const isNegativeTrend = this.isMetricRegression(metricPath, trendAnalysis.slope * 100);
      
      if (isNegativeTrend && trendAnalysis.trend !== 'stable') {
        return {
          metric: metricPath,
          type: 'trend',
          severity: this.calculateTrendSeverity(trendAnalysis),
          currentValue: recentHistory[recentHistory.length - 1],
          baselineValue: recentHistory[0],
          percentageChange: ((recentHistory[recentHistory.length - 1] - recentHistory[0]) / recentHistory[0]) * 100,
          confidence: trendAnalysis.confidence,
          timestamp: Date.now(),
          description: `${trendAnalysis.trend} trend detected for ${this.getMetricDisplayName(metricPath)}`,
          recommendation: 'Monitor this trend and consider preventive measures'
        };
      }
    }

    return null;
  }

  /**
   * Calculate statistical summary
   */
  private calculateStatistics(values: number[]): StatisticalSummary {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = this.calculatePercentile(sorted, 50);
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const percentile95 = this.calculatePercentile(sorted, 95);
    const percentile99 = this.calculatePercentile(sorted, 99);
    
    // Count outliers (values beyond 2 standard deviations)
    const outlierCount = values.filter(val => 
      Math.abs(val - mean) > 2 * standardDeviation
    ).length;

    return {
      mean,
      median,
      standardDeviation,
      variance,
      percentile95,
      percentile99,
      outlierCount
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate t-statistic for two samples
   */
  private calculateTStatistic(sample1: number[], sample2: number[]): number {
    const mean1 = sample1.reduce((sum, val) => sum + val, 0) / sample1.length;
    const mean2 = sample2.reduce((sum, val) => sum + val, 0) / sample2.length;
    
    const variance1 = sample1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (sample1.length - 1);
    const variance2 = sample2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (sample2.length - 1);
    
    const pooledStd = Math.sqrt((variance1 / sample1.length) + (variance2 / sample2.length));
    
    return Math.abs(mean1 - mean2) / pooledStd;
  }

  /**
   * Calculate confidence from t-statistic
   */
  private calculateConfidence(tStatistic: number, degreesOfFreedom: number): number {
    // Simplified confidence calculation
    // In a real implementation, you'd use a proper t-distribution table
    if (tStatistic > 2.5) return 0.95;
    if (tStatistic > 2.0) return 0.9;
    if (tStatistic > 1.5) return 0.8;
    if (tStatistic > 1.0) return 0.7;
    return 0.5;
  }

  /**
   * Calculate trend using linear regression
   */
  private calculateTrend(values: number[]): TrendAnalysis {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
    
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    
    // Calculate correlation coefficient
    const ssxx = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
    const ssyy = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const ssxy = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
    
    const correlation = ssxy / Math.sqrt(ssxx * ssyy);
    
    const trend = Math.abs(slope) < 0.01 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';
    const confidence = Math.abs(correlation);
    const projection = slope * n + intercept;
    
    return { trend, slope, correlation, confidence, projection };
  }

  /**
   * Determine if a percentage change represents a regression for a specific metric
   */
  private isMetricRegression(metricPath: string, percentageChange: number): boolean {
    // Metrics where higher values are worse (regressions)
    const higherIsBadMetrics = [
      'coreWebVitals.lcp',
      'coreWebVitals.inp',
      'coreWebVitals.cls',
      'coreWebVitals.fcp',
      'coreWebVitals.ttfb',
      'memoryUsage.used',
      'memoryUsage.percentage',
      'resourceMetrics.totalSize',
      'resourceMetrics.totalResources',
      'resourceMetrics.slowestResource',
      'renderMetrics.renderTime',
      'userExperience.timeToInteractive',
      'userExperience.pageResponseTime',
      'userExperience.errorRate'
    ];
    
    const isHigherBadMetric = higherIsBadMetrics.some(metric => metricPath.includes(metric));
    
    return isHigherBadMetric ? percentageChange > 0 : percentageChange < 0;
  }

  /**
   * Calculate severity based on change magnitude and confidence
   */
  private calculateSeverity(percentageChange: number, confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    const weightedScore = percentageChange * confidence;
    
    if (weightedScore > 50) return 'critical';
    if (weightedScore > 30) return 'high';
    if (weightedScore > 15) return 'medium';
    return 'low';
  }

  /**
   * Calculate anomaly severity
   */
  private calculateAnomalySeverity(value: number, lowerBound: number, upperBound: number): 'low' | 'medium' | 'high' | 'critical' {
    const distanceFromBounds = Math.min(
      Math.abs(value - lowerBound),
      Math.abs(value - upperBound)
    );
    const range = upperBound - lowerBound;
    const severity = distanceFromBounds / range;
    
    if (severity > 3) return 'critical';
    if (severity > 2) return 'high';
    if (severity > 1) return 'medium';
    return 'low';
  }

  /**
   * Calculate trend severity
   */
  private calculateTrendSeverity(trendAnalysis: TrendAnalysis): 'low' | 'medium' | 'high' | 'critical' {
    const combinedScore = Math.abs(trendAnalysis.slope) * Math.abs(trendAnalysis.correlation) * trendAnalysis.confidence;
    
    if (combinedScore > 0.8) return 'critical';
    if (combinedScore > 0.6) return 'high';
    if (combinedScore > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable metric display name
   */
  private getMetricDisplayName(metricPath: string): string {
    const displayNames: { [key: string]: string } = {
      'coreWebVitals.lcp': 'Largest Contentful Paint',
      'coreWebVitals.inp': 'Interaction to Next Paint',
      'coreWebVitals.cls': 'Cumulative Layout Shift',
      'coreWebVitals.fcp': 'First Contentful Paint',
      'coreWebVitals.ttfb': 'Time to First Byte',
      'memoryUsage.used': 'Memory Usage',
      'memoryUsage.percentage': 'Memory Usage Percentage',
      'resourceMetrics.totalSize': 'Total Bundle Size',
      'resourceMetrics.totalResources': 'Resource Count',
      'resourceMetrics.slowestResource': 'Slowest Resource',
      'renderMetrics.renderTime': 'Render Time',
      'userExperience.timeToInteractive': 'Time to Interactive',
      'userExperience.pageResponseTime': 'Page Response Time'
    };

    return displayNames[metricPath] || metricPath;
  }

  /**
   * Generate alert description
   */
  private generateDescription(metricPath: string, percentageChange: number, isRegression: boolean): string {
    const metricName = this.getMetricDisplayName(metricPath);
    const changeType = isRegression ? 'increased' : 'improved';
    const absChange = Math.abs(percentageChange).toFixed(1);
    
    return `${metricName} has ${changeType} by ${absChange}% compared to baseline`;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(metricPath: string, isRegression: boolean): string {
    if (!isRegression) return 'Continue monitoring to maintain this improvement';

    const recommendations: { [key: string]: string } = {
      'coreWebVitals.lcp': 'Optimize images, reduce server response time, preload critical resources',
      'coreWebVitals.inp': 'Reduce JavaScript execution time, optimize event handlers',
      'coreWebVitals.cls': 'Set explicit dimensions for images, avoid inserting content above fold',
      'memoryUsage.used': 'Check for memory leaks, optimize component re-renders',
      'resourceMetrics.totalSize': 'Enable compression, remove unused code, optimize assets',
      'renderMetrics.renderTime': 'Optimize React re-renders, use virtualization for large lists'
    };

    return recommendations[metricPath] || 'Investigate and optimize this metric';
  }

  /**
   * Generate overall summary
   */
  private generateSummary(alerts: RegressionAlert[]): any {
    const regressionCount = alerts.filter(a => a.type === 'regression').length;
    const improvementCount = alerts.filter(a => a.type === 'improvement').length;
    const anomalyCount = alerts.filter(a => a.type === 'anomaly').length;
    
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;
    
    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    
    if (criticalCount > 0) overallHealth = 'critical';
    else if (highCount > 2 || regressionCount > 3) overallHealth = 'warning';
    else if (regressionCount > 0 || anomalyCount > 0) overallHealth = 'good';
    else overallHealth = 'excellent';

    return {
      totalAlerts: alerts.length,
      regressionCount,
      improvementCount,
      anomalyCount,
      overallHealth
    };
  }

  /**
   * Generate recommendations based on alerts
   */
  private generateRecommendations(alerts: RegressionAlert[]): string[] {
    const recommendations = new Set<string>();
    
    alerts.forEach(alert => {
      if (alert.recommendation) {
        recommendations.add(alert.recommendation);
      }
    });
    
    // Add general recommendations based on alert patterns
    const regressionCount = alerts.filter(a => a.type === 'regression').length;
    if (regressionCount > 3) {
      recommendations.add('Consider implementing stricter performance budgets');
      recommendations.add('Review recent code changes for performance impact');
    }
    
    return Array.from(recommendations);
  }

  /**
   * Helper function to get nested object values
   */
  private getNestedValue(obj: any, path: string): number | null {
    const value = path.split('.').reduce((current, key) => current?.[key], obj);
    return typeof value === 'number' && !isNaN(value) ? value : null;
  }

  /**
   * Get latest alerts
   */
  getLatestAlerts(limit: number = 10): RegressionAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): RegressionAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.metricsHistory.clear();
    this.alerts = [];
  }

  /**
   * Register callback for regression events
   */
  onRegressionDetected(callback: (report: RegressionReport) => void): void {
    this.callbacks.set('regression-detected', callback);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const regressionDetector = new PerformanceRegressionDetector();

// React hook for regression monitoring
export function usePerformanceRegression() {
  return {
    detector: regressionDetector,
    addMetrics: (metrics: PerformanceMetrics) => regressionDetector.addMetrics(metrics),
    getLatestAlerts: (limit?: number) => regressionDetector.getLatestAlerts(limit),
    analyzeRegressions: () => regressionDetector.analyzeRegressions()
  };
}

export default PerformanceRegressionDetector;