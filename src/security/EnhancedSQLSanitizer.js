/**
 * Enhanced SQL Sanitizer - Advanced SQL injection prevention and query validation
 * Addresses security vulnerabilities in the existing basic sanitization
 */

const { z } = require('zod');

class EnhancedSQLSanitizer {
  constructor() {
    // Dangerous SQL patterns that should be blocked
    this.dangerousPatterns = [
      /(\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b)/gi,
      /(;|\b(UNION|SELECT)\b.*\b(FROM|WHERE)\b)/gi,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)/gi,
      /((\%27)|(\')|(--)|(\%23)|(#))/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(--)|(\%23)|(#))/gi,
      /\b(AND|OR)\b\s+\d+\s*=\s*\d+/gi,
      /1\s*=\s*1|1\s*=\s*0/gi,
      /(sleep|benchmark|waitfor|delay)\s*\(/gi
    ];

    // Allowed SQL operations for read-only queries
    this.allowedReadOperations = [
      'SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC'
    ];

    // Allowed SQL operations for write queries (with stricter validation)
    this.allowedWriteOperations = [
      'INSERT', 'UPDATE', 'DELETE', 'REPLACE'
    ];

    // Parameter validation schemas
    this.parameterSchemas = {
      email: z.string().email().max(255),
      id: z.number().int().positive(),
      uuid: z.string().uuid(),
      text: z.string().max(10000),
      shortText: z.string().max(500),
      date: z.string().datetime(),
      boolean: z.boolean(),
      enum: (values) => z.enum(values)
    };
  }

  /**
   * Enhanced query sanitization with comprehensive validation
   */
  sanitizeQuery(query, params = [], options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: must be a non-empty string');
    }

    // Normalize whitespace
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    // Validate query structure
    this.validateQueryStructure(normalizedQuery, options);

    // Sanitize parameters
    const sanitizedParams = this.sanitizeParameters(params, options);

    // Additional security checks
    this.performSecurityChecks(normalizedQuery, sanitizedParams, options);

    return {
      query: normalizedQuery,
      params: sanitizedParams,
      metadata: {
        operation: this.detectOperation(normalizedQuery),
        paramCount: sanitizedParams.length,
        isReadOnly: this.isReadOnlyQuery(normalizedQuery),
        sanitizedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Validate query structure and detect malicious patterns
   */
  validateQueryStructure(query, options = {}) {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
      }
    }

    // Validate allowed operations
    const operation = this.detectOperation(query);
    const isReadOnly = options.readOnly !== false; // Default to read-only unless explicitly set

    if (isReadOnly && !this.allowedReadOperations.includes(operation)) {
      throw new Error(`Operation '${operation}' not allowed in read-only mode`);
    }

    if (!isReadOnly && ![...this.allowedReadOperations, ...this.allowedWriteOperations].includes(operation)) {
      throw new Error(`Operation '${operation}' not allowed`);
    }

    // Check for multiple statements (potential SQL injection)
    const statements = query.split(';').filter(s => s.trim());
    if (statements.length > 1) {
      throw new Error('Multiple statements not allowed');
    }

    // Validate parentheses balance
    const openParen = (query.match(/\(/g) || []).length;
    const closeParen = (query.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
      throw new Error('Unbalanced parentheses in query');
    }

    return true;
  }

  /**
   * Enhanced parameter sanitization with type validation
   */
  sanitizeParameters(params, options = {}) {
    if (!Array.isArray(params)) {
      throw new Error('Parameters must be an array');
    }

    return params.map((param, index) => {
      // Validate parameter based on expected schema
      if (options.parameterSchemas && options.parameterSchemas[index]) {
        const schema = options.parameterSchemas[index];
        const result = schema.safeParse(param);
        if (!result.success) {
          throw new Error(`Parameter ${index} validation failed: ${result.error.message}`);
        }
        return result.data;
      }

      // Generic parameter sanitization
      return this.sanitizeParameter(param, index);
    });
  }

  /**
   * Sanitize individual parameter
   */
  sanitizeParameter(param, index) {
    if (param === null || param === undefined) {
      return null;
    }

    if (typeof param === 'string') {
      // Remove potentially dangerous characters
      let sanitized = param
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
        .replace(/['"\\]/g, '') // Quotes and backslashes
        .trim();

      // Length validation
      if (sanitized.length > 10000) {
        throw new Error(`Parameter ${index} exceeds maximum length (10000 characters)`);
      }

      // Check for suspicious patterns
      if (this.containsSuspiciousPattern(sanitized)) {
        throw new Error(`Parameter ${index} contains suspicious content`);
      }

      return sanitized;
    }

    if (typeof param === 'number') {
      if (!Number.isFinite(param)) {
        throw new Error(`Parameter ${index} must be a finite number`);
      }
      return param;
    }

    if (typeof param === 'boolean') {
      return param;
    }

    if (param instanceof Date) {
      return param.toISOString();
    }

    // For other types, convert to string and sanitize
    return this.sanitizeParameter(String(param), index);
  }

  /**
   * Check for suspicious patterns in parameters
   */
  containsSuspiciousPattern(str) {
    const suspiciousPatterns = [
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
      /(script|javascript|vbscript|onload|onerror)/gi,
      /([\'\";])/g,
      /(\b(and|or)\b\s*\d+\s*(=|<|>)\s*\d+)/gi
    ];

    return suspiciousPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Perform additional security checks
   */
  performSecurityChecks(query, params, options = {}) {
    // Check parameter count matches placeholders
    const placeholderCount = (query.match(/\$\d+/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(`Parameter count mismatch: expected ${placeholderCount}, got ${params.length}`);
    }

    // Validate table names (if provided)
    if (options.allowedTables) {
      const tablePattern = /(?:FROM|JOIN|UPDATE|INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
      let match;
      while ((match = tablePattern.exec(query)) !== null) {
        const tableName = match[1].toLowerCase();
        if (!options.allowedTables.includes(tableName)) {
          throw new Error(`Access to table '${tableName}' not allowed`);
        }
      }
    }

    // Validate column names (if provided)
    if (options.allowedColumns) {
      const columnPattern = /(?:SELECT|WHERE|ORDER BY|GROUP BY)\s+.*?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
      // Note: This is a simplified column detection - would need more sophisticated parsing for production
    }

    return true;
  }

  /**
   * Detect SQL operation type
   */
  detectOperation(query) {
    const firstWord = query.trim().split(/\s+/)[0].toUpperCase();
    return firstWord;
  }

  /**
   * Check if query is read-only
   */
  isReadOnlyQuery(query) {
    const operation = this.detectOperation(query);
    return this.allowedReadOperations.includes(operation);
  }

  /**
   * Create a safe query executor with built-in sanitization
   */
  createSafeQueryExecutor(client, defaultOptions = {}) {
    return async (query, params = [], options = {}) => {
      const mergedOptions = { ...defaultOptions, ...options };
      const sanitized = this.sanitizeQuery(query, params, mergedOptions);
      
      try {
        const result = await client.query(sanitized.query, sanitized.params);
        
        // Log successful queries for audit trail
        if (mergedOptions.audit) {
          this.logAuditEvent('query_success', {
            operation: sanitized.metadata.operation,
            isReadOnly: sanitized.metadata.isReadOnly,
            paramCount: sanitized.metadata.paramCount,
            rowCount: result.rowCount
          });
        }
        
        return result;
      } catch (error) {
        // Log failed queries for security monitoring
        this.logAuditEvent('query_error', {
          operation: sanitized.metadata.operation,
          error: error.message,
          query: query.substring(0, 100) + '...'
        });
        throw error;
      }
    };
  }

  /**
   * Create parameter schema for validation
   */
  createParameterSchema(type, options = {}) {
    switch (type) {
      case 'email':
        return this.parameterSchemas.email;
      case 'id':
        return this.parameterSchemas.id;
      case 'uuid':
        return this.parameterSchemas.uuid;
      case 'text':
        return options.maxLength 
          ? z.string().max(options.maxLength)
          : this.parameterSchemas.text;
      case 'shortText':
        return this.parameterSchemas.shortText;
      case 'date':
        return this.parameterSchemas.date;
      case 'boolean':
        return this.parameterSchemas.boolean;
      case 'enum':
        return this.parameterSchemas.enum(options.values);
      default:
        return z.any();
    }
  }

  /**
   * Log audit events for security monitoring
   */
  logAuditEvent(type, data) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      type,
      data,
      source: 'EnhancedSQLSanitizer'
    };

    // In production, this would go to a secure audit log system
    console.log('[AUDIT]', JSON.stringify(auditLog));
  }

  /**
   * Generate safe query templates for common operations
   */
  createQueryTemplate(templateName, allowedTables = []) {
    const templates = {
      selectById: {
        query: 'SELECT * FROM $1 WHERE id = $2',
        parameterSchemas: [
          z.enum(allowedTables),
          this.parameterSchemas.id
        ],
        readOnly: true
      },
      selectByEmail: {
        query: 'SELECT * FROM $1 WHERE email = $2',
        parameterSchemas: [
          z.enum(allowedTables),
          this.parameterSchemas.email
        ],
        readOnly: true
      },
      insertRecord: {
        query: 'INSERT INTO $1 ($2) VALUES ($3) RETURNING id',
        readOnly: false,
        requiresAudit: true
      }
    };

    return templates[templateName] || null;
  }
}

// Export singleton instance and class
const enhancedSQLSanitizer = new EnhancedSQLSanitizer();

module.exports = { 
  EnhancedSQLSanitizer, 
  enhancedSQLSanitizer,
  // For backward compatibility
  SQLSanitizer: EnhancedSQLSanitizer
};