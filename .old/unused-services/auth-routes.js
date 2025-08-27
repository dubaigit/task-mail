/**
 * Authentication Routes
 * Handles user authentication, token generation, and session management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Import middleware
const { 
  authenticateToken, 
  generateToken, 
  authLimiter, 
  handleValidationErrors 
} = require('../middleware/auth');

// Import database agent
const { optimizedDatabaseAgent } = require('../database/OptimizedDatabaseAgent');

/**
 * Login endpoint
 * POST /api/auth/login
 */
router.post('/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Get user from database
      const userQuery = 'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1';
      const userResult = await optimizedDatabaseAgent.query(userQuery, [email]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      const user = userResult.rows[0];
      
      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account has been disabled'
          }
        });
      }
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!validPassword) {
        // Log failed attempt
        await optimizedDatabaseAgent.query(
          'INSERT INTO login_attempts (user_id, ip_address, success) VALUES ($1, $2, $3)',
          [user.id, req.ip, false]
        );
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      // Generate tokens
      const accessToken = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });
      
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-this',
        { expiresIn: '7d' }
      );
      
      // Store refresh token in database
      await optimizedDatabaseAgent.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, refreshToken]
      );
      
      // Log successful login
      await optimizedDatabaseAgent.query(
        'INSERT INTO login_attempts (user_id, ip_address, success) VALUES ($1, $2, $3)',
        [user.id, req.ip, true]
      );
      
      // Set cookies
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          accessToken,
          expiresIn: '24h'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Failed to process login'
        }
      });
    }
  }
);

/**
 * Refresh token endpoint
 * POST /api/auth/refresh
 */
router.post('/refresh',
  authLimiter,
  async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'Refresh token not provided'
          }
        });
      }
      
      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(
          refreshToken, 
          process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-this'
        );
      } catch (error) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        });
      }
      
      // Check if token exists and is valid in database
      const tokenQuery = `
        SELECT rt.*, u.email, u.role, u.is_active 
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = $1 
          AND rt.expires_at > NOW()
          AND rt.revoked = false
      `;
      
      const tokenResult = await optimizedDatabaseAgent.query(tokenQuery, [refreshToken]);
      
      if (tokenResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token not found or expired'
          }
        });
      }
      
      const tokenData = tokenResult.rows[0];
      
      // Check if user is still active
      if (!tokenData.is_active) {
        // Revoke the token
        await optimizedDatabaseAgent.query(
          'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
          [refreshToken]
        );
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account has been disabled'
          }
        });
      }
      
      // Generate new access token
      const newAccessToken = generateToken({
        id: tokenData.user_id,
        email: tokenData.email,
        role: tokenData.role
      });
      
      // Set new access token cookie
      res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: '24h'
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Failed to refresh token'
        }
      });
    }
  }
);

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
router.post('/logout',
  authenticateToken,
  async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      
      // Revoke refresh token if present
      if (refreshToken) {
        await optimizedDatabaseAgent.query(
          'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
          [refreshToken]
        );
      }
      
      // Clear cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear cookies even if database update fails
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  }
);

/**
 * Get current user endpoint
 * GET /api/auth/me
 */
router.get('/me',
  authenticateToken,
  async (req, res) => {
    try {
      const userQuery = `
        SELECT id, email, role, created_at, updated_at, 
               first_name, last_name, avatar_url, preferences
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const userResult = await optimizedDatabaseAgent.query(userQuery, [req.user.id]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }
      
      const user = userResult.rows[0];
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
            avatarUrl: user.avatar_url,
            preferences: user.preferences,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'USER_FETCH_ERROR',
          message: 'Failed to fetch user information'
        }
      });
    }
  }
);

/**
 * Change password endpoint
 * POST /api/auth/change-password
 */
router.post('/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Get current password hash
      const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
      const userResult = await optimizedDatabaseAgent.query(userQuery, [req.user.id]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }
      
      // Verify current password
      const validPassword = await bcrypt.compare(
        currentPassword, 
        userResult.rows[0].password_hash
      );
      
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect'
          }
        });
      }
      
      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      await optimizedDatabaseAgent.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, req.user.id]
      );
      
      // Revoke all refresh tokens for security
      await optimizedDatabaseAgent.query(
        'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
        [req.user.id]
      );
      
      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password'
        }
      });
    }
  }
);

module.exports = router;