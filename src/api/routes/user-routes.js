/**
 * User profile and preferences API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, generalLimiter } = require('../../middleware/auth');
const { optimizedDatabaseAgent } = require('../../database/OptimizedDatabaseAgent');

/**
 * Get user profile
 * GET /api/user/profile
 */
router.get('/profile', 
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      const query = `
        SELECT 
          id,
          email,
          first_name,
          last_name,
          avatar_url,
          role,
          preferences,
          created_at,
          updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await optimizedDatabaseAgent.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }
      
      const user = result.rows[0];
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        preferences: user.preferences || {},
        createdAt: user.created_at,
        updatedAt: user.updated_at
      });
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user profile',
        message: error.message
      });
    }
  }
);

/**
 * Update user profile
 * PUT /api/user/profile
 */
router.put('/profile',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, avatarUrl, preferences } = req.body;
      
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (firstName !== undefined) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(firstName);
      }
      
      if (lastName !== undefined) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(lastName);
      }
      
      if (avatarUrl !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(avatarUrl);
      }
      
      if (preferences !== undefined) {
        updates.push(`preferences = $${paramCount++}`);
        values.push(JSON.stringify(preferences));
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ 
          error: 'No fields to update' 
        });
      }
      
      updates.push('updated_at = NOW()');
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, first_name, last_name, avatar_url, role, preferences, updated_at
      `;
      
      const result = await optimizedDatabaseAgent.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }
      
      const user = result.rows[0];
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url,
          role: user.role,
          preferences: user.preferences,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      res.status(500).json({ 
        error: 'Failed to update user profile',
        message: error.message
      });
    }
  }
);

/**
 * Get user preferences
 * GET /api/user/preferences
 */
router.get('/preferences',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      const query = 'SELECT preferences FROM users WHERE id = $1';
      const result = await optimizedDatabaseAgent.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }
      
      res.json(result.rows[0].preferences || {});
    } catch (error) {
      console.error('❌ Error fetching preferences:', error);
      res.status(500).json({ 
        error: 'Failed to fetch preferences',
        message: error.message
      });
    }
  }
);

/**
 * Update user preferences
 * PATCH /api/user/preferences
 */
router.patch('/preferences',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const newPreferences = req.body;
      
      // Merge with existing preferences
      const getQuery = 'SELECT preferences FROM users WHERE id = $1';
      const getResult = await optimizedDatabaseAgent.query(getQuery, [userId]);
      
      if (getResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'User not found' 
        });
      }
      
      const currentPreferences = getResult.rows[0].preferences || {};
      const mergedPreferences = { ...currentPreferences, ...newPreferences };
      
      const updateQuery = `
        UPDATE users 
        SET preferences = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING preferences
      `;
      
      const updateResult = await optimizedDatabaseAgent.query(
        updateQuery, 
        [JSON.stringify(mergedPreferences), userId]
      );
      
      res.json({
        success: true,
        preferences: updateResult.rows[0].preferences
      });
    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      res.status(500).json({ 
        error: 'Failed to update preferences',
        message: error.message
      });
    }
  }
);

module.exports = router;