/**
 * Performance Monitor Service - Query performance tracking and bottleneck analysis
 */

const crypto = require('crypto');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'performance-monitor' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/performance-monitor.log' })
  ]
});

class PerformanceMonitor {
  constructor() {
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');
    this.queryStats = new Map();
    this.recentQueries = [];
    this.maxRecentQueries = parseInt(process.env.MAX_RECENT_QUERIES || '100');
    this.isInitialized = false;
    
    // Performance buckets for analysis
    this.performanceBuckets = {
      fast: 0,      // < 100ms
      normal: 0,    // 100ms - 500ms
      slow: 0,      // 500ms - 1000ms
      verySlow: 0   // > 1000ms
    };
    
    // Statistics
    this.stats = {
      totalQueries: 0,
      totalTime: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  initialize() {
    if (this.isInitialized) return;
    
    try {
      this.setupMaintenanceTasks();
      this.isInitialized = true;
      logger.info('✅ Performance Monitor initialized successfully');
    } catch (error) {
      logger.error('❌ Performance Monitor initialization failed:', error);
      throw error;
    }
  }

  async monitorQuery(queryFn, queryInfo) {
    const startTime = process.hrtime.bigint();
    const queryHash = crypto.createHash('md5').update(queryInfo.query).digest('hex');
    const timestamp = new Date();

    try {
      const result = await queryFn();
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds

      // Record performance metrics
      this.recordQueryPerformance(queryHash, queryInfo, duration, result.rowCount, timestamp, null);
      
      // Categorize performance
      this.categorizePerformance(duration);

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          duration: `${duration.toFixed(2)}ms`,
          query: this.sanitizeQuery(queryInfo.query),
          params: queryInfo.params?.length || 0,
          rowCount: result.rowCount,
          poolType: queryInfo.poolType,
          queryHash
        });
        
        // Trigger slow query analysis
        this.analyzeSlowQuery(queryHash, queryInfo, duration);
      } else {
        logger.debug('Query executed', {
          duration: `${duration.toFixed(2)}ms`,
          rowCount: result.rowCount,
          poolType: queryInfo.poolType,
          queryHash
        });
      }

      return result;
      
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      // Record error
      this.recordQueryPerformance(queryHash, queryInfo, duration, 0, timestamp, error);
      
      logger.error('Query execution failed', {
        duration: `${duration.toFixed(2)}ms`,
        query: this.sanitizeQuery(queryInfo.query),
        params: queryInfo.params?.length || 0,
        poolType: queryInfo.poolType,
        error: error.message,
        queryHash
      });
      
      throw error;
    }
  }

  recordQueryPerformance(queryHash, queryInfo, duration, rowCount, timestamp, error) {
    // Update global stats
    this.stats.totalQueries++;
    this.stats.totalTime += duration;
    if (error) {
      this.stats.errors++;
    }

    // Update query-specific stats
    const stats = this.queryStats.get(queryHash) || {
      query: this.sanitizeQuery(queryInfo.query),
      poolType: queryInfo.poolType,
      executions: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Infinity,
      avgTime: 0,
      errors: 0,
      firstSeen: timestamp,
      lastExecuted: null,
      recentExecutions: []
    };

    stats.executions++;
    stats.totalTime += duration;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.minTime = Math.min(stats.minTime, duration);
    stats.avgTime = stats.totalTime / stats.executions;
    stats.lastExecuted = timestamp;
    
    if (error) {
      stats.errors++;
    }

    // Keep track of recent executions for trend analysis
    stats.recentExecutions.push({
      duration,
      timestamp,
      rowCount,
      error: error ? error.message : null
    });
    
    // Keep only last 10 executions per query
    if (stats.recentExecutions.length > 10) {
      stats.recentExecutions.shift();
    }

    this.queryStats.set(queryHash, stats);

    // Add to recent queries list
    this.recentQueries.push({
      queryHash,
      query: this.sanitizeQuery(queryInfo.query),
      duration,
      rowCount,
      timestamp,
      poolType: queryInfo.poolType,
      error: error ? error.message : null
    });

    // Keep recent queries list bounded
    if (this.recentQueries.length > this.maxRecentQueries) {
      this.recentQueries.shift();
    }
  }

  categorizePerformance(duration) {
    if (duration < 100) {
      this.performanceBuckets.fast++;
    } else if (duration < 500) {
      this.performanceBuckets.normal++;
    } else if (duration < 1000) {
      this.performanceBuckets.slow++;
    } else {
      this.performanceBuckets.verySlow++;
    }
  }

  analyzeSlowQuery(queryHash, queryInfo, duration) {
    const stats = this.queryStats.get(queryHash);
    if (!stats) return;

    // Check if this is consistently slow
    const recentAvg = stats.recentExecutions.length > 0
      ? stats.recentExecutions.reduce((sum, exec) => sum + exec.duration, 0) / stats.recentExecutions.length
      : duration;

    if (recentAvg > this.slowQueryThreshold) {
      logger.warn('Consistently slow query detected', {
        queryHash,
        avgDuration: `${recentAvg.toFixed(2)}ms`,
        executions: stats.executions,
        query: stats.query
      });
    }

    // Check for performance degradation
    if (stats.recentExecutions.length >= 5) {
      const recent = stats.recentExecutions.slice(-3).map(e => e.duration);
      const older = stats.recentExecutions.slice(-6, -3).map(e => e.duration);
      
      if (older.length >= 3) {
        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b) / older.length;
        
        if (recentAvg > olderAvg * 1.5) {
          logger.warn('Query performance degradation detected', {
            queryHash,
            recentAvg: `${recentAvg.toFixed(2)}ms`,
            olderAvg: `${olderAvg.toFixed(2)}ms`,
            degradationRatio: (recentAvg / olderAvg).toFixed(2)
          });
        }
      }
    }
  }

  sanitizeQuery(query) {
    return query.substring(0, 100).replace(/\s+/g, ' ').trim() + '...';
  }

  getPerformanceStats() {
    const topSlowQueries = Array.from(this.queryStats.entries())
      .map(([hash, data]) => ({ queryHash: hash, ...data }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const topFrequentQueries = Array.from(this.queryStats.entries())
      .map(([hash, data]) => ({ queryHash: hash, ...data }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10);

    const runtime = Date.now() - this.stats.startTime;
    const avgQueryTime = this.stats.totalQueries > 0 
      ? this.stats.totalTime / this.stats.totalQueries 
      : 0;

    return {
      overview: {
        totalQueries: this.stats.totalQueries,
        totalTime: `${this.stats.totalTime.toFixed(2)}ms`,
        avgQueryTime: `${avgQueryTime.toFixed(2)}ms`,
        errors: this.stats.errors,
        errorRate: this.stats.totalQueries > 0 
          ? `${(this.stats.errors / this.stats.totalQueries * 100).toFixed(2)}%`
          : '0%',
        uptimeMs: runtime,
        queriesPerSecond: runtime > 0 
          ? (this.stats.totalQueries / (runtime / 1000)).toFixed(2)
          : '0'
      },
      performanceBuckets: {
        ...this.performanceBuckets,
        distribution: {
          fast: this.stats.totalQueries > 0 ? `${(this.performanceBuckets.fast / this.stats.totalQueries * 100).toFixed(1)}%` : '0%',
          normal: this.stats.totalQueries > 0 ? `${(this.performanceBuckets.normal / this.stats.totalQueries * 100).toFixed(1)}%` : '0%',
          slow: this.stats.totalQueries > 0 ? `${(this.performanceBuckets.slow / this.stats.totalQueries * 100).toFixed(1)}%` : '0%',
          verySlow: this.stats.totalQueries > 0 ? `${(this.performanceBuckets.verySlow / this.stats.totalQueries * 100).toFixed(1)}%` : '0%'
        }
      },
      topSlowQueries,
      topFrequentQueries,
      recentQueries: this.recentQueries.slice(-10)
    };
  }

  getQueryAnalysis(queryHash) {
    const stats = this.queryStats.get(queryHash);
    if (!stats) {
      return null;
    }

    return {
      ...stats,
      performanceAnalysis: {
        isConsistentlySlow: stats.avgTime > this.slowQueryThreshold,
        variability: stats.maxTime - stats.minTime,
        errorRate: stats.executions > 0 ? `${(stats.errors / stats.executions * 100).toFixed(2)}%` : '0%',
        trend: this.calculateTrend(stats.recentExecutions)
      }
    };
  }

  calculateTrend(executions) {
    if (executions.length < 3) {
      return 'insufficient_data';
    }

    const recent = executions.slice(-3);
    const older = executions.slice(0, 3);
    
    const recentAvg = recent.reduce((sum, e) => sum + e.duration, 0) / recent.length;
    const olderAvg = older.reduce((sum, e) => sum + e.duration, 0) / older.length;

    if (recentAvg > olderAvg * 1.2) {
      return 'degrading';
    } else if (recentAvg < olderAvg * 0.8) {
      return 'improving';
    } else {
      return 'stable';
    }
  }

  setupMaintenanceTasks() {
    // Clean old query stats every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldStats();
    }, 60 * 60 * 1000);

    // Performance report every 15 minutes
    this.reportInterval = setInterval(() => {
      const stats = this.getPerformanceStats();
      logger.info('Performance report', {
        totalQueries: stats.overview.totalQueries,
        avgQueryTime: stats.overview.avgQueryTime,
        errorRate: stats.overview.errorRate,
        slowQueries: stats.topSlowQueries.length
      });
    }, 15 * 60 * 1000);
  }

  cleanupOldStats() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [hash, stats] of this.queryStats.entries()) {
      if (stats.lastExecuted < cutoffTime && stats.executions < 5) {
        this.queryStats.delete(hash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Performance stats cleanup completed', { statsRemoved: cleaned });
    }
  }

  async healthCheck() {
    const startTime = Date.now();
    const stats = this.getPerformanceStats();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      metrics: {
        totalQueries: this.stats.totalQueries,
        avgQueryTime: stats.overview.avgQueryTime,
        errorRate: stats.overview.errorRate,
        trackedQueries: this.queryStats.size
      },
      isInitialized: this.isInitialized,
      timestamp: new Date().toISOString()
    };
  }

  async shutdown() {
    logger.info('Shutting down Performance Monitor...');
    
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      if (this.reportInterval) {
        clearInterval(this.reportInterval);
      }
      
      // Log final performance summary
      const finalStats = this.getPerformanceStats();
      logger.info('Final performance summary', finalStats.overview);
      
      this.isInitialized = false;
      logger.info('✅ Performance Monitor shutdown complete');
    } catch (error) {
      logger.error('Error during Performance Monitor shutdown:', error);
      throw error;
    }
  }
}

module.exports = PerformanceMonitor;