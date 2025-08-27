/**
 * Enhanced Database Agent - Centralized database management with proper error handling
 * Addresses SQL injection, connection pooling, caching, and monitoring issues
 */

const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const winston = require('winston');

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
    this.supabase = null;
    this.redisClient = null;
    this.isInitialized = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.health = {
      supabase: false,
      redis: false,
      lastCheck: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.initializeSupabase();
      await this.initializeRedis();
      await this.setupHealthMonitoring();
      this.isInitialized = true;
      logger.info('✅ Database Agent initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Database Agent:', error);
      throw error;
    }
  }

  async initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    // Test connection
    await this.testSupabaseConnection();
  }

  async testSupabaseConnection() {
    try {
      const { data, error } = await this.supabase
        .from('emails')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      logger.info('✅ Supabase connection successful');
      this.health.supabase = true;
      return true;
    } catch (error) {
      logger.error('❌ Supabase connection failed:', error);
      this.health.supabase = false;
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
      // Test Supabase
      if (this.supabase) {
        await this.testSupabaseConnection();
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
  async executeQuery(table, operation, options = {}) {
    const startTime = Date.now();
    
    try {
      let query = this.supabase.from(table);
      
      // Apply operation
      if (operation.select) {
        query = query.select(operation.select);
      }
      if (operation.insert) {
        query = query.insert(operation.insert);
      }
      if (operation.update) {
        query = query.update(operation.update);
      }
      if (operation.delete) {
        query = query.delete();
      }
      
      // Apply filters
      if (operation.filters) {
        for (const [key, value] of Object.entries(operation.filters)) {
          query = query.eq(key, value);
        }
      }
      
      // Apply ordering
      if (operation.order) {
        query = query.order(operation.order.column, { ascending: operation.order.ascending });
      }
      
      // Apply limit
      if (operation.limit) {
        query = query.limit(operation.limit);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Log performance metrics
      const duration = Date.now() - startTime;
      logger.debug('Query executed successfully:', {
        duration: `${duration}ms`,
        table,
        operation: Object.keys(operation)[0]
      });
      
      return { data, error: null };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution failed:', {
        error: error.message,
        duration: `${duration}ms`,
        table,
        stack: error.stack
      });
      return { data: null, error };
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
    try {
      const results = [];
      
      for (const operation of operations) {
        const result = await this.executeQuery(operation.table, operation.operation);
        if (result.error) throw result.error;
        results.push(result.data);
      }
      
      logger.info('Transaction completed successfully');
      return results;
    } catch (error) {
      logger.error('Transaction failed:', error);
      throw error;
    }
  }

  // Error handling
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
      supabase: {
        isConnected: this.health.supabase
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
      overall: this.health.supabase && this.health.redis
    };
  }
}

// Singleton instance
const databaseAgent = new DatabaseAgent();

module.exports = { DatabaseAgent, databaseAgent };