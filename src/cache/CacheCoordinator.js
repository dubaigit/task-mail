const Redis = require('redis');
const EventEmitter = require('events');

class CacheCoordinator extends EventEmitter {
  constructor(redisConfig) {
    super();
    this.redis = Redis.createClient(redisConfig);
    this.localCache = new Map();
    this.maxLocalSize = 1000;
    this.localTTL = 5 * 60 * 1000; // 5 minutes
    this.redisTTL = 60 * 60; // 1 hour
    this.keyPrefix = 'apple-mcp:';
    
    // Track cache statistics
    this.stats = {
      localHits: 0,
      redisHits: 0,
      misses: 0,
      evictions: 0
    };
    
    this.setupEventHandlers();
    this.startCleanupTimer();
  }

  setupEventHandlers() {
    // Clear local cache on Redis invalidation
    this.redis.on('message', (channel, message) => {
      if (channel === `${this.keyPrefix}invalidate`) {
        const key = message.replace(this.keyPrefix, '');
        this.localCache.delete(key);
        this.emit('invalidated', key);
      }
    });
  }

  startCleanupTimer() {
    // Clean up expired local cache entries every 2 minutes
    setInterval(() => {
      this.cleanupLocalCache();
    }, 2 * 60 * 1000);
  }

  cleanupLocalCache() {
    const now = Date.now();
    for (const [key, entry] of this.localCache.entries()) {
      if (now - entry.timestamp > this.localTTL) {
        this.localCache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  async get(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    
    // Check local cache first
    const localEntry = this.localCache.get(key);
    if (localEntry && (Date.now() - localEntry.timestamp) < this.localTTL) {
      this.stats.localHits++;
      return localEntry.value;
    }

    try {
      // Check Redis cache
      const redisValue = await this.redis.get(prefixedKey);
      if (redisValue) {
        const parsedValue = JSON.parse(redisValue);
        
        // Update local cache
        this.setLocal(key, parsedValue);
        this.stats.redisHits++;
        return parsedValue;
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }

    this.stats.misses++;
    return null;
  }

  async set(key, value, ttl = this.redisTTL) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    
    try {
      // Set in Redis with TTL
      await this.redis.setEx(prefixedKey, ttl, JSON.stringify(value));
      
      // Set in local cache
      this.setLocal(key, value);
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  setLocal(key, value) {
    // Evict oldest entries if cache is full
    if (this.localCache.size >= this.maxLocalSize) {
      const oldestKey = this.localCache.keys().next().value;
      this.localCache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.localCache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  async invalidate(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    
    try {
      // Remove from Redis
      await this.redis.del(prefixedKey);
      
      // Remove from local cache
      this.localCache.delete(key);
      
      // Publish invalidation message
      await this.redis.publish(`${this.keyPrefix}invalidate`, prefixedKey);
      
      this.emit('invalidated', key);
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  async clear() {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
      
      this.localCache.clear();
      this.stats.evictions += keys.length;
      
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  getStats() {
    return {
      ...this.stats,
      localCacheSize: this.localCache.size,
      hitRate: this.stats.localHits + this.stats.redisHits / 
               (this.stats.localHits + this.stats.redisHits + this.stats.misses) || 0
    };
  }

  async disconnect() {
    await this.redis.disconnect();
    this.localCache.clear();
  }
}

module.exports = CacheCoordinator;