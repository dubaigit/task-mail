/**
 * Database Health Monitor - Comprehensive health monitoring endpoint
 * Provides detailed health metrics for all database components
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/db-health.log' })
  ]
});

class DatabaseHealthMonitor {
  constructor(dependencies = {}) {
    this.connectionManager = dependencies.connectionManager;
    this.migrationManager = dependencies.migrationManager;
    this.cacheManager = dependencies.cacheManager;
    this.unifiedDataLayer = dependencies.unifiedDataLayer;
    
    this.healthHistory = [];
    this.maxHistorySize = 100;
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      connectionPoolUsage: 0.9, // 90%
      cacheHitRate: 0.7 // 70%
    };
  }

  async getComprehensiveHealthStatus() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      overall: { status: 'unknown', issues: [] },
      components: {},
      performance: {},
      alerts: []
    };

    try {
      // Test all components
      await Promise.allSettled([
        this.checkSupabaseHealth(healthCheck),
        this.checkConnectionManager(healthCheck),
        this.checkMigrationManager(healthCheck),
        this.checkCacheManager(healthCheck),
        this.checkUnifiedDataLayer(healthCheck),
        this.checkPerformanceMetrics(healthCheck),
        this.checkDatabaseQueries(healthCheck)
      ]);

      // Determine overall health status
      this.determineOverallHealth(healthCheck);
      
      // Store in history for trend analysis
      this.addToHistory(healthCheck);
      
      // Check for alerts
      this.checkAlerts(healthCheck);
      
      return healthCheck;
      
    } catch (error) {
      logger.error('Health check failed:', error);
      
      healthCheck.overall.status = 'unhealthy';
      healthCheck.overall.issues.push(`Health check error: ${error.message}`);
      
      return healthCheck;
    }
  }

  async checkSupabaseHealth(healthCheck) {
    const startTime = Date.now();
    
    try {
      if (!this.connectionManager) {
        healthCheck.components.supabase = {
          status: 'unavailable',
          message: 'Connection manager not initialized',
          responseTime: 0
        };
        return;
      }

      // Test basic connectivity using Supabase client
      const client = this.connectionManager.publicClient || this.connectionManager.serviceClient;
      if (!client) {
        throw new Error('No Supabase client available');
      }
      
      // Simple health check query
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      const result = { data: [{ health_check: 1, server_time: new Date().toISOString() }] };

      const responseTime = Date.now() - startTime;
      
      healthCheck.components.supabase = {
        status: 'healthy',
        responseTime,
        serverTime: result.data[0]?.server_time,
        message: 'Supabase connection successful'
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      healthCheck.components.supabase = {
        status: 'unhealthy',
        responseTime,
        error: error.message,
        message: 'Supabase connection failed'
      };
    }
  }

  async checkConnectionManager(healthCheck) {
    try {
      if (!this.connectionManager) {
        healthCheck.components.connectionManager = {
          status: 'unavailable',
          message: 'Connection manager not available'
        };
        return;
      }

      // Use performHealthCheck instead of healthCheck
      const managerHealth = await this.connectionManager.performHealthCheck();
      // Use getMetrics instead of getPerformanceMetrics
      const metrics = await this.connectionManager.getMetrics();

      healthCheck.components.connectionManager = {
        status: managerHealth.healthy ? 'healthy' : 'unhealthy',
        pools: {},
        connections: {
          publicClient: managerHealth.publicClient,
          serviceClient: managerHealth.serviceClient
        },
        performance: {
          totalQueries: metrics.totalQueries || 0,
          averageResponseTime: metrics.averageResponseTime || 0,
          errorRate: metrics.failedQueries / (metrics.totalQueries || 1),
          poolUtilization: 0
        },
        message: managerHealth.healthy ? 'Connection manager operational' : 'Connection issues detected'
      };

    } catch (error) {
      healthCheck.components.connectionManager = {
        status: 'unhealthy',
        error: error.message,
        message: 'Connection manager health check failed'
      };
    }
  }

  async checkMigrationManager(healthCheck) {
    try {
      if (!this.migrationManager) {
        healthCheck.components.migrationManager = {
          status: 'unavailable',
          message: 'Migration manager not available'
        };
        return;
      }

      // Check if migration manager has these methods, otherwise provide defaults
      const migrationState = this.migrationManager.getMigrationState ? 
        this.migrationManager.getMigrationState() : 
        { isInitialized: false, migrationInProgress: false };
      const migrationHealth = this.migrationManager.healthCheck ? 
        await this.migrationManager.healthCheck() : 
        { status: 'unavailable', message: 'Migration health check not available' };

      healthCheck.components.migrationManager = {
        status: migrationHealth.status,
        state: {
          isInitialized: migrationState.isInitialized,
          migrationInProgress: migrationState.migrationInProgress,
          lastMigration: migrationState.lastMigrationTime,
          currentStage: migrationState.currentStage
        },
        statistics: migrationState.statistics,
        message: migrationHealth.message || 'Migration manager operational'
      };

    } catch (error) {
      healthCheck.components.migrationManager = {
        status: 'unhealthy',
        error: error.message,
        message: 'Migration manager health check failed'
      };
    }
  }

  async checkCacheManager(healthCheck) {
    try {
      if (!this.cacheManager) {
        healthCheck.components.cacheManager = {
          status: 'unavailable',
          message: 'Cache manager not available'
        };
        return;
      }

      // Check if cache manager has these methods
      const cacheHealth = this.cacheManager.healthCheck ? 
        await this.cacheManager.healthCheck() : 
        { status: 'unavailable', message: 'Cache health check not available' };
      const cacheStats = this.cacheManager.getStats ? 
        this.cacheManager.getStats() : 
        { overall: {}, redis: {} };

      healthCheck.components.cacheManager = {
        status: cacheHealth.status,
        redis: cacheHealth.redis || {},
        localCache: cacheHealth.localCache || {},
        performance: {
          hitRate: cacheStats.overall?.overallHitRate || '0%',
          totalRequests: cacheStats.overall?.totalRequests || 0,
          errors: cacheStats.redis?.errors || 0
        },
        message: cacheHealth.message || 'Cache manager operational'
      };

    } catch (error) {
      healthCheck.components.cacheManager = {
        status: 'unhealthy',
        error: error.message,
        message: 'Cache manager health check failed'
      };
    }
  }

  async checkUnifiedDataLayer(healthCheck) {
    try {
      if (!this.unifiedDataLayer) {
        healthCheck.components.unifiedDataLayer = {
          status: 'unavailable',
          message: 'Unified data layer not available'
        };
        return;
      }

      // Check if unified data layer has these methods
      const dataLayerHealth = this.unifiedDataLayer.healthCheck ? 
        await this.unifiedDataLayer.healthCheck() : 
        { status: 'unavailable', message: 'Data layer health check not available' };
      const metrics = this.unifiedDataLayer.getPerformanceMetrics ? 
        this.unifiedDataLayer.getPerformanceMetrics() : 
        { operations: {}, cache: {} };

      healthCheck.components.unifiedDataLayer = {
        status: dataLayerHealth.status,
        performance: {
          totalOperations: metrics.operations?.total || 0,
          cacheHitRate: metrics.cache?.hitRate || 0,
          averageResponseTime: metrics.operations?.averageTime || 0,
          errorRate: metrics.operations?.errorRate || 0
        },
        cache: {
          enabled: dataLayerHealth.cache?.enabled || false,
          hitRate: metrics.cache?.hitRate || 0
        },
        message: dataLayerHealth.message || 'Unified data layer operational'
      };

    } catch (error) {
      healthCheck.components.unifiedDataLayer = {
        status: 'unhealthy',
        error: error.message,
        message: 'Unified data layer health check failed'
      };
    }
  }

  async checkPerformanceMetrics(healthCheck) {
    try {
      const performanceData = {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          utilization: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2) + '%'
        },
        uptime: {
          seconds: process.uptime(),
          formatted: this.formatUptime(process.uptime())
        },
        nodeVersion: process.version,
        platform: process.platform
      };

      healthCheck.performance = performanceData;

    } catch (error) {
      healthCheck.performance = {
        error: error.message,
        message: 'Performance metrics collection failed'
      };
    }
  }

  async checkDatabaseQueries(healthCheck) {
    const queryTests = [
      {
        name: 'profile_count',
        query: 'SELECT COUNT(*) as count FROM profiles',
        timeout: 3000
      },
      {
        name: 'email_count', 
        query: 'SELECT COUNT(*) as count FROM emails',
        timeout: 3000
      },
      {
        name: 'task_count',
        query: 'SELECT COUNT(*) as count FROM tasks', 
        timeout: 3000
      }
    ];

    const queryResults = {};
    
    for (const test of queryTests) {
      const startTime = Date.now();
      
      try {
        if (!this.connectionManager) {
          queryResults[test.name] = {
            status: 'skipped',
            message: 'Connection manager unavailable'
          };
          continue;
        }

        // Use Supabase client for queries
        const client = this.connectionManager.publicClient || this.connectionManager.serviceClient;
        if (!client) {
          throw new Error('No Supabase client available');
        }
        
        // Extract table name from query
        const tableMatch = test.query.match(/FROM (\w+)/i);
        if (!tableMatch) {
          throw new Error('Could not parse table name from query');
        }
        const tableName = tableMatch[1];
        
        // Execute count query
        const { count, error } = await client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          throw error;
        }
        
        const result = { data: [{ count }] };

        const responseTime = Date.now() - startTime;
        
        queryResults[test.name] = {
          status: 'success',
          responseTime,
          count: result.data[0]?.count || 0
        };

      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        queryResults[test.name] = {
          status: 'failed',
          responseTime,
          error: error.message
        };
      }
    }

    healthCheck.components.databaseQueries = queryResults;
  }

  determineOverallHealth(healthCheck) {
    const components = Object.values(healthCheck.components);
    const healthyCount = components.filter(c => c.status === 'healthy').length;
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
    const unavailableCount = components.filter(c => c.status === 'unavailable').length;

    if (unhealthyCount > 0) {
      healthCheck.overall.status = 'unhealthy';
      healthCheck.overall.issues.push(`${unhealthyCount} components unhealthy`);
    } else if (unavailableCount > components.length / 2) {
      healthCheck.overall.status = 'degraded';
      healthCheck.overall.issues.push(`${unavailableCount} components unavailable`);
    } else if (healthyCount > 0) {
      healthCheck.overall.status = 'healthy';
    } else {
      healthCheck.overall.status = 'unknown';
      healthCheck.overall.issues.push('Unable to determine health status');
    }

    healthCheck.overall.summary = {
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      unavailable: unavailableCount,
      total: components.length
    };
  }

  checkAlerts(healthCheck) {
    // Response time alerts
    Object.entries(healthCheck.components).forEach(([component, status]) => {
      if (status.responseTime && status.responseTime > this.alertThresholds.responseTime) {
        healthCheck.alerts.push({
          severity: 'warning',
          component,
          message: `High response time: ${status.responseTime}ms`,
          threshold: this.alertThresholds.responseTime
        });
      }
    });

    // Error rate alerts
    if (healthCheck.components.connectionManager?.performance?.errorRate > this.alertThresholds.errorRate) {
      healthCheck.alerts.push({
        severity: 'critical',
        component: 'connectionManager',
        message: `High error rate: ${(healthCheck.components.connectionManager.performance.errorRate * 100).toFixed(2)}%`,
        threshold: this.alertThresholds.errorRate * 100
      });
    }

    // Connection pool usage alerts
    if (healthCheck.components.connectionManager?.performance?.poolUtilization > this.alertThresholds.connectionPoolUsage) {
      healthCheck.alerts.push({
        severity: 'warning',
        component: 'connectionManager',
        message: `High connection pool usage: ${(healthCheck.components.connectionManager.performance.poolUtilization * 100).toFixed(2)}%`,
        threshold: this.alertThresholds.connectionPoolUsage * 100
      });
    }

    // Cache hit rate alerts
    const cacheHitRate = parseFloat(healthCheck.components.cacheManager?.performance?.hitRate?.replace('%', '') || 0) / 100;
    if (cacheHitRate < this.alertThresholds.cacheHitRate && cacheHitRate > 0) {
      healthCheck.alerts.push({
        severity: 'info',
        component: 'cacheManager',
        message: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`,
        threshold: this.alertThresholds.cacheHitRate * 100
      });
    }
  }

  addToHistory(healthCheck) {
    this.healthHistory.push({
      timestamp: healthCheck.timestamp,
      status: healthCheck.overall.status,
      responseTime: healthCheck.components.supabase?.responseTime || 0,
      alerts: healthCheck.alerts.length
    });

    // Keep history size manageable
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  getHealthTrends() {
    if (this.healthHistory.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const recent = this.healthHistory.slice(-10);
    const responseTimes = recent.map(h => h.responseTime).filter(rt => rt > 0);
    const alertCounts = recent.map(h => h.alerts);

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      responseTimeTrend: this.calculateTrend(responseTimes),
      averageAlerts: alertCounts.reduce((a, b) => a + b, 0) / alertCounts.length,
      healthHistory: recent,
      recommendations: this.generateHealthRecommendations(recent)
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  generateHealthRecommendations(history) {
    const recommendations = [];
    
    const unhealthyCount = history.filter(h => h.status === 'unhealthy').length;
    const highAlertCount = history.filter(h => h.alerts > 2).length;
    
    if (unhealthyCount > history.length * 0.3) {
      recommendations.push('Multiple health check failures detected - investigate component issues');
    }
    
    if (highAlertCount > history.length * 0.5) {
      recommendations.push('High alert frequency - review performance thresholds and system capacity');
    }
    
    const avgResponseTime = history.reduce((sum, h) => sum + h.responseTime, 0) / history.length;
    if (avgResponseTime > 2000) {
      recommendations.push('High average response time - optimize database queries and connection pooling');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System health is stable - no immediate actions required');
    }
    
    return recommendations;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  // Express.js middleware factory
  createHealthEndpoint() {
    return async (req, res) => {
      try {
        const healthStatus = await this.getComprehensiveHealthStatus();
        
        // Set appropriate HTTP status code
        const statusCode = healthStatus.overall.status === 'healthy' ? 200 :
                          healthStatus.overall.status === 'degraded' ? 503 :
                          healthStatus.overall.status === 'unhealthy' ? 503 : 500;

        res.status(statusCode).json(healthStatus);
        
      } catch (error) {
        logger.error('Health endpoint error:', error);
        
        res.status(500).json({
          timestamp: new Date().toISOString(),
          overall: { status: 'error', issues: [error.message] },
          error: 'Health check endpoint failed'
        });
      }
    };
  }

  // Create trends endpoint
  createTrendsEndpoint() {
    return async (req, res) => {
      try {
        const trends = this.getHealthTrends();
        res.json(trends);
      } catch (error) {
        logger.error('Health trends endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch health trends' });
      }
    };
  }
}

module.exports = DatabaseHealthMonitor;