/**
 * Advanced Performance Monitoring System
 * 
 * Implements Core Web Vitals monitoring, real-time performance tracking,
 * and automated performance regression detection for the Apple MCP dashboard.
 * 
 * Features:
 * - Real-time Core Web Vitals measurement (LCP, INP, CLS)
 * - Performance budget enforcement
 * - User experience metrics collection
 * - Automated performance alerts
 * - Integration with Analytics dashboard
 */

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  inp: number; // Interaction to Next Paint
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

export interface PerformanceMetrics {
  coreWebVitals: CoreWebVitals;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  } | null;
  resourceMetrics: {
    totalResources: number;
    totalSize: number;
    largestResource: number;
    slowestResource: number;
  };
  renderMetrics: {
    renderTime: number;
    rerenderCount: number;
    componentCount: number;
  };
  networkMetrics: {
    connectionType: string;
    downloadSpeed: number;
    latency: number;
  };
  userExperience: {
    timeToInteractive: number;
    pageResponseTime: number;
    errorRate: number;
    bounceRate: number;
  };
  timestamp: number;
}

export interface PerformanceBudget {
  lcp: number; // Target: < 2.5s
  inp: number; // Target: < 200ms
  cls: number; // Target: < 0.1
  maxBundleSize: number; // Target: < 500KB
  maxMemoryUsage: number; // Target: < 100MB
  maxResourceCount: number; // Target: < 100 resources
}

class AdvancedPerformanceMonitor {
  private observers: Map<string, PerformanceObserver> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private budget: PerformanceBudget;
  private callbacks: Map<string, Function> = new Map();
  private isEnabled: boolean = true;
  private measurementInterval: number | null = null;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budget = {
      lcp: 2500, // 2.5 seconds
      inp: 200,  // 200 milliseconds
      cls: 0.1,  // 0.1 layout shift score
      maxBundleSize: 500 * 1024, // 500KB
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxResourceCount: 100,
      ...budget
    };

    this.initialize();
  }

  private initialize(): void {
    if (typeof window === 'undefined' || !window.performance) {
      this.isEnabled = false;
      return;
    }

    this.setupCoreWebVitalsObservers();
    this.setupResourceObserver();
    this.setupMemoryMonitoring();
    this.setupNetworkMonitoring();
    this.startContinuousMonitoring();
  }

  private setupCoreWebVitalsObservers(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          this.updateMetric('lcp', lastEntry.startTime);
        }
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported:', e);
      }

      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          this.updateMetric('fcp', lastEntry.startTime);
        }
      });

      try {
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('fcp', fcpObserver);
      } catch (e) {
        console.warn('FCP observer not supported:', e);
      }

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let cls = 0;
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
        this.updateMetric('cls', cls);
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported:', e);
      }

      // Interaction to Next Paint (INP) - approximation
      const eventObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        for (const entry of entries) {
          if (entry.processingEnd && entry.startTime) {
            const inp = entry.processingEnd - entry.startTime;
            this.updateMetric('inp', inp);
          }
        }
      });

      try {
        eventObserver.observe({ entryTypes: ['event'] });
        this.observers.set('inp', eventObserver);
      } catch (e) {
        console.warn('INP observer not supported:', e);
      }
    }
  }

  private setupResourceObserver(): void {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        
        let totalSize = 0;
        let largestResource = 0;
        let slowestResource = 0;

        for (const entry of entries) {
          const size = entry.transferSize || 0;
          const duration = entry.responseEnd - entry.startTime;
          
          totalSize += size;
          largestResource = Math.max(largestResource, size);
          slowestResource = Math.max(slowestResource, duration);
        }

        this.updateResourceMetrics({
          totalResources: entries.length,
          totalSize,
          largestResource,
          slowestResource
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported:', e);
      }
    }
  }

  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.measurementInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          const memoryUsage = {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
          };

          this.updateMemoryMetrics(memoryUsage);

          // Check budget violations
          if (memoryUsage.used > this.budget.maxMemoryUsage) {
            this.triggerAlert('memory', 'Memory usage exceeded budget', {
              current: memoryUsage.used,
              budget: this.budget.maxMemoryUsage
            });
          }
        }
      }, 5000); // Check every 5 seconds
    }
  }

  private setupNetworkMonitoring(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.updateNetworkMetrics({
          connectionType: connection.effectiveType || 'unknown',
          downloadSpeed: connection.downlink || 0,
          latency: connection.rtt || 0
        });

        connection.addEventListener('change', () => {
          this.updateNetworkMetrics({
            connectionType: connection.effectiveType || 'unknown',
            downloadSpeed: connection.downlink || 0,
            latency: connection.rtt || 0
          });
        });
      }
    }
  }

  private startContinuousMonitoring(): void {
    setInterval(() => {
      this.captureCurrentMetrics();
    }, 10000); // Capture metrics every 10 seconds
  }

  private updateMetric(type: string, value: number): void {
    const callback = this.callbacks.get(`metric-${type}`);
    if (callback) {
      callback({ type, value, timestamp: Date.now() });
    }

    // Check budget violations
    if (type === 'lcp' && value > this.budget.lcp) {
      this.triggerAlert('lcp', 'LCP exceeded budget', { current: value, budget: this.budget.lcp });
    } else if (type === 'inp' && value > this.budget.inp) {
      this.triggerAlert('inp', 'INP exceeded budget', { current: value, budget: this.budget.inp });
    } else if (type === 'cls' && value > this.budget.cls) {
      this.triggerAlert('cls', 'CLS exceeded budget', { current: value, budget: this.budget.cls });
    }
  }

  private updateResourceMetrics(metrics: any): void {
    const callback = this.callbacks.get('resource-metrics');
    if (callback) {
      callback(metrics);
    }
  }

  private updateMemoryMetrics(metrics: any): void {
    const callback = this.callbacks.get('memory-metrics');
    if (callback) {
      callback(metrics);
    }
  }

  private updateNetworkMetrics(metrics: any): void {
    const callback = this.callbacks.get('network-metrics');
    if (callback) {
      callback(metrics);
    }
  }

  private triggerAlert(type: string, message: string, data: any): void {
    const callback = this.callbacks.get('alert');
    if (callback) {
      callback({
        type,
        message,
        data,
        timestamp: Date.now(),
        severity: this.getAlertSeverity(type, data)
      });
    }

    // Log to console for debugging
    console.warn(`Performance Alert [${type.toUpperCase()}]: ${message}`, data);
  }

  private getAlertSeverity(type: string, data: any): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'lcp':
        if (data.current > 4000) return 'critical';
        if (data.current > 3000) return 'high';
        return 'medium';
      
      case 'inp':
        if (data.current > 500) return 'critical';
        if (data.current > 300) return 'high';
        return 'medium';
      
      case 'cls':
        if (data.current > 0.25) return 'critical';
        if (data.current > 0.15) return 'high';
        return 'medium';
      
      case 'memory':
        if (data.current > this.budget.maxMemoryUsage * 1.5) return 'critical';
        if (data.current > this.budget.maxMemoryUsage * 1.2) return 'high';
        return 'medium';
      
      default:
        return 'medium';
    }
  }

  public captureCurrentMetrics(): PerformanceMetrics | null {
    if (!this.isEnabled) return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const memory = (performance as any).memory;

    // Calculate Core Web Vitals
    const coreWebVitals: CoreWebVitals = {
      lcp: this.getLatestMetric('lcp') || (navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0),
      inp: this.getLatestMetric('inp') || 0,
      cls: this.getLatestMetric('cls') || 0,
      fcp: this.getLatestMetric('fcp') || 0,
      ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0
    };

    // Calculate resource metrics
    const resourceMetrics = {
      totalResources: resources.length,
      totalSize: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
      largestResource: Math.max(...resources.map(r => r.transferSize || 0)),
      slowestResource: Math.max(...resources.map(r => r.responseEnd - r.startTime))
    };

    // Memory metrics
    const memoryUsage = memory ? {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    } : null;

    // Network metrics
    const connection = (navigator as any).connection;
    const networkMetrics = {
      connectionType: connection?.effectiveType || 'unknown',
      downloadSpeed: connection?.downlink || 0,
      latency: connection?.rtt || 0
    };

    // Render metrics (approximation)
    const renderMetrics = {
      renderTime: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
      rerenderCount: this.getComponentRerenderCount(),
      componentCount: this.getComponentCount()
    };

    // User experience metrics
    const userExperience = {
      timeToInteractive: navigation ? navigation.domInteractive - navigation.startTime : 0,
      pageResponseTime: coreWebVitals.lcp,
      errorRate: this.getErrorRate(),
      bounceRate: this.getBounceRate()
    };

    const metrics: PerformanceMetrics = {
      coreWebVitals,
      memoryUsage,
      resourceMetrics,
      renderMetrics,
      networkMetrics,
      userExperience,
      timestamp: Date.now()
    };

    this.metrics.push(metrics);
    
    // Keep only last 100 measurements
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    return metrics;
  }

  private getLatestMetric(type: string): number | null {
    // This would be updated by the observers
    return null;
  }

  private getComponentRerenderCount(): number {
    // This would require React DevTools integration or custom tracking
    return 0;
  }

  private getComponentCount(): number {
    // Count rendered React components (approximation)
    return document.querySelectorAll('[data-reactroot] *').length;
  }

  private getErrorRate(): number {
    // This would be tracked by error boundaries
    return 0;
  }

  private getBounceRate(): number {
    // This would be calculated based on user interaction patterns
    return 0;
  }

  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getBudgetViolations(): Array<{ metric: string, current: number, budget: number, severity: string }> {
    const latest = this.getLatestMetrics();
    if (!latest) return [];

    const violations = [];

    if (latest.coreWebVitals.lcp > this.budget.lcp) {
      violations.push({
        metric: 'LCP',
        current: latest.coreWebVitals.lcp,
        budget: this.budget.lcp,
        severity: this.getAlertSeverity('lcp', { current: latest.coreWebVitals.lcp })
      });
    }

    if (latest.coreWebVitals.inp > this.budget.inp) {
      violations.push({
        metric: 'INP',
        current: latest.coreWebVitals.inp,
        budget: this.budget.inp,
        severity: this.getAlertSeverity('inp', { current: latest.coreWebVitals.inp })
      });
    }

    if (latest.coreWebVitals.cls > this.budget.cls) {
      violations.push({
        metric: 'CLS',
        current: latest.coreWebVitals.cls,
        budget: this.budget.cls,
        severity: this.getAlertSeverity('cls', { current: latest.coreWebVitals.cls })
      });
    }

    if (latest.memoryUsage && latest.memoryUsage.used > this.budget.maxMemoryUsage) {
      violations.push({
        metric: 'Memory Usage',
        current: latest.memoryUsage.used,
        budget: this.budget.maxMemoryUsage,
        severity: this.getAlertSeverity('memory', { current: latest.memoryUsage.used })
      });
    }

    return violations;
  }

  public onMetricUpdate(callback: Function): void {
    this.callbacks.set('metric-update', callback);
  }

  public onAlert(callback: Function): void {
    this.callbacks.set('alert', callback);
  }

  public updateBudget(newBudget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...newBudget };
  }

  public startRegressionDetection(): void {
    // Compare current metrics with historical baseline
    setInterval(() => {
      this.detectPerformanceRegression();
    }, 60000); // Check every minute
  }

  private detectPerformanceRegression(): void {
    if (this.metrics.length < 10) return; // Need baseline data

    const recent = this.metrics.slice(-5); // Last 5 measurements
    const baseline = this.metrics.slice(0, 10); // First 10 measurements

    const recentAvg = this.calculateAverageMetrics(recent);
    const baselineAvg = this.calculateAverageMetrics(baseline);

    // Check for significant regressions (>20% worse)
    const regressions = [];

    if (recentAvg.coreWebVitals.lcp > baselineAvg.coreWebVitals.lcp * 1.2) {
      regressions.push('LCP regression detected');
    }

    if (recentAvg.coreWebVitals.inp > baselineAvg.coreWebVitals.inp * 1.2) {
      regressions.push('INP regression detected');
    }

    if (recentAvg.coreWebVitals.cls > baselineAvg.coreWebVitals.cls * 1.2) {
      regressions.push('CLS regression detected');
    }

    if (regressions.length > 0) {
      this.triggerAlert('regression', 'Performance regression detected', {
        regressions,
        baseline: baselineAvg,
        current: recentAvg
      });
    }
  }

  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const avg = metrics.reduce((acc, metric) => {
      acc.coreWebVitals.lcp += metric.coreWebVitals.lcp;
      acc.coreWebVitals.inp += metric.coreWebVitals.inp;
      acc.coreWebVitals.cls += metric.coreWebVitals.cls;
      acc.coreWebVitals.fcp += metric.coreWebVitals.fcp;
      acc.coreWebVitals.ttfb += metric.coreWebVitals.ttfb;
      return acc;
    }, {
      coreWebVitals: { lcp: 0, inp: 0, cls: 0, fcp: 0, ttfb: 0 },
      memoryUsage: null,
      resourceMetrics: { totalResources: 0, totalSize: 0, largestResource: 0, slowestResource: 0 },
      renderMetrics: { renderTime: 0, rerenderCount: 0, componentCount: 0 },
      networkMetrics: { connectionType: '', downloadSpeed: 0, latency: 0 },
      userExperience: { timeToInteractive: 0, pageResponseTime: 0, errorRate: 0, bounceRate: 0 },
      timestamp: 0
    });

    const count = metrics.length;
    avg.coreWebVitals.lcp /= count;
    avg.coreWebVitals.inp /= count;
    avg.coreWebVitals.cls /= count;
    avg.coreWebVitals.fcp /= count;
    avg.coreWebVitals.ttfb /= count;

    return avg as PerformanceMetrics;
  }

  public dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
    }
    
    this.callbacks.clear();
    this.metrics = [];
  }
}

// Singleton instance for global use
export const performanceMonitor = new AdvancedPerformanceMonitor();

// React hook for easy integration
export function usePerformanceMonitor() {
  return {
    monitor: performanceMonitor,
    captureMetrics: () => performanceMonitor.captureCurrentMetrics(),
    getLatestMetrics: () => performanceMonitor.getLatestMetrics(),
    getBudgetViolations: () => performanceMonitor.getBudgetViolations(),
    getMetricsHistory: () => performanceMonitor.getMetricsHistory()
  };
}

export default AdvancedPerformanceMonitor;