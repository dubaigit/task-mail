/**
 * Comprehensive Health Check and Monitoring System
 * Provides health checks, metrics collection, alerting, and system monitoring
 */

const winston = require('winston');
const EventEmitter = require('events');
const os = require('os');
const fs = require('fs').promises;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/health-monitoring.log' })
  ]
});

/**
 * Health Check Configuration
 */
const HEALTH_CONFIG = {
  // Health check intervals
  INTERVALS: {
    CRITICAL_SERVICES: 10000, // 10 seconds
    STANDARD_SERVICES: 30000, // 30 seconds
    SYSTEM_METRICS: 60000, // 1 minute
    DEPENDENCY_CHECKS: 120000 // 2 minutes
  },

  // Health thresholds
  THRESHOLDS: {
    CPU_WARNING: 70,
    CPU_CRITICAL: 90,
    MEMORY_WARNING: 80,
    MEMORY_CRITICAL: 95,
    DISK_WARNING: 85,
    DISK_CRITICAL: 95,
    RESPONSE_TIME_WARNING: 1000, // ms
    RESPONSE_TIME_CRITICAL: 5000, // ms
    ERROR_RATE_WARNING: 5, // percentage
    ERROR_RATE_CRITICAL: 10 // percentage
  },

  // Alert configuration
  ALERTS: {
    RETRY_ATTEMPTS: 3,
    ESCALATION_TIMEOUT: 300000, // 5 minutes
    ALERT_COOLDOWN: 600000, // 10 minutes
    CHANNELS: ['email', 'slack', 'webhook']
  },

  // Service dependencies
  DEPENDENCIES: {
    DATABASE: 'postgresql',
    CACHE: 'redis',
    MESSAGE_QUEUE: 'rabbitmq',
    EXTERNAL_APIS: ['openai-api', 'email-service']
  }
};

/**
 * Health Status Definitions
 */
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  WARNING: 'warning', 
  CRITICAL: 'critical',
  DOWN: 'down',
  UNKNOWN: 'unknown'
};

/**
 * Comprehensive Health Monitor
 */
class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = { ...HEALTH_CONFIG, ...options };
    this.services = new Map(); // serviceName -> healthCheck config
    this.healthHistory = new Map(); // serviceName -> health events
    this.systemMetrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    };
    this.alerts = new Map(); // alertId -> alert info
    this.alertCooldowns = new Map(); // alertKey -> timestamp
    
    this.initializeHealthChecks();
    this.setupSystemMonitoring();
  }

  // Initialize health check system
  initializeHealthChecks() {
    // Register core system checks
    this.registerSystemHealthChecks();
    
    // Start health check intervals
    this.startHealthCheckIntervals();
    
    logger.info('Health monitoring system initialized');
  }

  // Register a service for health monitoring
  registerService(serviceName, healthCheckConfig) {
    const config = {
      name: serviceName,
      url: healthCheckConfig.url,
      method: healthCheckConfig.method || 'GET',
      timeout: healthCheckConfig.timeout || 5000,
      interval: healthCheckConfig.interval || this.config.INTERVALS.STANDARD_SERVICES,
      retries: healthCheckConfig.retries || 3,
      expectedStatus: healthCheckConfig.expectedStatus || 200,
      headers: healthCheckConfig.headers || {},
      critical: healthCheckConfig.critical || false,
      dependencies: healthCheckConfig.dependencies || [],
      customCheck: healthCheckConfig.customCheck,
      registeredAt: new Date(),
      lastCheck: null,
      status: HEALTH_STATUS.UNKNOWN,
      consecutiveFailures: 0
    };

    this.services.set(serviceName, config);
    this.healthHistory.set(serviceName, []);
    
    // Start individual health check interval
    this.startServiceHealthCheck(serviceName);
    
    logger.info(`Service registered for health monitoring: ${serviceName}`);
    this.emit('service.registered', { serviceName, config });
  }

  // Register system-level health checks
  registerSystemHealthChecks() {
    // CPU Health Check
    this.registerService('system-cpu', {
      url: null,
      interval: this.config.INTERVALS.SYSTEM_METRICS,
      critical: true,
      customCheck: async () => {
        const cpuUsage = await this.getCPUUsage();
        return {
          healthy: cpuUsage < this.config.THRESHOLDS.CPU_CRITICAL,
          status: this.getStatusFromCPU(cpuUsage),
          metrics: { cpuUsage },
          responseTime: 0
        };
      }
    });

    // Memory Health Check
    this.registerService('system-memory', {
      url: null,
      interval: this.config.INTERVALS.SYSTEM_METRICS,
      critical: true,
      customCheck: async () => {
        const memoryUsage = this.getMemoryUsage();
        return {
          healthy: memoryUsage.percentage < this.config.THRESHOLDS.MEMORY_CRITICAL,
          status: this.getStatusFromMemory(memoryUsage.percentage),
          metrics: memoryUsage,
          responseTime: 0
        };
      }
    });

    // Disk Health Check
    this.registerService('system-disk', {
      url: null,
      interval: this.config.INTERVALS.SYSTEM_METRICS,
      critical: true,
      customCheck: async () => {
        const diskUsage = await this.getDiskUsage();
        return {
          healthy: diskUsage.percentage < this.config.THRESHOLDS.DISK_CRITICAL,
          status: this.getStatusFromDisk(diskUsage.percentage),
          metrics: diskUsage,
          responseTime: 0
        };
      }
    });
  }

  // Start health check intervals for all services
  startHealthCheckIntervals() {
    for (const serviceName of this.services.keys()) {
      this.startServiceHealthCheck(serviceName);
    }
  }

  // Start health check for specific service
  startServiceHealthCheck(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return;

    // Clear any existing interval
    if (service.intervalId) {
      clearInterval(service.intervalId);
    }

    // Set up new interval
    service.intervalId = setInterval(async () => {
      await this.performHealthCheck(serviceName);
    }, service.interval);
  }

  // Perform health check for a service
  async performHealthCheck(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return;

    const startTime = Date.now();
    let healthResult;

    try {
      if (service.customCheck) {
        // Custom health check function
        healthResult = await service.customCheck();
      } else {
        // HTTP health check
        healthResult = await this.performHTTPHealthCheck(service);
      }

      const responseTime = Date.now() - startTime;
      healthResult.responseTime = responseTime;
      
      // Process health check result
      await this.processHealthResult(serviceName, healthResult);
      
    } catch (error) {
      // Health check failed
      const responseTime = Date.now() - startTime;
      healthResult = {
        healthy: false,
        status: HEALTH_STATUS.DOWN,
        error: error.message,
        responseTime,
        metrics: {}
      };
      
      await this.processHealthResult(serviceName, healthResult);
    }
  }

  // Perform HTTP health check
  async performHTTPHealthCheck(service) {
    const fetch = require('node-fetch'); // In real implementation, use proper HTTP client
    
    const response = await fetch(service.url, {
      method: service.method,
      headers: service.headers,
      timeout: service.timeout
    });

    const healthy = response.status === service.expectedStatus;
    const responseData = await response.text();

    return {
      healthy,
      status: healthy ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.CRITICAL,
      httpStatus: response.status,
      responseBody: responseData,
      metrics: {
        httpStatus: response.status,
        responseSize: responseData.length
      }
    };
  }

  // Process health check result
  async processHealthResult(serviceName, result) {
    const service = this.services.get(serviceName);
    if (!service) return;

    const previousStatus = service.status;
    service.lastCheck = new Date();
    service.status = result.status;

    // Handle consecutive failures
    if (!result.healthy) {
      service.consecutiveFailures = (service.consecutiveFailures || 0) + 1;
    } else {
      service.consecutiveFailures = 0;
    }

    // Record health event
    const healthEvent = {
      timestamp: new Date(),
      status: result.status,
      healthy: result.healthy,
      responseTime: result.responseTime,
      metrics: result.metrics,
      error: result.error,
      consecutiveFailures: service.consecutiveFailures
    };

    const history = this.healthHistory.get(serviceName);
    history.push(healthEvent);
    
    // Keep only last 100 health events
    if (history.length > 100) {
      this.healthHistory.set(serviceName, history.slice(-100));
    }

    // Emit health change event if status changed
    if (previousStatus !== result.status) {
      this.emit('health.changed', {
        serviceName,
        previousStatus,
        currentStatus: result.status,
        service,
        result
      });
      
      logger.info(`Health status changed: ${serviceName} ${previousStatus} -> ${result.status}`);
    }

    // Check if alerting is needed
    await this.checkAlerting(serviceName, healthEvent);

    // Update system metrics if it's a system service
    if (serviceName.startsWith('system-')) {
      this.updateSystemMetrics(serviceName, result.metrics);
    }
  }

  // Setup system-level monitoring
  setupSystemMonitoring() {
    // Process metrics collection
    setInterval(async () => {
      await this.collectProcessMetrics();
    }, this.config.INTERVALS.SYSTEM_METRICS);
  }

  // Collect process-level metrics
  async collectProcessMetrics() {
    const processMetrics = {
      timestamp: new Date(),
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: await this.getCPUUsage(),
      eventLoopLag: this.getEventLoopLag(),
      handles: process._getActiveHandles().length,
      requests: process._getActiveRequests().length
    };

    this.emit('process.metrics', processMetrics);
  }

  // System resource monitoring methods
  async getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - Math.round((idle / total) * 100);
    
    return usage;
  }

  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentage = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  async getDiskUsage() {
    try {
      const stats = await fs.stat('/');
      // This is a simplified implementation
      // In real implementation, use proper disk usage library
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB placeholder
        used: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        free: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        percentage: 50
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        error: error.message
      };
    }
  }

  getEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
      return lag;
    });
    return 0; // Simplified for this example
  }

  // Status determination methods
  getStatusFromCPU(usage) {
    if (usage >= this.config.THRESHOLDS.CPU_CRITICAL) return HEALTH_STATUS.CRITICAL;
    if (usage >= this.config.THRESHOLDS.CPU_WARNING) return HEALTH_STATUS.WARNING;
    return HEALTH_STATUS.HEALTHY;
  }

  getStatusFromMemory(percentage) {
    if (percentage >= this.config.THRESHOLDS.MEMORY_CRITICAL) return HEALTH_STATUS.CRITICAL;
    if (percentage >= this.config.THRESHOLDS.MEMORY_WARNING) return HEALTH_STATUS.WARNING;
    return HEALTH_STATUS.HEALTHY;
  }

  getStatusFromDisk(percentage) {
    if (percentage >= this.config.THRESHOLDS.DISK_CRITICAL) return HEALTH_STATUS.CRITICAL;
    if (percentage >= this.config.THRESHOLDS.DISK_WARNING) return HEALTH_STATUS.WARNING;
    return HEALTH_STATUS.HEALTHY;
  }

  // Update system metrics storage
  updateSystemMetrics(serviceName, metrics) {
    const metricType = serviceName.replace('system-', '');
    
    if (this.systemMetrics[metricType]) {
      this.systemMetrics[metricType].push({
        timestamp: new Date(),
        ...metrics
      });
      
      // Keep only last 60 data points (1 hour at 1-minute intervals)
      if (this.systemMetrics[metricType].length > 60) {
        this.systemMetrics[metricType] = this.systemMetrics[metricType].slice(-60);
      }
    }
  }

  // Alerting system
  async checkAlerting(serviceName, healthEvent) {
    const service = this.services.get(serviceName);
    if (!service) return;

    const alertKey = `${serviceName}-${healthEvent.status}`;
    const cooldownEnd = this.alertCooldowns.get(alertKey) || 0;
    
    // Check if we're in cooldown period
    if (Date.now() < cooldownEnd) {
      return;
    }

    // Determine if alert should be sent
    let shouldAlert = false;
    let alertLevel = 'info';

    switch (healthEvent.status) {
      case HEALTH_STATUS.CRITICAL:
      case HEALTH_STATUS.DOWN:
        shouldAlert = true;
        alertLevel = 'critical';
        break;
      case HEALTH_STATUS.WARNING:
        shouldAlert = service.consecutiveFailures >= 3;
        alertLevel = 'warning';
        break;
    }

    if (shouldAlert) {
      await this.sendAlert({
        serviceName,
        level: alertLevel,
        status: healthEvent.status,
        message: this.generateAlertMessage(serviceName, healthEvent),
        metrics: healthEvent.metrics,
        service
      });
      
      // Set cooldown
      this.alertCooldowns.set(alertKey, Date.now() + this.config.ALERTS.ALERT_COOLDOWN);
    }
  }

  // Generate alert message
  generateAlertMessage(serviceName, healthEvent) {
    const messages = {
      [HEALTH_STATUS.DOWN]: `Service ${serviceName} is DOWN`,
      [HEALTH_STATUS.CRITICAL]: `Service ${serviceName} is in CRITICAL state`,
      [HEALTH_STATUS.WARNING]: `Service ${serviceName} is experiencing issues (WARNING)`
    };

    let message = messages[healthEvent.status] || `Service ${serviceName} status: ${healthEvent.status}`;
    
    if (healthEvent.error) {
      message += ` - Error: ${healthEvent.error}`;
    }
    
    if (healthEvent.responseTime) {
      message += ` - Response time: ${healthEvent.responseTime}ms`;
    }
    
    return message;
  }

  // Send alert through configured channels
  async sendAlert(alert) {
    const alertId = `${alert.serviceName}-${Date.now()}`;
    
    // Store alert
    this.alerts.set(alertId, {
      ...alert,
      id: alertId,
      timestamp: new Date(),
      sent: false,
      attempts: 0
    });

    // Send through configured channels
    for (const channel of this.config.ALERTS.CHANNELS) {
      try {
        await this.sendAlertToChannel(alert, channel);
        logger.info(`Alert sent via ${channel}: ${alert.serviceName}`);
      } catch (error) {
        logger.error(`Failed to send alert via ${channel}:`, error);
      }
    }

    this.emit('alert.sent', alert);
  }

  // Send alert to specific channel
  async sendAlertToChannel(alert, channel) {
    switch (channel) {
      case 'email':
        await this.sendEmailAlert(alert);
        break;
      case 'slack':
        await this.sendSlackAlert(alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert);
        break;
      default:
        logger.warn(`Unknown alert channel: ${channel}`);
    }
  }

  // Alert channel implementations (simplified)
  async sendEmailAlert(alert) {
    // Implement email sending logic
    logger.info(`EMAIL ALERT: ${alert.message}`);
  }

  async sendSlackAlert(alert) {
    // Implement Slack webhook logic
    logger.info(`SLACK ALERT: ${alert.message}`);
  }

  async sendWebhookAlert(alert) {
    // Implement webhook sending logic
    logger.info(`WEBHOOK ALERT: ${alert.message}`);
  }

  // Get overall system health
  getOverallHealth() {
    const services = Array.from(this.services.values());
    const criticalServices = services.filter(s => s.critical);
    
    let overallStatus = HEALTH_STATUS.HEALTHY;
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let downCount = 0;

    // Count service statuses
    services.forEach(service => {
      switch (service.status) {
        case HEALTH_STATUS.HEALTHY:
          healthyCount++;
          break;
        case HEALTH_STATUS.WARNING:
          warningCount++;
          break;
        case HEALTH_STATUS.CRITICAL:
          criticalCount++;
          break;
        case HEALTH_STATUS.DOWN:
          downCount++;
          break;
      }
    });

    // Determine overall status
    if (downCount > 0 || criticalServices.some(s => s.status === HEALTH_STATUS.DOWN)) {
      overallStatus = HEALTH_STATUS.DOWN;
    } else if (criticalCount > 0 || criticalServices.some(s => s.status === HEALTH_STATUS.CRITICAL)) {
      overallStatus = HEALTH_STATUS.CRITICAL;
    } else if (warningCount > 0) {
      overallStatus = HEALTH_STATUS.WARNING;
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      summary: {
        total: services.length,
        healthy: healthyCount,
        warning: warningCount,
        critical: criticalCount,
        down: downCount
      },
      services: services.map(service => ({
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        critical: service.critical
      })),
      systemMetrics: this.getLatestSystemMetrics()
    };
  }

  // Get latest system metrics
  getLatestSystemMetrics() {
    const latest = {};
    
    for (const [metricType, values] of Object.entries(this.systemMetrics)) {
      if (values.length > 0) {
        latest[metricType] = values[values.length - 1];
      }
    }
    
    return latest;
  }

  // Get health history for a service
  getServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    const history = this.healthHistory.get(serviceName);
    
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    return {
      service: {
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        critical: service.critical,
        registeredAt: service.registeredAt
      },
      history: history || [],
      metrics: this.calculateServiceMetrics(history)
    };
  }

  // Calculate service metrics from history
  calculateServiceMetrics(history) {
    if (!history || history.length === 0) {
      return {
        uptime: 0,
        avgResponseTime: 0,
        errorRate: 0
      };
    }

    const healthyChecks = history.filter(h => h.healthy).length;
    const totalChecks = history.length;
    const uptime = (healthyChecks / totalChecks) * 100;
    
    const responseTimes = history
      .filter(h => h.responseTime !== null)
      .map(h => h.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b) / responseTimes.length 
      : 0;
    
    const errorRate = ((totalChecks - healthyChecks) / totalChecks) * 100;

    return {
      uptime: Math.round(uptime * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      totalChecks,
      recentChecks: history.slice(-10)
    };
  }

  // Cleanup and shutdown
  async shutdown() {
    // Clear all intervals
    for (const service of this.services.values()) {
      if (service.intervalId) {
        clearInterval(service.intervalId);
      }
    }

    // Clear alert cooldowns
    this.alertCooldowns.clear();
    
    logger.info('Health monitoring system shutdown');
  }

  // Export health data
  exportHealthData() {
    return {
      services: Object.fromEntries(this.services),
      healthHistory: Object.fromEntries(this.healthHistory),
      systemMetrics: this.systemMetrics,
      alerts: Object.fromEntries(this.alerts),
      overallHealth: this.getOverallHealth(),
      exportedAt: new Date()
    };
  }
}

/**
 * Health Check Endpoints for Express
 */
class HealthEndpoints {
  constructor(healthMonitor) {
    this.healthMonitor = healthMonitor;
  }

  // Create Express routes
  createRoutes(app) {
    // Basic health check
    app.get('/health', (req, res) => {
      const health = this.healthMonitor.getOverallHealth();
      const statusCode = health.status === HEALTH_STATUS.HEALTHY ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Detailed health report
    app.get('/health/detailed', (req, res) => {
      const healthData = this.healthMonitor.exportHealthData();
      res.json(healthData);
    });

    // Individual service health
    app.get('/health/service/:serviceName', (req, res) => {
      try {
        const serviceHealth = this.healthMonitor.getServiceHealth(req.params.serviceName);
        res.json(serviceHealth);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });

    // System metrics
    app.get('/health/metrics', (req, res) => {
      const metrics = this.healthMonitor.getLatestSystemMetrics();
      res.json(metrics);
    });

    // Ready check (for Kubernetes)
    app.get('/ready', (req, res) => {
      const health = this.healthMonitor.getOverallHealth();
      const isReady = health.status !== HEALTH_STATUS.DOWN;
      res.status(isReady ? 200 : 503).json({ ready: isReady });
    });

    // Live check (for Kubernetes)
    app.get('/live', (req, res) => {
      res.status(200).json({ live: true, timestamp: new Date() });
    });
  }
}

module.exports = {
  HealthMonitor,
  HealthEndpoints,
  HEALTH_STATUS,
  HEALTH_CONFIG
};
