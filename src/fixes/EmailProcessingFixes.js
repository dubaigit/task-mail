/**
 * Email Processing Fixes
 * Implements solutions for identified email processing issues
 */

const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// Enhanced logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/email-fixes.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

class EmailProcessingFixes {
  constructor() {
    this.appliedFixes = [];
  }

  /**
   * Fix 1: Enhanced Email Processing Queue with Timeout Handling
   */
  async fixProcessingTimeouts() {
    logger.info('🔧 Applying Fix 1: Processing Timeout Handling');

    const timeoutFixCode = `
// Enhanced Email Processing with Timeout Handling
class EnhancedEmailProcessor {
  constructor() {
    this.processingTimeouts = new Map();
    this.maxProcessingTime = 60000; // 60 seconds
  }

  async processEmailWithTimeout(emailData) {
    const startTime = Date.now();
    const timeoutId = setTimeout(() => {
      logger.warn(\`Email processing timeout: \${emailData.messageId}\`);
      this.handleProcessingTimeout(emailData.messageId);
    }, this.maxProcessingTime);

    try {
      this.processingTimeouts.set(emailData.messageId, timeoutId);
      
      const result = await this.processEmail(emailData);
      
      clearTimeout(timeoutId);
      this.processingTimeouts.delete(emailData.messageId);
      
      const processingTime = Date.now() - startTime;
      logger.info(\`Email processed successfully in \${processingTime}ms: \${emailData.messageId}\`);
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      this.processingTimeouts.delete(emailData.messageId);
      
      logger.error(\`Email processing failed: \${emailData.messageId}\`, error);
      
      // Mark email for retry
      await this.markForRetry(emailData.messageId, error.message);
      throw error;
    }
  }

  async handleProcessingTimeout(messageId) {
    try {
      // Reset email status for retry
      await databaseAgent.executeQuery(
        'UPDATE email_processing_queue SET status = $1, error_message = $2, updated_at = NOW() WHERE email_id = $3',
        ['failed', 'Processing timeout', messageId]
      );
      
      logger.warn(\`Email processing timeout handled: \${messageId}\`);
    } catch (error) {
      logger.error(\`Failed to handle timeout for \${messageId}:\`, error);
    }
  }

  async markForRetry(messageId, errorMessage) {
    try {
      const result = await databaseAgent.executeQuery(
        \`UPDATE email_processing_queue 
         SET retry_count = retry_count + 1, 
             status = CASE 
               WHEN retry_count < 3 THEN 'pending'
               ELSE 'failed'
             END,
             error_message = $1,
             updated_at = NOW()
         WHERE email_id = $2
         RETURNING retry_count, status\`,
        [errorMessage, messageId]
      );
      
      if (result.rows[0]?.status === 'pending') {
        logger.info(\`Email marked for retry (\${result.rows[0].retry_count}/3): \${messageId}\`);
      } else {
        logger.warn(\`Email failed permanently after 3 retries: \${messageId}\`);
      }
    } catch (error) {
      logger.error(\`Failed to mark email for retry: \${messageId}\`, error);
    }
  }
}`;

    await this.writeFixToFile('enhanced-email-processor.js', timeoutFixCode);
    this.appliedFixes.push('Processing timeout handling implemented');
    logger.info('✅ Fix 1 applied successfully');
  }

  /**
   * Fix 2: Improved AI Service Error Handling
   */
  async fixAIServiceErrorHandling() {
    logger.info('🔧 Applying Fix 2: AI Service Error Handling');

    const aiErrorHandlingCode = `
// Enhanced AI Service with Robust Error Handling
class RobustAIService {
  constructor() {
    this.fallbackClassifications = {
      urgent: ['urgent', 'critical', 'emergency', 'asap', 'immediately'],
      meeting: ['meeting', 'schedule', 'calendar', 'appointment'],
      task: ['review', 'complete', 'action', 'todo', 'task'],
      fyi: ['fyi', 'info', 'notification', 'update']
    };
    this.serviceHealthy = true;
    this.lastHealthCheck = null;
  }

  async classifyEmailRobust(emailContent, subject, sender) {
    try {
      // Check AI service health
      if (!await this.checkAIServiceHealth()) {
        return this.fallbackClassification(emailContent, subject, sender);
      }

      // Try AI classification with timeout
      const classificationResult = await Promise.race([
        this.classifyWithAI(emailContent, subject, sender),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI service timeout')), 30000)
        )
      ]);

      // Validate AI response
      if (!this.validateClassificationResult(classificationResult)) {
        logger.warn('Invalid AI classification result, using fallback');
        return this.fallbackClassification(emailContent, subject, sender);
      }

      return classificationResult;

    } catch (error) {
      logger.error('AI classification failed, using fallback:', error.message);
      this.serviceHealthy = false;
      return this.fallbackClassification(emailContent, subject, sender);
    }
  }

  async checkAIServiceHealth() {
    const now = Date.now();
    
    // Check health every 5 minutes
    if (this.lastHealthCheck && (now - this.lastHealthCheck) < 300000) {
      return this.serviceHealthy;
    }

    try {
      // Simple health check with OpenAI API
      const testResult = await this.classifyWithAI(
        'Health check test',
        'Test',
        'test@example.com'
      );

      this.serviceHealthy = !!testResult?.classification;
      this.lastHealthCheck = now;

      logger.info(\`AI service health check: \${this.serviceHealthy ? 'healthy' : 'unhealthy'}\`);
      return this.serviceHealthy;

    } catch (error) {
      this.serviceHealthy = false;
      this.lastHealthCheck = now;
      logger.warn('AI service health check failed:', error.message);
      return false;
    }
  }

  fallbackClassification(emailContent, subject, sender) {
    const combinedText = \`\${subject} \${emailContent}\`.toLowerCase();
    
    // Rule-based classification
    let classification = 'FYI_ONLY';
    let confidence = 60;

    if (this.containsKeywords(combinedText, this.fallbackClassifications.urgent)) {
      classification = 'URGENT_RESPONSE';
      confidence = 75;
    } else if (this.containsKeywords(combinedText, this.fallbackClassifications.meeting)) {
      classification = 'MEETING_REQUEST';
      confidence = 70;
    } else if (this.containsKeywords(combinedText, this.fallbackClassifications.task)) {
      classification = 'CREATE_TASK';
      confidence = 65;
    }

    // Adjust confidence based on sender
    if (sender.includes('noreply') || sender.includes('notification')) {
      classification = 'FYI_ONLY';
      confidence = 80;
    }

    return {
      classification,
      confidence,
      urgency: classification === 'URGENT_RESPONSE' ? 'HIGH' : 'MEDIUM',
      suggested_action: this.getSuggestedAction(classification),
      fallback_used: true,
      reason: 'AI service unavailable'
    };
  }

  containsKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  getSuggestedAction(classification) {
    const actions = {
      'URGENT_RESPONSE': 'Respond immediately',
      'MEETING_REQUEST': 'Check calendar and respond',
      'CREATE_TASK': 'Create task and schedule',
      'FYI_ONLY': 'Review when convenient'
    };
    return actions[classification] || 'Review manually';
  }

  validateClassificationResult(result) {
    if (!result || typeof result !== 'object') return false;
    if (!result.classification || typeof result.classification !== 'string') return false;
    if (result.confidence === undefined || result.confidence < 0 || result.confidence > 100) return false;
    return true;
  }
}`;

    await this.writeFixToFile('robust-ai-service.js', aiErrorHandlingCode);
    this.appliedFixes.push('AI service error handling improved');
    logger.info('✅ Fix 2 applied successfully');
  }

  /**
   * Fix 3: Database Connection Pool Management
   */
  async fixDatabaseConnectionIssues() {
    logger.info('🔧 Applying Fix 3: Database Connection Management');

    const dbFixCode = `
// Enhanced Database Connection Management
class DatabaseConnectionManager {
  constructor() {
    this.pool = null;
    this.connectionHealthy = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        user: process.env.DB_USER || 'email_admin',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'email_management',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 20,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      });

      // Setup connection event handlers
      this.setupConnectionHandlers();
      
      // Test initial connection
      await this.testConnection();
      
      logger.info('✅ Database connection pool initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize database connection:', error);
      throw error;
    }
  }

  setupConnectionHandlers() {
    this.pool.on('connect', (client) => {
      logger.debug('Database client connected');
      this.connectionHealthy = true;
      this.reconnectAttempts = 0;
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database connection error:', err);
      this.connectionHealthy = false;
      this.handleConnectionError(err);
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed from pool');
    });
  }

  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as current_time, version() as db_version');
      logger.info(\`Database connection test successful: \${result.rows[0].current_time}\`);
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }

  async handleConnectionError(error) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.warn(\`Database connection error, attempt \${this.reconnectAttempts}/\${this.maxReconnectAttempts}: \${error.message}\`);
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
      
      try {
        await this.testConnection();
        logger.info('Database reconnection successful');
      } catch (reconnectError) {
        logger.error('Database reconnection failed:', reconnectError);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max reconnection attempts reached, database unavailable');
        }
      }
    }
  }

  async executeQuerySafely(query, params = []) {
    if (!this.connectionHealthy) {
      throw new Error('Database connection unhealthy');
    }

    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const client = await this.pool.connect();
        try {
          const result = await client.query(query, params);
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        attempts++;
        logger.warn(`Database query attempt ${attempts} failed:`, error.message);
        
        if (attempts >= maxRetries) {
          logger.error('Database query failed after all retries');
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  async getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      connectionHealthy: this.connectionHealthy,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  async gracefulShutdown() {
    logger.info('Shutting down database connection pool...');
    try {
      await this.pool.end();
      logger.info('✅ Database connection pool closed gracefully');
    } catch (error) {
      logger.error('Error during database shutdown:', error);
    }
  }
}`;

    await this.writeFixToFile('database-connection-manager.js', dbFixCode);
    this.appliedFixes.push('Database connection management enhanced');
    logger.info('✅ Fix 3 applied successfully');
  }

  /**
   * Fix 4: Redis Cache Optimization
   */
  async fixRedisCacheIssues() {
    logger.info('🔧 Applying Fix 4: Redis Cache Optimization');

    const cacheFixCode = `
// Optimized Redis Cache Management
class OptimizedCacheManager {
  constructor() {
    this.redis = null;
    this.localCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0
    };
    this.isConnected = false;
  }

  async initialize() {
    try {
      this.redis = Redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: true,
        family: 4
      });

      await this.setupRedisHandlers();
      await this.redis.connect();
      
      logger.info('✅ Redis cache manager initialized successfully');
      
    } catch (error) {
      logger.error('❌ Redis initialization failed:', error);
      logger.warn('Continuing with local cache only');
    }
  }

  async setupRedisHandlers() {
    this.redis.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error:', error.message);
      this.isConnected = false;
      this.cacheStats.errors++;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  async get(key) {
    try {
      // Try local cache first (fastest)
      if (this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes local TTL
          this.cacheStats.hits++;
          return cached.data;
        } else {
          this.localCache.delete(key);
        }
      }

      // Try Redis cache if connected
      if (this.isConnected) {
        const redisResult = await this.redis.get(key);
        if (redisResult) {
          const data = JSON.parse(redisResult);
          
          // Store in local cache for next time
          this.setLocalCache(key, data);
          
          this.cacheStats.hits++;
          return data;
        }
      }

      this.cacheStats.misses++;
      return null;

    } catch (error) {
      logger.warn(\`Cache get error for key \${key}:\`, error.message);
      this.cacheStats.errors++;
      return null;
    }
  }

  async set(key, data, ttl = 3600) {
    try {
      // Always set in local cache
      this.setLocalCache(key, data);

      // Set in Redis if connected
      if (this.isConnected) {
        await this.redis.setEx(key, ttl, JSON.stringify(data));
      }

      this.cacheStats.sets++;
      return true;

    } catch (error) {
      logger.warn(\`Cache set error for key \${key}:\`, error.message);
      this.cacheStats.errors++;
      return false;
    }
  }

  setLocalCache(key, data) {
    // Implement LRU eviction if local cache gets too large
    if (this.localCache.size >= 1000) {
      const oldestKey = this.localCache.keys().next().value;
      this.localCache.delete(oldestKey);
    }

    this.localCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  async invalidate(pattern) {
    try {
      // Clear matching local cache entries
      const keysToDelete = [];
      for (const key of this.localCache.keys()) {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.localCache.delete(key));

      // Clear Redis cache if connected
      if (this.isConnected) {
        const keys = await this.redis.keys(\`*\${pattern}*\`);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }

      logger.info(\`Cache invalidated for pattern: \${pattern}\`);
      return true;

    } catch (error) {
      logger.warn(\`Cache invalidation error for pattern \${pattern}:\`, error.message);
      return false;
    }
  }

  getStats() {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;

    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      localCacheSize: this.localCache.size,
      redisConnected: this.isConnected
    };
  }

  async healthCheck() {
    const stats = this.getStats();
    
    return {
      redis: {
        connected: this.isConnected,
        stats: stats
      },
      localCache: {
        size: this.localCache.size,
        healthy: true
      },
      overall: {
        healthy: true, // Always healthy since we have fallback
        hitRate: stats.hitRate,
        errorRate: stats.errors / (stats.hits + stats.misses + stats.sets || 1)
      }
    };
  }
}`;

    await this.writeFixToFile('optimized-cache-manager.js', cacheFixCode);
    this.appliedFixes.push('Redis cache management optimized');
    logger.info('✅ Fix 4 applied successfully');
  }

  /**
   * Fix 5: Enhanced Email Processing Queue
   */
  async fixProcessingQueue() {
    logger.info('🔧 Applying Fix 5: Enhanced Processing Queue');

    const queueFixCode = `
// Enhanced Email Processing Queue
class EnhancedProcessingQueue {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.batchSize = 10;
    this.maxConcurrentJobs = 5;
    this.currentJobs = new Set();
  }

  async initialize() {
    // Ensure queue table exists with proper indexes
    await this.createQueueTable();
    await this.createIndexes();
    
    // Start background processing
    this.startProcessing();
    
    logger.info('✅ Enhanced processing queue initialized');
  }

  async createQueueTable() {
    const createTableQuery = \`
      CREATE TABLE IF NOT EXISTS email_processing_queue (
        id SERIAL PRIMARY KEY,
        email_id VARCHAR(255) NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        priority INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        error_message TEXT,
        processing_data JSONB,
        UNIQUE(email_id, operation_type)
      )
    \`;

    await databaseAgent.executeQuery(createTableQuery);
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_queue_status ON email_processing_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_queue_priority ON email_processing_queue(priority DESC)',
      'CREATE INDEX IF NOT EXISTS idx_queue_created ON email_processing_queue(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_queue_operation ON email_processing_queue(operation_type)',
      'CREATE INDEX IF NOT EXISTS idx_queue_composite ON email_processing_queue(status, priority DESC, created_at)'
    ];

    for (const indexQuery of indexes) {
      await databaseAgent.executeQuery(indexQuery);
    }
  }

  async addToQueue(emailId, operationType, processingData = {}, priority = 0) {
    try {
      const insertQuery = \`
        INSERT INTO email_processing_queue 
        (email_id, operation_type, processing_data, priority)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email_id, operation_type) 
        DO UPDATE SET 
          priority = EXCLUDED.priority,
          processing_data = EXCLUDED.processing_data,
          updated_at = NOW()
        RETURNING id
      \`;

      const result = await databaseAgent.executeQuery(insertQuery, [
        emailId, 
        operationType, 
        JSON.stringify(processingData), 
        priority
      ]);

      logger.info(\`Added to queue: \${emailId} - \${operationType}\`);
      return result.rows[0].id;

    } catch (error) {
      logger.error(\`Failed to add to queue: \${emailId}\`, error);
      throw error;
    }
  }

  startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.currentJobs.size < this.maxConcurrentJobs) {
        await this.processNextBatch();
      }
    }, 5000); // Check every 5 seconds

    logger.info('Background queue processing started');
  }

  async processNextBatch() {
    if (this.currentJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    try {
      this.isProcessing = true;

      // Get next batch of items to process
      const selectQuery = \`
        SELECT id, email_id, operation_type, processing_data, retry_count
        FROM email_processing_queue
        WHERE status = 'pending'
          AND retry_count < max_retries
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      \`;

      const result = await databaseAgent.executeQuery(selectQuery, [
        this.batchSize - this.currentJobs.size
      ]);

      if (result.rows.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Process items concurrently
      const processingPromises = result.rows.map(item => 
        this.processQueueItem(item)
      );

      await Promise.allSettled(processingPromises);

    } catch (error) {
      logger.error('Error processing queue batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processQueueItem(item) {
    const jobId = \`\${item.email_id}-\${item.operation_type}\`;
    
    if (this.currentJobs.has(jobId)) {
      return;
    }

    this.currentJobs.add(jobId);

    try {
      // Mark as processing
      await this.updateQueueStatus(item.id, 'processing', null, { started_at: 'NOW()' });

      // Process based on operation type
      let result;
      switch (item.operation_type) {
        case 'classify':
          result = await this.processClassification(item);
          break;
        case 'generate_task':
          result = await this.processTaskGeneration(item);
          break;
        case 'generate_draft':
          result = await this.processDraftGeneration(item);
          break;
        default:
          throw new Error(\`Unknown operation type: \${item.operation_type}\`);
      }

      // Mark as completed
      await this.updateQueueStatus(item.id, 'completed', null, { 
        completed_at: 'NOW()',
        processing_result: JSON.stringify(result)
      });

      logger.info(\`Queue item processed successfully: \${jobId}\`);

    } catch (error) {
      logger.error(\`Queue item processing failed: \${jobId}\`, error);

      // Handle retry logic
      if (item.retry_count < 3) {
        await this.updateQueueStatus(item.id, 'pending', error.message, {
          retry_count: item.retry_count + 1
        });
      } else {
        await this.updateQueueStatus(item.id, 'failed', error.message);
      }

    } finally {
      this.currentJobs.delete(jobId);
    }
  }

  async updateQueueStatus(id, status, errorMessage = null, additionalFields = {}) {
    const fields = ['status = $2', 'updated_at = NOW()'];
    const values = [id, status];
    let paramIndex = 3;

    if (errorMessage) {
      fields.push(\`error_message = $\${paramIndex}\`);
      values.push(errorMessage);
      paramIndex++;
    }

    for (const [field, value] of Object.entries(additionalFields)) {
      if (value === 'NOW()') {
        fields.push(\`\${field} = NOW()\`);
      } else {
        fields.push(\`\${field} = $\${paramIndex}\`);
        values.push(value);
        paramIndex++;
      }
    }

    const updateQuery = \`
      UPDATE email_processing_queue 
      SET \${fields.join(', ')}
      WHERE id = $1
    \`;

    await databaseAgent.executeQuery(updateQuery, values);
  }

  async getQueueStatus() {
    const statusQuery = \`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
      FROM email_processing_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    \`;

    const result = await databaseAgent.executeQuery(statusQuery);
    
    const statusMap = {};
    result.rows.forEach(row => {
      statusMap[row.status] = {
        count: parseInt(row.count),
        averageAge: Math.round(parseFloat(row.avg_age_seconds))
      };
    });

    return {
      pending: statusMap.pending?.count || 0,
      processing: statusMap.processing?.count || 0,
      completed: statusMap.completed?.count || 0,
      failed: statusMap.failed?.count || 0,
      activeJobs: this.currentJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs
    };
  }

  async cleanupOldEntries() {
    // Remove completed entries older than 7 days
    const cleanupQuery = \`
      DELETE FROM email_processing_queue
      WHERE status = 'completed' 
        AND completed_at < NOW() - INTERVAL '7 days'
    \`;

    const result = await databaseAgent.executeQuery(cleanupQuery);
    logger.info(\`Cleaned up \${result.rowCount} old queue entries\`);
    
    return result.rowCount;
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info('Queue processing stopped');
  }
}`;

    await this.writeFixToFile('enhanced-processing-queue.js', queueFixCode);
    this.appliedFixes.push('Processing queue enhanced with better concurrency');
    logger.info('✅ Fix 5 applied successfully');
  }

  /**
   * Utility function to write fix code to file
   */
  async writeFixToFile(filename, code) {
    const fixesDir = path.join(process.cwd(), 'src', 'fixes');
    
    try {
      await fs.mkdir(fixesDir, { recursive: true });
      await fs.writeFile(path.join(fixesDir, filename), code);
      logger.info(`Fix code written to: ${filename}`);
    } catch (error) {
      logger.error(`Failed to write fix to file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Apply all fixes
   */
  async applyAllFixes() {
    logger.info('🔧 Starting to apply all email processing fixes...');

    try {
      await this.fixProcessingTimeouts();
      await this.fixAIServiceErrorHandling();
      await this.fixDatabaseConnectionIssues();
      await this.fixRedisCacheIssues();
      await this.fixProcessingQueue();

      logger.info('✅ All email processing fixes applied successfully');
      
      return {
        success: true,
        appliedFixes: this.appliedFixes,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Failed to apply fixes:', error);
      return {
        success: false,
        error: error.message,
        appliedFixes: this.appliedFixes
      };
    }
  }

  /**
   * Generate fix summary report
   */
  generateFixSummary() {
    return {
      totalFixes: this.appliedFixes.length,
      fixes: this.appliedFixes,
      recommendations: [
        'Run the debugging script to identify any remaining issues',
        'Execute comprehensive Playwright tests to validate fixes',
        'Monitor email processing metrics for improvements',
        'Set up alerts for email processing failures',
        'Schedule regular maintenance for queue cleanup'
      ],
      nextSteps: [
        'Deploy fixes to staging environment',
        'Run integration tests',
        'Monitor performance metrics',
        'Deploy to production with monitoring',
        'Update documentation'
      ]
    };
  }
}

module.exports = EmailProcessingFixes;

// CLI usage
if (require.main === module) {
  const fixes = new EmailProcessingFixes();
  
  fixes.applyAllFixes()
    .then(result => {
      console.log('📋 EMAIL PROCESSING FIXES APPLIED');
      console.log('==================================');
      console.log(JSON.stringify(result, null, 2));
      
      const summary = fixes.generateFixSummary();
      console.log('\\n📊 FIX SUMMARY');
      console.log('===============');
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch(error => {
      console.error('❌ Fix application failed:', error);
      process.exit(1);
    });
}