/**
 * Advanced Caching Strategy - Multi-layer caching with Redis and in-memory optimization
 * Implements distributed caching, cache warming, and intelligent invalidation
 */

const Redis = require('ioredis');
const winston = require('winston');
const EventEmitter = require('events');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/cache.log' })
  ]
});

/**
 * Cache Configuration
 */
const CACHE_CONFIG = {
  // Cache layers with different TTLs and strategies
  LAYERS: {
    L1_MEMORY: {
      name: 'in-memory',
      ttl: 300, // 5 minutes
      maxSize: 10000,
      strategy: 'lru'
    },
    L2_REDIS: {
      name: 'redis',
      ttl: 3600, // 1 hour
      maxMemory: '2gb',
      strategy: 'allkeys-lru'
    },
    L3_PERSISTENT: {
      name: 'database',
      ttl: 86400, // 24 hours
      strategy: 'write-through'
    }
  },

  // Cache keys with different invalidation patterns
  CACHE_PATTERNS: {
    USER_DATA: {
      pattern: 'user:{userId}:*',
      ttl: 3600,
      warming: true,
      invalidateOn: ['user.update', 'user.delete']
    },
    EMAIL_LIST: {
      pattern: 'emails:{userId}:page:{page}',
      ttl: 300,
      warming: false,
      invalidateOn: ['email.create', 'email.update', 'email.delete']
    },
    TASK_DATA: {
      pattern: 'tasks:{userId}:*',
      ttl: 600,
      warming: true,
      invalidateOn: ['task.create', 'task.update', 'task.delete']
    },
    AI_ANALYSIS: {
      pattern: 'ai:analysis:{contentHash}',
      ttl: 86400,
      warming: false,
      invalidateOn: ['ai.model.update']
    },
    SEARCH_RESULTS: {
      pattern: 'search:{query}:{filters}',
      ttl: 1800,
      warming: false,
      invalidateOn: ['data.update']
    }
  }
};

/**
 * Multi-Layer Cache Manager
 */
class MultiLayerCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = { ...CACHE_CONFIG, ...options };
    this.metrics = {
      hits: new Map(),
      misses: new Map(),
      invalidations: new Map(),
      warmingEvents: 0
    };
    
    this.initializeCacheLayers();
    this.setupInvalidationListeners();
  }

  // Initialize all cache layers
  async initializeCacheLayers() {
    // L1: In-memory cache (Node.js Map with LRU)
    this.l1Cache = new Map();
    this.l1AccessOrder = new Map();
    
    // L2: Redis distributed cache
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Redis cluster support
    if (process.env.REDIS_CLUSTER_NODES) {
      this.redis = new Redis.Cluster(
        process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port) };
        })
      );
    }

    await this.redis.connect();
    logger.info('Cache layers initialized successfully');
  }

  // Setup cache invalidation event listeners
  setupInvalidationListeners() {
    // Listen for data change events
    this.on('data.changed', (event) => {
      this.handleInvalidation(event);
    });

    // Setup Redis pub/sub for distributed invalidation
    this.redisSubscriber = this.redis.duplicate();
    this.redisSubscriber.subscribe('cache:invalidate');
    this.redisSubscriber.on('message', (channel, message) => {
      const { pattern, reason } = JSON.parse(message);
      this.invalidatePattern(pattern, reason, 'distributed');
    });
  }

  /**
   * GET - Retrieve from cache with multi-layer fallback
   */
  async get(key, options = {}) {
    const startTime = Date.now();
    let result = null;
    let hitLayer = null;

    try {
      // L1: Check in-memory cache first
      if (this.l1Cache.has(key)) {
        result = this.l1Cache.get(key);
        hitLayer = 'L1_MEMORY';
        this.updateL1AccessOrder(key);
      }

      // L2: Check Redis if not in memory
      if (!result) {
        const redisResult = await this.redis.get(key);
        if (redisResult) {
          result = JSON.parse(redisResult);
          hitLayer = 'L2_REDIS';
          
          // Promote to L1 cache
          this.setL1(key, result, options.ttl || this.config.LAYERS.L1_MEMORY.ttl);
        }
      }

      // Update metrics
      if (result) {
        this.recordHit(key, hitLayer, Date.now() - startTime);
        logger.debug(`Cache hit: ${key} from ${hitLayer}`);
      } else {
        this.recordMiss(key, Date.now() - startTime);
        logger.debug(`Cache miss: ${key}`);
      }

      return result;

    } catch (error) {
      logger.error('Cache get error:', error);
      this.recordMiss(key, Date.now() - startTime, error.message);
      return null;
    }
  }

  /**
   * SET - Store in cache with multi-layer propagation
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl || this.config.LAYERS.L2_REDIS.ttl;
    const layers = options.layers || ['L1_MEMORY', 'L2_REDIS'];

    try {
      const serializedValue = JSON.stringify(value);
      const promises = [];

      // Store in specified layers
      if (layers.includes('L1_MEMORY')) {
        this.setL1(key, value, Math.min(ttl, this.config.LAYERS.L1_MEMORY.ttl));
      }

      if (layers.includes('L2_REDIS')) {
        promises.push(this.redis.setex(key, ttl, serializedValue));
      }

      await Promise.all(promises);
      logger.debug(`Cache set: ${key} in layers [${layers.join(', ')}]`);

      // Emit cache warming event if configured
      const pattern = this.getPatternForKey(key);
      if (pattern && this.config.CACHE_PATTERNS[pattern]?.warming) {
        this.emit('cache.warmed', { key, pattern });
      }

    } catch (error) {
      logger.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * DELETE - Remove from all cache layers
   */
  async delete(key) {
    try {
      // Remove from L1
      this.l1Cache.delete(key);
      this.l1AccessOrder.delete(key);

      // Remove from L2 (Redis)
      await this.redis.del(key);

      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * INVALIDATE - Pattern-based cache invalidation
   */
  async invalidatePattern(pattern, reason = 'manual', source = 'local') {
    try {
      let keysInvalidated = 0;

      // Invalidate L1 cache
      for (const key of this.l1Cache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          this.l1Cache.delete(key);
          this.l1AccessOrder.delete(key);
          keysInvalidated++;
        }
      }

      // Invalidate L2 cache (Redis)
      const redisKeys = await this.redis.keys(pattern);
      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
        keysInvalidated += redisKeys.length;
      }

      // Record metrics
      this.recordInvalidation(pattern, keysInvalidated, reason);

      // Broadcast to other instances if local invalidation
      if (source === 'local') {
        await this.redis.publish('cache:invalidate', JSON.stringify({ pattern, reason }));
      }

      logger.info(`Cache invalidated: pattern=${pattern}, keys=${keysInvalidated}, reason=${reason}`);
      return keysInvalidated;

    } catch (error) {
      logger.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * WARM - Preload cache with frequently accessed data
   */
  async warmCache(warmingStrategy = 'popular') {
    try {
      this.metrics.warmingEvents++;
      let warmedKeys = 0;

      switch (warmingStrategy) {
        case 'popular':
          warmedKeys = await this.warmPopularData();
          break;
        case 'user-specific':
          warmedKeys = await this.warmUserSpecificData();
          break;
        case 'predictive':
          warmedKeys = await this.warmPredictiveData();
          break;
      }

      logger.info(`Cache warming completed: ${warmedKeys} keys warmed using ${warmingStrategy} strategy`);
      return warmedKeys;

    } catch (error) {
      logger.error('Cache warming error:', error);
      return 0;
    }
  }

  // L1 Cache Management
  setL1(key, value, ttl) {
    // Implement LRU eviction if at capacity
    if (this.l1Cache.size >= this.config.LAYERS.L1_MEMORY.maxSize) {
      this.evictLRU();
    }

    this.l1Cache.set(key, value);
    this.updateL1AccessOrder(key);

    // Set TTL timeout
    setTimeout(() => {
      this.l1Cache.delete(key);
      this.l1AccessOrder.delete(key);
    }, ttl * 1000);
  }

  updateL1AccessOrder(key) {
    this.l1AccessOrder.delete(key);
    this.l1AccessOrder.set(key, Date.now());
  }

  evictLRU() {
    const oldestKey = this.l1AccessOrder.keys().next().value;
    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.l1AccessOrder.delete(oldestKey);
    }
  }

  // Pattern matching for cache keys
  matchesPattern(key, pattern) {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\{[^}]+\}/g, '[^:]+');
    return new RegExp(`^${regexPattern}$`).test(key);
  }

  getPatternForKey(key) {
    for (const [patternName, config] of Object.entries(this.config.CACHE_PATTERNS)) {
      if (this.matchesPattern(key, config.pattern)) {
        return patternName;
      }
    }
    return null;
  }

  // Data-specific warming strategies
  async warmPopularData() {
    // Implement popular data warming logic
    return 0; // Placeholder
  }

  async warmUserSpecificData() {
    // Implement user-specific data warming logic
    return 0; // Placeholder
  }

  async warmPredictiveData() {
    // Implement predictive data warming logic
    return 0; // Placeholder
  }

  // Metrics and monitoring
  recordHit(key, layer, responseTime) {
    const layerHits = this.metrics.hits.get(layer) || { count: 0, totalTime: 0 };
    layerHits.count++;
    layerHits.totalTime += responseTime;
    this.metrics.hits.set(layer, layerHits);
  }

  recordMiss(key, responseTime, error = null) {
    const misses = this.metrics.misses.get('total') || { count: 0, totalTime: 0, errors: 0 };
    misses.count++;
    misses.totalTime += responseTime;
    if (error) misses.errors++;
    this.metrics.misses.set('total', misses);
  }

  recordInvalidation(pattern, keysCount, reason) {
    const invalidations = this.metrics.invalidations.get(reason) || { count: 0, totalKeys: 0 };
    invalidations.count++;
    invalidations.totalKeys += keysCount;
    this.metrics.invalidations.set(reason, invalidations);
  }

  // Handle data change events
  handleInvalidation(event) {
    const { type, userId, resourceId } = event;
    
    // Find patterns that should be invalidated
    for (const [patternName, config] of Object.entries(this.config.CACHE_PATTERNS)) {
      if (config.invalidateOn.includes(type)) {
        let pattern = config.pattern;
        
        // Replace placeholders with actual values
        if (userId) pattern = pattern.replace('{userId}', userId);
        if (resourceId) pattern = pattern.replace('{resourceId}', resourceId);
        
        this.invalidatePattern(pattern, type);
      }
    }
  }

  /**
   * Health Check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      layers: {},
      metrics: this.getMetrics(),
      timestamp: new Date().toISOString()
    };

    try {
      // Check L1 cache
      health.layers.L1_MEMORY = {
        status: 'healthy',
        size: this.l1Cache.size,
        maxSize: this.config.LAYERS.L1_MEMORY.maxSize,
        utilization: (this.l1Cache.size / this.config.LAYERS.L1_MEMORY.maxSize * 100).toFixed(2) + '%'
      };

      // Check Redis connection
      const redisInfo = await this.redis.info('memory');
      health.layers.L2_REDIS = {
        status: 'healthy',
        connected: true,
        memory: redisInfo
      };

    } catch (error) {
      health.status = 'degraded';
      health.layers.L2_REDIS = {
        status: 'unhealthy',
        error: error.message
      };
    }

    return health;
  }

  // Get comprehensive metrics
  getMetrics() {
    const totalHits = Array.from(this.metrics.hits.values()).reduce((sum, h) => sum + h.count, 0);
    const totalMisses = Array.from(this.metrics.misses.values()).reduce((sum, m) => sum + m.count, 0);
    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    return {
      hitRate: (hitRate * 100).toFixed(2) + '%',
      totalHits,
      totalMisses,
      hitsByLayer: Object.fromEntries(this.metrics.hits),
      invalidations: Object.fromEntries(this.metrics.invalidations),
      warmingEvents: this.metrics.warmingEvents
    };
  }

  // Cleanup resources
  async close() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.disconnect();
    }
    logger.info('Cache manager closed');
  }
}

/**
 * Cache Decorator for automatic caching
 */
function cached(options = {}) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cacheManager = this.cacheManager || global.cacheManager;
      if (!cacheManager) {
        return method.apply(this, args);
      }

      // Generate cache key
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await cacheManager.set(cacheKey, result, options);
      
      return result;
    };
    
    return descriptor;
  };
}

module.exports = {
  MultiLayerCacheManager,
  CACHE_CONFIG,
  cached
};
