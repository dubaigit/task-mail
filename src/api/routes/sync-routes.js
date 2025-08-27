/**
 * Synchronization status API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, generalLimiter } = require('../../middleware/auth');

// Import sync status manager (to be created)
let syncStatus = {
  email: {
    status: 'idle',
    lastSync: null,
    totalEmails: 0,
    processedEmails: 0,
    errors: []
  },
  tasks: {
    status: 'idle',
    lastSync: null,
    totalTasks: 0,
    processedTasks: 0,
    errors: []
  },
  ai: {
    status: 'idle',
    lastProcess: null,
    queueLength: 0,
    processing: false
  }
};

/**
 * Get synchronization status
 * GET /api/sync-status
 */
router.get('/status', 
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      res.json({
        timestamp: new Date().toISOString(),
        services: syncStatus,
        overall: calculateOverallStatus()
      });
    } catch (error) {
      console.error('❌ Error fetching sync status:', error);
      res.status(500).json({ 
        error: 'Failed to fetch sync status',
        message: error.message
      });
    }
  }
);

/**
 * Trigger manual sync
 * POST /api/sync/trigger
 */
router.post('/trigger',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { service } = req.body;
      
      if (!service || !['email', 'tasks', 'all'].includes(service)) {
        return res.status(400).json({
          error: 'Invalid service. Must be: email, tasks, or all'
        });
      }
      
      // Trigger sync based on service
      if (service === 'all' || service === 'email') {
        syncStatus.email.status = 'syncing';
        syncStatus.email.lastSync = new Date().toISOString();
        // Trigger actual email sync here
      }
      
      if (service === 'all' || service === 'tasks') {
        syncStatus.tasks.status = 'syncing';
        syncStatus.tasks.lastSync = new Date().toISOString();
        // Trigger actual task sync here
      }
      
      res.json({
        success: true,
        message: `Sync triggered for ${service}`,
        status: syncStatus
      });
    } catch (error) {
      console.error('❌ Error triggering sync:', error);
      res.status(500).json({ 
        error: 'Failed to trigger sync',
        message: error.message
      });
    }
  }
);

/**
 * Get sync history
 * GET /api/sync/history
 */
router.get('/history',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { service, limit = 10 } = req.query;
      
      // This would normally query from a sync_history table
      const history = [
        {
          id: '1',
          service: 'email',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 3500000).toISOString(),
          itemsProcessed: 150,
          errors: 0
        },
        {
          id: '2',
          service: 'tasks',
          status: 'completed',
          startTime: new Date(Date.now() - 7200000).toISOString(),
          endTime: new Date(Date.now() - 7100000).toISOString(),
          itemsProcessed: 45,
          errors: 0
        }
      ];
      
      const filteredHistory = service 
        ? history.filter(h => h.service === service)
        : history;
      
      res.json({
        history: filteredHistory.slice(0, limit),
        total: filteredHistory.length
      });
    } catch (error) {
      console.error('❌ Error fetching sync history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch sync history',
        message: error.message
      });
    }
  }
);

/**
 * Clear sync errors
 * DELETE /api/sync/errors
 */
router.delete('/errors',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { service } = req.body;
      
      if (service === 'email' || service === 'all') {
        syncStatus.email.errors = [];
      }
      
      if (service === 'tasks' || service === 'all') {
        syncStatus.tasks.errors = [];
      }
      
      res.json({
        success: true,
        message: 'Sync errors cleared',
        status: syncStatus
      });
    } catch (error) {
      console.error('❌ Error clearing sync errors:', error);
      res.status(500).json({ 
        error: 'Failed to clear sync errors',
        message: error.message
      });
    }
  }
);

// Helper function to calculate overall status
function calculateOverallStatus() {
  const statuses = [
    syncStatus.email.status,
    syncStatus.tasks.status,
    syncStatus.ai.status
  ];
  
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('syncing')) return 'syncing';
  if (statuses.every(s => s === 'idle')) return 'idle';
  return 'mixed';
}

module.exports = router;