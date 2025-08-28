/**
 * Connection Manager Interface - Database connection lifecycle management
 */

class IConnectionManager {
  /**
   * Initialize database connections
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Get a read-only database connection
   * @returns {Promise<Object>}
   */
  async getReadConnection() {
    throw new Error('Method getReadConnection() must be implemented');
  }

  /**
   * Get a write database connection
   * @returns {Promise<Object>}
   */
  async getWriteConnection() {
    throw new Error('Method getWriteConnection() must be implemented');
  }

  /**
   * Test database connectivity
   * @returns {Promise<boolean>}
   */
  async testConnectivity() {
    throw new Error('Method testConnectivity() must be implemented');
  }

  /**
   * Get connection pool metrics
   * @returns {Object}
   */
  getConnectionMetrics() {
    throw new Error('Method getConnectionMetrics() must be implemented');
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

module.exports = IConnectionManager;