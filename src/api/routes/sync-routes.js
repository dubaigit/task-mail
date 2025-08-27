/**
 * Synchronization status API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, generalLimiter } = require('../../middleware/auth');

// Import enhanced sync services
const EnhancedAppleMailSync = require('../../services/EnhancedAppleMailSync');
const AutomationEngine = require('../../services/AutomationEngine');
const DraftSyncService = require('../../services/DraftSyncService');

// Initialize services
let emailSyncService = null;
let automationEngine = null;
let draftSyncService = null;

// Initialize services on startup
async function initializeServices() {
  try {
    // Initialize Enhanced Apple Mail Sync
    emailSyncService = new EnhancedAppleMailSync();
    await emailSyncService.initialize();
    
    // Initialize Automation Engine
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
    
    // Initialize Draft Sync (Mac only)
    if (process.platform === 'darwin') {
      draftSyncService = new DraftSyncService();
      await draftSyncService.initialize();
    }
    
    // Set up email processing through automation
    emailSyncService.on('batch-synced', async (stats) => {
      console.log(`✅ Batch synced: ${stats.synced} emails`);
    });
    
    console.log('✅ All sync services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize sync services:', error);
  }
}

// Initialize on module load
initializeServices();

/**
 * Get synchronization status
 * GET /api/sync/status
 */
router.get('/status', 
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const emailStats = emailSyncService ? emailSyncService.getStats() : null;
      const automationStats = automationEngine ? automationEngine.getStats() : null;
      const draftStats = draftSyncService ? draftSyncService.getStats() : null;
      
      res.json({
        timestamp: new Date().toISOString(),
        services: {
          email: {
            status: emailSyncService?.isRunning ? 'active' : 'idle',
            lastSync: emailStats?.lastSyncTime,
            totalSynced: emailStats?.totalSynced || 0,
            lastSyncedRowId: emailStats?.lastSyncedRowId || 0,
            isRunning: emailStats?.isRunning || false
          },
          automation: {
            status: automationEngine?.isRunning ? 'active' : 'idle',
            totalRules: automationStats?.totalRules || 0,
            activeRules: automationStats?.activeRules || 0,
            totalExecutions: automationStats?.totalExecutions || 0,
            successfulExecutions: automationStats?.successfulExecutions || 0,
            failedExecutions: automationStats?.failedExecutions || 0,
            lastExecutionTime: automationStats?.lastExecutionTime
          },
          drafts: draftStats ? {
            status: draftStats.isActive ? 'active' : 'idle',
            lastSync: draftStats.lastSyncTime,
            pendingDrafts: draftStats.pendingDrafts || 0,
            syncedDrafts: draftStats.syncedDrafts || 0
          } : null
        },
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
      const { service, type = 'incremental' } = req.body;
      
      if (!service || !['email', 'drafts', 'all'].includes(service)) {
        return res.status(400).json({
          error: 'Invalid service. Must be: email, drafts, or all'
        });
      }
      
      const results = {};
      
      // Trigger email sync
      if (service === 'all' || service === 'email') {
        if (emailSyncService) {
          if (type === 'full') {
            results.email = await emailSyncService.performFullSync();
          } else {
            results.email = await emailSyncService.performIncrementalSync();
          }
        } else {
          results.email = { error: 'Email sync service not initialized' };
        }
      }
      
      // Trigger draft sync (Mac only)
      if (service === 'all' || service === 'drafts') {
        if (draftSyncService) {
          results.drafts = await draftSyncService.syncDrafts();
        } else {
          results.drafts = { error: 'Draft sync not available (Mac only)' };
        }
      }
      
      res.json({
        success: true,
        message: `Sync triggered for ${service}`,
        type,
        results
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
 * Start continuous sync
 * POST /api/sync/start
 */
router.post('/start',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { service } = req.body;
      
      if (service === 'email' && emailSyncService) {
        await emailSyncService.start();
      } else if (service === 'drafts' && draftSyncService) {
        await draftSyncService.start();
      } else if (service === 'all') {
        if (emailSyncService) await emailSyncService.start();
        if (draftSyncService) await draftSyncService.start();
      }
      
      res.json({
        success: true,
        message: `Continuous sync started for ${service}`
      });
    } catch (error) {
      console.error('❌ Error starting sync:', error);
      res.status(500).json({ 
        error: 'Failed to start sync',
        message: error.message
      });
    }
  }
);

/**
 * Stop continuous sync
 * POST /api/sync/stop
 */
router.post('/stop',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { service } = req.body;
      
      if (service === 'email' && emailSyncService) {
        await emailSyncService.stop();
      } else if (service === 'drafts' && draftSyncService) {
        await draftSyncService.stop();
      } else if (service === 'all') {
        if (emailSyncService) await emailSyncService.stop();
        if (draftSyncService) await draftSyncService.stop();
      }
      
      res.json({
        success: true,
        message: `Continuous sync stopped for ${service}`
      });
    } catch (error) {
      console.error('❌ Error stopping sync:', error);
      res.status(500).json({ 
        error: 'Failed to stop sync',
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