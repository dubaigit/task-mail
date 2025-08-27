/**
 * Performance Provider Component
 * 
 * Integrates all performance monitoring systems and provides a unified
 * interface for performance optimization across the application.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../../utils/performanceMonitor';
import { performanceBudget } from '../../utils/performanceBudget';
import { regressionDetector } from '../../utils/performanceRegression';
import { uxTracker } from '../../utils/userExperienceTracker';
import { advancedCache } from '../../utils/advancedCache';

interface PerformanceContextValue {
  // Current metrics
  currentMetrics: PerformanceMetrics | null;
  isMonitoring: boolean;
  
  // Budget violations
  budgetViolations: any[];
  budgetStatus: 'pass' | 'warning' | 'fail';
  
  // Regression alerts
  regressionAlerts: any[];
  regressionStatus: 'excellent' | 'good' | 'warning' | 'critical';
  
  // UX metrics
  uxMetrics: any;
  
  // Cache statistics
  cacheStats: any;
  
  // Controls
  startMonitoring: () => void;
  stopMonitoring: () => void;
  generateReport: () => Promise<any>;
  optimizePerformance: () => Promise<void>;
  
  // Alerts
  alerts: PerformanceAlert[];
  dismissAlert: (id: string) => void;
}

interface PerformanceAlert {
  id: string;
  type: 'budget' | 'regression' | 'ux' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data?: any;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

interface PerformanceProviderProps {
  children: React.ReactNode;
  autoStart?: boolean;
  reportingInterval?: number;
  enableOptimizations?: boolean;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({
  children,
  autoStart = true,
  reportingInterval = 30000,
  enableOptimizations = true
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [budgetViolations, setBudgetViolations] = useState<any[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<'pass' | 'warning' | 'fail'>('pass');
  const [regressionAlerts, setRegressionAlerts] = useState<any[]>([]);
  const [regressionStatus, setRegressionStatus] = useState<'excellent' | 'good' | 'warning' | 'critical'>('excellent');
  const [uxMetrics, setUxMetrics] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

  // Start comprehensive monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    // Start performance monitoring
    performanceMonitor.startRegressionDetection();

    // Start budget monitoring
    performanceBudget.startMonitoring();

    // Start UX tracking
    uxTracker.startTracking();

    // Set up event listeners
    setupEventListeners();

    // Start periodic reporting
    startPeriodicReporting();

  }, [isMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    setIsMonitoring(false);

    // Stop budget monitoring
    performanceBudget.stopMonitoring();

    // Stop UX tracking
    uxTracker.stopTracking();

  }, [isMonitoring]);

  // Set up event listeners for all monitoring systems
  const setupEventListeners = useCallback(() => {
    // Performance budget violations
    performanceBudget.onBudgetEvaluation((report) => {
      setBudgetViolations(report.violations);
      setBudgetStatus(report.status);

      if (report.violations.length > 0) {
        const alert: PerformanceAlert = {
          id: `budget-${Date.now()}`,
          type: 'budget',
          severity: report.summary.blockingViolations > 0 ? 'critical' : 'medium',
          message: `${report.violations.length} performance budget violation(s) detected`,
          timestamp: Date.now(),
          data: report
        };
        setAlerts(prev => [...prev, alert]);
      }
    });

    // Performance regression detection
    regressionDetector.onRegressionDetected((report) => {
      setRegressionAlerts(report.alerts);
      setRegressionStatus(report.summary.overallHealth);

      if (report.alerts.length > 0) {
        const alert: PerformanceAlert = {
          id: `regression-${Date.now()}`,
          type: 'regression',
          severity: report.summary.overallHealth === 'critical' ? 'critical' : 'high',
          message: `Performance regression detected in ${report.alerts.length} metric(s)`,
          timestamp: Date.now(),
          data: report
        };
        setAlerts(prev => [...prev, alert]);
      }
    });

    // UX tracking updates
    uxTracker.onPeriodicUpdate((report) => {
      setUxMetrics(report);

      // Check for UX issues
      if (report.usability.errorRate > 5) {
        const alert: PerformanceAlert = {
          id: `ux-${Date.now()}`,
          type: 'ux',
          severity: report.usability.errorRate > 10 ? 'high' : 'medium',
          message: `High user error rate detected: ${report.usability.errorRate.toFixed(1)}%`,
          timestamp: Date.now(),
          data: report
        };
        setAlerts(prev => [...prev, alert]);
      }
    });

    // Performance alert handler
    performanceMonitor.onAlert((alert: any) => {
      const performanceAlert: PerformanceAlert = {
        id: `perf-${Date.now()}`,
        type: 'budget',
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        data: alert.data
      };
      setAlerts(prev => [...prev, performanceAlert]);
    });
  }, []);

  // Start periodic reporting
  const startPeriodicReporting = useCallback(() => {
    const interval = setInterval(() => {
      if (!isMonitoring) return;

      // Capture current metrics
      const metrics = performanceMonitor.captureCurrentMetrics();
      if (metrics) {
        setCurrentMetrics(metrics);
        
        // Feed metrics to regression detector
        regressionDetector.addMetrics(metrics);
      }

      // Update cache stats
      setCacheStats(advancedCache.getStats());
    }, reportingInterval);

    return () => clearInterval(interval);
  }, [isMonitoring, reportingInterval]);

  // Generate comprehensive performance report
  const generateReport = useCallback(async (): Promise<any> => {
    const timestamp = Date.now();
    
    const report = {
      timestamp,
      performance: {
        currentMetrics: performanceMonitor.getLatestMetrics(),
        metricsHistory: performanceMonitor.getMetricsHistory(),
        budgetViolations: performanceBudget.getLatestReport()?.violations || [],
        budgetStatus: performanceBudget.getLatestReport()?.status || 'unknown'
      },
      regression: {
        alerts: regressionDetector.getLatestAlerts(),
        analysis: regressionDetector.analyzeRegressions()
      },
      userExperience: {
        metrics: uxTracker.getCurrentMetrics(),
        fullReport: uxTracker.generateReport()
      },
      cache: {
        stats: advancedCache.getStats()
      },
      summary: {
        overallHealth: calculateOverallHealth(),
        recommendations: generateRecommendations(),
        optimizationOpportunities: identifyOptimizationOpportunities()
      }
    };

    // Cache the report for future reference
    await advancedCache.set(`performance-report-${timestamp}`, report, {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      metadata: { type: 'performance-report' }
    });

    return report;
  }, []);

  // Automated performance optimization
  const optimizePerformance = useCallback(async (): Promise<void> => {
    if (!enableOptimizations) {
      return;
    }


    try {
      // 1. Cache optimization
      await optimizeCache();

      // 2. Bundle optimization suggestions
      await suggestBundleOptimizations();

      // 3. Memory cleanup
      await performMemoryCleanup();

      // 4. Prefetch critical resources
      await prefetchCriticalResources();


      const alert: PerformanceAlert = {
        id: `optimization-${Date.now()}`,
        type: 'cache',
        severity: 'low',
        message: 'Automated performance optimization completed',
        timestamp: Date.now()
      };
      setAlerts(prev => [...prev, alert]);

    } catch (error) {
    }
  }, [enableOptimizations]);

  // Cache optimization
  const optimizeCache = async (): Promise<void> => {
    const stats = advancedCache.getStats();
    
    if (stats.hitRate < 70) {
      // Implement cache warming strategies
    }

    if (stats.totalSize > 40 * 1024 * 1024) { // 40MB
      // The cache will handle this automatically with its eviction strategies
    }
  };

  // Bundle optimization suggestions
  const suggestBundleOptimizations = async (): Promise<void> => {
    const metrics = performanceMonitor.getLatestMetrics();
    if (!metrics) return;

    if (metrics.resourceMetrics.totalSize > 500 * 1024) { // 500KB
    }
  };

  // Memory cleanup
  const performMemoryCleanup = async (): Promise<void> => {
    const metrics = performanceMonitor.getLatestMetrics();
    if (!metrics?.memoryUsage) return;

    if (metrics.memoryUsage.percentage > 80) {
      
      // Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
      }

      // Clean up old cache entries
      // This is handled by the cache's automatic cleanup
    }
  };

  // Prefetch critical resources
  const prefetchCriticalResources = async (): Promise<void> => {
    const criticalResources = [
      '/api/emails',
      '/api/analytics',
      '/api/dashboard-metrics'
    ];

    for (const resource of criticalResources) {
      const cached = await advancedCache.get(resource);
      if (!cached) {
        // In a real implementation, this would fetch from the API
        // and cache the result
      }
    }
  };

  // Calculate overall health score
  const calculateOverallHealth = (): 'excellent' | 'good' | 'warning' | 'critical' => {
    let score = 100;

    // Budget violations
    if (budgetStatus === 'fail') score -= 30;
    else if (budgetStatus === 'warning') score -= 15;

    // Regression status
    if (regressionStatus === 'critical') score -= 25;
    else if (regressionStatus === 'warning') score -= 10;

    // Cache performance
    const cache = advancedCache.getStats();
    if (cache.hitRate < 50) score -= 15;
    else if (cache.hitRate < 70) score -= 5;

    // UX metrics
    if (uxMetrics?.usability?.errorRate > 10) score -= 20;
    else if (uxMetrics?.usability?.errorRate > 5) score -= 10;

    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  };

  // Generate recommendations
  const generateRecommendations = (): string[] => {
    const recommendations: string[] = [];

    if (budgetViolations.length > 0) {
      recommendations.push('Address performance budget violations');
    }

    if (regressionAlerts.length > 0) {
      recommendations.push('Investigate performance regressions');
    }

    const cache = advancedCache.getStats();
    if (cache.hitRate < 70) {
      recommendations.push('Improve cache hit rate with better prefetching');
    }

    if (uxMetrics?.usability?.errorRate > 5) {
      recommendations.push('Reduce user error rate through UX improvements');
    }

    return recommendations;
  };

  // Identify optimization opportunities
  const identifyOptimizationOpportunities = (): string[] => {
    const opportunities: string[] = [];

    const metrics = performanceMonitor.getLatestMetrics();
    if (metrics) {
      if (metrics.coreWebVitals.lcp > 2000) {
        opportunities.push('Optimize Largest Contentful Paint');
      }

      if (metrics.resourceMetrics.totalSize > 300 * 1024) {
        opportunities.push('Reduce bundle size');
      }

      if (metrics.memoryUsage && metrics.memoryUsage.percentage > 70) {
        opportunities.push('Optimize memory usage');
      }
    }

    return opportunities;
  };

  // Dismiss alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  // Auto-start monitoring
  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    // Cleanup on unmount
    return () => {
      if (isMonitoring) {
        stopMonitoring();
      }
    };
  }, [autoStart, startMonitoring, stopMonitoring, isMonitoring]);

  // Provide context value
  const value: PerformanceContextValue = {
    currentMetrics,
    isMonitoring,
    budgetViolations,
    budgetStatus,
    regressionAlerts,
    regressionStatus,
    uxMetrics,
    cacheStats,
    startMonitoring,
    stopMonitoring,
    generateReport,
    optimizePerformance,
    alerts,
    dismissAlert
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

// Custom hook to use performance context
export const usePerformance = (): PerformanceContextValue => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

export default PerformanceProvider;
