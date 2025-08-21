const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

// SQL injection prevention utilities
class SQLSanitizer {
  static sanitizeQuery(query, params = []) {
    // Validate query structure
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query parameter');
    }
    
    // Ensure parameters are properly escaped
    const sanitizedParams = params.map(param => {
      if (typeof param === 'string') {
        // Basic SQL injection prevention
        return param.replace(/['";\\]/g, '');
      }
      return param;
    });
    
    return { query, params: sanitizedParams };
  }
  
  static createSafeQuery(client) {
    return async (query, params = []) => {
      const { query: safeQuery, params: safeParams } = this.sanitizeQuery(query, params);
      return await client.query(safeQuery, safeParams);
    };
  }
}

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Database rate limiters
const dbRateLimiters = {
  general: createRateLimiter(15 * 60 * 1000, 100, 'Too many database requests'),
  auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'),
  search: createRateLimiter(1 * 60 * 1000, 20, 'Too many search requests'),
};

module.exports = {
  SQLSanitizer,
  dbRateLimiters
};