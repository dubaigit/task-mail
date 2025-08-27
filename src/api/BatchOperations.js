/**
 * Batch Operations API - High-throughput batch processing for Apple Mail Task Manager
 * Replaces individual API calls with efficient batch operations
 */

const winston = require('winston');
const { validationResult, body, param } = require('express-validator');
const crypto = require('crypto');

// Enhanced logger for batch operations
const logger = winston.createLogger({
  level: process.env.BATCH_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'batch-operations' },
  transports: [
    new winston.transports.File({ filename: 'logs/batch-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/batch-combined.log' }),
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
 * Batch Operation Manager - Handles batch processing with intelligent queuing
 */
class BatchOperationManager {
  constructor(databaseAgent) {
    this.db = databaseAgent;
    this.activeOperations = new Map();
    this.operationQueue = [];
    this.maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '100');
    this.maxConcurrentOperations = parseInt(process.env.MAX_CONCURRENT_BATCH_OPS || '5');
    this.batchTimeout = parseInt(process.env.BATCH_TIMEOUT || '30000'); // 30 seconds
    this.processingInterval = null;
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      queueSize: 0
    };
    
    this.startProcessing();
  }

  startProcessing() {
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, 1000); // Process every second

    logger.info('Batch operation manager started');
  }

  async processQueue() {
    if (this.operationQueue.length === 0 || 
        this.activeOperations.size >= this.maxConcurrentOperations) {
      return;
    }

    const operation = this.operationQueue.shift();
    if (!operation) return;

    this.stats.queueSize = this.operationQueue.length;
    this.activeOperations.set(operation.id, operation);

    try {
      await this.executeOperation(operation);
    } catch (error) {
      logger.error('Batch operation failed', {
        operationId: operation.id,
        type: operation.type,
        error: error.message
      });
      
      operation.reject(error);
      this.stats.failedOperations++;
    } finally {
      this.activeOperations.delete(operation.id);
    }
  }

  async executeOperation(operation) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (operation.type) {
        case 'batch_task_update':
          result = await this.executeBatchTaskUpdate(operation);
          break;
        case 'batch_email_classification':
          result = await this.executeBatchEmailClassification(operation);
          break;
        case 'batch_ai_analysis':
          result = await this.executeBatchAIAnalysis(operation);
          break;
        case 'batch_data_sync':
          result = await this.executeBatchDataSync(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      operation.resolve(result);
      
      logger.info('Batch operation completed', {
        operationId: operation.id,
        type: operation.type,
        processingTime: `${processingTime}ms`,
        itemsProcessed: operation.data.length
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      throw error;
    }
  }

  async executeBatchTaskUpdate(operation) {
    const { data: tasks, options } = operation;
    
    if (tasks.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum: ${this.maxBatchSize}`);
    }

    const operations = tasks.map(task => ({
      query: `
        UPDATE tasks 
        SET status = $2, priority = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, priority, updated_at
      `,
      params: [task.id, task.status, task.priority]
    }));

    const results = await this.db.executeTransaction(operations, {
      isolationLevel: 'READ COMMITTED',
      invalidateCache: 'db_query:*tasks*'
    });

    const updatedTasks = results.map(result => result.rows[0]).filter(Boolean);
    
    // Broadcast updates via WebSocket if available
    if (global.webSocketManager) {
      updatedTasks.forEach(task => {
        global.webSocketManager.broadcastTaskUpdate(task);
      });
    }

    return {
      success: true,
      updatedCount: updatedTasks.length,
      tasks: updatedTasks,
      processingTime: Date.now() - operation.createdAt
    };
  }

  async executeBatchEmailClassification(operation) {
    const { data: emails, options } = operation;
    
    if (emails.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum: ${this.maxBatchSize}`);
    }

    // Process emails in parallel chunks
    const chunkSize = 10;
    const chunks = [];
    
    for (let i = 0; i < emails.length; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize));
    }

    const classificationPromises = chunks.map(async (chunk) => {
      const operations = chunk.map(email => ({
        query: `
          UPDATE emails 
          SET 
            classification = $2,
            priority = $3,
            ai_analysis_completed = true,
            ai_analysis_date = NOW(),
            confidence_score = $4
          WHERE id = $1
          RETURNING id, classification, priority, confidence_score
        `,
        params: [
          email.id, 
          email.classification, 
          email.priority, 
          email.confidence || 0.8
        ]
      }));

      return this.db.executeTransaction(operations, {
        isolationLevel: 'READ COMMITTED'
      });
    });

    const chunkResults = await Promise.all(classificationPromises);
    const classifiedEmails = chunkResults.flat().map(result => result.rows[0]).filter(Boolean);

    return {
      success: true,
      classifiedCount: classifiedEmails.length,
      emails: classifiedEmails,
      processingTime: Date.now() - operation.createdAt
    };
  }

  async executeBatchAIAnalysis(operation) {
    const { data: items, options } = operation;
    const { analysisType = 'general' } = options;
    
    if (items.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum: ${this.maxBatchSize}`);
    }

    // Batch AI processing with queue management
    const analysisResults = [];
    const batchId = crypto.randomUUID();
    
    // Create analysis batch record
    await this.db.executeQuery(`
      INSERT INTO ai_analysis_batches (id, batch_type, item_count, status, created_at)
      VALUES ($1, $2, $3, 'processing', NOW())
    `, [batchId, analysisType, items.length]);

    try {
      // Process items in smaller chunks for AI analysis
      const chunkSize = 5; // Smaller chunks for AI processing
      const chunks = [];
      
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (item) => {
          try {
            // Simulate AI processing delay and result
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const analysis = {
              itemId: item.id,
              analysisType,
              results: {
                confidence: 0.85,
                categories: ['task_creation', 'priority_high'],
                summary: `AI analysis completed for item ${item.id}`,
                processingTime: Date.now()
              },
              processedAt: new Date().toISOString()
            };

            // Store analysis result
            await this.db.executeQuery(`
              INSERT INTO ai_analysis_results (
                item_id, batch_id, analysis_type, results, confidence_score, created_at
              ) VALUES ($1, $2, $3, $4, $5, NOW())
              ON CONFLICT (item_id, analysis_type) 
              DO UPDATE SET 
                results = $4, 
                confidence_score = $5, 
                updated_at = NOW()
            `, [
              item.id, 
              batchId, 
              analysisType, 
              JSON.stringify(analysis.results), 
              analysis.results.confidence
            ]);

            return analysis;
          } catch (error) {
            logger.error('AI analysis failed for item', {
              itemId: item.id,
              error: error.message
            });
            
            return {
              itemId: item.id,
              error: error.message,
              success: false
            };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        analysisResults.push(...chunkResults);
      }

      // Update batch record
      await this.db.executeQuery(`
        UPDATE ai_analysis_batches 
        SET status = 'completed', completed_at = NOW(), 
            success_count = $2, error_count = $3
        WHERE id = $1
      `, [
        batchId,
        analysisResults.filter(r => r.success !== false).length,
        analysisResults.filter(r => r.success === false).length
      ]);

      return {
        success: true,
        batchId,
        processedCount: analysisResults.length,
        results: analysisResults,
        processingTime: Date.now() - operation.createdAt
      };

    } catch (error) {
      // Mark batch as failed
      await this.db.executeQuery(`
        UPDATE ai_analysis_batches 
        SET status = 'failed', completed_at = NOW(), error_message = $2
        WHERE id = $1
      `, [batchId, error.message]);
      
      throw error;
    }
  }

  async executeBatchDataSync(operation) {
    const { data: syncItems, options } = operation;
    const { syncType = 'incremental' } = options;
    
    if (syncItems.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum: ${this.maxBatchSize}`);
    }

    const syncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process sync items in transaction
    const operations = syncItems.map(item => {
      const { action, data } = item;
      
      switch (action) {
        case 'upsert_email':
          return {
            query: `
              INSERT INTO emails (id, subject, sender, content, received_date, message_id)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (message_id)
              DO UPDATE SET 
                subject = $2, sender = $3, content = $4, 
                received_date = $5, updated_at = NOW()
              RETURNING id, message_id, 
                CASE WHEN xmax = 0 THEN 'created' ELSE 'updated' END as action
            `,
            params: [
              data.id, data.subject, data.sender, 
              data.content, data.receivedDate, data.messageId
            ]
          };
        
        case 'upsert_task':
          return {
            query: `
              INSERT INTO tasks (id, title, description, status, priority, email_id)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id)
              DO UPDATE SET 
                title = $2, description = $3, status = $4, 
                priority = $5, updated_at = NOW()
              RETURNING id, 
                CASE WHEN xmax = 0 THEN 'created' ELSE 'updated' END as action
            `,
            params: [
              data.id, data.title, data.description, 
              data.status, data.priority, data.emailId
            ]
          };
        
        default:
          throw new Error(`Unknown sync action: ${action}`);
      }
    });

    try {
      const results = await this.db.executeTransaction(operations, {
        isolationLevel: 'READ COMMITTED',
        invalidateCache: 'db_query:*'
      });

      results.forEach(result => {
        if (result.rows.length > 0) {
          const action = result.rows[0].action;
          if (action === 'created') {
            syncResults.created++;
          } else if (action === 'updated') {
            syncResults.updated++;
          }
          syncResults.processed++;
        }
      });

      // Broadcast sync completion
      if (global.webSocketManager) {
        global.webSocketManager.broadcastEmailSync({
          syncType,
          results: syncResults,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        syncType,
        results: syncResults,
        processingTime: Date.now() - operation.createdAt
      };

    } catch (error) {
      syncResults.errors.push(error.message);
      throw error;
    }
  }

  updateStats(processingTime, success) {
    this.stats.totalOperations++;
    
    if (success) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }
    
    // Update rolling average
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalOperations - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalOperations;
  }

  // Public API methods
  async queueOperation(type, data, options = {}) {
    return new Promise((resolve, reject) => {
      const operation = {
        id: crypto.randomUUID(),
        type,
        data,
        options,
        createdAt: Date.now(),
        resolve,
        reject
      };

      this.operationQueue.push(operation);
      this.stats.queueSize = this.operationQueue.length;
      
      logger.info('Batch operation queued', {
        operationId: operation.id,
        type,
        itemCount: data.length,
        queuePosition: this.operationQueue.length
      });

      // Set timeout for operation
      setTimeout(() => {
        const index = this.operationQueue.findIndex(op => op.id === operation.id);
        if (index > -1) {
          this.operationQueue.splice(index, 1);
          reject(new Error('Batch operation timeout'));
        }
      }, this.batchTimeout);
    });
  }

  getStats() {
    return {
      ...this.stats,
      activeOperations: this.activeOperations.size,
      queueSize: this.operationQueue.length,
      maxBatchSize: this.maxBatchSize,
      maxConcurrentOperations: this.maxConcurrentOperations
    };
  }

  async shutdown() {
    logger.info('Shutting down batch operation manager...');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Wait for active operations to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeOperations.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeOperations.size > 0) {
      logger.warn('Some batch operations did not complete before shutdown', {
        remainingOperations: this.activeOperations.size
      });
    }

    logger.info('Batch operation manager shutdown complete');
  }
}

module.exports = { BatchOperationManager };