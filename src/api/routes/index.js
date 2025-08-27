/**
 * Main API Routes Module
 * Consolidates all API route definitions
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { 
  authenticateToken, 
  generalLimiter,
  aiLimiter,
  taskQueryValidation,
  aiCommandValidation,
  emailClassificationValidation,
  handleValidationErrors
} = require('../../middleware/auth');

// Import route handlers
const authRoutes = require('../../auth/secure-auth-routes');
const aiRoutes = require('./ai-routes');
const taskRoutes = require('./task-routes');
const emailRoutes = require('./email-routes');
// const userRoutes = require('./user-routes');
const syncRoutes = require('./sync-routes');
const healthRoutes = require('./health-routes');
// const statsRoutes = require('./stats-routes');
const automationRoutes = require('./automation-routes');
const testRoutes = require('./test-routes');

// Mount route groups
router.use('/auth', authRoutes);
router.use('/test', testRoutes);
router.use('/ai', aiRoutes);
router.use('/tasks', taskRoutes);
router.use('/emails', emailRoutes);
// router.use('/user', userRoutes);
router.use('/sync', syncRoutes);
router.use('/health', healthRoutes);
// router.use('/statistics', statsRoutes);
router.use('/automation', automationRoutes);

module.exports = router;