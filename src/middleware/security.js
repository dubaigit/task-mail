const helmet = require('helmet');
const cors = require('cors');

// Secure CORS configuration
const createSecureCors = () => {
  // Strict allowlist of origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://apple-mcp.yourcompany.com' // Replace with your production domain
  ];

  // Add production domain from environment if set
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    credentials: false, // Disable credentials to prevent CSRF
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control'
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400 // 24 hours
  });
};

// Comprehensive security headers
const createSecurityHeaders = () => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", // Allow inline styles for React
          "https://fonts.googleapis.com"
        ],
        scriptSrc: [
          "'self'",
          // Add nonce or hash for inline scripts if needed
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "https:", // Allow HTTPS images
          "blob:" // Allow blob URLs for dynamic images
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        connectSrc: [
          "'self'",
          "https://api.openai.com", // Allow OpenAI API calls
          "wss:" // Allow WebSocket connections
        ],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [], // Enforce HTTPS in production
      },
      reportOnly: false // Set to true for testing, false for enforcement
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },

    // X-Download-Options
    ieNoOpen: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // Expect-CT header
    expectCt: {
      maxAge: 86400,
      enforce: true
    }
  });
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Remove potentially dangerous characters from URL parameters
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        // Remove null bytes and other control characters
        req.params[key] = req.params[key].replace(/[\x00-\x1f\x7f-\x9f]/g, '');
      }
    }
  }

  // Limit request body size per endpoint
  const maxSizes = {
    '/api/ai/': '1mb',
    '/api/tasks': '100kb',
    'default': '100kb'
  };

  let maxSize = maxSizes.default;
  for (const path in maxSizes) {
    if (req.path.startsWith(path)) {
      maxSize = maxSizes[path];
      break;
    }
  }

  // Set Content-Length limit
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const sizeInBytes = {
    '100kb': 100 * 1024,
    '1mb': 1024 * 1024,
    '5mb': 5 * 1024 * 1024
  };

  if (contentLength > sizeInBytes[maxSize]) {
    return res.status(413).json({
      error: 'Payload too large',
      message: `Request body must be smaller than ${maxSize}`
    });
  }

  next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  const securityEvents = [];

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection attempts
    /javascript:/i,  // JavaScript protocol
    /data:.*base64/i  // Base64 data URLs
  ];

  const checkString = (str) => {
    if (typeof str === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(str)) {
          securityEvents.push({
            type: 'suspicious_pattern',
            pattern: pattern.toString(),
            value: str.substring(0, 100),
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  };

  // Check URL, query params, and body
  checkString(req.url);
  Object.values(req.query || {}).forEach(checkString);
  
  if (req.body && typeof req.body === 'object') {
    JSON.stringify(req.body).split('').slice(0, 1000).join('');
    checkString(JSON.stringify(req.body));
  }

  if (securityEvents.length > 0) {
    console.warn('🚨 Security events detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      events: securityEvents
    });
  }

  next();
};

// Error sanitization middleware
const sanitizeErrors = (err, req, res, next) => {
  console.error('Server error:', err);

  // Don't leak internal details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  let statusCode = err.statusCode || err.status || 500;
  let message = 'Internal server error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Authentication required';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Access denied';
  } else if (err.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    message = 'Invalid CSRF token';
  } else if (statusCode === 404) {
    message = 'Resource not found';
  } else if (statusCode === 429) {
    message = 'Too many requests';
  }

  const response = {
    error: message,
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };

  // Only include details in development
  if (isDevelopment && err.message) {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  createSecureCors,
  createSecurityHeaders,
  sanitizeRequest,
  securityLogger,
  sanitizeErrors
};