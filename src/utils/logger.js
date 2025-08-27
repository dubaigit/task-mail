const winston = require('winston');
const path = require('path');

/**
 * Logger utility for Apple MCP Email Intelligence Dashboard
 * Provides structured logging with different levels and formats
 */
class Logger {
  constructor() {
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger instance
   */
  createLogger() {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Create logs directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        return log;
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'apple-mcp' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        
        // File transport for error logs
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        
        // File transport for performance logs
        new winston.transports.File({
          filename: path.join(logDir, 'performance.log'),
          level: 'info',
          maxsize: 5242880, // 5MB
          maxFiles: 3,
          tailable: true
        })
      ],
      
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log')
        })
      ],
      
      // Handle unhandled rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log')
        })
      ]
    });
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Log verbose message
   */
  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }

  /**
   * Log performance metrics
   */
  performance(operation, duration, meta = {}) {
    this.logger.info(`Performance: ${operation}`, {
      ...meta,
      operation,
      duration,
      type: 'performance'
    });
  }

  /**
   * Log database operations
   */
  database(operation, table, duration, meta = {}) {
    this.logger.info(`Database: ${operation}`, {
      ...meta,
      operation,
      table,
      duration,
      type: 'database'
    });
  }

  /**
   * Log API requests
   */
  api(method, path, statusCode, duration, meta = {}) {
    this.logger.info(`API: ${method} ${path}`, {
      ...meta,
      method,
      path,
      statusCode,
      duration,
      type: 'api'
    });
  }

  /**
   * Log security events
   */
  security(event, user, ip, meta = {}) {
    this.logger.warn(`Security: ${event}`, {
      ...meta,
      event,
      user,
      ip,
      type: 'security'
    });
  }

  /**
   * Log AI operations
   */
  ai(operation, model, tokens, cost, meta = {}) {
    this.logger.info(`AI: ${operation}`, {
      ...meta,
      operation,
      model,
      tokens,
      cost,
      type: 'ai'
    });
  }

  /**
   * Log sync operations
   */
  sync(service, operation, count, duration, meta = {}) {
    this.logger.info(`Sync: ${service} ${operation}`, {
      ...meta,
      service,
      operation,
      count,
      duration,
      type: 'sync'
    });
  }

  /**
   * Create child logger with additional context
   */
  child(meta = {}) {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(meta);
    return childLogger;
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      level: this.logger.level,
      transports: this.logger.transports.map(t => ({
        name: t.name,
        level: t.level
      }))
    };
  }
}

// Create and export singleton instance
const logger = new Logger();

module.exports = logger;