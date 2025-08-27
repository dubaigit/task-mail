/**
 * Query Executor Service - Database query execution with caching and monitoring
 */

const winston = require('winston');
const IQueryExecutor = require('../interfaces/IQueryExecutor');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'query-executor' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/query-executor.log' })
  ]
});

class QueryExecutor extends IQueryExecutor {
  constructor(dependencies) {
    super();
    this.connectionManager = dependencies.connectionManager;
    this.cacheManager = dependencies.cacheManager;
    this.performanceMonitor = dependencies.performanceMonitor;
    
    // Configuration
    this.defaultTimeout = parseInt(process.env.QUERY_TIMEOUT || '30000');
    this.defaultCacheTTL = parseInt(process.env.QUERY_CACHE_TTL || '300');
    
    // Statistics
    this.stats = {
      queriesExecuted: 0,
      cachedQueries: 0,
      transactionsExecuted: 0,
      readQueries: 0,
      writeQueries: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async executeQuery(query, params = [], options = {}) {
    const queryInfo = { query, params };
    const isReadQuery = this.isReadOnlyQuery(query);
    const poolType = isReadQuery ? 'READ' : 'WRITE';

    this.stats.queriesExecuted++;
    if (isReadQuery) {
      this.stats.readQueries++;
    } else {
      this.stats.writeQueries++;
    }

    // Check cache for read queries
    if (isReadQuery && options.cache !== false && this.cacheManager) {
      const cacheKey = this.cacheManager.generateCacheKey(query, params);
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        this.stats.cachedQueries++;
        logger.debug('Query served from cache', { poolType, cacheKey });
        return { 
          rows: cached, 
          rowCount: cached.length, 
          fromCache: true 
        };
      }
    }

    const queryFn = async () => {
      let client = null;
      try {
        // Get appropriate connection
        client = isReadQuery 
          ? await this.connectionManager.getReadConnection()
          : await this.connectionManager.getWriteConnection();
        
        // Set query timeout if specified
        if (options.timeout || this.defaultTimeout) {
          const timeout = options.timeout || this.defaultTimeout;
          await client.query(`SET statement_timeout = ${timeout}`);
        }
        
        // Execute query
        const result = await client.query(query, params);
        
        // Cache read query results
        if (isReadQuery && options.cache !== false && result.rows.length > 0 && this.cacheManager) {
          const cacheKey = this.cacheManager.generateCacheKey(query, params);
          const cacheTTL = options.cacheTTL || this.defaultCacheTTL;
          await this.cacheManager.set(cacheKey, result.rows, cacheTTL);
        }
        
        return result;
      } finally {
        if (client) {
          client.release();
        }
      }
    };

    try {
      // Monitor query performance if available
      if (this.performanceMonitor) {
        return await this.performanceMonitor.monitorQuery(queryFn, { ...queryInfo, poolType });
      } else {
        return await queryFn();
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Query execution failed', {
        query: query.substring(0, 100) + '...',
        params,
        poolType,
        error: error.message
      });
      throw error;
    }
  }

  async executeCachedQuery(query, params = [], cacheTTL = this.defaultCacheTTL) {
    return this.executeQuery(query, params, { 
      cache: true, 
      cacheTTL 
    });
  }

  async executeTransaction(operations, options = {}) {
    this.stats.transactionsExecuted++;
    
    let client = null;
    try {
      // Get write connection for transactions
      client = await this.connectionManager.getWriteConnection();
      
      // Begin transaction
      await client.query('BEGIN');
      
      // Set isolation level if specified
      if (options.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }
      
      // Set timeout if specified
      if (options.timeout || this.defaultTimeout) {
        const timeout = options.timeout || this.defaultTimeout;
        await client.query(`SET statement_timeout = ${timeout}`);
      }
      
      const results = [];
      
      // Execute all operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        try {
          const result = await client.query(operation.query, operation.params);
          results.push(result);
          
          logger.debug(`Transaction operation ${i + 1}/${operations.length} completed`, {
            rowCount: result.rowCount
          });
        } catch (error) {
          logger.error(`Transaction operation ${i + 1} failed:`, error);
          throw error;
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      logger.info('Transaction completed successfully', { 
        operationCount: operations.length,
        totalRows: results.reduce((sum, r) => sum + (r.rowCount || 0), 0)
      });
      
      // Invalidate relevant cache patterns
      if (options.invalidateCache && this.cacheManager) {
        await this.cacheManager.invalidatePattern(options.invalidateCache);
      }
      
      return results;
      
    } catch (error) {
      // Rollback on error
      if (client) {
        try {
          await client.query('ROLLBACK');
          logger.info('Transaction rolled back due to error');
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction:', rollbackError);
        }
      }
      
      this.stats.errors++;
      logger.error('Transaction failed:', error);
      throw error;
      
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  isReadOnlyQuery(query) {
    const trimmed = query.trim().toLowerCase();
    const readOnlyPatterns = [
      /^select\s/,
      /^with\s.*\s+select\s/,
      /^explain\s/,
      /^show\s/,
      /^describe\s/,
      /^desc\s/
    ];
    
    return readOnlyPatterns.some(pattern => pattern.test(trimmed));
  }

  async executeBatch(queries, options = {}) {
    const batchSize = options.batchSize || 10;
    const results = [];
    
    // Process queries in batches to avoid overwhelming the database
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      const batchPromises = batch.map(queryInfo => 
        this.executeQuery(queryInfo.query, queryInfo.params, queryInfo.options || {})
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        logger.debug(`Batch ${Math.floor(i / batchSize) + 1} completed`, {
          batchSize: batch.length,
          totalProcessed: i + batch.length
        });
      } catch (error) {
        logger.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        throw error;
      }
    }
    
    return results;
  }

  getQueryMetrics() {
    const runtime = Date.now() - this.stats.startTime;
    const cacheHitRate = this.stats.queriesExecuted > 0 
      ? (this.stats.cachedQueries / this.stats.queriesExecuted * 100).toFixed(2) + '%'
      : '0%';

    return {
      execution: {
        totalQueries: this.stats.queriesExecuted,
        readQueries: this.stats.readQueries,
        writeQueries: this.stats.writeQueries,
        transactions: this.stats.transactionsExecuted,
        errors: this.stats.errors,
        errorRate: this.stats.queriesExecuted > 0 
          ? (this.stats.errors / this.stats.queriesExecuted * 100).toFixed(2) + '%'
          : '0%'
      },
      caching: {
        cachedQueries: this.stats.cachedQueries,
        cacheHitRate,
        cacheEnabled: !!this.cacheManager
      },
      performance: {
        uptimeMs: runtime,
        queriesPerSecond: runtime > 0 
          ? (this.stats.queriesExecuted / (runtime / 1000)).toFixed(2)
          : '0'
      },
      monitoring: {
        performanceMonitorEnabled: !!this.performanceMonitor
      }
    };
  }

  async healthCheck() {
    const startTime = Date.now();
    
    try {
      // Test a simple query
      await this.executeQuery('SELECT 1 as health_check');
      
      const metrics = this.getQueryMetrics();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        metrics,
        dependencies: {
          connectionManager: !!this.connectionManager,
          cacheManager: !!this.cacheManager,
          performanceMonitor: !!this.performanceMonitor
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Common application-specific queries
  async getTaskCategoryCounts() {
    return this.executeCachedQuery(
      'SELECT get_task_category_counts_cached() as counts',
      [],
      180 // 3 minutes cache
    );
  }

  async getAIProcessingStats() {
    return this.executeCachedQuery(
      'SELECT get_ai_processing_stats_cached() as stats',
      [],
      60 // 1 minute cache
    );
  }

  async getUnanalyzedEmails(batchSize = 10) {
    return this.executeQuery(
      'SELECT * FROM get_unanalyzed_emails($1)',
      [batchSize],
      { cache: false } // Don't cache dynamic queries
    );
  }
}

module.exports = QueryExecutor;