/**
 * Comprehensive Sync Service
 * Orchestrates bi-directional sync between SQLite and Supabase
 * with intelligent conflict resolution and retry mechanisms
 */

const { DualDatabaseManager } = require('../database/DualDatabaseArchitecture');
const winston = require('winston');
const { EventEmitter } = require('events');
const path = require('path');

// Enhanced logger for sync operations
const logger = winston.createLogger({
  level: process.env.SYNC_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sync-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/sync-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/sync-combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

/**
 * Sync Statistics Collector
 */
class SyncStatistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.stats = {
      totalChanges: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      tablesProcessed: new Set(),
      errorsByType: {},
      performanceMetrics: {
        avgSyncTime: 0,
        minSyncTime: Infinity,
        maxSyncTime: 0,
        totalSyncTime: 0,
        syncCount: 0
      }
    };
  }

  recordSync(tableName, duration, success, error = null) {
    this.stats.totalChanges++;
    this.stats.tablesProcessed.add(tableName);
    
    if (success) {
      this.stats.successfulSyncs++;
    } else {
      this.stats.failedSyncs++;
      if (error) {
        const errorType = error.code || error.name || 'Unknown';
        this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
      }
    }
    
    // Performance metrics
    const perfMetrics = this.stats.performanceMetrics;
    perfMetrics.totalSyncTime += duration;
    perfMetrics.syncCount++;
    perfMetrics.avgSyncTime = perfMetrics.totalSyncTime / perfMetrics.syncCount;
    perfMetrics.minSyncTime = Math.min(perfMetrics.minSyncTime, duration);
    perfMetrics.maxSyncTime = Math.max(perfMetrics.maxSyncTime, duration);
  }

  recordConflict(resolved = false) {
    this.stats.conflictsDetected++;
    if (resolved) {
      this.stats.conflictsResolved++;
    }
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    return {
      ...this.stats,
      duration,
      successRate: this.stats.totalChanges > 0 ? 
        (this.stats.successfulSyncs / this.stats.totalChanges) * 100 : 0,
      conflictResolutionRate: this.stats.conflictsDetected > 0 ?
        (this.stats.conflictsResolved / this.stats.conflictsDetected) * 100 : 0,
      tablesProcessed: Array.from(this.stats.tablesProcessed),
      performanceMetrics: {
        ...this.stats.performanceMetrics,
        minSyncTime: this.stats.performanceMetrics.minSyncTime === Infinity ? 0 : this.stats.performanceMetrics.minSyncTime
      }
    };
  }
}

/**
 * Sync Health Monitor
 */
class SyncHealthMonitor extends EventEmitter {
  constructor() {
    super();
    this.health = {
      status: 'healthy', // healthy, degraded, critical
      lastSyncAt: null,
      consecutiveFailures: 0,
      avgSyncDuration: 0,
      errorRate: 0,
      warnings: []
    };
    this.maxConsecutiveFailures = 5;
    this.criticalErrorRate = 0.1; // 10%
    this.recentSyncs = []; // circular buffer for recent sync results
    this.maxRecentSyncs = 100;
  }

  recordSyncResult(success, duration, error = null) {
    const syncResult = {
      success,
      duration,
      error: error ? error.message : null,
      timestamp: Date.now()
    };

    // Add to recent syncs (circular buffer)
    this.recentSyncs.push(syncResult);
    if (this.recentSyncs.length > this.maxRecentSyncs) {
      this.recentSyncs.shift();
    }

    // Update consecutive failures
    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    // Update last sync time
    this.health.lastSyncAt = new Date().toISOString();

    // Calculate metrics
    this.updateHealthMetrics();
    this.assessHealthStatus();
  }

  updateHealthMetrics() {
    if (this.recentSyncs.length === 0) return;

    // Calculate average sync duration
    const successfulSyncs = this.recentSyncs.filter(sync => sync.success);
    this.health.avgSyncDuration = successfulSyncs.length > 0 ?
      successfulSyncs.reduce((sum, sync) => sum + sync.duration, 0) / successfulSyncs.length : 0;

    // Calculate error rate
    const failedSyncs = this.recentSyncs.filter(sync => !sync.success);
    this.health.errorRate = failedSyncs.length / this.recentSyncs.length;
  }

  assessHealthStatus() {
    this.health.warnings = [];
    let newStatus = 'healthy';

    // Check consecutive failures
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      newStatus = 'critical';
      this.health.warnings.push(`${this.consecutiveFailures} consecutive sync failures`);
    } else if (this.consecutiveFailures >= 2) {
      newStatus = 'degraded';
      this.health.warnings.push(`${this.consecutiveFailures} consecutive failures`);
    }

    // Check error rate
    if (this.health.errorRate >= this.criticalErrorRate) {
      newStatus = this.health.errorRate >= 0.2 ? 'critical' : 'degraded';
      this.health.warnings.push(`High error rate: ${(this.health.errorRate * 100).toFixed(1)}%`);
    }

    // Check sync frequency (no sync in last 5 minutes is concerning)
    if (this.health.lastSyncAt) {
      const timeSinceLastSync = Date.now() - new Date(this.health.lastSyncAt).getTime();
      if (timeSinceLastSync > 300000) { // 5 minutes
        newStatus = timeSinceLastSync > 900000 ? 'critical' : 'degraded'; // 15 minutes = critical
        this.health.warnings.push(`No sync in ${Math.round(timeSinceLastSync / 60000)} minutes`);
      }
    }

    // Update status and emit events if changed
    if (newStatus !== this.health.status) {
      const previousStatus = this.health.status;
      this.health.status = newStatus;
      this.emit('health_status_changed', { 
        previous: previousStatus, 
        current: newStatus, 
        warnings: this.health.warnings 
      });
    }
  }

  getHealthStatus() {
    return { ...this.health };
  }
}

/**
 * Main Sync Service
 */
class SyncService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      sqlitePath: config.sqlitePath || path.join(__dirname, '../../database/apple_mail_replica.db'),
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL,
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
      syncInterval: config.syncInterval || 30000, // 30 seconds
      batchSize: config.batchSize || 100,
      enableRealtime: config.enableRealtime !== false,
      conflictResolutionStrategy: config.conflictResolutionStrategy || 'timestamp',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      metricsRetentionDays: config.metricsRetentionDays || 7,
      enableAutoRecovery: config.enableAutoRecovery !== false,
      ...config
    };

    this.dualDbManager = null;
    this.syncStatistics = new SyncStatistics();
    this.healthMonitor = new SyncHealthMonitor();
    this.syncInProgress = false;
    this.syncIntervalId = null;
    this.healthCheckIntervalId = null;
    this.isInitialized = false;

    // Bind event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Health monitor events
    this.healthMonitor.on('health_status_changed', (event) => {
      logger.warn('Sync health status changed', event);
      this.emit('health_status_changed', event);

      // Auto-recovery actions
      if (this.config.enableAutoRecovery && event.current === 'critical') {
        this.attemptRecovery().catch(error => {
          logger.error('Auto-recovery failed', { error });
        });
      }
    });
  }

  async initialize() {
    if (this.isInitialized) {
      logger.warn('Sync service already initialized');
      return true;
    }

    try {
      logger.info('Initializing sync service...');

      // Initialize dual database manager
      this.dualDbManager = new DualDatabaseManager(this.config);
      
      // Setup event forwarding
      this.dualDbManager.on('sync_start', () => this.emit('sync_start'));
      this.dualDbManager.on('sync_complete', (data) => this.emit('sync_complete', data));
      this.dualDbManager.on('sync_error', (error) => this.emit('sync_error', error));
      this.dualDbManager.on('conflict_resolved', (data) => {
        this.syncStatistics.recordConflict(true);
        this.emit('conflict_resolved', data);
      });

      await this.dualDbManager.initialize();

      // Start health monitoring
      this.startHealthCheck();

      this.isInitialized = true;
      logger.info('Sync service initialized successfully');
      this.emit('initialized');

      return true;
    } catch (error) {
      logger.error('Failed to initialize sync service', { error });
      throw error;
    }
  }

  startHealthCheck() {
    if (this.healthCheckIntervalId) return;

    this.healthCheckIntervalId = setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Health check failed', { error });
      });
    }, this.config.healthCheckInterval);

    logger.info('Health monitoring started');
  }

  stopHealthCheck() {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
      logger.info('Health monitoring stopped');
    }
  }

  async performHealthCheck() {
    try {
      // Check database connectivity
      const status = await this.dualDbManager.getSyncStatus();
      
      // Emit health metrics
      this.emit('health_metrics', {
        sync_status: status,
        health: this.healthMonitor.getHealthStatus(),
        statistics: this.syncStatistics.getSummary()
      });

      // Check for stale data
      if (status.last_sync) {
        const timeSinceLastSync = Date.now() - status.last_sync;
        if (timeSinceLastSync > this.config.syncInterval * 3) {
          logger.warn('Sync appears to be stale', { timeSinceLastSync });
        }
      }

    } catch (error) {
      logger.error('Health check error', { error });
      this.healthMonitor.recordSyncResult(false, 0, error);
    }
  }

  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.syncIntervalId) {
      logger.warn('Sync service already running');
      return;
    }

    logger.info('Starting sync service...');
    
    // Start dual database manager sync
    this.dualDbManager.startSync();
    
    // Start our enhanced sync monitoring
    this.syncIntervalId = setInterval(() => {
      this.performEnhancedSync().catch(error => {
        logger.error('Enhanced sync error', { error });
        this.healthMonitor.recordSyncResult(false, 0, error);
      });
    }, this.config.syncInterval);

    this.emit('started');
    logger.info('Sync service started');
  }

  async stop() {
    logger.info('Stopping sync service...');

    // Stop intervals
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    this.stopHealthCheck();

    // Stop dual database manager
    if (this.dualDbManager) {
      this.dualDbManager.stopSync();
    }

    this.emit('stopped');
    logger.info('Sync service stopped');
  }

  async performEnhancedSync() {
    if (this.syncInProgress) {
      logger.debug('Sync already in progress, skipping enhanced sync');
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      this.emit('enhanced_sync_start');
      
      // Get sync status before operation
      const preSync = await this.dualDbManager.getSyncStatus();
      
      // Perform the sync
      await this.dualDbManager.performBidirectionalSync();
      
      // Get sync status after operation
      const postSync = await this.dualDbManager.getSyncStatus();
      
      const duration = Date.now() - startTime;
      const changesSynced = Math.abs(postSync.pending_changes - preSync.pending_changes);
      
      // Record successful sync
      this.syncStatistics.recordSync('all', duration, true);
      this.healthMonitor.recordSyncResult(true, duration);
      
      this.emit('enhanced_sync_complete', {
        duration,
        changesSynced,
        preSync,
        postSync
      });

      logger.info('Enhanced sync completed', { 
        duration, 
        changesSynced,
        pendingChanges: postSync.pending_changes,
        pendingConflicts: postSync.pending_conflicts
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.syncStatistics.recordSync('all', duration, false, error);
      this.healthMonitor.recordSyncResult(false, duration, error);
      
      this.emit('enhanced_sync_error', error);
      logger.error('Enhanced sync failed', { error, duration });
      
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async forceSyncTable(tableName, direction = 'bidirectional') {
    if (!this.isInitialized) {
      throw new Error('Sync service not initialized');
    }

    logger.info(`Force syncing table: ${tableName} (${direction})`);
    const startTime = Date.now();

    try {
      await this.dualDbManager.forceSyncTable(tableName, direction);
      
      const duration = Date.now() - startTime;
      this.syncStatistics.recordSync(tableName, duration, true);
      
      this.emit('force_sync_complete', { tableName, direction, duration });
      logger.info(`Force sync completed for ${tableName}`, { duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.syncStatistics.recordSync(tableName, duration, false, error);
      
      logger.error(`Force sync failed for ${tableName}`, { error, duration });
      throw error;
    }
  }

  async resolveConflict(conflictId, resolution, data = null) {
    if (!this.isInitialized) {
      throw new Error('Sync service not initialized');
    }

    try {
      await this.dualDbManager.resolveConflict(conflictId, resolution, data);
      this.syncStatistics.recordConflict(true);
      
      this.emit('conflict_resolved_manual', { conflictId, resolution });
      logger.info('Conflict resolved manually', { conflictId, resolution });

    } catch (error) {
      logger.error('Failed to resolve conflict', { error, conflictId, resolution });
      throw error;
    }
  }

  async attemptRecovery() {
    logger.info('Attempting automatic recovery...');

    try {
      // Stop current sync
      this.dualDbManager.stopSync();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Reinitialize database connections
      await this.dualDbManager.initialize();
      
      // Restart sync
      this.dualDbManager.startSync();
      
      logger.info('Automatic recovery completed');
      this.emit('recovery_success');

    } catch (error) {
      logger.error('Automatic recovery failed', { error });
      this.emit('recovery_failed', error);
      throw error;
    }
  }

  // Getter methods for monitoring
  async getSyncStatus() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    const baseStatus = await this.dualDbManager.getSyncStatus();
    return {
      ...baseStatus,
      health: this.healthMonitor.getHealthStatus(),
      statistics: this.syncStatistics.getSummary(),
      service_status: this.syncIntervalId ? 'running' : 'stopped'
    };
  }

  async getPendingConflicts() {
    if (!this.isInitialized) {
      return [];
    }
    
    return this.dualDbManager.getPendingConflicts();
  }

  getStatistics() {
    return this.syncStatistics.getSummary();
  }

  getHealthStatus() {
    return this.healthMonitor.getHealthStatus();
  }

  // Admin methods
  resetStatistics() {
    this.syncStatistics.reset();
    logger.info('Sync statistics reset');
    this.emit('statistics_reset');
  }

  async exportSyncReport(format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      service: 'apple-mail-task-manager-sync',
      status: await this.getSyncStatus(),
      statistics: this.getStatistics(),
      health: this.getHealthStatus(),
      conflicts: await this.getPendingConflicts()
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }
    
    // Could add other formats like CSV, XML, etc.
    return report;
  }

  close() {
    this.stop();
    
    if (this.dualDbManager) {
      this.dualDbManager.close();
    }
    
    this.emit('closed');
    logger.info('Sync service closed');
  }
}

module.exports = {
  SyncService,
  SyncStatistics,
  SyncHealthMonitor
};