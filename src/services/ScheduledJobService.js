/**
 * Scheduled Job Service - Server-side scheduled jobs for maintenance tasks
 * Replaces client-side polling with server-side scheduled operations
 */

const { AIJobQueue } = require('../ai/AsyncAIProcessor');
const { WebSocketManager } = require('../websocket/WebSocketManager');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'scheduled-job-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/scheduled-jobs.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ],
});

class ScheduledJobService {
  constructor(webSocketManager = null) {
    this.jobQueue = new AIJobQueue();
    this.intervals = new Map();
    this.isRunning = false;
    this.webSocketManager = webSocketManager;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    this.scheduleJob('cache-cleanup', this.performCacheCleanup.bind(this), 5 * 60 * 1000);
    
    this.scheduleJob('metrics-collection', this.performMetricsCollection.bind(this), 60 * 1000);
    
    this.scheduleJob('performance-monitoring', this.performPerformanceMonitoring.bind(this), 30 * 1000);
    
    logger.info('Scheduled job service started');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.intervals.forEach((interval, jobName) => {
      clearInterval(interval);
      logger.info('Stopped scheduled job', { jobName });
    });
    
    this.intervals.clear();
    this.isRunning = false;
    
    logger.info('Scheduled job service stopped');
  }

  scheduleJob(jobName, jobFunction, intervalMs) {
    if (this.intervals.has(jobName)) {
      clearInterval(this.intervals.get(jobName));
    }
    
    const interval = setInterval(async () => {
      try {
        await jobFunction();
      } catch (error) {
        logger.error('Scheduled job failed', { 
          jobName, 
          error: error.message,
          stack: error.stack 
        });
      }
    }, intervalMs);
    
    this.intervals.set(jobName, interval);
    
    logger.info('Scheduled job registered', { 
      jobName, 
      intervalMs: intervalMs / 1000 + 's' 
    });
  }

  async performCacheCleanup() {
    logger.debug('Performing cache cleanup');
    
    const jobId = this.jobQueue.enqueue({
      type: 'cache-cleanup',
      priority: 'low',
      data: {
        action: 'cleanup_expired_cache',
        timestamp: new Date().toISOString()
      }
    });
    
    if (this.webSocketManager) {
      this.webSocketManager.broadcastPerformanceUpdate({
        type: 'cache_cleanup',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.debug('Cache cleanup job queued', { jobId });
  }

  async performMetricsCollection() {
    logger.debug('Performing metrics collection');
    
    const jobId = this.jobQueue.enqueue({
      type: 'metrics-collection',
      priority: 'medium',
      data: {
        action: 'collect_performance_metrics',
        timestamp: new Date().toISOString()
      }
    });
    
    if (this.webSocketManager) {
      this.webSocketManager.broadcastPerformanceUpdate({
        type: 'metrics_collection',
        timestamp: new Date().toISOString(),
        metrics: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          cpu: process.cpuUsage()
        }
      });
    }
    
    logger.debug('Metrics collection job queued', { jobId });
  }

  async performPerformanceMonitoring() {
    logger.debug('Performing performance monitoring');
    
    const jobId = this.jobQueue.enqueue({
      type: 'performance-monitoring',
      priority: 'medium',
      data: {
        action: 'monitor_system_performance',
        timestamp: new Date().toISOString(),
        metrics: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          cpu: process.cpuUsage()
        }
      }
    });
    
    if (this.webSocketManager) {
      this.webSocketManager.broadcastAdminUpdate({
        type: 'system_health',
        timestamp: new Date().toISOString(),
        health: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          connections: this.webSocketManager.getStats().totalConnections
        }
      });
    }
    
    logger.debug('Performance monitoring job queued', { jobId });
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.intervals.size,
      jobNames: Array.from(this.intervals.keys()),
      queueStats: this.jobQueue.getStats()
    };
  }
}

module.exports = { ScheduledJobService };
