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

// Rate limiting disabled for local development
const createRateLimiter = (windowMs, max, message) => {
  return (req, res, next) => next();
};

// Database rate limiters - disabled for local development
const dbRateLimiters = {
  general: (req, res, next) => next(),
  auth: (req, res, next) => next(),
  search: (req, res, next) => next(),
};

module.exports = {
  SQLSanitizer,
  dbRateLimiters
};