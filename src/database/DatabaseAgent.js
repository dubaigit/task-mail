/**
 * Enhanced Database Agent - Centralized database management with proper error handling
 * Addresses SQL injection, connection pooling, caching, and monitoring issues
 */

const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');
const { SQLSanitizer } = require('../security/sql-sanitizer');

// Enhanced logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database-agent' },
  transports: [
    new winston.transports.File({ filename: 'logs/database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/database-combined.log' }),
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

class DatabaseAgent {
  constructor() {
    this.pgPool = null;
    this.redisClient = null;
    this.isInitialized = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.health = {
      postgres: false,
      redis: false,
      lastCheck: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.initializePostgreSQL();
      await this.initializeRedis();
      await this.setupHealthMonitoring();
      this.isInitialized = true;
      logger.info('✅ Database Agent initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Database Agent:', error);
      throw error;
    }
  }

  async initializePostgreSQL() {
    const poolConfig = {
      user: process.env.DB_USER || 'email_admin',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'email_management',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
      
      // Enhanced connection pool settings
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
      
      // SSL configuration
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false,
      
      // Application name for monitoring
      application_name: 'apple-mail-task-manager'
    };

    this.pgPool = new Pool(poolConfig);

    // Enhanced connection event handling
    this.pgPool.on('connect', (client) => {
      logger.info('New PostgreSQL client connected');
      this.health.postgres = true;
    });

    this.pgPool.on('error', (err, client) => {
      logger.error('PostgreSQL pool error:', err);
      this.health.postgres = false;
      this.handlePostgreSQLError(err);
    });

    this.pgPool.on('acquire', (client) => {
      logger.debug('PostgreSQL client acquired from pool');
    });

    this.pgPool.on('release', (err, client) => {
      if (err) {
        logger.error('Error releasing PostgreSQL client:', err);
      } else {
        logger.debug('PostgreSQL client released back to pool');
      }
    });

    // Test connection
    await this.testPostgreSQLConnection();
  }

  async testPostgreSQLConnection() {
    try {
      const client = await this.pgPool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();
      
      logger.info('✅ PostgreSQL connection successful:', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version.split(' ')[0]
      });
      
      this.health.postgres = true;
      return true;
    } catch (error) {
      logger.error('❌ PostgreSQL connection failed:', error);
      this.health.postgres = false;
      throw error;
    }
  }

  async initializeRedis() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryConnectOnFailover: true,
      lazyConnect: true
    };

    // Add password if provided
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    this.redisClient = redis.createClient(redisConfig);

    // Enhanced Redis event handling
    this.redisClient.on('connect', () => {
      logger.info('✅ Redis client connecting...');
    });

    this.redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
      this.health.redis = true;
    });

    this.redisClient.on('error', (err) => {
      logger.error('❌ Redis client error:', err);
      this.health.redis = false;
      this.handleRedisError(err);
    });

    this.redisClient.on('end', () => {
      logger.info('Redis client connection ended');
      this.health.redis = false;
    });

    this.redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Connect to Redis
    await this.redisClient.connect();
    
    // Test Redis connection
    await this.testRedisConnection();
  }

  async testRedisConnection() {
    try {
      await this.redisClient.ping();
      logger.info('✅ Redis connection successful');
      this.health.redis = true;
      return true;
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      this.health.redis = false;
      throw error;
    }
  }

  setupHealthMonitoring() {
    // Health check every 30 seconds
    setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);
  }

  async performHealthCheck() {
    this.health.lastCheck = new Date();
    
    try {
      // Test PostgreSQL
      if (this.pgPool) {
        await this.testPostgreSQLConnection();
      }
      
      // Test Redis
      if (this.redisClient && this.redisClient.isReady) {
        await this.testRedisConnection();
      }
      
      logger.debug('Health check completed:', this.health);
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  // Enhanced query execution with proper error handling and monitoring
  async executeQuery(query, params = [], options = {}) {
    const startTime = Date.now();
    let client = null;
    
    try {
      // Validate and sanitize query
      const { query: sanitizedQuery, params: sanitizedParams } = SQLSanitizer.sanitizeQuery(query, params);
      
      // Get client from pool
      client = await this.pgPool.connect();
      
      // Set query timeout if specified
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }
      
      // Execute query
      const result = await client.query(sanitizedQuery, sanitizedParams);
      
      // Log performance metrics
      const duration = Date.now() - startTime;
      logger.debug('Query executed successfully:', {
        duration: `${duration}ms`,
        rowCount: result.rowCount,
        command: result.command
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution failed:', {
        error: error.message,
        duration: `${duration}ms`,
        query: query.substring(0, 100) + '...',
        stack: error.stack
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Enhanced cache operations with error handling
  async getCachedData(key, options = {}) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) {
        logger.warn('Redis not available for cache get operation');
        return null;
      }
      
      const cached = await this.redisClient.get(key);
      
      if (cached) {
        logger.debug('Cache hit:', { key });
        return JSON.parse(cached);
      }
      
      logger.debug('Cache miss:', { key });
      return null;
    } catch (error) {
      logger.error('Cache get operation failed:', { key, error: error.message });
      return null; // Graceful degradation
    }
  }

  async setCachedData(key, data, ttl = 300) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) {
        logger.warn('Redis not available for cache set operation');
        return false;
      }
      
      await this.redisClient.setEx(key, ttl, JSON.stringify(data));
      logger.debug('Cache set successful:', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set operation failed:', { key, error: error.message });
      return false;
    }
  }

  async invalidateCache(pattern) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) {
        logger.warn('Redis not available for cache invalidation');
        return false;
      }
      
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        logger.info('Cache invalidated:', { pattern, keysDeleted: keys.length });
      }
      return true;
    } catch (error) {
      logger.error('Cache invalidation failed:', { pattern, error: error.message });
      return false;
    }
  }

  // Transaction support
  async executeTransaction(operations) {
    const client = await this.pgPool.connect();
    
    try {
      await client.query('BEGIN');
      const results = [];
      
      for (const operation of operations) {
        const { query, params } = SQLSanitizer.sanitizeQuery(operation.query, operation.params);
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      logger.info('Transaction completed successfully');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed, rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Error handling
  handlePostgreSQLError(error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('PostgreSQL connection refused - database may be down');
    } else if (error.code === '53300') {
      logger.error('PostgreSQL connection limit reached');
    } else if (error.code === '28000') {
      logger.error('PostgreSQL authentication failed');
    }
    
    // Attempt reconnection after delay
    setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.connectionAttempts++;
        this.testPostgreSQLConnection().catch(() => {
          logger.error(`PostgreSQL reconnection attempt ${this.connectionAttempts} failed`);
        });
      }
    }, 5000 * this.connectionAttempts);
  }

  handleRedisError(error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused - Redis may be down');
    } else if (error.code === 'WRONGPASS') {
      logger.error('Redis authentication failed');
    }
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down Database Agent...');
    
    try {
      if (this.pgPool) {
        await this.pgPool.end();
        logger.info('PostgreSQL pool closed');
      }
      
      if (this.redisClient) {
        await this.redisClient.disconnect();
        logger.info('Redis client disconnected');
      }
      
      this.isInitialized = false;
      logger.info('✅ Database Agent shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  // Metrics and monitoring
  getConnectionMetrics() {
    return {
      postgresql: {
        totalCount: this.pgPool?.totalCount || 0,
        idleCount: this.pgPool?.idleCount || 0,
        waitingCount: this.pgPool?.waitingCount || 0
      },
      redis: {
        isReady: this.redisClient?.isReady || false,
        status: this.redisClient?.status || 'disconnected'
      },
      health: this.health
    };
  }

  getHealth() {
    return {
      ...this.health,
      overall: this.health.postgres && this.health.redis
    };
  }
}

// Singleton instance
const databaseAgent = new DatabaseAgent();

module.exports = { DatabaseAgent, databaseAgent };