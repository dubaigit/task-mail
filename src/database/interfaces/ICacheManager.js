/**
 * Cache Manager Interface - Multi-tier caching strategy
 */

class ICacheManager {
  /**
   * Initialize cache systems
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Get cached value by key
   * @param {string} key - Cache key
   * @returns {Promise<*>}
   */
  async get(key) {
    throw new Error('Method get() must be implemented');
  }

  /**
   * Set cached value with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, ttl = 300) {
    throw new Error('Method set() must be implemented');
  }

  /**
   * Generate cache key from query and parameters
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {string}
   */
  generateCacheKey(query, params = []) {
    throw new Error('Method generateCacheKey() must be implemented');
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} pattern - Cache key pattern
   * @returns {Promise<void>}
   */
  async invalidatePattern(pattern) {
    throw new Error('Method invalidatePattern() must be implemented');
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    throw new Error('Method getStats() must be implemented');
  }

  /**
   * Perform health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    throw new Error('Method healthCheck() must be implemented');
  }

  /**
   * Graceful shutdown
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error('Method shutdown() must be implemented');
  }
}

module.exports = ICacheManager;