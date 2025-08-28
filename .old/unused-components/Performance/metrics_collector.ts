/**
 * metrics_collector.ts - Performance Metrics Collection System
 * 
 * Comprehensive performance metrics collection and analysis for task-centric interface.
 * Implements real-time monitoring, historical tracking, and intelligent performance insights.
 * 
 * Features:
 * - Real-time performance metric collection
 * - Historical data aggregation and analysis
 * - Performance budget monitoring
 * - Anomaly detection and alerting
 * - User experience tracking
 * - Resource utilization monitoring
 * - Custom metric definitions
 * - Data export and reporting
 */

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: MetricCategory;
  tags: Record<string, string>;
  threshold?: PerformanceThreshold;
}

export interface PerformanceThreshold {
  warning: number;
  critical: number;
  target?: number;
}

export enum MetricCategory {
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  RESOURCE = 'resource',
  USER_EXPERIENCE = 'user_experience',
  QUALITY = 'quality',
  BUSINESS = 'business'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

// Collector configuration
export interface MetricsCollectorConfig {
  // Collection settings
  enableCollection: boolean;
  collectionInterval: number; // milliseconds
  batchSize: number;
  maxMetricsHistory: number;
  
  // Performance targets (from requirements)
  classificationTargetMs: number; // Sub-100ms
  taskCategorizationTargetMs: number; // <2ms
  uiInteractionTargetMs: number; // <500ms
  memoryTargetMb: number; // <50MB for 1000+ tasks
  targetFps: number; // 60fps
  
  // Monitoring features
  enableRealTimeMonitoring: boolean;
  enableAnomalyDetection: boolean;
  enableAlerts: boolean;
  enableResourceMonitoring: boolean;
  enableUserExperienceTracking: boolean;
  
  // Data management
  enableDataCompression: boolean;
  enableHistoricalAnalysis: boolean;
  enableExport: boolean;
  dataRetentionDays: number;
  
  // Alert configuration
  alertCooldownMs: number;
  maxAlertsPerMinute: number;
}

// Metric aggregation types
export interface MetricAggregation {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  aggregation?: MetricAggregation;
}

export interface MetricSeries {
  name: string;
  category: MetricCategory;
  data: TimeSeriesData[];
  metadata: Record<string, any>;
}

// Performance insights
export interface PerformanceInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'optimization' | 'degradation';
  severity: AlertSeverity;
  title: string;
  description: string;
  metrics: string[];
  impact: string;
  recommendation: string;
  timestamp: number;
  confidence: number;
}

export interface PerformanceAlert {
  id: string;
  metricName: string;
  severity: AlertSeverity;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

// Main metrics collector class
export class PerformanceMetricsCollector {
  private config: MetricsCollectorConfig;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private aggregatedMetrics: Map<string, MetricAggregation> = new Map();
  private alerts: PerformanceAlert[] = [];
  private insights: PerformanceInsight[] = [];
  
  // Collection state
  private isCollecting = false;
  private collectionTimer?: NodeJS.Timeout;
  private lastCollectionTime = 0;
  
  // Observers and monitors
  private performanceObserver?: PerformanceObserver;
  private mutationObserver?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  
  // Event handlers
  private alertHandlers: Set<(alert: PerformanceAlert) => void> = new Set();
  private insightHandlers: Set<(insight: PerformanceInsight) => void> = new Set();
  
  // Performance tracking
  private frameTimestamps: number[] = [];
  private interactionTimestamps: Map<string, number> = new Map();
  private resourceTimings: PerformanceResourceTiming[] = [];
  
  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = {
      enableCollection: true,
      collectionInterval: 1000, // 1 second
      batchSize: 100,
      maxMetricsHistory: 10000,
      
      // Performance targets from requirements
      classificationTargetMs: 100,
      taskCategorizationTargetMs: 2,
      uiInteractionTargetMs: 500,
      memoryTargetMb: 50,
      targetFps: 60,
      
      enableRealTimeMonitoring: true,
      enableAnomalyDetection: true,
      enableAlerts: true,
      enableResourceMonitoring: true,
      enableUserExperienceTracking: true,
      
      enableDataCompression: true,
      enableHistoricalAnalysis: true,
      enableExport: true,
      dataRetentionDays: 30,
      
      alertCooldownMs: 60000, // 1 minute
      maxAlertsPerMinute: 10,
      
      ...config,
    };

    this.initializeMetricsCollection();
  }

  // Public API methods

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.setupPerformanceObservers();
    this.startCollectionTimer();
    
    this.recordMetric('collector_started', 1, 'count', MetricCategory.QUALITY);
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    this.cleanup();
    
    this.recordMetric('collector_stopped', 1, 'count', MetricCategory.QUALITY);
  }

  /**
   * Record a custom metric
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: string, 
    category: MetricCategory,
    tags: Record<string, string> = {},
    threshold?: PerformanceThreshold
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: performance.now(),
      category,
      tags,
      threshold,
    };

    this.addMetric(metric);
    this.checkThresholds(metric);
  }

  /**
   * Record email classification performance
   */
  recordClassificationPerformance(latencyMs: number, emailCount: number): void {
    this.recordMetric(
      'email_classification_latency',
      latencyMs,
      'ms',
      MetricCategory.LATENCY,
      { email_count: emailCount.toString() },
      { warning: 80, critical: this.config.classificationTargetMs, target: 50 }
    );

    this.recordMetric(
      'emails_classified_per_second',
      emailCount / (latencyMs / 1000),
      'ops/sec',
      MetricCategory.THROUGHPUT,
      { batch_size: emailCount.toString() }
    );

    // Check if target is met
    if (latencyMs > this.config.classificationTargetMs) {
      this.generateAlert(
        'email_classification_latency',
        AlertSeverity.WARNING,
        `Email classification latency (${latencyMs.toFixed(1)}ms) exceeds target (${this.config.classificationTargetMs}ms)`,
        latencyMs,
        this.config.classificationTargetMs
      );
    }
  }

  /**
   * Record task categorization performance
   */
  recordTaskCategorizationPerformance(latencyMs: number, taskCount: number): void {
    this.recordMetric(
      'task_categorization_latency',
      latencyMs,
      'ms',
      MetricCategory.LATENCY,
      { task_count: taskCount.toString() },
      { warning: 1.5, critical: this.config.taskCategorizationTargetMs, target: 1 }
    );

    this.recordMetric(
      'tasks_categorized_per_second',
      taskCount / (latencyMs / 1000),
      'ops/sec',
      MetricCategory.THROUGHPUT,
      { batch_size: taskCount.toString() }
    );

    // Check if target is met
    if (latencyMs > this.config.taskCategorizationTargetMs) {
      this.generateAlert(
        'task_categorization_latency',
        AlertSeverity.CRITICAL,
        `Task categorization latency (${latencyMs.toFixed(2)}ms) exceeds target (${this.config.taskCategorizationTargetMs}ms)`,
        latencyMs,
        this.config.taskCategorizationTargetMs
      );
    }
  }

  /**
   * Record UI interaction performance
   */
  recordUIInteractionPerformance(interaction: string, latencyMs: number): void {
    this.recordMetric(
      'ui_interaction_latency',
      latencyMs,
      'ms',
      MetricCategory.USER_EXPERIENCE,
      { interaction_type: interaction },
      { warning: 300, critical: this.config.uiInteractionTargetMs, target: 100 }
    );

    // Track interaction frequency
    this.recordMetric(
      'ui_interactions_per_minute',
      1,
      'count',
      MetricCategory.USER_EXPERIENCE,
      { interaction_type: interaction }
    );

    // Check if target is met
    if (latencyMs > this.config.uiInteractionTargetMs) {
      this.generateAlert(
        'ui_interaction_latency',
        AlertSeverity.WARNING,
        `UI interaction '${interaction}' latency (${latencyMs.toFixed(1)}ms) exceeds target (${this.config.uiInteractionTargetMs}ms)`,
        latencyMs,
        this.config.uiInteractionTargetMs
      );
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(usageMb: number, taskCount: number): void {
    this.recordMetric(
      'memory_usage',
      usageMb,
      'MB',
      MetricCategory.RESOURCE,
      { task_count: taskCount.toString() },
      { warning: 40, critical: this.config.memoryTargetMb, target: 30 }
    );

    // Calculate memory per task
    if (taskCount > 0) {
      this.recordMetric(
        'memory_per_task',
        usageMb / taskCount,
        'MB/task',
        MetricCategory.RESOURCE,
        { task_count: taskCount.toString() }
      );
    }

    // Check if target is met
    if (usageMb > this.config.memoryTargetMb) {
      this.generateAlert(
        'memory_usage',
        AlertSeverity.CRITICAL,
        `Memory usage (${usageMb.toFixed(1)}MB) exceeds target (${this.config.memoryTargetMb}MB) for ${taskCount} tasks`,
        usageMb,
        this.config.memoryTargetMb
      );
    }
  }

  /**
   * Record frame rate performance
   */
  recordFrameRate(fps: number): void {
    this.recordMetric(
      'frame_rate',
      fps,
      'fps',
      MetricCategory.USER_EXPERIENCE,
      {},
      { warning: 50, critical: 40, target: this.config.targetFps }
    );

    // Check if target is met
    if (fps < this.config.targetFps * 0.8) { // Allow 20% deviation
      this.generateAlert(
        'frame_rate',
        AlertSeverity.WARNING,
        `Frame rate (${fps.toFixed(1)}fps) below target (${this.config.targetFps}fps)`,
        fps,
        this.config.targetFps
      );
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(category?: MetricCategory): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];
    
    for (const metricList of this.metrics.values()) {
      for (const metric of metricList) {
        if (!category || metric.category === category) {
          allMetrics.push(metric);
        }
      }
    }
    
    return allMetrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(metricName: string): MetricAggregation | null {
    return this.aggregatedMetrics.get(metricName) || null;
  }

  /**
   * Get time series data
   */
  getTimeSeries(metricName: string, timeRangeMs: number = 3600000): MetricSeries | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics) return null;

    const cutoffTime = performance.now() - timeRangeMs;
    const filteredMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
    
    if (filteredMetrics.length === 0) return null;

    const data: TimeSeriesData[] = filteredMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.value,
    }));

    return {
      name: metricName,
      category: filteredMetrics[0].category,
      data,
      metadata: {
        count: filteredMetrics.length,
        timeRange: timeRangeMs,
        firstTimestamp: filteredMetrics[0].timestamp,
        lastTimestamp: filteredMetrics[filteredMetrics.length - 1].timestamp,
      },
    };
  }

  /**
   * Get performance alerts
   */
  getAlerts(severity?: AlertSeverity): PerformanceAlert[] {
    return this.alerts
      .filter(alert => !severity || alert.severity === severity)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get performance insights
   */
  getInsights(): PerformanceInsight[] {
    return this.insights.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate performance report
   */
  generateReport(timeRangeMs: number = 3600000): PerformanceReport {
    const cutoffTime = performance.now() - timeRangeMs;
    
    const report: PerformanceReport = {
      timestamp: Date.now(),
      timeRangeMs,
      summary: this.generateSummary(cutoffTime),
      metrics: this.generateMetricsSummary(cutoffTime),
      alerts: this.alerts.filter(a => a.timestamp >= cutoffTime),
      insights: this.insights.filter(i => i.timestamp >= cutoffTime),
      recommendations: this.generateRecommendations(),
    };

    return report;
  }

  /**
   * Export metrics data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: this.getMetrics(),
      aggregations: Object.fromEntries(this.aggregatedMetrics),
      alerts: this.alerts,
      insights: this.insights,
      config: this.config,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      return this.convertToCSV(data.metrics);
    }
  }

  /**
   * Subscribe to alerts
   */
  onAlert(handler: (alert: PerformanceAlert) => void): () => void {
    this.alertHandlers.add(handler);
    return () => this.alertHandlers.delete(handler);
  }

  /**
   * Subscribe to insights
   */
  onInsight(handler: (insight: PerformanceInsight) => void): () => void {
    this.insightHandlers.add(handler);
    return () => this.insightHandlers.delete(handler);
  }

  // Private implementation methods

  private initializeMetricsCollection(): void {
    // Initialize core Web Vitals monitoring
    if (typeof window !== 'undefined') {
      this.setupWebVitalsMonitoring();
      this.setupResourceTimingMonitoring();
      this.setupMemoryMonitoring();
      this.setupUserExperienceMonitoring();
    }
  }

  private setupPerformanceObservers(): void {
    if (typeof window === 'undefined') return;

    // Performance Observer for navigation and resource timing
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        for (const entry of entries) {
          this.processPerformanceEntry(entry);
        }
      });

      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'resource', 'measure', 'mark'] 
      });
    }

    // Mutation Observer for DOM changes
    if (this.config.enableUserExperienceTracking) {
      this.mutationObserver = new MutationObserver((mutations) => {
        this.recordMetric(
          'dom_mutations',
          mutations.length,
          'count',
          MetricCategory.USER_EXPERIENCE
        );
      });

      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    // Resize Observer for layout changes
    this.resizeObserver = new ResizeObserver((entries) => {
      this.recordMetric(
        'layout_changes',
        entries.length,
        'count',
        MetricCategory.USER_EXPERIENCE
      );
    });

    if (document.body) {
      this.resizeObserver.observe(document.body);
    }
  }

  private setupWebVitalsMonitoring(): void {
    // Monitor Core Web Vitals
    if ('web-vitals' in window) {
      // This would typically use the web-vitals library
      // For now, we'll implement basic monitoring
      this.setupBasicWebVitals();
    }
  }

  private setupBasicWebVitals(): void {
    // FCP - First Contentful Paint
    const paintObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric(
            'first_contentful_paint',
            entry.startTime,
            'ms',
            MetricCategory.USER_EXPERIENCE,
            {},
            { warning: 1800, critical: 3000, target: 1000 }
          );
        }
      }
    });

    paintObserver.observe({ entryTypes: ['paint'] });

    // LCP - Largest Contentful Paint (approximation)
    let largestElement: Element | null = null;
    let largestSize = 0;

    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        // Type guard for entries with size and element properties
        if ('size' in entry && 'element' in entry) {
          const elementEntry = entry as PerformanceEntry & { size: number; element: Element };
          if (elementEntry.size && elementEntry.size > largestSize) {
            largestSize = elementEntry.size;
            largestElement = elementEntry.element;
          
            this.recordMetric(
              'largest_contentful_paint',
              entry.startTime,
              'ms',
              MetricCategory.USER_EXPERIENCE,
              {},
              { warning: 2500, critical: 4000, target: 2000 }
            );
          }
        }
      }
    });

    if ('largest-contentful-paint' in PerformanceObserver.supportedEntryTypes) {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }

  private setupResourceTimingMonitoring(): void {
    if (!this.config.enableResourceMonitoring) return;

    setInterval(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const newResources = resources.slice(this.resourceTimings.length);
      
      for (const resource of newResources) {
        this.recordMetric(
          'resource_load_time',
          resource.duration,
          'ms',
          MetricCategory.RESOURCE,
          { 
            resource_type: this.getResourceType(resource.name),
            size: resource.transferSize?.toString() || '0'
          }
        );
      }
      
      this.resourceTimings = resources;
    }, this.config.collectionInterval);
  }

  private setupMemoryMonitoring(): void {
    if (!this.config.enableResourceMonitoring) return;

    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        
        this.recordMetric(
          'js_heap_used',
          memory.usedJSHeapSize / (1024 * 1024),
          'MB',
          MetricCategory.RESOURCE,
          {},
          { warning: 40, critical: this.config.memoryTargetMb }
        );

        this.recordMetric(
          'js_heap_total',
          memory.totalJSHeapSize / (1024 * 1024),
          'MB',
          MetricCategory.RESOURCE
        );

        this.recordMetric(
          'js_heap_limit',
          memory.jsHeapSizeLimit / (1024 * 1024),
          'MB',
          MetricCategory.RESOURCE
        );
      }
    }, this.config.collectionInterval);
  }

  private setupUserExperienceMonitoring(): void {
    if (!this.config.enableUserExperienceTracking) return;

    // Monitor frame rate
    let lastFrameTime = performance.now();
    let frameCount = 0;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastFrameTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastFrameTime));
        this.recordFrameRate(fps);
        
        frameCount = 0;
        lastFrameTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);

    // Monitor user interactions
    const interactionEvents = ['click', 'keydown', 'scroll', 'input'];
    
    for (const eventType of interactionEvents) {
      document.addEventListener(eventType, (event) => {
        const startTime = performance.now();
        this.interactionTimestamps.set(eventType, startTime);
        
        // Measure interaction to next frame
        requestAnimationFrame(() => {
          const endTime = performance.now();
          const latency = endTime - startTime;
          this.recordUIInteractionPerformance(eventType, latency);
        });
      }, { passive: true });
    }
  }

  private startCollectionTimer(): void {
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
      this.analyzeMetrics();
      this.cleanupOldData();
    }, this.config.collectionInterval);
  }

  private collectMetrics(): void {
    const currentTime = performance.now();
    
    // Collect basic performance metrics
    this.recordMetric(
      'collection_interval',
      currentTime - this.lastCollectionTime,
      'ms',
      MetricCategory.QUALITY
    );
    
    this.lastCollectionTime = currentTime;

    // Update aggregations
    this.updateAggregations();
  }

  private updateAggregations(): void {
    for (const [metricName, metricList] of this.metrics.entries()) {
      if (metricList.length === 0) continue;

      const values = metricList.map(m => m.value);
      const aggregation: MetricAggregation = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: this.calculatePercentile(values, 0.5),
        p95: this.calculatePercentile(values, 0.95),
        p99: this.calculatePercentile(values, 0.99),
        stdDev: this.calculateStandardDeviation(values),
      };

      this.aggregatedMetrics.set(metricName, aggregation);
    }
  }

  private analyzeMetrics(): void {
    if (!this.config.enableAnomalyDetection) return;

    // Simple anomaly detection based on statistical analysis
    for (const [metricName, aggregation] of this.aggregatedMetrics.entries()) {
      const metrics = this.metrics.get(metricName);
      if (!metrics || metrics.length < 10) continue;

      const recentValues = metrics.slice(-10).map(m => m.value);
      const recentMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      
      // Check for anomalies (values more than 2 standard deviations from mean)
      if (Math.abs(recentMean - aggregation.mean) > 2 * aggregation.stdDev) {
        this.generateInsight(
          'anomaly',
          AlertSeverity.WARNING,
          `Anomaly detected in ${metricName}`,
          `Recent average (${recentMean.toFixed(2)}) deviates significantly from historical mean (${aggregation.mean.toFixed(2)})`,
          [metricName],
          'Investigate recent changes or system load',
          0.8
        );
      }
    }
  }

  private addMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricList = this.metrics.get(metric.name)!;
    metricList.push(metric);

    // Maintain history limit
    if (metricList.length > this.config.maxMetricsHistory) {
      metricList.shift();
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    if (!metric.threshold || !this.config.enableAlerts) return;

    const { warning, critical } = metric.threshold;

    if (metric.value >= critical) {
      this.generateAlert(
        metric.name,
        AlertSeverity.CRITICAL,
        `${metric.name} is critical: ${metric.value}${metric.unit}`,
        metric.value,
        critical
      );
    } else if (metric.value >= warning) {
      this.generateAlert(
        metric.name,
        AlertSeverity.WARNING,
        `${metric.name} is above warning threshold: ${metric.value}${metric.unit}`,
        metric.value,
        warning
      );
    }
  }

  private generateAlert(
    metricName: string,
    severity: AlertSeverity,
    message: string,
    currentValue: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metricName,
      severity,
      message,
      currentValue,
      threshold,
      timestamp: performance.now(),
      resolved: false,
    };

    this.alerts.push(alert);

    // Notify handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    }

    // Maintain alerts limit
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }
  }

  private generateInsight(
    type: PerformanceInsight['type'],
    severity: AlertSeverity,
    title: string,
    description: string,
    metrics: string[],
    recommendation: string,
    confidence: number
  ): void {
    const insight: PerformanceInsight = {
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      description,
      metrics,
      impact: this.calculateInsightImpact(metrics),
      recommendation,
      timestamp: performance.now(),
      confidence,
    };

    this.insights.push(insight);

    // Notify handlers
    for (const handler of this.insightHandlers) {
      try {
        handler(insight);
      } catch (error) {
        console.error('Insight handler error:', error);
      }
    }

    // Maintain insights limit
    if (this.insights.length > 100) {
      this.insights = this.insights.slice(-50);
    }
  }

  private calculateInsightImpact(metrics: string[]): string {
    // Simple impact calculation based on metric types
    const impactFactors: Record<string, string> = {
      latency: 'High - Affects user experience',
      throughput: 'Medium - Affects system capacity',
      resource: 'Medium - Affects system stability',
      user_experience: 'High - Directly affects users',
      quality: 'Low - Affects monitoring quality',
      business: 'High - Affects business metrics',
    };

    // Find the highest impact category
    for (const metric of metrics) {
      const category = this.getMetricCategory(metric);
      if (category && impactFactors[category]) {
        return impactFactors[category];
      }
    }

    return 'Unknown impact';
  }

  private getMetricCategory(metricName: string): string | null {
    const metric = this.metrics.get(metricName)?.[0];
    return metric?.category || null;
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.processNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'resource':
        this.processResourceEntry(entry as PerformanceResourceTiming);
        break;
      case 'measure':
        this.processMeasureEntry(entry);
        break;
    }
  }

  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    this.recordMetric(
      'page_load_time',
      entry.loadEventEnd - entry.fetchStart,
      'ms',
      MetricCategory.USER_EXPERIENCE,
      {},
      { warning: 3000, critical: 5000, target: 2000 }
    );

    this.recordMetric(
      'dom_content_loaded',
      entry.domContentLoadedEventEnd - entry.fetchStart,
      'ms',
      MetricCategory.USER_EXPERIENCE,
      {},
      { warning: 2000, critical: 3000, target: 1500 }
    );
  }

  private processResourceEntry(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    
    this.recordMetric(
      'resource_duration',
      entry.duration,
      'ms',
      MetricCategory.RESOURCE,
      { resource_type: resourceType }
    );

    if (entry.transferSize) {
      this.recordMetric(
        'resource_size',
        entry.transferSize,
        'bytes',
        MetricCategory.RESOURCE,
        { resource_type: resourceType }
      );
    }
  }

  private processMeasureEntry(entry: PerformanceEntry): void {
    this.recordMetric(
      entry.name,
      entry.duration,
      'ms',
      MetricCategory.LATENCY
    );
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (!extension) return 'other';
    
    if (['js', 'ts'].includes(extension)) return 'script';
    if (['css'].includes(extension)) return 'stylesheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension)) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'font';
    if (['json', 'xml'].includes(extension)) return 'data';
    
    return 'other';
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private generateSummary(cutoffTime: number): PerformanceSummary {
    const recentMetrics = this.getMetrics().filter(m => m.timestamp >= cutoffTime);
    
    return {
      totalMetrics: recentMetrics.length,
      categories: this.summarizeByCategory(recentMetrics),
      overallHealth: this.calculateOverallHealth(),
      topIssues: this.getTopIssues(),
    };
  }

  private summarizeByCategory(metrics: PerformanceMetric[]): Record<string, number> {
    const categoryCounts: Record<string, number> = {};
    
    for (const metric of metrics) {
      categoryCounts[metric.category] = (categoryCounts[metric.category] || 0) + 1;
    }
    
    return categoryCounts;
  }

  private calculateOverallHealth(): number {
    // Simple health score based on recent alerts
    const recentAlerts = this.alerts.filter(a => 
      performance.now() - a.timestamp < 300000 && !a.resolved
    );
    
    if (recentAlerts.length === 0) return 100;
    
    const criticalAlerts = recentAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length;
    const warningAlerts = recentAlerts.filter(a => a.severity === AlertSeverity.WARNING).length;
    
    const penalty = criticalAlerts * 20 + warningAlerts * 10;
    return Math.max(0, 100 - penalty);
  }

  private getTopIssues(): string[] {
    const recentAlerts = this.alerts
      .filter(a => performance.now() - a.timestamp < 300000 && !a.resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return recentAlerts.slice(0, 5).map(a => a.message);
  }

  private generateMetricsSummary(cutoffTime: number): Record<string, MetricAggregation> {
    const summary: Record<string, MetricAggregation> = {};
    
    for (const [metricName, aggregation] of this.aggregatedMetrics.entries()) {
      const metrics = this.metrics.get(metricName);
      if (metrics && metrics.some(m => m.timestamp >= cutoffTime)) {
        summary[metricName] = aggregation;
      }
    }
    
    return summary;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze recent performance and generate recommendations
    const classificationMetrics = this.aggregatedMetrics.get('email_classification_latency');
    if (classificationMetrics && classificationMetrics.mean > this.config.classificationTargetMs) {
      recommendations.push('Consider enabling more aggressive caching for email classification');
    }
    
    const taskMetrics = this.aggregatedMetrics.get('task_categorization_latency');
    if (taskMetrics && taskMetrics.mean > this.config.taskCategorizationTargetMs) {
      recommendations.push('Optimize task categorization algorithm for better performance');
    }
    
    const memoryMetrics = this.aggregatedMetrics.get('memory_usage');
    if (memoryMetrics && memoryMetrics.mean > this.config.memoryTargetMb * 0.8) {
      recommendations.push('Consider implementing virtual scrolling to reduce memory usage');
    }
    
    return recommendations;
  }

  private convertToCSV(metrics: PerformanceMetric[]): string {
    const headers = ['name', 'value', 'unit', 'timestamp', 'category'];
    const rows = metrics.map(m => [
      m.name,
      m.value.toString(),
      m.unit,
      m.timestamp.toString(),
      m.category,
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private cleanupOldData(): void {
    const cutoffTime = performance.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
    
    // Clean old metrics
    for (const [metricName, metricList] of this.metrics.entries()) {
      const filteredMetrics = metricList.filter(m => m.timestamp >= cutoffTime);
      this.metrics.set(metricName, filteredMetrics);
    }
    
    // Clean old alerts
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoffTime);
    
    // Clean old insights
    this.insights = this.insights.filter(i => i.timestamp >= cutoffTime);
  }

  private cleanup(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}

// Supporting interfaces
export interface PerformanceReport {
  timestamp: number;
  timeRangeMs: number;
  summary: PerformanceSummary;
  metrics: Record<string, MetricAggregation>;
  alerts: PerformanceAlert[];
  insights: PerformanceInsight[];
  recommendations: string[];
}

export interface PerformanceSummary {
  totalMetrics: number;
  categories: Record<string, number>;
  overallHealth: number;
  topIssues: string[];
}

// Factory function
export function createMetricsCollector(config?: Partial<MetricsCollectorConfig>): PerformanceMetricsCollector {
  return new PerformanceMetricsCollector(config);
}

// Singleton instance for global usage
export const globalMetricsCollector = createMetricsCollector();

// Auto-start collection in browser environment
if (typeof window !== 'undefined') {
  globalMetricsCollector.start();
}

export default PerformanceMetricsCollector;