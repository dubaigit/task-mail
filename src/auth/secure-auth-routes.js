/**
 * Secure Authentication Routes - Phase 1 Emergency Security
 * Replaces mock authentication with proper security controls
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Environment-based secrets (development-friendly for local use)
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('⚠️ WARNING: Using default JWT_SECRET for development');
  return 'development_jwt_secret_key_32_characters_minimum_required';
})();

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_REFRESH_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('⚠️ WARNING: Using default JWT_REFRESH_SECRET for development');
  return 'development_refresh_secret_key_32_characters_minimum';
})();

// Secure session storage (use Redis in production)
const refreshTokens = new Map();
const loginAttempts = new Map();
const blacklistedTokens = new Set();

// Rate limiting disabled for local development
const strictAuthLimiter = (req, res, next) => next();

// Input validation middleware
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email too long'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character')
];

const tokenValidation = [
  body('refreshToken')
    .isString()
    .withMessage('Refresh token required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Invalid token format')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      }
    });
  }
  next();
};

// Demo users with hashed passwords (replace with database in production)
let SECURE_USERS = null;

// Initialize secure users with proper password hashing
const initializeSecureUsers = async () => {
  if (SECURE_USERS) return SECURE_USERS;
  
  try {
    SECURE_USERS = [
      {
        id: uuidv4(),
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('SecureAdmin@2024', 12),
        role: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        createdAt: new Date().toISOString(),
        active: true
      },
      {
        id: uuidv4(),
        email: 'user@example.com',
        passwordHash: await bcrypt.hash('SecureUser@2024', 12),
        role: 'user',
        firstName: 'Demo',
        lastName: 'User',
        createdAt: new Date().toISOString(),
        active: true
      }
    ];
    
    console.log('✅ Secure users initialized with hashed passwords');
    return SECURE_USERS;
  } catch (error) {
    console.error('❌ Failed to initialize secure users:', error);
    throw error;
  }
};

// Token generation utilities
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4() // JWT ID for token tracking
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m', // Short-lived access token
    issuer: 'apple-mcp-auth',
    audience: 'apple-mcp-client',
    algorithm: 'HS256'
  });

  const refreshPayload = {
    id: user.id,
    tokenId: payload.jti,
    iat: Math.floor(Date.now() / 1000)
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'apple-mcp-auth',
    audience: 'apple-mcp-client',
    algorithm: 'HS256'
  });

  // Store refresh token securely
  refreshTokens.set(refreshToken, {
    userId: user.id,
    tokenId: payload.jti,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    userAgent: 'secure-client',
    ipAddress: 'localhost'
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
    tokenType: 'Bearer'
  };
};

/**
 * Secure Login endpoint
 * POST /api/auth/login
 */
router.post('/login', 
  strictAuthLimiter,
  loginValidation,
  handleValidationErrors,
  async (req, res) => {
    console.log('🔐 Secure login attempt for:', req.body.email);
    
    try {
      const { email, password } = req.body;
      
      // Check login attempts
      const attemptKey = `${req.ip}:${email}`;
      const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
      
      if (attempts.count >= 5 && Date.now() - attempts.lastAttempt < 15 * 60 * 1000) {
        return res.status(423).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account temporarily locked due to multiple failed attempts',
            retryAfter: 15 * 60
          }
        });
      }
      
      // Initialize users if needed
      await initializeSecureUsers();
      
      // Find user by email
      const user = SECURE_USERS.find(u => u.email === email && u.active);
      
      if (!user) {
        // Record failed attempt
        attempts.count += 1;
        attempts.lastAttempt = Date.now();
        loginAttempts.set(attemptKey, attempts);
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        // Record failed attempt
        attempts.count += 1;
        attempts.lastAttempt = Date.now();
        loginAttempts.set(attemptKey, attempts);
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      // Clear failed attempts on success
      loginAttempts.delete(attemptKey);
      
      // Generate secure tokens
      const tokens = generateTokens(user);
      
      console.log('✅ Secure login successful for:', user.email);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
          },
          ...tokens
        }
      });
      
    } catch (error) {
      console.error('❌ Secure login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Authentication service temporarily unavailable'
        }
      });
    }
  }
);

/**
 * Secure Token Refresh endpoint
 * POST /api/auth/refresh
 */
router.post('/refresh',
  strictAuthLimiter,
  tokenValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      // Check if token exists in storage
      if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        });
      }
      
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
        issuer: 'apple-mcp-auth',
        audience: 'apple-mcp-client'
      });
      
      // Get stored token info
      const tokenInfo = refreshTokens.get(refreshToken);
      
      if (tokenInfo.expiresAt < new Date()) {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired'
          }
        });
      }
      
      // Find user
      await initializeSecureUsers();
      const user = SECURE_USERS.find(u => u.id === decoded.id && u.active);
      
      if (!user) {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found or deactivated'
          }
        });
      }
      
      // Remove old refresh token
      refreshTokens.delete(refreshToken);
      
      // Generate new tokens
      const tokens = generateTokens(user);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
          },
          ...tokens
        }
      });
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        });
      }
      
      console.error('❌ Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Token refresh service temporarily unavailable'
        }
      });
    }
  }
);

/**
 * Secure Logout endpoint
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];
    
    // Blacklist access token if provided
    if (accessToken) {
      blacklistedTokens.add(accessToken);
    }
    
    // Remove refresh token
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('❌ Secure logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Logout service temporarily unavailable'
      }
    });
  }
});

/**
 * Get Current User endpoint
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access token required'
        }
      });
    }
    
    // Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked'
        }
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'apple-mcp-auth',
      audience: 'apple-mcp-client'
    });
    
    await initializeSecureUsers();
    const user = SECURE_USERS.find(u => u.id === decoded.id && u.active);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found or deactivated'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
});

// Cleanup expired tokens (run periodically)
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  
  for (const [token, info] of refreshTokens.entries()) {
    if (info.expiresAt < now) {
      refreshTokens.delete(token);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired refresh tokens`);
  }
}, 60 * 60 * 1000); // Clean every hour

console.log('🔒 Secure authentication routes initialized');
console.log('📝 Demo accounts:');
console.log('   Admin: admin@example.com / SecureAdmin@2024');
console.log('   User:  user@example.com / SecureUser@2024');

module.exports = router;