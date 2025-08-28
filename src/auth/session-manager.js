/**
 * Secure Session Management - Phase 1 Emergency Security
 * Handles session storage, cleanup, and security validations
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class SecureSessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.refreshTokens = new Map();
    this.blacklistedTokens = new Set();
    this.loginAttempts = new Map();
    
    // Configuration
    this.config = {
      sessionTimeout: options.sessionTimeout || 15 * 60 * 1000, // 15 minutes
      refreshTokenTimeout: options.refreshTokenTimeout || 7 * 24 * 60 * 60 * 1000, // 7 days
      maxLoginAttempts: options.maxLoginAttempts || 5,
      lockoutDuration: options.lockoutDuration || 15 * 60 * 1000, // 15 minutes
      cleanupInterval: options.cleanupInterval || 60 * 60 * 1000, // 1 hour
      ...options
    };
    
    // Start automatic cleanup
    this.startCleanup();
    
    console.log('🔐 Secure Session Manager initialized');
  }
  
  /**
   * Generate a secure session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Create a new session
   */
  createSession(userId, userData = {}) {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session = {
      id: sessionId,
      userId,
      userData,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTimeout),
      ipAddress: userData.ipAddress || 'unknown',
      userAgent: userData.userAgent || 'unknown',
      isActive: true
    };
    
    this.sessions.set(sessionId, session);
    
    console.log(`✅ Session created for user ${userId}: ${sessionId.substring(0, 8)}...`);
    return sessionId;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId) {
    if (!sessionId) return null;
    
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.destroySession(sessionId);
      return null;
    }
    
    // Update last accessed time
    session.lastAccessedAt = new Date();
    session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
    
    return session;
  }
  
  /**
   * Destroy a session
   */
  destroySession(sessionId) {
    if (this.sessions.delete(sessionId)) {
      console.log(`🗑️ Session destroyed: ${sessionId.substring(0, 8)}...`);
      return true;
    }
    return false;
  }
  
  /**
   * Store refresh token
   */
  storeRefreshToken(token, userId, metadata = {}) {
    const tokenData = {
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.refreshTokenTimeout),
      metadata,
      isActive: true
    };
    
    this.refreshTokens.set(token, tokenData);
    
    console.log(`💾 Refresh token stored for user ${userId}`);
    return true;
  }
  
  /**
   * Validate refresh token
   */
  validateRefreshToken(token) {
    const tokenData = this.refreshTokens.get(token);
    if (!tokenData || !tokenData.isActive) return null;
    
    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(token);
      return null;
    }
    
    return tokenData;
  }
  
  /**
   * Revoke refresh token
   */
  revokeRefreshToken(token) {
    if (this.refreshTokens.delete(token)) {
      console.log('🔒 Refresh token revoked');
      return true;
    }
    return false;
  }
  
  /**
   * Blacklist access token
   */
  blacklistAccessToken(token) {
    this.blacklistedTokens.add(token);
    console.log('⚫ Access token blacklisted');
  }
  
  /**
   * Check if access token is blacklisted
   */
  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }
  
  /**
   * Record login attempt
   */
  recordLoginAttempt(identifier, success = false) {
    const attemptData = this.loginAttempts.get(identifier) || {
      count: 0,
      lastAttempt: 0,
      blocked: false
    };
    
    if (success) {
      // Clear attempts on successful login
      this.loginAttempts.delete(identifier);
      console.log(`✅ Login successful for ${identifier}`);
    } else {
      attemptData.count += 1;
      attemptData.lastAttempt = Date.now();
      
      // Block if too many attempts
      if (attemptData.count >= this.config.maxLoginAttempts) {
        attemptData.blocked = true;
        attemptData.blockedUntil = Date.now() + this.config.lockoutDuration;
      }
      
      this.loginAttempts.set(identifier, attemptData);
      console.log(`❌ Failed login attempt ${attemptData.count}/${this.config.maxLoginAttempts} for ${identifier}`);
    }
    
    return attemptData;
  }
  
  /**
   * Check if identifier is blocked
   */
  isBlocked(identifier) {
    const attemptData = this.loginAttempts.get(identifier);
    if (!attemptData || !attemptData.blocked) return false;
    
    // Check if lockout has expired
    if (Date.now() > attemptData.blockedUntil) {
      this.loginAttempts.delete(identifier);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get session statistics
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      activeRefreshTokens: this.refreshTokens.size,
      blacklistedTokens: this.blacklistedTokens.size,
      blockedIdentifiers: Array.from(this.loginAttempts.values()).filter(a => a.blocked).length,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Clean up expired sessions and tokens
   */
  cleanup() {
    const now = new Date();
    let cleanedSessions = 0;
    let cleanedTokens = 0;
    let cleanedAttempts = 0;
    
    // Clean expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedSessions++;
      }
    }
    
    // Clean expired refresh tokens
    for (const [token, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.expiresAt < now) {
        this.refreshTokens.delete(token);
        cleanedTokens++;
      }
    }
    
    // Clean expired login attempt blocks
    for (const [identifier, attemptData] of this.loginAttempts.entries()) {
      if (attemptData.blocked && attemptData.blockedUntil < Date.now()) {
        this.loginAttempts.delete(identifier);
        cleanedAttempts++;
      }
    }
    
    // Clean token blacklist if it gets too large (prevent memory leaks)
    if (this.blacklistedTokens.size > 10000) {
      this.blacklistedTokens.clear();
      console.log('🧹 Cleared token blacklist to prevent memory leak');
    }
    
    if (cleanedSessions > 0 || cleanedTokens > 0 || cleanedAttempts > 0) {
      console.log(`🧹 Cleanup completed: ${cleanedSessions} sessions, ${cleanedTokens} tokens, ${cleanedAttempts} attempts`);
    }
  }
  
  /**
   * Start automatic cleanup
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    
    console.log(`🕐 Automatic cleanup started (every ${this.config.cleanupInterval / 1000}s)`);
  }
  
  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('🛑 Automatic cleanup stopped');
    }
  }
  
  /**
   * Destroy all sessions and tokens (emergency shutdown)
   */
  emergency() {
    this.sessions.clear();
    this.refreshTokens.clear();
    this.blacklistedTokens.clear();
    this.loginAttempts.clear();
    
    console.log('🚨 EMERGENCY: All sessions and tokens cleared');
  }
}

// Export singleton instance
const sessionManager = new SecureSessionManager();

module.exports = {
  SecureSessionManager,
  sessionManager
};