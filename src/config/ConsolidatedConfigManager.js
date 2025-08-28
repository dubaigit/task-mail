/**
 * Consolidated Configuration Management System
 * Apple Mail Task Manager - Phase 4 Configuration Management
 * 
 * FEATURES:
 * - Reduced from 143+ to 49 environment variables (≤50 target achieved)
 * - Zod validation schemas for type safety and validation
 * - Environment-specific configuration inheritance 
 * - Secure secret management integration
 * - Configuration change audit logging
 * - Backward compatibility with legacy variables
 * - Zero-downtime configuration migration
 */

const { z } = require('zod');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Try to load dotenv
try {
  require('dotenv').config();
} catch (e) {
  console.warn('dotenv not available, using system environment variables');
}

// Consolidated Configuration Schemas (≤50 Variables Total)
const AppConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().int().min(1000).max(65535).default(8000),
  baseUrl: z.string().url().default('http://localhost:8000'),
  frontendUrl: z.string().url().default('http://localhost:3000'),
  apiVersion: z.string().default('v1'),
  corsOrigins: z.union([
    z.string().transform(str => str.split(',').map(s => s.trim())),
    z.array(z.string())
  ]).default('http://localhost:3000')
});

const DatabaseConfigSchema = z.object({
  primaryUrl: z.string().min(1).describe('Primary database connection URL'),
  replicaUrl: z.string().optional().describe('Read replica database URL'),
  cacheUrl: z.string().optional().describe('Redis cache URL'),
  maxConnections: z.coerce.number().int().min(1).max(100).default(20),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(30000),
  sslEnabled: z.coerce.boolean().default(false),
  loggingEnabled: z.coerce.boolean().default(false),
  migrationAuto: z.coerce.boolean().default(false)
});

const AuthConfigSchema = z.object({
  jwtSecret: z.string().min(32).describe('JWT signing secret (min 32 chars)'),
  sessionSecret: z.string().min(32).describe('Session signing secret (min 32 chars)'),
  encryptionKey: z.string().min(32).describe('Data encryption key (min 32 chars)'),
  tokenExpiryMinutes: z.coerce.number().int().min(5).max(1440).default(60)
});

const ExternalServicesSchema = z.object({
  openaiApiKey: z.string().optional().describe('OpenAI API key'),
  anthropicApiKey: z.string().optional().describe('Anthropic Claude API key'),
  oauthGoogleClientId: z.string().optional().describe('Google OAuth client ID'),
  oauthGoogleSecret: z.string().optional().describe('Google OAuth client secret'),
  oauthGithubClientId: z.string().optional().describe('GitHub OAuth client ID'),
  oauthGithubSecret: z.string().optional().describe('GitHub OAuth client secret'),
  monitoringSentryDsn: z.string().optional().describe('Sentry monitoring DSN'),
  monitoringAnalyticsKey: z.string().optional().describe('Analytics service key')
});

const FeatureConfigSchema = z.object({
  aiEnabled: z.coerce.boolean().default(true),
  realtimeEnabled: z.coerce.boolean().default(true),
  analyticsEnabled: z.coerce.boolean().default(true),
  advancedEnabled: z.coerce.boolean().default(false),
  experimentalEnabled: z.coerce.boolean().default(false)
});

const PerformanceConfigSchema = z.object({
  maxWorkers: z.coerce.number().int().min(1).max(16).default(4),
  maxConnections: z.coerce.number().int().min(10).max(1000).default(100),
  memoryLimitMb: z.coerce.number().int().min(128).max(8192).default(512),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(30000),
  cacheSizeMb: z.coerce.number().int().min(10).max(1024).default(128),
  batchSize: z.coerce.number().int().min(1).max(1000).default(50)
});

const RateLimitConfigSchema = z.object({
  requestsPerMinute: z.coerce.number().int().min(1).max(10000).default(100),
  aiRequestsPerMinute: z.coerce.number().int().min(1).max(1000).default(10),
  burstCapacity: z.coerce.number().int().min(1).max(100).default(20)
});

const CommunicationConfigSchema = z.object({
  smtpUrl: z.string().optional().describe('Complete SMTP URL (smtp://user:pass@host:port)'),
  emailFrom: z.string().email().optional().describe('Default sender email address'),
  webhooksEnabled: z.coerce.boolean().default(false),
  cacheUrl: z.string().optional().describe('Cache service URL'),
  notificationsEnabled: z.coerce.boolean().default(true)
});

const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  filePath: z.string().default('./logs/app.log'),
  maxSizeMb: z.coerce.number().int().min(1).max(1000).default(10),
  monitoringEnabled: z.coerce.boolean().default(true)
});

// Complete Configuration Schema (49 total variables)
const ConsolidatedConfigSchema = z.object({
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  external: ExternalServicesSchema,
  features: FeatureConfigSchema,
  performance: PerformanceConfigSchema,
  rateLimit: RateLimitConfigSchema,
  communication: CommunicationConfigSchema,
  logging: LoggingConfigSchema
});

class ConsolidatedConfigManager {
  constructor() {
    this.config = null;
    this.legacyMapping = this.createLegacyMapping();
    this.auditLog = [];
    this.configChangeCallbacks = new Set();
    this.secretsManager = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the consolidated configuration manager
   * @param {Object} options - Initialization options
   * @returns {Promise<Object>} Validated configuration object
   */
  async initialize(options = {}) {
    try {
      console.log('🔧 Initializing Consolidated Configuration Manager...');
      
      // Load environment variables from files
      this.loadEnvironmentFiles();
      
      // Build configuration from environment
      const rawConfig = this.buildConsolidatedConfig();
      
      // Validate against schema
      this.config = ConsolidatedConfigSchema.parse(rawConfig);
      
      // Apply environment-specific overrides
      this.applyEnvironmentOverrides();
      
      // Initialize secrets management
      if (options.secretsManager) {
        this.secretsManager = options.secretsManager;
        await this.loadSecretsFromManager();
      }
      
      // Validate critical configuration
      this.validateCriticalConfig();
      
      // Log audit entry
      this.auditConfigChange('INITIALIZED', {
        totalVariables: this.getTotalVariableCount(),
        environment: this.config.app.environment,
        timestamp: new Date().toISOString()
      });
      
      this.isInitialized = true;
      
      console.log(`✅ Configuration Manager initialized successfully`);
      console.log(`📊 Environment: ${this.config.app.environment}`);
      console.log(`🔢 Total variables: ${this.getTotalVariableCount()} (target: ≤50)`);
      console.log(`🔐 Secrets validation: ${this.hasRequiredSecrets() ? '✅ Pass' : '❌ Fail'}`);
      
      return this.config;
      
    } catch (error) {
      console.error('❌ Configuration initialization failed:', error.message);
      
      if (error instanceof z.ZodError) {
        console.error('🔍 Validation errors:');
        error.issues.forEach((issue, index) => {
          console.error(`  ${index + 1}. ${issue.path.join('.')}: ${issue.message}`);
          if (issue.received) {
            console.error(`     Received: ${issue.received}`);
          }
        });
      }
      
      throw new Error(`Configuration Manager initialization failed: ${error.message}`);
    }
  }

  /**
   * Build consolidated configuration from environment variables
   * @returns {Object} Raw configuration object
   */
  buildConsolidatedConfig() {
    return {
      app: {
        environment: process.env.APP_ENVIRONMENT || process.env.NODE_ENV || 'development',
        port: process.env.APP_PORT || process.env.PORT || 8000,
        baseUrl: process.env.APP_BASE_URL || this.getLegacyEnvValue(['BACKEND_URL', 'API_EXTERNAL_URL'], 'http://localhost:8000'),
        frontendUrl: process.env.APP_FRONTEND_URL || this.getLegacyEnvValue(['FRONTEND_URL', 'SITE_URL'], 'http://localhost:3000'),
        apiVersion: process.env.APP_API_VERSION || 'v1',
        corsOrigins: process.env.APP_CORS_ORIGINS || this.getLegacyEnvValue(['CORS_ORIGIN', 'CORS_ORIGINS'], 'http://localhost:3000')
      },
      
      database: {
        primaryUrl: process.env.DATABASE_PRIMARY_URL || this.getLegacyEnvValue(['DATABASE_URL', 'POSTGRES_URL'], this.buildPostgresUrl()),
        replicaUrl: process.env.DATABASE_REPLICA_URL,
        cacheUrl: process.env.DATABASE_CACHE_URL || this.getLegacyEnvValue(['REDIS_URL'], this.buildRedisUrl()),
        maxConnections: process.env.DATABASE_MAX_CONNECTIONS || this.getLegacyEnvValue(['DB_MAX_CONNECTIONS', 'DATABASE_POOL_SIZE'], 20),
        timeoutMs: process.env.DATABASE_TIMEOUT_MS || this.getLegacyEnvValue(['DATABASE_TIMEOUT'], 30000),
        sslEnabled: process.env.DATABASE_SSL_ENABLED || (process.env.NODE_ENV === 'production'),
        loggingEnabled: process.env.DATABASE_LOGGING_ENABLED || (process.env.NODE_ENV === 'development'),
        migrationAuto: process.env.DATABASE_MIGRATION_AUTO || false
      },
      
      auth: {
        jwtSecret: process.env.AUTH_JWT_SECRET || this.getLegacyEnvValue(['JWT_SECRET', 'SECRET_KEY'], ''),
        sessionSecret: process.env.AUTH_SESSION_SECRET || process.env.SESSION_SECRET || '',
        encryptionKey: process.env.AUTH_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '',
        tokenExpiryMinutes: process.env.AUTH_TOKEN_EXPIRY_MINUTES || this.getLegacyEnvValue(['ACCESS_TOKEN_EXPIRE_MINUTES'], 60)
      },
      
      external: {
        openaiApiKey: process.env.EXTERNAL_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.EXTERNAL_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        oauthGoogleClientId: process.env.EXTERNAL_OAUTH_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        oauthGoogleSecret: process.env.EXTERNAL_OAUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
        oauthGithubClientId: process.env.EXTERNAL_OAUTH_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
        oauthGithubSecret: process.env.EXTERNAL_OAUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET,
        monitoringSentryDsn: process.env.MONITORING_SENTRY_DSN || process.env.SENTRY_DSN,
        monitoringAnalyticsKey: process.env.MONITORING_ANALYTICS_KEY || this.getLegacyEnvValue(['GOOGLE_ANALYTICS_ID', 'DATADOG_API_KEY'], '')
      },
      
      features: {
        aiEnabled: this.parseBoolean(process.env.FEATURES_AI_ENABLED || this.getLegacyEnvValue(['ENABLE_AI_FEATURES'], 'true')),
        realtimeEnabled: this.parseBoolean(process.env.FEATURES_REALTIME_ENABLED || this.getLegacyEnvValue(['ENABLE_REAL_TIME'], 'true')),
        analyticsEnabled: this.parseBoolean(process.env.FEATURES_ANALYTICS_ENABLED || this.getLegacyEnvValue(['ENABLE_ANALYTICS'], 'true')),
        advancedEnabled: this.parseBoolean(process.env.FEATURES_ADVANCED_ENABLED || this.getLegacyEnvValue(['FEATURE_BATCH_PROCESSING'], 'false')),
        experimentalEnabled: this.parseBoolean(process.env.FEATURES_EXPERIMENTAL_ENABLED || 'false')
      },
      
      performance: {
        maxWorkers: process.env.PERFORMANCE_MAX_WORKERS || this.getLegacyEnvValue(['WORKERS'], 4),
        maxConnections: process.env.PERFORMANCE_MAX_CONNECTIONS || this.getLegacyEnvValue(['MAX_CONNECTIONS'], 100),
        memoryLimitMb: process.env.PERFORMANCE_MEMORY_LIMIT_MB || this.getLegacyEnvValue(['WORKER_MAX_MEMORY_MB'], 512),
        timeoutMs: process.env.PERFORMANCE_TIMEOUT_MS || this.getLegacyEnvValue(['TIMEOUT_KEEP_ALIVE'], 30000),
        cacheSizeMb: process.env.PERFORMANCE_CACHE_SIZE_MB || this.getLegacyEnvValue(['CACHE_MAX_MEMORY_MB'], 128),
        batchSize: process.env.PERFORMANCE_BATCH_SIZE || this.getLegacyEnvValue(['EMAIL_BATCH_SIZE'], 50)
      },
      
      rateLimit: {
        requestsPerMinute: process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || this.getLegacyEnvValue(['API_RATE_LIMIT_PER_MINUTE'], 100),
        aiRequestsPerMinute: process.env.RATE_LIMIT_AI_REQUESTS_PER_MINUTE || this.getLegacyEnvValue(['AI_REQUESTS_PER_MINUTE'], 10),
        burstCapacity: process.env.RATE_LIMIT_BURST_CAPACITY || this.getLegacyEnvValue(['AI_BURST_CAPACITY'], 20)
      },
      
      communication: {
        smtpUrl: process.env.COMMUNICATION_SMTP_URL || this.buildSmtpUrl(),
        emailFrom: process.env.COMMUNICATION_EMAIL_FROM || process.env.EMAIL_FROM,
        webhooksEnabled: this.parseBoolean(process.env.COMMUNICATION_WEBHOOKS_ENABLED || 'false'),
        cacheUrl: process.env.COMMUNICATION_CACHE_URL || process.env.REDIS_URL || this.buildRedisUrl(),
        notificationsEnabled: this.parseBoolean(process.env.COMMUNICATION_NOTIFICATIONS_ENABLED || 'true')
      },
      
      logging: {
        level: process.env.LOGGING_LEVEL || this.getLegacyEnvValue(['LOG_LEVEL'], 'info'),
        filePath: process.env.LOGGING_FILE_PATH || this.getLegacyEnvValue(['LOG_FILE_PATH'], './logs/app.log'),
        maxSizeMb: process.env.LOGGING_MAX_SIZE_MB || 10,
        monitoringEnabled: this.parseBoolean(process.env.MONITORING_ENABLED || this.getLegacyEnvValue(['METRICS_ENABLED'], 'true'))
      }
    };
  }

  /**
   * Get legacy environment variable value with fallbacks
   * @param {string[]} legacyKeys - Array of legacy environment variable names
   * @param {any} defaultValue - Default value if none found
   * @returns {any} Found value or default
   */
  getLegacyEnvValue(legacyKeys, defaultValue = undefined) {
    for (const key of legacyKeys) {
      if (process.env[key] !== undefined) {
        return process.env[key];
      }
    }
    return defaultValue;
  }

  /**
   * Parse boolean values from strings
   * @param {any} value - Value to parse
   * @returns {boolean} Parsed boolean
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
  }

  /**
   * Build PostgreSQL URL from individual components
   * @returns {string} Complete PostgreSQL URL or empty string
   */
  buildPostgresUrl() {
    const host = process.env.POSTGRES_HOST || process.env.DB_HOST;
    const port = process.env.POSTGRES_PORT || process.env.DB_PORT || '5432';
    const database = process.env.POSTGRES_DB || process.env.DB_NAME;
    const username = process.env.POSTGRES_USER || process.env.DB_USER;
    const password = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;

    if (host && database && username && password) {
      return `postgresql://${username}:${password}@${host}:${port}/${database}`;
    }
    return '';
  }

  /**
   * Build Redis URL from individual components
   * @returns {string} Complete Redis URL or empty string
   */
  buildRedisUrl() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;

    if (password) {
      return `redis://:${password}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
  }

  /**
   * Build SMTP URL from individual components
   * @returns {string|undefined} Complete SMTP URL or undefined
   */
  buildSmtpUrl() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || '587';
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;

    if (host && user && password) {
      return `smtp://${user}:${password}@${host}:${port}`;
    }
    return undefined;
  }

  /**
   * Apply environment-specific configuration overrides
   */
  applyEnvironmentOverrides() {
    const env = this.config.app.environment;

    switch (env) {
      case 'production':
        this.config.database.sslEnabled = true;
        this.config.database.loggingEnabled = false;
        this.config.logging.level = 'warn';
        this.config.features.experimentalEnabled = false;
        this.config.performance.maxWorkers = Math.max(2, this.config.performance.maxWorkers);
        break;

      case 'staging':
        this.config.database.sslEnabled = true;
        this.config.logging.level = 'info';
        this.config.features.advancedEnabled = true;
        break;

      case 'development':
        this.config.database.loggingEnabled = true;
        this.config.logging.level = 'debug';
        this.config.features.experimentalEnabled = true;
        break;
    }
  }

  /**
   * Load environment variables from various .env files
   */
  loadEnvironmentFiles() {
    const envFiles = [
      '.env.local',
      `.env.${process.env.NODE_ENV}`,
      '.env'
    ];

    for (const envFile of envFiles) {
      const envPath = path.resolve(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        try {
          const dotenv = require('dotenv');
          dotenv.config({ path: envPath, override: false });
          console.log(`📄 Loaded environment variables from ${envFile}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load ${envFile}:`, error.message);
        }
      }
    }
  }

  /**
   * Load secrets from external secrets manager
   */
  async loadSecretsFromManager() {
    if (!this.secretsManager) return;

    try {
      const secrets = await this.secretsManager.getSecrets([
        'AUTH_JWT_SECRET',
        'AUTH_SESSION_SECRET', 
        'AUTH_ENCRYPTION_KEY',
        'EXTERNAL_OPENAI_API_KEY',
        'EXTERNAL_ANTHROPIC_API_KEY'
      ]);

      // Override configuration with secrets from manager
      Object.keys(secrets).forEach(key => {
        const path = this.getConfigPathForSecret(key);
        if (path) {
          this.setConfigValue(path, secrets[key]);
        }
      });

      console.log('🔐 Secrets loaded from external manager');
    } catch (error) {
      console.error('❌ Failed to load secrets from manager:', error.message);
    }
  }

  /**
   * Map secret environment variable to configuration path
   * @param {string} secretKey - Secret environment variable name
   * @returns {string|null} Configuration path
   */
  getConfigPathForSecret(secretKey) {
    const secretMapping = {
      'AUTH_JWT_SECRET': 'auth.jwtSecret',
      'AUTH_SESSION_SECRET': 'auth.sessionSecret',
      'AUTH_ENCRYPTION_KEY': 'auth.encryptionKey',
      'EXTERNAL_OPENAI_API_KEY': 'external.openaiApiKey',
      'EXTERNAL_ANTHROPIC_API_KEY': 'external.anthropicApiKey'
    };
    
    return secretMapping[secretKey] || null;
  }

  /**
   * Set configuration value by path
   * @param {string} path - Configuration path (e.g., 'auth.jwtSecret')
   * @param {any} value - Value to set
   */
  setConfigValue(path, value) {
    const keys = path.split('.');
    let target = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[keys[keys.length - 1]] = value;
  }

  /**
   * Validate critical configuration requirements
   */
  validateCriticalConfig() {
    const criticalSecrets = ['auth.jwtSecret', 'auth.sessionSecret', 'auth.encryptionKey'];
    const missingSecrets = criticalSecrets.filter(path => !this.getConfigValue(path));
    
    if (missingSecrets.length > 0) {
      throw new Error(`Critical secrets missing: ${missingSecrets.join(', ')}`);
    }

    if (!this.config.database.primaryUrl) {
      throw new Error('DATABASE_PRIMARY_URL is required');
    }

    // Production-specific validations
    if (this.config.app.environment === 'production') {
      if (this.config.database.primaryUrl.includes('localhost')) {
        console.warn('⚠️ Production database should not use localhost');
      }
      
      if (this.config.app.frontendUrl.includes('localhost')) {
        console.warn('⚠️ Production frontend URL should not use localhost');
      }
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Configuration path (e.g., 'database.maxConnections')
   * @returns {any} Configuration value
   */
  getConfigValue(path) {
    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if all required secrets are present
   * @returns {boolean} True if all required secrets are present
   */
  hasRequiredSecrets() {
    const requiredSecrets = ['auth.jwtSecret', 'auth.sessionSecret', 'auth.encryptionKey'];
    return requiredSecrets.every(path => this.getConfigValue(path));
  }

  /**
   * Get total count of configuration variables
   * @returns {number} Total variable count
   */
  getTotalVariableCount() {
    let count = 0;

    const countObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          countObject(obj[key]);
        } else {
          count++;
        }
      }
    };

    countObject(this.config);
    return count;
  }

  /**
   * Audit configuration changes
   * @param {string} action - Action type
   * @param {Object} details - Change details
   */
  auditConfigChange(action, details) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      environment: this.config?.app?.environment || 'unknown',
      configHash: this.generateConfigHash()
    };

    this.auditLog.push(auditEntry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Generate configuration hash for change detection
   * @returns {string} MD5 hash of configuration
   */
  generateConfigHash() {
    const configString = JSON.stringify(this.exportSafeConfig(), null, 0);
    return crypto.createHash('md5').update(configString).digest('hex');
  }

  /**
   * Export configuration with secrets masked
   * @returns {Object} Safe configuration object
   */
  exportSafeConfig() {
    const safeConfig = JSON.parse(JSON.stringify(this.config));
    
    // Mask sensitive values
    const sensitiveKeys = ['secret', 'key', 'password', 'token', 'dsn'];
    
    const maskSensitive = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          maskSensitive(obj[key]);
        } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = obj[key] ? '***MASKED***' : obj[key];
        }
      }
    };
    
    maskSensitive(safeConfig);
    return safeConfig;
  }

  /**
   * Get configuration health status
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const validation = this.validateConfig();
    const criticalSecrets = ['auth.jwtSecret', 'auth.sessionSecret', 'auth.encryptionKey'];
    const missingSecrets = criticalSecrets.filter(path => !this.getConfigValue(path));

    return {
      isHealthy: validation.isValid && missingSecrets.length === 0,
      environment: this.config.app.environment,
      totalVariables: this.getTotalVariableCount(),
      targetAchieved: this.getTotalVariableCount() <= 50,
      validationErrors: validation.errors,
      missingSecrets,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Validate current configuration
   * @returns {Object} Validation result
   */
  validateConfig() {
    try {
      ConsolidatedConfigSchema.parse(this.config);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, errors: error.issues };
      }
      return { isValid: false, errors: [error.message] };
    }
  }

  /**
   * Create legacy variable mapping for backward compatibility
   * @returns {Map} Legacy variable mapping
   */
  createLegacyMapping() {
    return new Map([
      // Application
      ['NODE_ENV', 'APP_ENVIRONMENT'],
      ['PORT', 'APP_PORT'],
      ['API_EXTERNAL_URL', 'APP_BASE_URL'],
      ['BACKEND_URL', 'APP_BASE_URL'],
      ['FRONTEND_URL', 'APP_FRONTEND_URL'],
      ['CORS_ORIGIN', 'APP_CORS_ORIGINS'],

      // Database
      ['DATABASE_URL', 'DATABASE_PRIMARY_URL'],
      ['POSTGRES_URL', 'DATABASE_PRIMARY_URL'],
      ['DB_MAX_CONNECTIONS', 'DATABASE_MAX_CONNECTIONS'],
      ['DATABASE_POOL_SIZE', 'DATABASE_MAX_CONNECTIONS'],
      ['DATABASE_TIMEOUT', 'DATABASE_TIMEOUT_MS'],
      ['REDIS_URL', 'DATABASE_CACHE_URL'],

      // Authentication
      ['JWT_SECRET', 'AUTH_JWT_SECRET'],
      ['SECRET_KEY', 'AUTH_JWT_SECRET'],
      ['SESSION_SECRET', 'AUTH_SESSION_SECRET'],
      ['ENCRYPTION_KEY', 'AUTH_ENCRYPTION_KEY'],

      // External Services
      ['OPENAI_API_KEY', 'EXTERNAL_OPENAI_API_KEY'],
      ['ANTHROPIC_API_KEY', 'EXTERNAL_ANTHROPIC_API_KEY'],
      ['GOOGLE_CLIENT_ID', 'EXTERNAL_OAUTH_GOOGLE_CLIENT_ID'],
      ['GOOGLE_CLIENT_SECRET', 'EXTERNAL_OAUTH_GOOGLE_SECRET'],

      // Features
      ['ENABLE_AI_FEATURES', 'FEATURES_AI_ENABLED'],
      ['ENABLE_REAL_TIME', 'FEATURES_REALTIME_ENABLED'],
      ['ENABLE_ANALYTICS', 'FEATURES_ANALYTICS_ENABLED'],

      // Performance
      ['WORKERS', 'PERFORMANCE_MAX_WORKERS'],
      ['MAX_CONNECTIONS', 'PERFORMANCE_MAX_CONNECTIONS'],
      ['WORKER_MAX_MEMORY_MB', 'PERFORMANCE_MEMORY_LIMIT_MB'],

      // Rate Limiting
      ['API_RATE_LIMIT_PER_MINUTE', 'RATE_LIMIT_REQUESTS_PER_MINUTE'],
      ['AI_REQUESTS_PER_MINUTE', 'RATE_LIMIT_AI_REQUESTS_PER_MINUTE'],

      // Communication
      ['EMAIL_FROM', 'COMMUNICATION_EMAIL_FROM'],
      ['REDIS_URL', 'COMMUNICATION_CACHE_URL'],

      // Logging
      ['LOG_LEVEL', 'LOGGING_LEVEL'],
      ['LOG_FILE_PATH', 'LOGGING_FILE_PATH']
    ]);
  }

  /**
   * Generate secure secrets for missing values
   * @returns {Object} Generated secrets
   */
  static generateSecrets() {
    return {
      AUTH_JWT_SECRET: crypto.randomBytes(32).toString('base64url'),
      AUTH_SESSION_SECRET: crypto.randomBytes(32).toString('base64url'),
      AUTH_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url')
    };
  }

  /**
   * Export consolidated .env.example file
   * @param {string} outputPath - Output file path
   */
  async exportConsolidatedEnvExample(outputPath) {
    const secrets = ConsolidatedConfigManager.generateSecrets();
    
    const envTemplate = `# Apple Mail Task Manager - Consolidated Environment Configuration
# PHASE 4: Configuration Management - Reduced from 143+ to 49 variables (≤50 target achieved)
# Copy this file to .env and update the values

# ================================
# APPLICATION CONFIGURATION (6 variables)
# ================================
APP_ENVIRONMENT=development
APP_PORT=8000
APP_BASE_URL=http://localhost:8000
APP_FRONTEND_URL=http://localhost:3000
APP_API_VERSION=v1
APP_CORS_ORIGINS=http://localhost:3000

# ================================
# DATABASE CONFIGURATION (8 variables)
# ================================
DATABASE_PRIMARY_URL=postgresql://user:password@localhost:5432/database
DATABASE_REPLICA_URL=
DATABASE_CACHE_URL=redis://localhost:6379
DATABASE_MAX_CONNECTIONS=20
DATABASE_TIMEOUT_MS=30000
DATABASE_SSL_ENABLED=false
DATABASE_LOGGING_ENABLED=false
DATABASE_MIGRATION_AUTO=false

# ================================
# AUTHENTICATION CONFIGURATION (4 variables)
# ================================
# CRITICAL: Use generated secrets below or generate your own
AUTH_JWT_SECRET=${secrets.AUTH_JWT_SECRET}
AUTH_SESSION_SECRET=${secrets.AUTH_SESSION_SECRET}
AUTH_ENCRYPTION_KEY=${secrets.AUTH_ENCRYPTION_KEY}
AUTH_TOKEN_EXPIRY_MINUTES=60

# ================================
# EXTERNAL SERVICES CONFIGURATION (8 variables)
# ================================
EXTERNAL_OPENAI_API_KEY=
EXTERNAL_ANTHROPIC_API_KEY=
EXTERNAL_OAUTH_GOOGLE_CLIENT_ID=
EXTERNAL_OAUTH_GOOGLE_SECRET=
EXTERNAL_OAUTH_GITHUB_CLIENT_ID=
EXTERNAL_OAUTH_GITHUB_SECRET=
MONITORING_SENTRY_DSN=
MONITORING_ANALYTICS_KEY=

# ================================
# FEATURE FLAGS CONFIGURATION (5 variables)
# ================================
FEATURES_AI_ENABLED=true
FEATURES_REALTIME_ENABLED=true
FEATURES_ANALYTICS_ENABLED=true
FEATURES_ADVANCED_ENABLED=false
FEATURES_EXPERIMENTAL_ENABLED=false

# ================================
# PERFORMANCE CONFIGURATION (6 variables)
# ================================
PERFORMANCE_MAX_WORKERS=4
PERFORMANCE_MAX_CONNECTIONS=100
PERFORMANCE_MEMORY_LIMIT_MB=512
PERFORMANCE_TIMEOUT_MS=30000
PERFORMANCE_CACHE_SIZE_MB=128
PERFORMANCE_BATCH_SIZE=50

# ================================
# RATE LIMITING CONFIGURATION (3 variables)
# ================================
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_AI_REQUESTS_PER_MINUTE=10
RATE_LIMIT_BURST_CAPACITY=20

# ================================
# COMMUNICATION CONFIGURATION (5 variables)
# ================================
COMMUNICATION_SMTP_URL=smtp://user:password@smtp.gmail.com:587
COMMUNICATION_EMAIL_FROM=noreply@yourdomain.com
COMMUNICATION_WEBHOOKS_ENABLED=false
COMMUNICATION_CACHE_URL=redis://localhost:6379
COMMUNICATION_NOTIFICATIONS_ENABLED=true

# ================================
# LOGGING & MONITORING CONFIGURATION (4 variables)
# ================================
LOGGING_LEVEL=info
LOGGING_FILE_PATH=./logs/app.log
LOGGING_MAX_SIZE_MB=10
MONITORING_ENABLED=true

# ================================
# TOTAL: 49 Variables (≤50 target achieved!)
# ================================

# MIGRATION NOTE:
# This configuration is backward compatible with legacy variables.
# You can continue using old variable names during the migration period.
# The system will automatically map legacy variables to new consolidated ones.

# SECURITY NOTE:
# - All secrets above are randomly generated
# - Replace with your actual values
# - Never commit actual secrets to version control
# - Consider using a secret management service in production

# VALIDATION:
# Run 'node -e "require('./src/config/ConsolidatedConfigManager').initialize()"' to validate
`;

    fs.writeFileSync(outputPath, envTemplate);
    console.log(`📄 Consolidated .env.example created at: ${outputPath}`);
    console.log(`🔢 Total variables: 49 (≤50 target achieved)`);
    console.log(`🔐 Secure secrets generated automatically`);
  }

  /**
   * Get audit log entries
   * @param {number} limit - Maximum entries to return
   * @returns {Array} Audit log entries
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }
}

module.exports = { ConsolidatedConfigManager, ConsolidatedConfigSchema };