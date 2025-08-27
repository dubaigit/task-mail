/**
 * Database Health Checker Service - Comprehensive health monitoring and diagnostics
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'database-health-checker' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database-health-checker.log' })
  ]
});

class DatabaseHealthChecker {
  constructor(dependencies) {
    this.connectionManager = dependencies.connectionManager;
    this.cacheManager = dependencies.cacheManager;
    this.queryExecutor = dependencies.queryExecutor;
    this.performanceMonitor = dependencies.performanceMonitor;
    this.appleMailSyncEngine = dependencies.appleMailSyncEngine;
    
    this.isInitialized = false;
    this.healthCheckInterval = null;
    this.alertThresholds = {
      responseTime: parseInt(process.env.HEALTH_RESPONSE_THRESHOLD || '5000'), // 5s
      errorRate: parseFloat(process.env.HEALTH_ERROR_RATE_THRESHOLD || '0.05'), // 5%
      cacheHitRate: parseFloat(process.env.HEALTH_CACHE_HIT_RATE_THRESHOLD || '0.7'), // 70%
      connectionUtilization: parseFloat(process.env.HEALTH_CONNECTION_UTIL_THRESHOLD || '0.8') // 80%
    };
    
    // Health history for trend analysis
    this.healthHistory = [];
    this.maxHistorySize = parseInt(process.env.HEALTH_HISTORY_SIZE || '288'); // 24 hours at 5-minute intervals
    
    // Alert state tracking
    this.activeAlerts = new Map();
    this.alertCooldown = parseInt(process.env.HEALTH_ALERT_COOLDOWN || '300000'); // 5 minutes
  }

  initialize() {
    if (this.isInitialized) return;
    
    try {
      this.setupPeriodicHealthChecks();
      this.isInitialized = true;
      logger.info('✅ Database Health Checker initialized successfully');
    } catch (error) {
      logger.error('❌ Database Health Checker initialization failed:', error);
      throw error;
    }
  }

  async performComprehensiveHealthCheck() {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    logger.debug('Starting comprehensive health check...');
    
    try {
      // Collect health data from all services
      const healthData = {
        timestamp,
        overall: { status: 'healthy', score: 100 },
        services: {},
        metrics: {},
        alerts: []
      };

      // Check Connection Manager
      if (this.connectionManager) {
        try {
          const connHealth = await this.connectionManager.healthCheck();
          healthData.services.connectionManager = connHealth;
          
          // Analyze connection metrics
          const connMetrics = this.connectionManager.getConnectionMetrics();
          healthData.metrics.connections = connMetrics;
          
          await this.analyzeConnectionHealth(connMetrics, healthData);
        } catch (error) {
          healthData.services.connectionManager = { status: 'unhealthy', error: error.message };
          healthData.alerts.push({ severity: 'critical', service: 'connectionManager', message: error.message });
        }
      }

      // Check Cache Manager
      if (this.cacheManager) {
        try {
          const cacheHealth = await this.cacheManager.healthCheck();
          healthData.services.cacheManager = cacheHealth;
          
          const cacheStats = this.cacheManager.getStats();
          healthData.metrics.cache = cacheStats;
          
          await this.analyzeCacheHealth(cacheStats, healthData);
        } catch (error) {
          healthData.services.cacheManager = { status: 'unhealthy', error: error.message };
          healthData.alerts.push({ severity: 'warning', service: 'cacheManager', message: error.message });
        }
      }

      // Check Query Executor
      if (this.queryExecutor) {
        try {
          const queryHealth = await this.queryExecutor.healthCheck();
          healthData.services.queryExecutor = queryHealth;
          
          const queryMetrics = this.queryExecutor.getQueryMetrics();
          healthData.metrics.queries = queryMetrics;
          
          await this.analyzeQueryHealth(queryMetrics, healthData);
        } catch (error) {
          healthData.services.queryExecutor = { status: 'unhealthy', error: error.message };
          healthData.alerts.push({ severity: 'critical', service: 'queryExecutor', message: error.message });
        }
      }

      // Check Performance Monitor
      if (this.performanceMonitor) {
        try {
          const perfHealth = await this.performanceMonitor.healthCheck();
          healthData.services.performanceMonitor = perfHealth;
          
          const perfStats = this.performanceMonitor.getPerformanceStats();
          healthData.metrics.performance = perfStats;
          
          await this.analyzePerformanceHealth(perfStats, healthData);
        } catch (error) {
          healthData.services.performanceMonitor = { status: 'unhealthy', error: error.message };
          healthData.alerts.push({ severity: 'warning', service: 'performanceMonitor', message: error.message });
        }
      }

      // Check Apple Mail Sync Engine
      if (this.appleMailSyncEngine) {
        try {
          const syncHealth = await this.appleMailSyncEngine.healthCheck();
          healthData.services.appleMailSyncEngine = syncHealth;
          
          const syncStats = this.appleMailSyncEngine.getSyncStats();
          healthData.metrics.sync = syncStats;
          
          await this.analyzeSyncHealth(syncStats, healthData);
        } catch (error) {
          healthData.services.appleMailSyncEngine = { status: 'unhealthy', error: error.message };
          healthData.alerts.push({ severity: 'warning', service: 'appleMailSyncEngine', message: error.message });
        }
      }

      // Calculate overall health score
      healthData.overall = this.calculateOverallHealth(healthData);
      healthData.responseTime = Date.now() - startTime;

      // Store in health history
      this.storeHealthHistory(healthData);
      
      // Process alerts
      await this.processAlerts(healthData.alerts);

      logger.debug('Comprehensive health check completed', {
        overallStatus: healthData.overall.status,
        score: healthData.overall.score,
        responseTime: healthData.responseTime,
        alerts: healthData.alerts.length
      });

      return healthData;
      
    } catch (error) {
      logger.error('Comprehensive health check failed:', error);
      return {
        timestamp,
        overall: { status: 'unhealthy', score: 0, error: error.message },
        responseTime: Date.now() - startTime
      };
    }
  }

  async analyzeConnectionHealth(metrics, healthData) {
    // Check connection pool utilization
    const writeUtil = metrics.writePool.totalCount > 0 
      ? (metrics.writePool.totalCount - metrics.writePool.idleCount) / metrics.writePool.totalCount
      : 0;
    
    const readUtil = metrics.readPool.totalCount > 0
      ? (metrics.readPool.totalCount - metrics.readPool.idleCount) / metrics.readPool.totalCount
      : 0;

    if (writeUtil > this.alertThresholds.connectionUtilization) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'connectionManager',
        message: `High write pool utilization: ${(writeUtil * 100).toFixed(1)}%`,
        metric: 'writePoolUtilization',
        value: writeUtil,
        threshold: this.alertThresholds.connectionUtilization
      });
    }

    if (readUtil > this.alertThresholds.connectionUtilization) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'connectionManager',
        message: `High read pool utilization: ${(readUtil * 100).toFixed(1)}%`,
        metric: 'readPoolUtilization',
        value: readUtil,
        threshold: this.alertThresholds.connectionUtilization
      });
    }

    // Check waiting connections
    if (metrics.writePool.waitingCount > 5) {
      healthData.alerts.push({
        severity: 'critical',
        service: 'connectionManager',
        message: `High write pool queue: ${metrics.writePool.waitingCount} waiting`,
        metric: 'writePoolWaiting',
        value: metrics.writePool.waitingCount
      });
    }
  }

  async analyzeCacheHealth(stats, healthData) {
    // Parse hit rates
    const localHitRate = parseFloat(stats.localCache.hitRate) / 100;
    const redisHitRate = parseFloat(stats.redis.hitRate) / 100;
    const overallHitRate = parseFloat(stats.overall.overallHitRate) / 100;

    if (overallHitRate < this.alertThresholds.cacheHitRate) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'cacheManager',
        message: `Low cache hit rate: ${stats.overall.overallHitRate}`,
        metric: 'cacheHitRate',
        value: overallHitRate,
        threshold: this.alertThresholds.cacheHitRate
      });
    }

    // Check Redis connectivity
    if (!stats.redis.connected) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'cacheManager',
        message: 'Redis disconnected - using local cache only',
        metric: 'redisConnected',
        value: false
      });
    }

    // Check cache errors
    if (stats.overall.errors > 10) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'cacheManager',
        message: `High cache error count: ${stats.overall.errors}`,
        metric: 'cacheErrors',
        value: stats.overall.errors
      });
    }
  }

  async analyzeQueryHealth(metrics, healthData) {
    // Check error rate
    const errorRate = parseFloat(metrics.execution.errorRate) / 100;
    
    if (errorRate > this.alertThresholds.errorRate) {
      healthData.alerts.push({
        severity: 'critical',
        service: 'queryExecutor',
        message: `High query error rate: ${metrics.execution.errorRate}`,
        metric: 'queryErrorRate',
        value: errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }

    // Check cache performance
    const cacheHitRate = parseFloat(metrics.caching.cacheHitRate) / 100;
    if (cacheHitRate < this.alertThresholds.cacheHitRate) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'queryExecutor',
        message: `Low query cache hit rate: ${metrics.caching.cacheHitRate}`,
        metric: 'queryCacheHitRate',
        value: cacheHitRate,
        threshold: this.alertThresholds.cacheHitRate
      });
    }
  }

  async analyzePerformanceHealth(stats, healthData) {
    // Check for slow queries
    const slowQueryCount = stats.performanceBuckets.verySlow;
    const totalQueries = Object.values(stats.performanceBuckets)
      .filter(v => typeof v === 'number')
      .reduce((sum, count) => sum + count, 0);
    
    if (totalQueries > 0) {
      const slowQueryRate = slowQueryCount / totalQueries;
      if (slowQueryRate > 0.1) { // More than 10% slow queries
        healthData.alerts.push({
          severity: 'warning',
          service: 'performanceMonitor',
          message: `High slow query rate: ${(slowQueryRate * 100).toFixed(1)}%`,
          metric: 'slowQueryRate',
          value: slowQueryRate,
          threshold: 0.1
        });
      }
    }

    // Check average query time
    const avgTime = parseFloat(stats.overview.avgQueryTime);
    if (avgTime > 1000) { // More than 1 second average
      healthData.alerts.push({
        severity: 'warning',
        service: 'performanceMonitor',
        message: `High average query time: ${stats.overview.avgQueryTime}`,
        metric: 'avgQueryTime',
        value: avgTime,
        threshold: 1000
      });
    }
  }

  async analyzeSyncHealth(stats, healthData) {
    // Check sync errors
    if (stats.performance.syncErrors > 5) {
      healthData.alerts.push({
        severity: 'warning',
        service: 'appleMailSyncEngine',
        message: `High sync error count: ${stats.performance.syncErrors}`,
        metric: 'syncErrors',
        value: stats.performance.syncErrors
      });
    }

    // Check if sync is stuck
    if (stats.state.lastSyncTime) {
      const lastSync = new Date(stats.state.lastSyncTime);
      const timeSinceSync = Date.now() - lastSync.getTime();
      
      if (timeSinceSync > stats.state.syncIntervalMs * 2) {
        healthData.alerts.push({
          severity: 'critical',
          service: 'appleMailSyncEngine',
          message: `Sync appears stuck - last sync: ${lastSync.toISOString()}`,
          metric: 'syncStuck',
          value: timeSinceSync
        });
      }
    }
  }

  calculateOverallHealth(healthData) {
    let totalScore = 100;
    let status = 'healthy';
    
    // Deduct points for each service issue
    for (const [serviceName, serviceHealth] of Object.entries(healthData.services)) {
      if (serviceHealth.status === 'unhealthy') {
        totalScore -= 25;
        status = 'unhealthy';
      } else if (serviceHealth.status === 'degraded') {
        totalScore -= 15;
        if (status === 'healthy') status = 'degraded';
      }
    }
    
    // Deduct points for alerts
    for (const alert of healthData.alerts) {
      switch (alert.severity) {
        case 'critical':
          totalScore -= 20;
          status = 'critical';
          break;
        case 'warning':
          totalScore -= 10;
          if (status === 'healthy') status = 'degraded';
          break;
        case 'info':
          totalScore -= 5;
          break;
      }
    }
    
    totalScore = Math.max(0, totalScore);
    
    return {
      status,
      score: totalScore,
      servicesHealthy: Object.values(healthData.services).filter(s => s.status === 'healthy').length,
      servicesTotal: Object.keys(healthData.services).length,
      criticalAlerts: healthData.alerts.filter(a => a.severity === 'critical').length,
      warningAlerts: healthData.alerts.filter(a => a.severity === 'warning').length
    };
  }

  storeHealthHistory(healthData) {
    this.healthHistory.push({
      timestamp: healthData.timestamp,
      overallScore: healthData.overall.score,
      responseTime: healthData.responseTime,
      alerts: healthData.alerts.length,
      services: Object.keys(healthData.services).reduce((acc, service) => {
        acc[service] = healthData.services[service].status;
        return acc;
      }, {})
    });

    // Keep history size bounded
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  async processAlerts(alerts) {
    const now = Date.now();
    
    for (const alert of alerts) {
      const alertKey = `${alert.service}-${alert.metric || alert.message}`;
      const lastAlert = this.activeAlerts.get(alertKey);
      
      // Check cooldown period
      if (lastAlert && (now - lastAlert.timestamp) < this.alertCooldown) {
        continue;
      }
      
      // Log the alert
      const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
      logger[logLevel]('Health alert triggered', alert);
      
      // Update active alerts
      this.activeAlerts.set(alertKey, {
        ...alert,
        timestamp: now
      });
      
      // Could add external alerting here (email, Slack, etc.)
    }
  }

  setupPeriodicHealthChecks() {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'); // 5 minutes
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performComprehensiveHealthCheck();
        
        if (health.overall.status !== 'healthy') {
          logger.warn('System health degraded', {
            status: health.overall.status,
            score: health.overall.score,
            alerts: health.alerts.length
          });
        }
      } catch (error) {
        logger.error('Periodic health check failed:', error);
      }
    }, interval);
    
    logger.info(`Periodic health checks scheduled every ${interval / 1000} seconds`);
  }

  getHealthSummary() {
    const recentHistory = this.healthHistory.slice(-12); // Last 12 checks (1 hour at 5-minute intervals)
    
    return {
      current: this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null,
      trend: {
        avgScore: recentHistory.length > 0 
          ? recentHistory.reduce((sum, h) => sum + h.overallScore, 0) / recentHistory.length
          : 0,
        avgResponseTime: recentHistory.length > 0
          ? recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length
          : 0,
        totalAlerts: recentHistory.reduce((sum, h) => sum + h.alerts, 0)
      },
      activeAlerts: Array.from(this.activeAlerts.values()),
      configuration: {
        alertThresholds: this.alertThresholds,
        historySize: this.healthHistory.length,
        maxHistorySize: this.maxHistorySize
      }
    };
  }

  async healthCheck() {
    return {
      status: 'healthy',
      isInitialized: this.isInitialized,
      dependencies: {
        connectionManager: !!this.connectionManager,
        cacheManager: !!this.cacheManager,
        queryExecutor: !!this.queryExecutor,
        performanceMonitor: !!this.performanceMonitor,
        appleMailSyncEngine: !!this.appleMailSyncEngine
      },
      summary: this.getHealthSummary(),
      timestamp: new Date().toISOString()
    };
  }

  async shutdown() {
    logger.info('Shutting down Database Health Checker...');
    
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Log final health summary
      const summary = this.getHealthSummary();
      logger.info('Final health summary', {
        totalChecks: this.healthHistory.length,
        avgScore: summary.trend.avgScore,
        totalAlerts: this.activeAlerts.size
      });
      
      this.isInitialized = false;
      logger.info('✅ Database Health Checker shutdown complete');
    } catch (error) {
      logger.error('Error during Database Health Checker shutdown:', error);
      throw error;
    }
  }
}

module.exports = DatabaseHealthChecker;