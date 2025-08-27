const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param, query } = require('express-validator');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Enhanced Authentication and Database Integration
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('⚠️ WARNING: Using default JWT_SECRET in development - set JWT_SECRET in .env');
  return 'development_jwt_secret_key_32_characters_minimum_length_required';
})();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_REFRESH_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('⚠️ WARNING: Using default JWT_REFRESH_SECRET in development - set JWT_REFRESH_SECRET in .env');
  return 'development_refresh_secret_key_32_characters_minimum_length_required';
})();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client for authentication
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? 
  createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

// Validate JWT secrets
if (JWT_SECRET.length < 32) {
  console.error('❌ CRITICAL: JWT_SECRET must be at least 32 characters long');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

if (JWT_REFRESH_SECRET.length < 32) {
  console.error('❌ CRITICAL: JWT_REFRESH_SECRET must be at least 32 characters long');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Check for insecure default secrets in production
if (process.env.NODE_ENV === 'production') {
  const insecureSecrets = [
    'super_secure_jwt_secret_key_that_is_at_least_32_characters_long',
    'super_secure_refresh_token_key_32_chars_min',
    'your_jwt_secret_here',
    'development_jwt_secret_key_32_characters_minimum_length_required',
    'development_refresh_secret_key_32_characters_minimum_length_required'
  ];
  
  if (insecureSecrets.includes(JWT_SECRET) || insecureSecrets.includes(JWT_REFRESH_SECRET)) {
    console.error('❌ SECURITY ERROR: Default JWT secrets detected in production');
    console.error('Please set secure, unique JWT_SECRET and JWT_REFRESH_SECRET environment variables');
    process.exit(1);
  }
}

// In-memory stores (use Redis in production)
const refreshTokens = new Map();
const loginAttempts = new Map();

// In-memory token blacklist (use Redis in production)
const blacklistedTokens = new Set();

// Enhanced authentication middleware with token blacklist support
const authenticateToken = (req, res, next) => {
  // BYPASS AUTHENTICATION FOR DEVELOPMENT - NO LOGIN REQUIRED
  req.user = {
    id: 'default-user',
    email: 'admin@taskmail.com',
    role: 'admin'
  };
  return next();
  
  /* ORIGINAL AUTH CODE - DISABLED FOR DEVELOPMENT
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied',
      message: 'Authentication token required' 
    });
  }

  // Check if token is blacklisted
  if (blacklistedTokens.has(token)) {
    return res.status(401).json({ 
      error: 'Token revoked',
      message: 'Authentication token has been revoked' 
    });
  }

  jwt.verify(token, JWT_SECRET, { 
    issuer: 'apple-mcp-auth', 
    audience: 'apple-mcp-client',
    algorithms: ['HS256'] // Explicitly specify allowed algorithms
  }, (err, user) => {
    if (err) {
      let errorMessage = 'Authentication failed';
      if (err.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired';
      } else if (err.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token format';
      }
      
      return res.status(403).json({ 
        error: 'Invalid token',
        message: errorMessage 
      });
    }
    
    // Add token to user object for potential blacklisting on logout
    req.user = { ...user, token };
    next();
  });
  */ // END OF DISABLED AUTH CODE
};

// Token blacklist management
const blacklistToken = (token) => {
  blacklistedTokens.add(token);
};

const clearBlacklistedTokens = () => {
  blacklistedTokens.clear();
  console.log('🧹 Cleared token blacklist');
};

// Clean expired tokens from blacklist every hour
const tokenCleanupInterval = setInterval(() => {
  // In a real implementation, you'd check token expiration times
  // For now, we'll periodically clear the blacklist to prevent memory leaks
  if (blacklistedTokens.size > 1000) {
    clearBlacklistedTokens();
  }
}, 60 * 60 * 1000);

const cleanup = () => {
  if (tokenCleanupInterval) {
    clearInterval(tokenCleanupInterval);
    console.log('🧹 Token cleanup interval cleared');
  }
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/api/health' && req.method === 'GET'
  });
};

// Different rate limits for different endpoint types
// Rate limiting disabled for local development
const generalLimiter = (req, res, next) => next();

// Rate limiting disabled for local development
const authLimiter = (req, res, next) => next();

// Rate limiting disabled for local development
const aiLimiter = (req, res, next) => next();

// Input validation schemas
const taskQueryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Offset must be between 0 and 10000')
    .toInt(),
  query('filter')
    .optional()
    .isIn(['all', 'pending', 'completed', 'in-progress'])
    .withMessage('Filter must be: all, pending, completed, or in-progress')
];

const aiCommandValidation = [
  body('command')
    .isString()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Command must be between 1 and 1000 characters')
    .trim()
    .escape(),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object')
];

const emailClassificationValidation = [
  body('content')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters')
    .trim(),
  body('subject')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters')
    .trim(),
  body('sender')
    .isEmail()
    .withMessage('Sender must be a valid email address')
    .normalizeEmail()
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Enhanced authentication functions for dual database architecture
const generateTokens = async (user, rememberMe = false) => {
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
    permissions: user.permissions || []
  };

  const accessToken = jwt.sign(
    tokenPayload,
    JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'apple-mcp',
      audience: 'apple-mcp-client'
    }
  );

  const refreshTokenExpiry = rememberMe ? '30d' : '7d';
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { 
      expiresIn: refreshTokenExpiry,
      issuer: 'apple-mcp',
      audience: 'apple-mcp-client'
    }
  );

  // Store refresh token
  refreshTokens.set(refreshToken, {
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000)
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  };
};

// Login endpoint with dual database support
const login = async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // Check login attempts
    const attemptKey = `${req.ip}:${email}`;
    const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
    
    if (attempts.count >= 5 && Date.now() - attempts.lastAttempt < 15 * 60 * 1000) {
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed attempts'
      });
    }

    let user = null;

    // Try Supabase first if available
    if (supabase) {
      try {
        const { data: supabaseUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('active', true)
          .single();

        if (!error && supabaseUser) {
          const isValidPassword = await bcrypt.compare(password, supabaseUser.password_hash);
          if (isValidPassword) {
            user = supabaseUser;
          }
        }
      } catch (supabaseError) {
        console.warn('Supabase login failed, falling back to SQLite:', supabaseError.message);
      }
    }

    // Fallback to SQLite database (implement based on existing structure)
    if (!user && req.db) {
      try {
        const query = `
          SELECT id, email, password_hash, role, permissions, active
          FROM users 
          WHERE email = ? AND active = 1
        `;
        const sqliteUser = req.db.prepare(query).get(email.toLowerCase());
        
        if (sqliteUser && await bcrypt.compare(password, sqliteUser.password_hash)) {
          user = sqliteUser;
        }
      } catch (sqliteError) {
        console.error('SQLite login error:', sqliteError);
      }
    }

    if (!user) {
      // Record failed attempt
      attempts.count += 1;
      attempts.lastAttempt = Date.now();
      loginAttempts.set(attemptKey, attempts);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Clear failed attempts on success
    loginAttempts.delete(attemptKey);

    // Generate tokens
    const tokens = await generateTokens(user, rememberMe);

    // Update last login (dual database)
    const updateLastLogin = async () => {
      const now = new Date().toISOString();
      
      if (supabase) {
        try {
          await supabase
            .from('users')
            .update({ 
              last_login: now,
              last_active: now
            })
            .eq('id', user.id);
        } catch (error) {
          console.warn('Failed to update Supabase last login:', error);
        }
      }
      
      if (req.db) {
        try {
          req.db.prepare(`
            UPDATE users 
            SET last_login = ?, last_active = ? 
            WHERE id = ?
          `).run(now, now, user.id);
        } catch (error) {
          console.warn('Failed to update SQLite last login:', error);
        }
      }
    };

    updateLastLogin();

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      },
      ...tokens,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

// Register endpoint with dual database support
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'user' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password validation failed',
        requirements: passwordValidation.requirements
      });
    }

    // Check if user exists (dual database)
    let existingUser = null;
    
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();
      existingUser = data;
    }
    
    if (!existingUser && req.db) {
      existingUser = req.db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).get(email.toLowerCase());
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const userData = {
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: role === 'admin' ? 'user' : role, // Prevent admin registration
      active: true,
      created_at: new Date().toISOString()
    };

    let newUser = null;

    // Create in Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .single();

        if (!error) {
          newUser = data;
        }
      } catch (error) {
        console.warn('Supabase registration failed:', error);
      }
    }

    // Create in SQLite as fallback/sync
    if (req.db) {
      try {
        req.db.prepare(`
          INSERT INTO users (
            id, email, password_hash, first_name, last_name, 
            role, active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId, userData.email, userData.password_hash,
          userData.first_name, userData.last_name,
          userData.role, userData.active, userData.created_at
        );
        
        if (!newUser) {
          newUser = userData;
        }
      } catch (error) {
        console.error('SQLite registration error:', error);
        if (!newUser) {
          throw error;
        }
      }
    }

    if (!newUser) {
      throw new Error('Failed to create user in any database');
    }

    // Generate tokens
    const tokens = await generateTokens(newUser);

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      ...tokens,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

// Refresh token endpoint
const refreshTokenEndpoint = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Check if refresh token is valid
    if (!refreshTokens.has(refreshToken)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Get user (dual database)
    let user = null;
    
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .eq('active', true)
        .single();
      user = data;
    }
    
    if (!user && req.db) {
      user = req.db.prepare(`
        SELECT * FROM users WHERE id = ? AND active = 1
      `).get(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove old refresh token
    refreshTokens.delete(refreshToken);

    // Generate new tokens
    const tokens = await generateTokens(user);

    res.json({
      success: true,
      ...tokens,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
};

// Password validation helper
const validatePassword = (password) => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const valid = Object.values(requirements).every(req => req);

  return {
    valid,
    requirements: {
      ...requirements,
      messages: {
        length: 'At least 8 characters',
        uppercase: 'At least one uppercase letter',
        lowercase: 'At least one lowercase letter',
        number: 'At least one number',
        special: 'At least one special character'
      }
    }
  };
};

// Legacy generateToken for backward compatibility
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'apple-mcp',
      audience: 'apple-mcp-client'
    }
  );
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User not authenticated' 
      });
    }

    const userRole = req.user.role || 'user';
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${userRole}' not authorized for this action` 
      });
    }

    next();
  };
};

// Environment validation (relaxed for development)
const validateEnvironment = () => {
  const required = [
    'DB_HOST',
    'DB_NAME', 
    'DB_USER',
    'DB_PASSWORD'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️ WARNING: Missing environment variables:', missing);
    console.log('ℹ️ Server will continue with degraded functionality');
    return false;
  }

  // Warn about default values in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DB_PASSWORD === 'password' || process.env.DB_PASSWORD === 'secure_password_2024') {
      console.error('❌ SECURITY ERROR: Default database password detected in production.');
      process.exit(1);
    }
  }

  console.log('✅ Environment validation passed');
  return true;
};

module.exports = {
  authenticateToken,
  generateToken,
  generateTokens,
  login,
  register,
  refreshTokenEndpoint,
  validatePassword,
  requireRole,
  generalLimiter,
  authLimiter,
  aiLimiter,
  taskQueryValidation,
  aiCommandValidation,
  emailClassificationValidation,
  handleValidationErrors,
  validateEnvironment,
  cleanup,
  blacklistToken,
  clearBlacklistedTokens,
  refreshTokens,
  blacklistedTokens,
  loginAttempts
};
