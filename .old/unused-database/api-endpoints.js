const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { DualDatabaseManager } = require('./DualDatabaseArchitecture');
const { SecurityValidator } = require('../middleware/security');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * REST API Endpoints for Dual Database Operations
 * Provides secure access to SQLite and Supabase database operations
 * with real-time sync monitoring and comprehensive validation
 */
class DualDatabaseAPI extends EventEmitter {
  constructor(dualDbManager, options = {}) {
    super();
    this.dbManager = dualDbManager;
    this.router = express.Router();
    this.wsServer = null;
    this.options = {
      enableRateLimit: true,
      enableWebSocket: true,
      maxRequestsPerMinute: 100,
      ...options
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocketServer();
  }

  setupMiddleware() {
    // Rate limiting for database operations
    if (this.options.enableRateLimit) {
      this.dbRateLimit = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: this.options.maxRequestsPerMinute,
        message: {
          error: 'Too many database requests',
          retryAfter: 60
        },
        standardHeaders: true,
        legacyHeaders: false
      });
      this.router.use(this.dbRateLimit);
    }

    // Security validation middleware
    this.router.use(SecurityValidator.validateRequest);
    this.router.use(SecurityValidator.sanitizeInput);

    // JSON parsing with size limits
    this.router.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));

    // Error handling middleware
    this.router.use(this.errorHandler.bind(this));
  }

  setupRoutes() {
    // Health Check Endpoints
    this.router.get('/health', this.getHealthStatus.bind(this));
    this.router.get('/health/detailed', this.getDetailedHealth.bind(this));
    
    // Sync Operations
    this.router.post('/sync/up', 
      this.validateSyncRequest,
      this.performSyncUp.bind(this)
    );
    this.router.post('/sync/down',
      this.validateSyncRequest, 
      this.performSyncDown.bind(this)
    );
    this.router.post('/sync/bidirectional',
      this.validateSyncRequest,
      this.performBidirectionalSync.bind(this)
    );
    
    // Sync Status and Statistics
    this.router.get('/sync/status', this.getSyncStatus.bind(this));
    this.router.get('/sync/statistics', this.getSyncStatistics.bind(this));
    this.router.get('/sync/history', this.getSyncHistory.bind(this));
    
    // Database Operations
    this.router.get('/data/:table',
      this.validateTableAccess,
      this.getData.bind(this)
    );
    this.router.post('/data/:table',
      this.validateTableAccess,
      this.validateDataInput,
      this.insertData.bind(this)
    );
    this.router.put('/data/:table/:id',
      this.validateTableAccess,
      this.validateDataInput,
      this.updateData.bind(this)
    );
    this.router.delete('/data/:table/:id',
      this.validateTableAccess,
      this.deleteData.bind(this)
    );
    
    // Conflict Resolution
    this.router.get('/conflicts', this.getConflicts.bind(this));
    this.router.post('/conflicts/:id/resolve',
      this.validateConflictResolution,
      this.resolveConflict.bind(this)
    );
    
    // Migration Operations
    this.router.post('/migration/start',
      this.validateMigrationRequest,
      this.startMigration.bind(this)
    );
    this.router.get('/migration/status', this.getMigrationStatus.bind(this));
    
    // Advanced Operations
    this.router.post('/backup', this.createBackup.bind(this));
    this.router.post('/restore',
      this.validateRestoreRequest,
      this.restoreFromBackup.bind(this)
    );
  }

  // Validation Middlewares
  get validateSyncRequest() {
    return [
      body('tables').optional().isArray().withMessage('Tables must be an array'),
      body('options.batchSize').optional().isInt({ min: 1, max: 10000 })
        .withMessage('Batch size must be between 1 and 10000'),
      body('options.maxRetries').optional().isInt({ min: 0, max: 10 })
        .withMessage('Max retries must be between 0 and 10'),
      this.handleValidationErrors
    ];
  }

  get validateTableAccess() {
    return [
      query('limit').optional().isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
      query('offset').optional().isInt({ min: 0 })
        .withMessage('Offset must be non-negative'),
      this.handleValidationErrors,
      this.checkTablePermissions.bind(this)
    ];
  }

  get validateDataInput() {
    return [
      body().isObject().withMessage('Request body must be an object'),
      body('*.id').optional().isUUID().withMessage('ID must be a valid UUID'),
      this.handleValidationErrors
    ];
  }

  get validateConflictResolution() {
    return [
      body('resolution').isIn(['local', 'remote', 'merge'])
        .withMessage('Resolution must be local, remote, or merge'),
      body('mergeData').optional().isObject()
        .withMessage('Merge data must be an object'),
      this.handleValidationErrors
    ];
  }

  get validateMigrationRequest() {
    return [
      body('source').isIn(['sqlite', 'supabase'])
        .withMessage('Source must be sqlite or supabase'),
      body('target').isIn(['sqlite', 'supabase'])
        .withMessage('Target must be sqlite or supabase'),
      body('options.validateData').optional().isBoolean()
        .withMessage('Validate data must be boolean'),
      this.handleValidationErrors
    ];
  }

  get validateRestoreRequest() {
    return [
      body('backupId').isUUID().withMessage('Backup ID must be valid UUID'),
      body('options.overwrite').optional().isBoolean()
        .withMessage('Overwrite must be boolean'),
      this.handleValidationErrors
    ];
  }

  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }

  async checkTablePermissions(req, res, next) {
    try {
      const { table } = req.params;
      const userId = req.user?.id;
      
      // Check if user has access to this table
      const hasAccess = await this.dbManager.checkTableAccess(table, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to table',
          table
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  // Route Handlers
  async getHealthStatus(req, res) {
    try {
      const health = await this.dbManager.getHealthStatus();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getDetailedHealth(req, res) {
    try {
      const detailedHealth = await this.dbManager.getDetailedHealthStatus();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        ...detailedHealth
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async performSyncUp(req, res) {
    try {
      const { tables, options } = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.syncUp(tables, {
        ...options,
        userId,
        requestId: req.id
      });
      
      // Broadcast sync status via WebSocket
      this.broadcastSyncStatus('sync_up_completed', result);
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.broadcastSyncStatus('sync_up_failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async performSyncDown(req, res) {
    try {
      const { tables, options } = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.syncDown(tables, {
        ...options,
        userId,
        requestId: req.id
      });
      
      this.broadcastSyncStatus('sync_down_completed', result);
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.broadcastSyncStatus('sync_down_failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async performBidirectionalSync(req, res) {
    try {
      const { tables, options } = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.performBidirectionalSync({
        tables,
        ...options,
        userId,
        requestId: req.id
      });
      
      this.broadcastSyncStatus('bidirectional_sync_completed', result);
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.broadcastSyncStatus('bidirectional_sync_failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSyncStatus(req, res) {
    try {
      const status = await this.dbManager.getSyncStatus();
      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSyncStatistics(req, res) {
    try {
      const statistics = await this.dbManager.getSyncStatistics();
      res.json({
        success: true,
        statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSyncHistory(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const history = await this.dbManager.getSyncHistory({
        limit: parseInt(limit),
        offset: parseInt(offset),
        userId: req.user?.id
      });
      
      res.json({
        success: true,
        history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getData(req, res) {
    try {
      const { table } = req.params;
      const { limit = 50, offset = 0, filter, sort } = req.query;
      const userId = req.user?.id;
      
      const data = await this.dbManager.getData(table, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        filter: filter ? JSON.parse(filter) : undefined,
        sort: sort ? JSON.parse(sort) : undefined,
        userId
      });
      
      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: data.length === parseInt(limit)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async insertData(req, res) {
    try {
      const { table } = req.params;
      const data = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.insertData(table, {
        ...data,
        user_id: userId,
        created_at: new Date().toISOString()
      });
      
      res.status(201).json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateData(req, res) {
    try {
      const { table, id } = req.params;
      const data = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.updateData(table, id, {
        ...data,
        updated_at: new Date().toISOString()
      }, { userId });
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteData(req, res) {
    try {
      const { table, id } = req.params;
      const userId = req.user?.id;
      
      const result = await this.dbManager.deleteData(table, id, { userId });
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getConflicts(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user?.id;
      
      const conflicts = await this.dbManager.getConflicts({
        limit: parseInt(limit),
        offset: parseInt(offset),
        userId
      });
      
      res.json({
        success: true,
        conflicts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async resolveConflict(req, res) {
    try {
      const { id } = req.params;
      const { resolution, mergeData } = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.resolveConflict(id, {
        resolution,
        mergeData,
        userId,
        resolvedAt: new Date().toISOString()
      });
      
      this.broadcastSyncStatus('conflict_resolved', { conflictId: id, resolution });
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async startMigration(req, res) {
    try {
      const { source, target, options } = req.body;
      const userId = req.user?.id;
      
      const migrationId = await this.dbManager.startMigration({
        source,
        target,
        ...options,
        userId,
        requestId: req.id
      });
      
      this.broadcastSyncStatus('migration_started', { migrationId, source, target });
      
      res.json({
        success: true,
        migrationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getMigrationStatus(req, res) {
    try {
      const { migrationId } = req.query;
      const status = await this.dbManager.getMigrationStatus(migrationId);
      
      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createBackup(req, res) {
    try {
      const { databases = ['sqlite', 'supabase'] } = req.body;
      const userId = req.user?.id;
      
      const backupId = await this.dbManager.createBackup({
        databases,
        userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        backupId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async restoreFromBackup(req, res) {
    try {
      const { backupId, options } = req.body;
      const userId = req.user?.id;
      
      const result = await this.dbManager.restoreFromBackup(backupId, {
        ...options,
        userId
      });
      
      this.broadcastSyncStatus('restore_completed', { backupId });
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // WebSocket Server Setup
  setupWebSocketServer() {
    if (!this.options.enableWebSocket) return;
    
    this.wsServer = new WebSocket.Server({ 
      port: process.env.WS_PORT || 8080,
      perMessageDeflate: false
    });
    
    this.wsServer.on('connection', (ws, req) => {
      const clientId = req.headers['x-client-id'] || this.generateClientId();
      ws.clientId = clientId;
      
      console.log(`WebSocket client connected: ${clientId}`);
      
      // Send initial sync status
      this.sendToClient(ws, 'connection_established', {
        clientId,
        timestamp: new Date().toISOString()
      });
      
      ws.on('message', this.handleWebSocketMessage.bind(this, ws));
      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
      });
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
    
    // Listen to database manager events
    this.dbManager.on('syncProgress', (data) => {
      this.broadcastSyncStatus('sync_progress', data);
    });
    
    this.dbManager.on('conflictDetected', (data) => {
      this.broadcastSyncStatus('conflict_detected', data);
    });
    
    this.dbManager.on('healthChanged', (data) => {
      this.broadcastSyncStatus('health_changed', data);
    });
  }

  handleWebSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe_sync_status':
          ws.subscriptions = ws.subscriptions || [];
          if (!ws.subscriptions.includes('sync_status')) {
            ws.subscriptions.push('sync_status');
          }
          break;
          
        case 'unsubscribe_sync_status':
          ws.subscriptions = ws.subscriptions || [];
          ws.subscriptions = ws.subscriptions.filter(sub => sub !== 'sync_status');
          break;
          
        case 'get_current_status':
          this.sendCurrentStatus(ws);
          break;
          
        default:
          this.sendToClient(ws, 'error', {
            message: 'Unknown message type',
            type: data.type
          });
      }
    } catch (error) {
      this.sendToClient(ws, 'error', {
        message: 'Invalid message format',
        error: error.message
      });
    }
  }

  broadcastSyncStatus(type, data) {
    if (!this.wsServer) return;
    
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN &&
          client.subscriptions &&
          client.subscriptions.includes('sync_status')) {
        client.send(message);
      }
    });
  }

  sendToClient(ws, type, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
      }));
    }
  }

  async sendCurrentStatus(ws) {
    try {
      const status = await this.dbManager.getSyncStatus();
      this.sendToClient(ws, 'current_status', status);
    } catch (error) {
      this.sendToClient(ws, 'error', {
        message: 'Failed to get current status',
        error: error.message
      });
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Error Handler
  errorHandler(error, req, res, next) {
    console.error('API Error:', error);
    
    if (res.headersSent) {
      return next(error);
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      ...(isDevelopment && { stack: error.stack }),
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  // Cleanup
  async close() {
    if (this.wsServer) {
      this.wsServer.close();
    }
    this.removeAllListeners();
  }
}

module.exports = { DualDatabaseAPI };
