const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const { z } = require('zod');

// Try to import logger, fallback to console if not available
let logger;
try {
  logger = require('../utils/logger');
} catch (e) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
}

/**
 * Secure Configuration Management System
 * Handles environment variables, validation, and security best practices
 */
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.schema = this.buildValidationSchema();
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
    this.configPath = path.join(process.cwd(), '.env');
  }

  /**
   * Initialize configuration with validation
   */
  async initialize() {
    try {
      await this.loadEnvironmentVariables();
      await this.validateConfiguration();
      await this.applySecurityDefaults();
      
      logger.info('Configuration Manager initialized successfully', {
        environment: this.environment,
        hasSecrets: this.hasRequiredSecrets(),
        configKeys: Object.keys(this.config).length
      });
      
      return this.config;
    } catch (error) {
      logger.error('Failed to initialize Configuration Manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Load and parse environment variables
   */
  async loadEnvironmentVariables() {
    // Load from .env file if exists
    if (fs.existsSync(this.configPath)) {
      require('dotenv').config({ path: this.configPath });
    }

    // Map environment variables to configuration object
    this.config = {
      // Server Configuration
      port: parseInt(process.env.PORT) || 8000,
      nodeEnv: process.env.NODE_ENV || 'development',
      
      // Security Configuration
      jwtSecret: process.env.JWT_SECRET,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
      sessionSecret: process.env.SESSION_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
      
      // Database Configuration
      database: {
        supabase: {
          url: process.env.SUPABASE_URL,
          anonKey: process.env.SUPABASE_ANON_KEY,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        postgres: {
          host: process.env.POSTGRES_HOST,
          port: parseInt(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DB,
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          url: process.env.DATABASE_URL
        },
        sqlite: {
          path: process.env.SQLITE_DB_PATH || './database/apple_mail_replica.db'
        },
        redis: {
          url: process.env.REDIS_URL,
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD
        }
      },
      
      // API Configuration
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true
      },
      
      // Rate Limiting
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        aiMaxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 10
      },
      
      // AI Services
      ai: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4',
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000
        },
        gpt5: {
          apiKey: process.env.GPT5_API_KEY
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY
        }
      },
      
      // Email/SMTP Configuration
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.EMAIL_FROM,
        senderName: process.env.SMTP_SENDER_NAME
      },
      
      // Frontend URLs
      frontend: {
        url: process.env.FRONTEND_URL || 'http://localhost:3000',
        apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000'
      },
      
      // Feature Flags
      features: {
        aiEnabled: process.env.ENABLE_AI_FEATURES === 'true',
        realTimeEnabled: process.env.ENABLE_REAL_TIME === 'true',
        analyticsEnabled: process.env.ENABLE_ANALYTICS === 'true',
        rateLimitingEnabled: process.env.ENABLE_RATE_LIMITING === 'true'
      },
      
      // File Upload Configuration
      upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        allowedTypes: process.env.ALLOWED_FILE_TYPES ? 
          process.env.ALLOWED_FILE_TYPES.split(',') : 
          ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.png']
      },
      
      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        filePath: process.env.LOG_FILE_PATH || './logs/app.log'
      }
    };
  }

  /**
   * Build Joi validation schema for configuration
   */
  buildValidationSchema() {
    return Joi.object({
      port: Joi.number().port().required(),
      nodeEnv: Joi.string().valid('development', 'production', 'test').required(),
      
      // Security secrets - required and must be strong
      jwtSecret: Joi.string().min(32).required().messages({
        'string.min': 'JWT_SECRET must be at least 32 characters long',
        'any.required': 'JWT_SECRET is required for security'
      }),
      jwtRefreshSecret: Joi.string().min(32).required().messages({
        'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters long',
        'any.required': 'JWT_REFRESH_SECRET is required for security'
      }),
      sessionSecret: Joi.string().min(32).required().messages({
        'string.min': 'SESSION_SECRET must be at least 32 characters long',
        'any.required': 'SESSION_SECRET is required for security'
      }),
      encryptionKey: Joi.string().min(32).required().messages({
        'string.min': 'ENCRYPTION_KEY must be at least 32 characters long',
        'any.required': 'ENCRYPTION_KEY is required for data encryption'
      }),
      
      // Database configuration
      database: Joi.object({
        supabase: Joi.object({
          url: Joi.string().uri().required(),
          anonKey: Joi.string().required(),
          serviceRoleKey: Joi.string().required()
        }).required(),
        postgres: Joi.object({
          host: Joi.string().required(),
          port: Joi.number().port().required(),
          database: Joi.string().required(),
          user: Joi.string().required(),
          password: Joi.string().required(),
          url: Joi.string().uri()
        }).required(),
        sqlite: Joi.object({
          path: Joi.string().required()
        }).required(),
        redis: Joi.object({
          url: Joi.string().uri(),
          host: Joi.string().required(),
          port: Joi.number().port().required(),
          password: Joi.string().allow('')
        }).required()
      }).required(),
      
      cors: Joi.object({
        origin: Joi.string().required(),
        credentials: Joi.boolean().required()
      }).required(),
      
      rateLimit: Joi.object({
        windowMs: Joi.number().min(1000).required(),
        maxRequests: Joi.number().min(1).required(),
        aiMaxRequests: Joi.number().min(1).required()
      }).required(),
      
      ai: Joi.object({
        openai: Joi.object({
          apiKey: Joi.string().allow(''),
          model: Joi.string().required(),
          maxTokens: Joi.number().min(1).required()
        }),
        gpt5: Joi.object({
          apiKey: Joi.string().allow('')
        }),
        anthropic: Joi.object({
          apiKey: Joi.string().allow('')
        }),
        gemini: Joi.object({
          apiKey: Joi.string().allow('')
        })
      }),
      
      smtp: Joi.object({
        host: Joi.string().allow(''),
        port: Joi.number().port(),
        user: Joi.string().allow(''),
        password: Joi.string().allow(''),
        from: Joi.string().email().allow(''),
        senderName: Joi.string().allow('')
      }),
      
      frontend: Joi.object({
        url: Joi.string().uri().required(),
        apiUrl: Joi.string().uri().required()
      }).required(),
      
      features: Joi.object({
        aiEnabled: Joi.boolean().required(),
        realTimeEnabled: Joi.boolean().required(),
        analyticsEnabled: Joi.boolean().required(),
        rateLimitingEnabled: Joi.boolean().required()
      }).required(),
      
      upload: Joi.object({
        maxFileSize: Joi.number().min(1).required(),
        allowedTypes: Joi.array().items(Joi.string()).required()
      }).required(),
      
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
        filePath: Joi.string().required()
      }).required()
    });
  }

  /**
   * Validate configuration against schema
   */
  async validateConfiguration() {
    const { error, value } = this.schema.validate(this.config, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.error('Configuration validation failed', { errors: validationErrors });
      
      throw new Error(`Configuration validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    // Additional security validations
    this.validateSecrets();
    this.validateProductionRequirements();
    
    this.config = value;
  }

  /**
   * Validate security secrets strength
   */
  validateSecrets() {
    const secrets = {
      JWT_SECRET: this.config.jwtSecret,
      JWT_REFRESH_SECRET: this.config.jwtRefreshSecret,
      SESSION_SECRET: this.config.sessionSecret,
      ENCRYPTION_KEY: this.config.encryptionKey
    };

    for (const [name, secret] of Object.entries(secrets)) {
      if (!secret) {
        throw new Error(`${name} is required`);
      }

      if (secret.length < 32) {
        throw new Error(`${name} must be at least 32 characters long`);
      }

      // Check for weak secrets in production
      if (this.isProduction && this.isWeakSecret(secret)) {
        throw new Error(`${name} appears to be a default or weak secret. Use a strong, randomly generated secret in production.`);
      }
    }
  }

  /**
   * Check if a secret is weak or default
   */
  isWeakSecret(secret) {
    const weakPatterns = [
      /super-secret/i,
      /changeme/i,
      /password/i,
      /secret/i,
      /default/i,
      /12345/,
      /abc/i,
      /test/i
    ];

    return weakPatterns.some(pattern => pattern.test(secret)) || 
           secret.length < 40; // Require stronger secrets in production
  }

  /**
   * Validate production-specific requirements
   */
  validateProductionRequirements() {
    if (!this.isProduction) return;

    const productionChecks = [
      {
        condition: this.config.database.supabase.url.includes('localhost'),
        message: 'Production environment should not use localhost for Supabase URL'
      },
      {
        condition: this.config.cors.origin.includes('localhost'),
        message: 'Production environment should not use localhost for CORS origin'
      },
      {
        condition: this.config.logging.level === 'debug',
        message: 'Production environment should not use debug logging level'
      }
    ];

    const failures = productionChecks.filter(check => check.condition);
    if (failures.length > 0) {
      logger.warn('Production configuration warnings', {
        warnings: failures.map(f => f.message)
      });
    }
  }

  /**
   * Apply security defaults and hardening
   */
  async applySecurityDefaults() {
    // Ensure secure defaults for production
    if (this.isProduction) {
      this.config.cors.credentials = true;
      
      // Ensure HTTPS in production URLs
      if (this.config.frontend.url.startsWith('http://') && 
          !this.config.frontend.url.includes('localhost')) {
        logger.warn('Frontend URL should use HTTPS in production');
      }
    }

    // Set security headers configuration
    this.config.security = {
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", this.config.database.supabase.url]
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }
    };
  }

  /**
   * Generate secure random secrets
   */
  static generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate JWT secret (256-bit)
   */
  static generateJWTSecret() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate session secret (256-bit)
   */
  static generateSessionSecret() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate encryption key (256-bit)
   */
  static generateEncryptionKey() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Check if all required secrets are present
   */
  hasRequiredSecrets() {
    return !!(this.config.jwtSecret && 
             this.config.jwtRefreshSecret && 
             this.config.sessionSecret && 
             this.config.encryptionKey);
  }

  /**
   * Get configuration value by path
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Get all configuration (sanitized for logging)
   */
  getSanitizedConfig() {
    const sanitized = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive data
    const sensitiveKeys = [
      'jwtSecret', 'jwtRefreshSecret', 'sessionSecret', 'encryptionKey'
    ];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    // Sanitize nested objects
    if (sanitized.database?.postgres?.password) {
      sanitized.database.postgres.password = '[REDACTED]';
    }
    
    if (sanitized.database?.redis?.password) {
      sanitized.database.redis.password = '[REDACTED]';
    }
    
    if (sanitized.ai?.openai?.apiKey) {
      sanitized.ai.openai.apiKey = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Validate environment file exists and is properly formatted
   */
  validateEnvironmentFile() {
    if (!fs.existsSync(this.configPath)) {
      logger.warn('.env file not found. Using environment variables and defaults.');
      return false;
    }
    
    const content = fs.readFileSync(this.configPath, 'utf8');
    const lines = content.split('\n');
    
    const issues = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.includes('=')) {
        issues.push(`Line ${index + 1}: Invalid format - missing '=' separator`);
      }
    });
    
    if (issues.length > 0) {
      logger.warn('.env file formatting issues detected', { issues });
    }
    
    return issues.length === 0;
  }

  /**
   * Create secure .env.example file
   */
  static async createSecureEnvExample(outputPath) {
    const exampleContent = `# Apple Mail Task Manager - Environment Configuration
# Copy this file to .env and update the values with your actual secrets

# ================================
# CRITICAL SECURITY CONFIGURATION
# ================================
# Generate secure secrets using:
# node -e "const crypto = require('crypto'); console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('base64url'));"

JWT_SECRET=${this.generateJWTSecret()}
JWT_REFRESH_SECRET=${this.generateJWTSecret()}
SESSION_SECRET=${this.generateSessionSecret()}
ENCRYPTION_KEY=${this.generateEncryptionKey()}

# ================================
# Supabase Configuration
# ================================
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# React App Supabase (for frontend)
REACT_APP_SUPABASE_URL=http://localhost:8000
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# ================================
# Database Configuration
# ================================
# Local SQLite Database
SQLITE_DB_PATH=./database/apple_mail_replica.db

# PostgreSQL (Supabase)
DATABASE_URL=postgresql://supabase_admin:your_postgres_password@localhost:5432/postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=supabase_admin
POSTGRES_PASSWORD=your_postgres_password

# Redis Configuration
REDIS_URL=redis://:redis_secure_password_2024@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_secure_password_2024

# ================================
# AI Services Configuration
# ================================
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
GPT5_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# ================================
# Application Configuration
# ================================
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development

# ================================
# Security & Rate Limiting
# ================================
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AI_RATE_LIMIT_MAX_REQUESTS=10

# ================================
# Feature Flags
# ================================
ENABLE_AI_FEATURES=true
ENABLE_REAL_TIME=true
ENABLE_ANALYTICS=true

# ================================
# File Upload Configuration
# ================================
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.pdf,.doc,.docx,.txt,.jpg,.png

# ================================
# Logging Configuration
# ================================
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# ================================
# Email/SMTP Configuration
# ================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
SMTP_SENDER_NAME=Apple MCP Task Manager

# ================================
# External APIs (Optional)
# ================================
GITHUB_TOKEN=
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=

# ================================
# Cloud Storage (Optional)
# ================================
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# ================================
# OAuth (Optional)
# ================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=`;

    fs.writeFileSync(outputPath, exampleContent);
    logger.info('Secure .env.example file created', { path: outputPath });
  }
}

module.exports = ConfigurationManager;