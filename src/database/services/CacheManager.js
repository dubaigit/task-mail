/**
 * Cache Manager Service - Multi-tier caching with Redis and local cache
 */

const redis = require('redis');
const crypto = require('crypto');
const winston = require('winston');
const ICacheManager = require('../interfaces/ICacheManager');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'cache-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/cache-manager.log' })
  ]
});

class CacheManager extends ICacheManager {
  constructor() {
    super();
    this.redis = null;
    this.localCache = new Map();
    this.isInitialized = false;
    
    // Configuration
    this.maxLocalSize = parseInt(process.env.CACHE_LOCAL_MAX_SIZE || '1000');
    this.localTTL = parseInt(process.env.CACHE_LOCAL_TTL || '300000'); // 5 minutes
    this.defaultRedisTTL = parseInt(process.env.CACHE_REDIS_TTL || '900'); // 15 minutes
    
    // Statistics
    this.stats = {
      localHits: 0,
      localMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.initializeRedis();
      await this.setupMaintenanceTasks();
      
      this.isInitialized = true;
      logger.info('✅ Cache Manager initialized successfully');
    } catch (error) {
      logger.error('❌ Cache Manager initialization failed:', error);
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
      lazyConnect: true,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000')
    };

    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    this.redis = redis.createClient(redisConfig);

    this.setupRedisEventHandlers();
    await this.redis.connect();
    await this.testRedisConnection();
  }

  setupRedisEventHandlers() {
    this.redis.on('connect', () => {
      logger.debug('Redis client connecting...');
    });

    this.redis.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    this.redis.on('error', (err) => {
      logger.error('❌ Redis client error:', err);
      this.stats.errors++;
    });

    this.redis.on('end', () => {
      logger.info('Redis client connection ended');
    });

    this.redis.on('reconnecting', () => {
      logger.debug('Redis client reconnecting...');
    });
  }

  async testRedisConnection() {
    try {
      await this.redis.ping();
      logger.info('✅ Redis connection test successful');
      return true;
    } catch (error) {
      logger.error('❌ Redis connection test failed:', error);
      throw error;
    }
  }

  generateCacheKey(query, params = []) {
    const content = JSON.stringify({ 
      query: query.trim().toLowerCase(), 
      params 
    });
    return `db_query:${crypto.createHash('md5').update(content).digest('hex')}`;
  }

  async get(key) {
    try {
      // Check local cache first (L1)
      const localEntry = this.localCache.get(key);
      if (localEntry && Date.now() - localEntry.timestamp < this.localTTL) {
        this.stats.localHits++;
        logger.debug('Local cache hit', { key });
        return localEntry.data;
      }

      // Remove expired local entry
      if (localEntry) {
        this.localCache.delete(key);
      }
      
      this.stats.localMisses++;

      // Check Redis cache (L2)
      if (this.redis && this.redis.isReady) {
        const cached = await this.redis.get(key);
        if (cached) {
          this.stats.redisHits++;
          const data = JSON.parse(cached);
          
          // Populate local cache
          this.setLocal(key, data);
          logger.debug('Redis cache hit', { key });
          return data;
        }
      }

      this.stats.redisMisses++;
      logger.debug('Cache miss', { key });
      return null;
      
    } catch (error) {
      logger.warn('Cache get error', { key, error: error.message });
      this.stats.errors++;
      return null;
    }
  }

  async set(key, value, ttl = this.defaultRedisTTL) {
    try {
      // Set in local cache (L1)
      this.setLocal(key, value);

      // Set in Redis cache (L2)
      if (this.redis && this.redis.isReady) {
        await this.redis.setEx(key, ttl, JSON.stringify(value));
        this.stats.sets++;
        logger.debug('Cache set successful', { key, ttl });
      }
    } catch (error) {
      logger.warn('Cache set error', { key, error: error.message });
      this.stats.errors++;
    }
  }

  setLocal(key, data) {
    // LRU eviction for local cache
    if (this.localCache.size >= this.maxLocalSize) {
      const firstKey = this.localCache.keys().next().value;
      if (firstKey) {
        this.localCache.delete(firstKey);
      }
    }

    this.localCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  async invalidatePattern(pattern) {
    try {
      if (this.redis && this.redis.isReady) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
          this.stats.invalidations++;
          logger.info('Cache pattern invalidated', { pattern, keysDeleted: keys.length });
        }
      }

      // Clear local cache for pattern (simplified - clear all for performance)
      this.localCache.clear();
      
    } catch (error) {
      logger.warn('Cache invalidation error', { pattern, error: error.message });
      this.stats.errors++;
    }
  }

  async invalidateKey(key) {
    try {
      // Remove from local cache
      this.localCache.delete(key);

      // Remove from Redis cache
      if (this.redis && this.redis.isReady) {
        await this.redis.del(key);
        this.stats.invalidations++;
        logger.debug('Cache key invalidated', { key });
      }
    } catch (error) {
      logger.warn('Cache key invalidation error', { key, error: error.message });
      this.stats.errors++;
    }
  }

  getStats() {
    const runtime = Date.now() - this.stats.startTime;
    const totalRequests = this.stats.localHits + this.stats.localMisses;
    const totalHits = this.stats.localHits + this.stats.redisHits;

    return {
      localCache: {
        size: this.localCache.size,
        maxSize: this.maxLocalSize,
        hits: this.stats.localHits,
        misses: this.stats.localMisses,
        hitRate: totalRequests > 0 ? (this.stats.localHits / totalRequests * 100).toFixed(2) + '%' : '0%'
      },
      redis: {
        connected: this.redis?.isReady || false,
        hits: this.stats.redisHits,
        misses: this.stats.redisMisses,
        hitRate: totalRequests > 0 ? (this.stats.redisHits / totalRequests * 100).toFixed(2) + '%' : '0%'
      },
      overall: {
        totalRequests,
        totalHits,
        overallHitRate: totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%',
        sets: this.stats.sets,
        invalidations: this.stats.invalidations,
        errors: this.stats.errors,
        uptimeMs: runtime
      }
    };
  }

  async setupMaintenanceTasks() {
    // Cleanup expired local cache entries every 5 minutes
    this.localCleanupInterval = setInterval(() => {
      this.cleanupExpiredLocalEntries();
    }, 5 * 60 * 1000);

    // Log cache statistics every 15 minutes
    this.statsInterval = setInterval(() => {
      logger.info('Cache statistics', this.getStats());
    }, 15 * 60 * 1000);
  }

  cleanupExpiredLocalEntries() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.localCache.entries()) {
      if (now - entry.timestamp > this.localTTL) {
        this.localCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Local cache cleanup completed', { entriesCleaned: cleaned });
    }
  }

  async healthCheck() {
    const startTime = Date.now();
    
    try {
      // Test Redis connection
      const redisHealthy = this.redis && this.redis.isReady;
      if (redisHealthy) {
        await this.redis.ping();
      }

      const stats = this.getStats();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        redis: {
          connected: redisHealthy,
          status: this.redis?.status || 'disconnected'
        },
        localCache: {
          size: this.localCache.size,
          maxSize: this.maxLocalSize
        },
        performance: stats.overall,
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

  async shutdown() {
    logger.info('Shutting down Cache Manager...');
    
    try {
      // Clear intervals
      if (this.localCleanupInterval) {
        clearInterval(this.localCleanupInterval);
      }
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }

      // Disconnect Redis
      if (this.redis) {
        await this.redis.disconnect();
        logger.info('Redis client disconnected');
      }
      
      // Clear local cache
      this.localCache.clear();
      
      this.isInitialized = false;
      logger.info('✅ Cache Manager shutdown complete');
    } catch (error) {
      logger.error('Error during Cache Manager shutdown:', error);
      throw error;
    }
  }
}

module.exports = CacheManager;