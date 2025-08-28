const ConfigurationManager = require('../config/ConfigurationManager');
const logger = require('../utils/logger');

/**
 * Configuration validation middleware
 * Ensures all required environment variables are present and valid
 */
class ConfigurationMiddleware {
  constructor() {
    this.configManager = null;
    this.isInitialized = false;
  }

  /**
   * Initialize configuration manager
   */
  async initialize() {
    if (this.isInitialized) {
      return this.configManager;
    }

    try {
      this.configManager = new ConfigurationManager();
      await this.configManager.initialize();
      this.isInitialized = true;
      
      logger.info('Configuration middleware initialized successfully');
      return this.configManager;
    } catch (error) {
      logger.error('Failed to initialize configuration middleware', { error: error.message });
      throw error;
    }
  }

  /**
   * Express middleware to validate configuration on startup
   */
  validateOnStartup() {
    return async (req, res, next) => {
      try {
        if (!this.isInitialized) {
          await this.initialize();
        }
        
        // Add config to request object for easy access
        req.config = this.configManager.config;
        next();
      } catch (error) {
        logger.error('Configuration validation failed', { error: error.message });
        res.status(500).json({
          error: 'Configuration Error',
          message: 'Server configuration is invalid',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Please check server configuration'
        });
      }
    };
  }

  /**
   * Middleware to check specific configuration requirements
   */
  requireConfig(configPath, errorMessage) {
    return (req, res, next) => {
      if (!this.configManager) {
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Configuration not initialized'
        });
      }

      const value = this.configManager.get(configPath);
      if (!value) {
        logger.warn('Required configuration missing', { 
          path: configPath, 
          endpoint: req.path 
        });
        
        return res.status(503).json({
          error: 'Service Unavailable',
          message: errorMessage || `Required configuration missing: ${configPath}`
        });
      }

      next();
    };
  }

  /**
   * Middleware to validate AI service configuration
   */
  requireAIConfig() {
    return this.requireConfig('features.aiEnabled', 'AI features are not properly configured');
  }

  /**
   * Middleware to validate database configuration
   */
  requireDatabaseConfig() {
    return (req, res, next) => {
      if (!this.configManager) {
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Configuration not initialized'
        });
      }

      const dbConfig = this.configManager.get('database');
      if (!dbConfig || !dbConfig.supabase?.url) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Database configuration is incomplete'
        });
      }

      next();
    };
  }

  /**
   * Middleware to validate rate limiting configuration
   */
  requireRateLimitConfig() {
    return this.requireConfig('features.rateLimitingEnabled', 'Rate limiting is not properly configured');
  }

  /**
   * Get configuration manager instance
   */
  getConfigManager() {
    return this.configManager;
  }

  /**
   * Get sanitized configuration for health checks
   */
  getHealthCheckConfig() {
    if (!this.configManager) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'initialized',
      environment: this.configManager.config.nodeEnv,
      hasSecrets: this.configManager.hasRequiredSecrets(),
      features: this.configManager.config.features,
      database: {
        supabase: {
          configured: !!this.configManager.config.database.supabase.url
        },
        postgres: {
          configured: !!this.configManager.config.database.postgres.host
        },
        sqlite: {
          configured: !!this.configManager.config.database.sqlite.path
        },
        redis: {
          configured: !!this.configManager.config.database.redis.host
        }
      }
    };
  }

  /**
   * Startup validation checklist
   */
  async runStartupChecks() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const checks = [];
    
    // Check secrets
    checks.push({
      name: 'Security Secrets',
      status: this.configManager.hasRequiredSecrets() ? 'pass' : 'fail',
      message: this.configManager.hasRequiredSecrets() 
        ? 'All required secrets are present' 
        : 'Missing required security secrets'
    });

    // Check database configuration
    const dbConfig = this.configManager.get('database');
    checks.push({
      name: 'Database Configuration',
      status: (dbConfig?.supabase?.url && dbConfig?.postgres?.host) ? 'pass' : 'fail',
      message: (dbConfig?.supabase?.url && dbConfig?.postgres?.host)
        ? 'Database configuration is complete'
        : 'Database configuration is incomplete'
    });

    // Check environment file
    checks.push({
      name: 'Environment File',
      status: this.configManager.validateEnvironmentFile() ? 'pass' : 'warning',
      message: this.configManager.validateEnvironmentFile()
        ? '.env file is properly formatted'
        : '.env file has formatting issues or is missing'
    });

    // Check production readiness
    const isProduction = this.configManager.config.nodeEnv === 'production';
    if (isProduction) {
      const prodChecks = this.validateProductionReadiness();
      checks.push(...prodChecks);
    }

    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warning');

    logger.info('Configuration startup checks completed', {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: failedChecks.length,
      warnings: warningChecks.length,
      checks: checks
    });

    if (failedChecks.length > 0) {
      throw new Error(`Configuration validation failed: ${failedChecks.map(c => c.message).join(', ')}`);
    }

    return {
      status: 'success',
      checks,
      warnings: warningChecks.length
    };
  }

  /**
   * Validate production readiness
   */
  validateProductionReadiness() {
    const config = this.configManager.config;
    const checks = [];

    // Check for localhost URLs in production
    checks.push({
      name: 'Production URLs',
      status: (!config.database.supabase.url.includes('localhost') && 
               !config.cors.origin.includes('localhost')) ? 'pass' : 'warning',
      message: (!config.database.supabase.url.includes('localhost') && 
               !config.cors.origin.includes('localhost'))
        ? 'No localhost URLs detected in production'
        : 'Localhost URLs detected in production configuration'
    });

    // Check logging level
    checks.push({
      name: 'Production Logging',
      status: config.logging.level !== 'debug' ? 'pass' : 'warning',
      message: config.logging.level !== 'debug'
        ? 'Appropriate logging level for production'
        : 'Debug logging enabled in production'
    });

    // Check security features
    checks.push({
      name: 'Security Features',
      status: config.features.rateLimitingEnabled ? 'pass' : 'warning',
      message: config.features.rateLimitingEnabled
        ? 'Rate limiting is enabled'
        : 'Rate limiting is disabled in production'
    });

    return checks;
  }
}

// Create singleton instance
const configurationMiddleware = new ConfigurationMiddleware();

module.exports = configurationMiddleware;