/**
 * Connection Manager Service - Supabase client and connection pool management
 */

const { Pool } = require('pg');
const winston = require('winston');
const IConnectionManager = require('../interfaces/IConnectionManager');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'connection-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/connection-manager.log' })
  ]
});

class ConnectionManager extends IConnectionManager {
  constructor() {
    super();
    this.writePool = null;
    this.readPool = null;
    this.isInitialized = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.health = {
      writeDB: false,
      readDB: false,
      lastCheck: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.initializeConnectionPools();
      await this.testConnections();
      await this.setupHealthMonitoring();
      
      this.isInitialized = true;
      logger.info('✅ Connection Manager initialized successfully');
    } catch (error) {
      logger.error('❌ Connection Manager initialization failed:', error);
      throw error;
    }
  }

  async initializeConnectionPools() {
    const baseConfig = {
      user: process.env.DB_USER || 'email_admin',
      database: process.env.DB_NAME || 'email_management',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      application_name: 'apple-mail-connection-manager'
    };

    // Write pool for transactions and updates
    const writePoolConfig = {
      ...baseConfig,
      host: process.env.DB_WRITE_HOST || process.env.DB_HOST || 'localhost',
      max: parseInt(process.env.DB_WRITE_MAX_CONNECTIONS || '20'),
      min: parseInt(process.env.DB_WRITE_MIN_CONNECTIONS || '3'),
      idleTimeoutMillis: parseInt(process.env.DB_WRITE_IDLE_TIMEOUT || '10000'),
      connectionTimeoutMillis: parseInt(process.env.DB_WRITE_CONNECT_TIMEOUT || '2000'),
      acquireTimeoutMillis: parseInt(process.env.DB_WRITE_ACQUIRE_TIMEOUT || '20000'),
      maxUses: parseInt(process.env.DB_WRITE_MAX_USES || '7500'),
      allowExitOnIdle: false
    };

    // Read pool for analytics and queries
    const readPoolConfig = {
      ...baseConfig,
      host: process.env.DB_READ_HOST || process.env.DB_HOST || 'localhost',
      max: parseInt(process.env.DB_READ_MAX_CONNECTIONS || '30'),
      min: parseInt(process.env.DB_READ_MIN_CONNECTIONS || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_READ_IDLE_TIMEOUT || '20000'),
      connectionTimeoutMillis: parseInt(process.env.DB_READ_CONNECT_TIMEOUT || '3000'),
      acquireTimeoutMillis: parseInt(process.env.DB_READ_ACQUIRE_TIMEOUT || '30000'),
      maxUses: parseInt(process.env.DB_READ_MAX_USES || '10000'),
      allowExitOnIdle: true
    };

    this.writePool = new Pool(writePoolConfig);
    this.readPool = new Pool(readPoolConfig);

    this.setupPoolEventHandlers(this.writePool, 'WRITE');
    this.setupPoolEventHandlers(this.readPool, 'READ');

    logger.info('Database connection pools created');
  }

  setupPoolEventHandlers(pool, poolType) {
    pool.on('connect', (client) => {
      logger.debug(`${poolType} pool: New PostgreSQL client connected`);
      this.health[poolType === 'WRITE' ? 'writeDB' : 'readDB'] = true;
    });

    pool.on('error', (err, client) => {
      logger.error(`${poolType} pool: PostgreSQL error:`, err);
      this.health[poolType === 'WRITE' ? 'writeDB' : 'readDB'] = false;
      this.handleConnectionError(err);
    });

    pool.on('acquire', (client) => {
      logger.debug(`${poolType} pool: Client acquired`);
    });

    pool.on('release', (err, client) => {
      if (err) {
        logger.error(`${poolType} pool: Error releasing client:`, err);
      }
    });
  }

  async testConnections() {
    await Promise.all([
      this.testConnection(this.writePool, 'WRITE'),
      this.testConnection(this.readPool, 'READ')
    ]);
  }

  async testConnection(pool, poolType) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();
      
      logger.info(`✅ ${poolType} pool connection test successful`, {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version.split(' ')[0]
      });
      
      this.health[poolType === 'WRITE' ? 'writeDB' : 'readDB'] = true;
      return true;
    } catch (error) {
      logger.error(`❌ ${poolType} pool connection test failed:`, error);
      this.health[poolType === 'WRITE' ? 'writeDB' : 'readDB'] = false;
      throw error;
    }
  }

  async getReadConnection() {
    if (!this.readPool) {
      throw new Error('Read pool not initialized');
    }
    return this.readPool.connect();
  }

  async getWriteConnection() {
    if (!this.writePool) {
      throw new Error('Write pool not initialized');
    }
    return this.writePool.connect();
  }

  async testConnectivity() {
    try {
      await this.testConnections();
      return true;
    } catch (error) {
      logger.error('Connectivity test failed:', error);
      return false;
    }
  }

  getConnectionMetrics() {
    return {
      writePool: {
        totalCount: this.writePool?.totalCount || 0,
        idleCount: this.writePool?.idleCount || 0,
        waitingCount: this.writePool?.waitingCount || 0,
        maxSize: this.writePool?.options?.max || 0,
        minSize: this.writePool?.options?.min || 0
      },
      readPool: {
        totalCount: this.readPool?.totalCount || 0,
        idleCount: this.readPool?.idleCount || 0,
        waitingCount: this.readPool?.waitingCount || 0,
        maxSize: this.readPool?.options?.max || 0,
        minSize: this.readPool?.options?.min || 0
      },
      health: this.health,
      isInitialized: this.isInitialized
    };
  }

  async setupHealthMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);
  }

  async performHealthCheck() {
    this.health.lastCheck = new Date();
    
    try {
      await Promise.all([
        this.testConnection(this.writePool, 'WRITE'),
        this.testConnection(this.readPool, 'READ')
      ]);
    } catch (error) {
      logger.warn('Health check failed:', error);
    }
  }

  async healthCheck() {
    const startTime = Date.now();
    
    try {
      await this.testConnectivity();
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        metrics: this.getConnectionMetrics(),
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

  handleConnectionError(error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('PostgreSQL connection refused - database may be down');
    } else if (error.code === '53300') {
      logger.error('PostgreSQL connection limit reached');
    } else if (error.code === '28000') {
      logger.error('PostgreSQL authentication failed');
    }

    // Exponential backoff retry
    setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.connectionAttempts++;
        this.testConnectivity().catch(() => {
          logger.error(`Reconnection attempt ${this.connectionAttempts} failed`);
        });
      }
    }, 1000 * Math.pow(2, this.connectionAttempts));
  }

  async shutdown() {
    logger.info('Shutting down Connection Manager...');
    
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.writePool) {
        await this.writePool.end();
        logger.info('Write pool closed');
      }
      
      if (this.readPool) {
        await this.readPool.end();
        logger.info('Read pool closed');
      }
      
      this.isInitialized = false;
      logger.info('✅ Connection Manager shutdown complete');
    } catch (error) {
      logger.error('Error during Connection Manager shutdown:', error);
      throw error;
    }
  }
}

module.exports = ConnectionManager;