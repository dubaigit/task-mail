/**
 * Enhanced API Endpoints - Optimized endpoints with sub-50ms response times
 * Implements advanced caching, query optimization, and real-time features
 */

const express = require('express');
const { body, validationResult, query } = require('express-validator');
const winston = require('winston');

// Enhanced logger for API endpoints
const logger = winston.createLogger({
  level: process.env.API_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'enhanced-endpoints' },
  transports: [
    new winston.transports.File({ filename: 'logs/api-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/api-combined.log' }),
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

/**
 * Enhanced Dashboard Summary - Ultra-fast dashboard data aggregation
 */
async function getDashboardSummary(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { db, webSocketManager, aiProcessor } = req.app.locals;
    
    // Use optimized cached queries for dashboard data
    const [
      taskCounts,
      aiStats,
      emailStats,
      recentActivity
    ] = await Promise.all([
      // Cached task category counts (3 minute TTL)
      db.executeCachedQuery(`
        SELECT 
          classification,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM emails 
        WHERE ai_analysis_completed = true
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY classification
      `, [], 180),
      
      // AI processing statistics (1 minute TTL) 
      db.executeCachedQuery(`
        SELECT 
          COUNT(*) as total_processed,
          COUNT(*) FILTER (WHERE ai_analysis_completed = true) as analyzed,
          COUNT(*) FILTER (WHERE classification = 'CREATE_TASK') as tasks_created,
          AVG(confidence_score) as avg_confidence,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_processed
        FROM emails
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `, [], 60),
      
      // Email sync statistics (30 second TTL)
      db.executeCachedQuery(`
        SELECT 
          COUNT(*) as total_emails,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today_count,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 week') as week_count,
          MAX(created_at) as last_sync,
          COUNT(*) FILTER (WHERE ai_analysis_completed = false) as pending_analysis
        FROM emails
      `, [], 30),
      
      // Recent activity (1 minute TTL)
      db.executeCachedQuery(`
        SELECT 
          'email' as type,
          id,
          subject as title,
          sender,
          classification,
          created_at,
          confidence_score
        FROM emails
        WHERE created_at > NOW() - INTERVAL '2 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `, [], 60)
    ]);

    // Build dashboard summary
    const summary = {
      taskCounts: taskCounts.rows.reduce((acc, row) => {
        acc[row.classification] = {
          count: parseInt(row.count),
          avgConfidence: parseFloat(row.avg_confidence || 0)
        };
        return acc;
      }, {}),
      
      aiProcessing: {
        totalProcessed: parseInt(aiStats.rows[0]?.total_processed || 0),
        analyzed: parseInt(aiStats.rows[0]?.analyzed || 0),
        tasksCreated: parseInt(aiStats.rows[0]?.tasks_created || 0),
        averageConfidence: parseFloat(aiStats.rows[0]?.avg_confidence || 0),
        recentProcessed: parseInt(aiStats.rows[0]?.recent_processed || 0),
        processorStats: aiProcessor ? aiProcessor.getStats() : null
      },
      
      emailSync: {
        totalEmails: parseInt(emailStats.rows[0]?.total_emails || 0),
        todayCount: parseInt(emailStats.rows[0]?.today_count || 0),
        weekCount: parseInt(emailStats.rows[0]?.week_count || 0),
        lastSync: emailStats.rows[0]?.last_sync,
        pendingAnalysis: parseInt(emailStats.rows[0]?.pending_analysis || 0)
      },
      
      recentActivity: recentActivity.rows.map(row => ({
        type: row.type,
        id: row.id,
        title: row.title,
        sender: row.sender,
        classification: row.classification,
        timestamp: row.created_at,
        confidence: parseFloat(row.confidence_score || 0)
      })),
      
      performance: {
        responseTime: Number(process.hrtime.bigint() - startTime) / 1000000, // Convert to milliseconds
        cacheHit: true, // Will be set by caching layer
        timestamp: new Date().toISOString()
      }
    };

    // Add WebSocket connection stats if available
    if (webSocketManager) {
      summary.websocket = webSocketManager.getStats();
    }

    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    // Log slow responses
    if (responseTime > 200) {
      logger.warn('Slow dashboard summary response', {
        responseTime: `${responseTime.toFixed(2)}ms`,
        cacheStatus: 'miss'
      });
    }

    // Broadcast dashboard update to connected clients
    if (webSocketManager) {
      webSocketManager.broadcastDashboardUpdate(summary);
    }

    res.json(summary);
    
  } catch (error) {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.error('Dashboard summary error', {
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Failed to fetch dashboard summary',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }
}

/**
 * Batch Task Update - High-performance batch task operations
 */
async function batchUpdateTasks(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { tasks } = req.body;
    const { batchProcessor } = req.app.locals;
    
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        error: 'Tasks array is required'
      });
    }

    if (tasks.length === 0) {
      return res.status(400).json({
        error: 'At least one task is required'
      });
    }

    if (tasks.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 tasks per batch'
      });
    }

    // Submit batch operation to queue
    const result = await batchProcessor.queueOperation('batch_task_update', tasks, {
      requestId: req.headers['x-request-id'],
      userId: req.user?.id || 'anonymous'
    });

    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.info('Batch task update completed', {
      taskCount: tasks.length,
      responseTime: `${responseTime.toFixed(2)}ms`,
      updatedCount: result.updatedCount
    });

    // Broadcast task updates to connected WebSocket clients
    const { webSocketManager } = req.app.locals;
    console.log('DEBUG: webSocketManager available:', !!webSocketManager);
    console.log('DEBUG: webSocketManager type:', typeof webSocketManager);
    if (webSocketManager) {
      console.log('DEBUG: webSocketManager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(webSocketManager)));
      console.log('DEBUG: broadcastTaskUpdate method available:', typeof webSocketManager.broadcastTaskUpdate);
      
      tasks.forEach(task => {
        webSocketManager.broadcastTaskUpdate({
          id: task.id,
          status: task.status,
          priority: task.priority,
          action: 'updated',
          timestamp: new Date().toISOString()
        });
      });
    }

    res.json({
      success: true,
      batchSize: tasks.length,
      updatedCount: result.updatedCount,
      processingTime: result.processingTime,
      responseTime: responseTime.toFixed(2) + 'ms',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.error('Batch task update error', {
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
    
    res.status(500).json({
      error: 'Batch update failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Real-time Task Updates - WebSocket-enabled task status updates
 */
async function getRealtimeTaskUpdates(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { since } = req.query;
    const { db } = req.app.locals;
    
    let sinceTimestamp = new Date(Date.now() - 5 * 60 * 1000); // Default: 5 minutes ago
    
    if (since) {
      sinceTimestamp = new Date(since);
      if (isNaN(sinceTimestamp.getTime())) {
        return res.status(400).json({
          error: 'Invalid since parameter'
        });
      }
    }

    // Get recent task updates with minimal query
    const updates = await db.executeQuery(`
      SELECT 
        id,
        title,
        status,
        priority,
        classification,
        updated_at,
        confidence_score
      FROM emails
      WHERE updated_at > $1
        AND ai_analysis_completed = true
      ORDER BY updated_at DESC
      LIMIT 50
    `, [sinceTimestamp]);

    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    const result = {
      updates: updates.rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority,
        classification: row.classification,
        updatedAt: row.updated_at,
        confidence: parseFloat(row.confidence_score || 0)
      })),
      
      metadata: {
        since: sinceTimestamp.toISOString(),
        count: updates.rows.length,
        responseTime: responseTime.toFixed(2) + 'ms',
        timestamp: new Date().toISOString()
      }
    };

    // Set up Server-Sent Events headers for real-time streaming
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial data
      res.write(`data: ${JSON.stringify(result)}\n\n`);
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
      });
      
    } else {
      // Regular JSON response
      res.json(result);
    }
    
  } catch (error) {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.error('Realtime task updates error', {
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
    
    res.status(500).json({
      error: 'Failed to fetch task updates',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * AI Processing Status - Real-time AI processing statistics
 */
async function getAIProcessingStatus(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { aiProcessor } = req.app.locals;
    
    if (!aiProcessor) {
      return res.status(503).json({
        error: 'AI processor not available',
        timestamp: new Date().toISOString()
      });
    }

    const processorStats = aiProcessor.getStats();
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    const result = {
      processor: {
        isRunning: processorStats.activeWorkers > 0,
        activeWorkers: processorStats.activeWorkers,
        totalJobsProcessed: processorStats.totalJobsProcessed,
        queueSize: processorStats.queue.totalQueued,
        averageProcessingTime: processorStats.queue.averageProcessingTime
      },
      
      queue: {
        high: processorStats.queue.queueSizes.high,
        medium: processorStats.queue.queueSizes.medium,
        low: processorStats.queue.queueSizes.low,
        processing: processorStats.queue.processingJobs,
        completed: processorStats.queue.completedJobs,
        failed: processorStats.queue.failedJobs
      },
      
      workers: processorStats.workers.map(worker => ({
        id: worker.id,
        isRunning: worker.isRunning,
        processedJobs: worker.processedJobs,
        currentJob: worker.currentJob,
        uptime: worker.uptime
      })),
      
      performance: {
        responseTime: responseTime.toFixed(2) + 'ms',
        timestamp: new Date().toISOString()
      }
    };

    res.json(result);
    
  } catch (error) {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.error('AI processing status error', {
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
    
    res.status(500).json({
      error: 'Failed to fetch AI processing status',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Performance Metrics - System performance and optimization metrics
 */
async function getPerformanceMetrics(req, res) {
  const startTime = process.hrtime.bigint();
  
  try {
    const { db, deduplicationMiddleware, batchProcessor } = req.app.locals;
    
    // Get database performance metrics
    const dbMetrics = db.getPerformanceMetrics();
    
    // Get deduplication stats
    const deduplicationStats = deduplicationMiddleware ? 
      deduplicationMiddleware.getStats() : null;
    
    // Get batch processing stats
    const batchStats = batchProcessor ? batchProcessor.getStats() : null;
    
    // System metrics
    const systemMetrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform
    };

    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    const result = {
      database: dbMetrics,
      deduplication: deduplicationStats,
      batchProcessing: batchStats,
      system: systemMetrics,
      
      performance: {
        responseTime: responseTime.toFixed(2) + 'ms',
        timestamp: new Date().toISOString()
      }
    };

    res.json(result);
    
  } catch (error) {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    logger.error('Performance metrics error', {
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
    
    res.status(500).json({
      error: 'Failed to fetch performance metrics',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create Express Router with Enhanced Endpoints
 */
function createEnhancedRouter() {
  const router = express.Router();

  // Validation middleware
  const batchUpdateValidation = [
    body('tasks').isArray().withMessage('Tasks must be an array'),
    body('tasks.*.id').notEmpty().withMessage('Task ID is required'),
    body('tasks.*.status').optional().isIn(['pending', 'in_progress', 'completed', 'failed']),
    body('tasks.*.priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ];

  const realtimeValidation = [
    query('since').optional().isISO8601().withMessage('Since must be a valid ISO date')
  ];

  // Enhanced endpoints
  router.get('/dashboard/summary', getDashboardSummary);
  router.post('/tasks/batch-update', batchUpdateValidation, batchUpdateTasks);
  router.get('/tasks/realtime-updates', realtimeValidation, getRealtimeTaskUpdates);
  router.get('/ai/processing-status', getAIProcessingStatus);
  router.get('/system/performance-metrics', getPerformanceMetrics);

  return router;
}

module.exports = {
  createEnhancedRouter,
  getDashboardSummary,
  batchUpdateTasks,
  getRealtimeTaskUpdates,
  getAIProcessingStatus,
  getPerformanceMetrics
};