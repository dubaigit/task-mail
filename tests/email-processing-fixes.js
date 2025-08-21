/**
 * Email Processing Fixes and Debug Solutions
 * Addresses identified issues with email processing pipeline
 */

const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');

// Enhanced logger for debugging
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/email-debug.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

class EmailProcessingDebugger {
  constructor() {
    this.pool = null;
    this.redis = null;
    this.issues = [];
    this.fixes = [];
  }

  async initialize() {
    try {
      // Initialize database connection
      this.pool = new Pool({
        user: process.env.DB_USER || 'email_admin',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'email_management',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 10,
        connectionTimeoutMillis: 5000,
      });

      // Test database connection
      await this.pool.query('SELECT NOW()');
      logger.info('✅ Database connection established');

      // Initialize Redis connection
      this.redis = Redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      });

      await this.redis.connect();
      logger.info('✅ Redis connection established');

    } catch (error) {
      logger.error('❌ Failed to initialize connections:', error);
      throw error;
    }
  }

  async diagnoseEmailProcessingIssues() {
    logger.info('🔍 Starting email processing diagnostics...');
    this.issues = [];

    try {
      // Check 1: Verify email processing queue status
      await this.checkProcessingQueue();
      
      // Check 2: Validate AI service availability
      await this.checkAIServiceHealth();
      
      // Check 3: Examine stuck emails
      await this.checkStuckEmails();
      
      // Check 4: Validate database schema
      await this.validateDatabaseSchema();
      
      // Check 5: Check Redis cache health
      await this.checkCacheHealth();
      
      // Check 6: Validate email classification logic
      await this.validateClassificationLogic();

      // Check 7: Examine processing performance
      await this.checkProcessingPerformance();

    } catch (error) {
      logger.error('Diagnostic error:', error);
      this.issues.push({
        type: 'diagnostic_error',
        severity: 'critical',
        message: `Diagnostic process failed: ${error.message}`,
        fix: 'Review system configuration and database connectivity'
      });
    }

    return this.generateDiagnosticReport();
  }

  async checkProcessingQueue() {
    try {
      const queueQuery = `
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
        FROM email_processing_queue 
        GROUP BY status
      `;
      
      const result = await this.pool.query(queueQuery);
      
      result.rows.forEach(row => {
        if (row.status === 'processing' && row.avg_age_seconds > 300) {
          this.issues.push({
            type: 'stuck_processing',
            severity: 'high',
            message: `${row.count} emails stuck in processing for average ${Math.round(row.avg_age_seconds)} seconds`,
            fix: 'Reset stuck emails and implement timeout handling',
            data: row
          });
        }
        
        if (row.status === 'failed' && row.count > 10) {
          this.issues.push({
            type: 'high_failure_rate',
            severity: 'high',
            message: `${row.count} failed email processing attempts`,
            fix: 'Investigate failure causes and implement retry logic',
            data: row
          });
        }
      });

      logger.info(`Queue status check completed. Found ${this.issues.length} issues.`);
      
    } catch (error) {
      this.issues.push({
        type: 'queue_check_failed',
        severity: 'critical',
        message: `Cannot access processing queue: ${error.message}`,
        fix: 'Verify database connection and queue table existence'
      });
    }
  }

  async checkAIServiceHealth() {
    try {
      const { classifyEmail } = require('../ai_service');
      
      // Test AI service with sample email
      const testResult = await classifyEmail(
        'Test email for health check',
        'Health Check',
        'healthcheck@test.com'
      );

      if (!testResult || !testResult.classification) {
        this.issues.push({
          type: 'ai_service_unhealthy',
          severity: 'high',
          message: 'AI service not returning proper classifications',
          fix: 'Check OpenAI API key configuration and service availability'
        });
      } else {
        logger.info('✅ AI service is responding correctly');
      }

    } catch (error) {
      this.issues.push({
        type: 'ai_service_error',
        severity: 'critical',
        message: `AI service error: ${error.message}`,
        fix: 'Verify ai_service.js configuration and OpenAI API connectivity'
      });
    }
  }

  async checkStuckEmails() {
    try {
      const stuckQuery = `
        SELECT 
          email_id,
          operation_type,
          status,
          retry_count,
          error_message,
          created_at,
          updated_at,
          EXTRACT(EPOCH FROM (NOW() - updated_at)) as stuck_seconds
        FROM email_processing_queue
        WHERE status IN ('processing', 'pending')
          AND updated_at < NOW() - INTERVAL '10 minutes'
        ORDER BY created_at ASC
        LIMIT 50
      `;

      const result = await this.pool.query(stuckQuery);
      
      if (result.rows.length > 0) {
        this.issues.push({
          type: 'stuck_emails',
          severity: 'high',
          message: `${result.rows.length} emails stuck in processing`,
          fix: 'Reset stuck emails and improve error handling',
          data: result.rows
        });

        // Implement auto-fix for stuck emails
        await this.fixStuckEmails(result.rows);
      }

    } catch (error) {
      logger.error('Error checking stuck emails:', error);
    }
  }

  async fixStuckEmails(stuckEmails) {
    try {
      const resetQuery = `
        UPDATE email_processing_queue 
        SET status = 'failed',
            error_message = 'Reset due to timeout',
            updated_at = NOW()
        WHERE email_id = ANY($1::text[])
          AND status IN ('processing', 'pending')
          AND updated_at < NOW() - INTERVAL '10 minutes'
      `;

      const emailIds = stuckEmails.map(email => email.email_id);
      await this.pool.query(resetQuery, [emailIds]);
      
      this.fixes.push({
        type: 'stuck_emails_reset',
        message: `Reset ${emailIds.length} stuck emails`,
        emailIds: emailIds
      });

      logger.info(`✅ Reset ${emailIds.length} stuck emails`);

    } catch (error) {
      logger.error('Error fixing stuck emails:', error);
    }
  }

  async validateDatabaseSchema() {
    try {
      // Check if required tables exist
      const requiredTables = [
        'emails',
        'email_processing_queue', 
        'tasks',
        'ai_analysis'
      ];

      for (const table of requiredTables) {
        const checkQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `;
        
        const result = await this.pool.query(checkQuery, [table]);
        
        if (!result.rows[0].exists) {
          this.issues.push({
            type: 'missing_table',
            severity: 'critical',
            message: `Required table '${table}' does not exist`,
            fix: `Create table '${table}' using appropriate migration script`
          });
        }
      }

      // Check for required indexes
      await this.checkRequiredIndexes();

    } catch (error) {
      this.issues.push({
        type: 'schema_validation_error',
        severity: 'critical',
        message: `Schema validation failed: ${error.message}`,
        fix: 'Review database configuration and permissions'
      });
    }
  }

  async checkRequiredIndexes() {
    const requiredIndexes = [
      { table: 'emails', column: 'message_id', name: 'idx_emails_message_id' },
      { table: 'emails', column: 'processed_at', name: 'idx_emails_processed_at' },
      { table: 'email_processing_queue', column: 'status', name: 'idx_queue_status' },
      { table: 'tasks', column: 'email_id', name: 'idx_tasks_email_id' }
    ];

    for (const index of requiredIndexes) {
      const checkQuery = `
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = $1 AND indexname = $2
        )
      `;
      
      const result = await this.pool.query(checkQuery, [index.table, index.name]);
      
      if (!result.rows[0].exists) {
        this.issues.push({
          type: 'missing_index',
          severity: 'medium',
          message: `Missing index '${index.name}' on ${index.table}(${index.column})`,
          fix: `CREATE INDEX ${index.name} ON ${index.table}(${index.column})`
        });
      }
    }
  }

  async checkCacheHealth() {
    try {
      // Test Redis connectivity and basic operations
      await this.redis.set('health_check', 'ok', 'EX', 10);
      const result = await this.redis.get('health_check');
      
      if (result !== 'ok') {
        this.issues.push({
          type: 'cache_unhealthy',
          severity: 'medium',
          message: 'Redis cache not responding properly',
          fix: 'Check Redis server status and connectivity'
        });
      }

      // Check cache hit rate
      const info = await this.redis.info('stats');
      const hitRate = this.parseRedisHitRate(info);
      
      if (hitRate < 0.5) {
        this.issues.push({
          type: 'low_cache_hit_rate',
          severity: 'low',
          message: `Cache hit rate is ${Math.round(hitRate * 100)}%`,
          fix: 'Review cache keys and TTL settings'
        });
      }

    } catch (error) {
      this.issues.push({
        type: 'cache_error',
        severity: 'high',
        message: `Cache system error: ${error.message}`,
        fix: 'Verify Redis configuration and connectivity'
      });
    }
  }

  parseRedisHitRate(info) {
    try {
      const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      return hits / (hits + misses) || 0;
    } catch {
      return 0;
    }
  }

  async validateClassificationLogic() {
    try {
      const testCases = [
        {
          subject: 'Urgent: System Down',
          body: 'Critical system failure',
          expectedType: 'URGENT_RESPONSE'
        },
        {
          subject: 'Meeting invite',
          body: 'Please join us for a meeting',
          expectedType: 'MEETING_REQUEST'
        },
        {
          subject: 'FYI: Report attached',
          body: 'Here is the weekly report',
          expectedType: 'FYI_ONLY'
        }
      ];

      const { classifyEmail } = require('../ai_service');
      
      for (const testCase of testCases) {
        try {
          const result = await classifyEmail(testCase.body, testCase.subject, 'test@example.com');
          
          if (!result || !result.classification) {
            this.issues.push({
              type: 'classification_failure',
              severity: 'high',
              message: `Failed to classify test case: ${testCase.subject}`,
              fix: 'Review AI classification logic and API connectivity'
            });
          }
        } catch (error) {
          this.issues.push({
            type: 'classification_error',
            severity: 'medium',
            message: `Classification error for "${testCase.subject}": ${error.message}`,
            fix: 'Implement fallback classification logic'
          });
        }
      }

    } catch (error) {
      logger.error('Classification validation error:', error);
    }
  }

  async checkProcessingPerformance() {
    try {
      const perfQuery = `
        SELECT 
          operation_type,
          COUNT(*) as total_operations,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration,
          COUNT(*) FILTER (WHERE status = 'completed') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM email_processing_queue
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY operation_type
      `;

      const result = await this.pool.query(perfQuery);
      
      result.rows.forEach(row => {
        const successRate = row.successful / row.total_operations;
        const avgDuration = parseFloat(row.avg_duration);

        if (successRate < 0.9) {
          this.issues.push({
            type: 'low_success_rate',
            severity: 'high',
            message: `${row.operation_type} success rate is ${Math.round(successRate * 100)}%`,
            fix: 'Investigate failure causes and improve error handling',
            data: row
          });
        }

        if (avgDuration > 30) {
          this.issues.push({
            type: 'slow_processing',
            severity: 'medium',
            message: `${row.operation_type} average processing time is ${Math.round(avgDuration)}s`,
            fix: 'Optimize processing logic and consider parallel processing',
            data: row
          });
        }
      });

    } catch (error) {
      logger.error('Performance check error:', error);
    }
  }

  async applyAutoFixes() {
    logger.info('🔧 Applying automated fixes...');

    // Fix 1: Create missing indexes
    await this.createMissingIndexes();
    
    // Fix 2: Reset stuck emails
    await this.resetAllStuckEmails();
    
    // Fix 3: Clear expired cache entries
    await this.cleanupExpiredCache();
    
    // Fix 4: Optimize queue processing
    await this.optimizeQueueProcessing();

    return this.fixes;
  }

  async createMissingIndexes() {
    const missingIndexes = this.issues.filter(issue => issue.type === 'missing_index');
    
    for (const issue of missingIndexes) {
      try {
        await this.pool.query(issue.fix);
        this.fixes.push({
          type: 'index_created',
          message: `Created index: ${issue.fix}`
        });
        logger.info(`✅ ${issue.fix}`);
      } catch (error) {
        logger.error(`Failed to create index: ${error.message}`);
      }
    }
  }

  async resetAllStuckEmails() {
    try {
      const resetQuery = `
        UPDATE email_processing_queue 
        SET status = 'pending',
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE status = 'processing'
          AND updated_at < NOW() - INTERVAL '5 minutes'
      `;

      const result = await this.pool.query(resetQuery);
      
      if (result.rowCount > 0) {
        this.fixes.push({
          type: 'emails_reset',
          message: `Reset ${result.rowCount} stuck emails`
        });
        logger.info(`✅ Reset ${result.rowCount} stuck emails`);
      }
    } catch (error) {
      logger.error('Error resetting stuck emails:', error);
    }
  }

  async cleanupExpiredCache() {
    try {
      // Remove expired AI cache entries
      const keys = await this.redis.keys('ai_cache:*');
      let deletedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.redis.expire(key, 3600); // Set 1 hour expiration
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        this.fixes.push({
          type: 'cache_cleanup',
          message: `Set expiration for ${deletedCount} cache entries`
        });
      }
    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }

  async optimizeQueueProcessing() {
    try {
      // Reorder pending items by priority
      const reorderQuery = `
        UPDATE email_processing_queue 
        SET priority = CASE
          WHEN operation_type = 'classify' THEN 1
          WHEN operation_type = 'generate_task' THEN 2
          WHEN operation_type = 'generate_draft' THEN 3
          ELSE 5
        END
        WHERE status = 'pending' AND priority = 0
      `;

      const result = await this.pool.query(reorderQuery);
      
      if (result.rowCount > 0) {
        this.fixes.push({
          type: 'queue_optimized',
          message: `Prioritized ${result.rowCount} queue items`
        });
      }
    } catch (error) {
      logger.error('Queue optimization error:', error);
    }
  }

  generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
        highIssues: this.issues.filter(i => i.severity === 'high').length,
        mediumIssues: this.issues.filter(i => i.severity === 'medium').length,
        lowIssues: this.issues.filter(i => i.severity === 'low').length
      },
      issues: this.issues,
      fixes: this.fixes,
      recommendations: this.generateRecommendations()
    };

    logger.info('📋 Diagnostic report generated:', JSON.stringify(report.summary, null, 2));
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.issues.some(i => i.type === 'ai_service_error')) {
      recommendations.push({
        priority: 'high',
        action: 'Configure OpenAI API key and verify service availability',
        impact: 'Email classification will fail without AI service'
      });
    }

    if (this.issues.some(i => i.type === 'stuck_emails')) {
      recommendations.push({
        priority: 'high',
        action: 'Implement email processing timeout and retry logic',
        impact: 'Emails may remain unprocessed indefinitely'
      });
    }

    if (this.issues.some(i => i.type === 'low_success_rate')) {
      recommendations.push({
        priority: 'medium',
        action: 'Investigate root causes of processing failures',
        impact: 'High failure rate reduces system reliability'
      });
    }

    return recommendations;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = EmailProcessingDebugger;

// CLI usage
if (require.main === module) {
  const emailDebugger = new EmailProcessingDebugger();
  
  emailDebugger.initialize()
    .then(() => emailDebugger.diagnoseEmailProcessingIssues())
    .then(report => {
      console.log('\n📋 DIAGNOSTIC REPORT');
      console.log('==================');
      console.log(JSON.stringify(report, null, 2));
      
      return emailDebugger.applyAutoFixes();
    })
    .then(fixes => {
      console.log('\n🔧 APPLIED FIXES');
      console.log('===============');
      console.log(JSON.stringify(fixes, null, 2));
    })
    .catch(error => {
      console.error('❌ Debug process failed:', error);
    })
    .finally(() => {
      emailDebugger.close();
    });
}