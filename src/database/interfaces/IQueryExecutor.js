/**
 * Query Executor Interface - Database query execution with caching
 */

class IQueryExecutor {
  /**
   * Execute a query with automatic read/write routing
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async executeQuery(query, params = [], options = {}) {
    throw new Error('Method executeQuery() must be implemented');
  }

  /**
   * Execute a cached query for read operations
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @param {number} cacheTTL - Cache TTL in seconds
   * @returns {Promise<Object>}
   */
  async executeCachedQuery(query, params = [], cacheTTL = 300) {
    throw new Error('Method executeCachedQuery() must be implemented');
  }

  /**
   * Execute multiple operations in a transaction
   * @param {Array} operations - Array of query operations
   * @param {Object} options - Transaction options
   * @returns {Promise<Array>}
   */
  async executeTransaction(operations, options = {}) {
    throw new Error('Method executeTransaction() must be implemented');
  }

  /**
   * Determine if query is read-only
   * @param {string} query - SQL query
   * @returns {boolean}
   */
  isReadOnlyQuery(query) {
    throw new Error('Method isReadOnlyQuery() must be implemented');
  }

  /**
   * Get query execution metrics
   * @returns {Object}
   */
  getQueryMetrics() {
    throw new Error('Method getQueryMetrics() must be implemented');
  }

  /**
   * Perform health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    throw new Error('Method healthCheck() must be implemented');
  }
}

module.exports = IQueryExecutor;