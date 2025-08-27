/**
 * Automation Rules Management API Routes
 * 
 * Endpoints for creating, managing, and monitoring automation rules
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, generalLimiter } = require('../../middleware/auth');
const AutomationEngine = require('../../services/AutomationEngine');

// Initialize automation engine
let automationEngine = null;

async function initializeAutomationEngine() {
  try {
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
    console.log('✅ Automation Engine initialized in routes');
  } catch (error) {
    console.error('❌ Failed to initialize automation engine:', error);
  }
}

// Initialize on module load
initializeAutomationEngine();

/**
 * Get all automation rules
 * GET /api/automation/rules
 */
router.get('/rules',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const rules = automationEngine.getRules();
      
      res.json({
        success: true,
        rules,
        total: rules.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching automation rules:', error);
      res.status(500).json({
        error: 'Failed to fetch automation rules',
        message: error.message
      });
    }
  }
);

/**
 * Get specific automation rule
 * GET /api/automation/rules/:id
 */
router.get('/rules/:id',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const rule = automationEngine.getRule(req.params.id);
      
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json({
        success: true,
        rule,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching automation rule:', error);
      res.status(500).json({
        error: 'Failed to fetch automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Create new automation rule
 * POST /api/automation/rules
 */
router.post('/rules',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const { name, description, conditions, actions, priority, enabled } = req.body;

      // Validate required fields
      if (!name || !conditions || !actions) {
        return res.status(400).json({
          error: 'Missing required fields: name, conditions, and actions are required'
        });
      }

      // Validate conditions structure
      if (!conditions.conditions || !Array.isArray(conditions.conditions)) {
        return res.status(400).json({
          error: 'Invalid conditions structure: must include conditions array'
        });
      }

      // Validate actions structure
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({
          error: 'Invalid actions: must be a non-empty array'
        });
      }

      const rule = await automationEngine.createRule({
        name,
        description,
        conditions,
        actions,
        priority: priority || 0,
        enabled: enabled !== false
      });
      
      res.status(201).json({
        success: true,
        rule,
        message: 'Automation rule created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error creating automation rule:', error);
      res.status(500).json({
        error: 'Failed to create automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Update automation rule
 * PUT /api/automation/rules/:id
 */
router.put('/rules/:id',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const ruleId = req.params.id;
      const updates = req.body;

      // Check if rule exists
      const existingRule = automationEngine.getRule(ruleId);
      if (!existingRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      // Validate updates if conditions or actions are being changed
      if (updates.conditions && (!updates.conditions.conditions || !Array.isArray(updates.conditions.conditions))) {
        return res.status(400).json({
          error: 'Invalid conditions structure: must include conditions array'
        });
      }

      if (updates.actions && (!Array.isArray(updates.actions) || updates.actions.length === 0)) {
        return res.status(400).json({
          error: 'Invalid actions: must be a non-empty array'
        });
      }

      const updatedRule = await automationEngine.updateRule(ruleId, updates);
      
      res.json({
        success: true,
        rule: updatedRule,
        message: 'Automation rule updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error updating automation rule:', error);
      res.status(500).json({
        error: 'Failed to update automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Delete automation rule
 * DELETE /api/automation/rules/:id
 */
router.delete('/rules/:id',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const ruleId = req.params.id;

      // Check if rule exists
      const existingRule = automationEngine.getRule(ruleId);
      if (!existingRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      await automationEngine.deleteRule(ruleId);
      
      res.json({
        success: true,
        message: 'Automation rule deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error deleting automation rule:', error);
      res.status(500).json({
        error: 'Failed to delete automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Test automation rule against email
 * POST /api/automation/test
 */
router.post('/test',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const { rule, email } = req.body;

      if (!rule || !email) {
        return res.status(400).json({
          error: 'Missing required fields: rule and email are required'
        });
      }

      // Test rule conditions
      const matches = await automationEngine.evaluateConditions(rule.conditions, email);
      
      // If conditions match, simulate actions (without executing)
      let simulatedActions = [];
      if (matches) {
        simulatedActions = rule.actions.map(action => ({
          type: action.type,
          wouldExecute: true,
          parameters: action
        }));
      }
      
      res.json({
        success: true,
        matches,
        simulatedActions,
        message: matches ? 'Rule conditions match - actions would be executed' : 'Rule conditions do not match',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error testing automation rule:', error);
      res.status(500).json({
        error: 'Failed to test automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Process email through all automation rules
 * POST /api/automation/process-email
 */
router.post('/process-email',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Missing required field: email'
        });
      }

      const results = await automationEngine.processEmail(email);
      
      res.json({
        success: true,
        results,
        rulesApplied: results.length,
        message: results.length > 0 ? 'Email processed successfully' : 'No rules matched this email',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error processing email through automation:', error);
      res.status(500).json({
        error: 'Failed to process email',
        message: error.message
      });
    }
  }
);

/**
 * Get automation statistics
 * GET /api/automation/stats
 */
router.get('/stats',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const stats = automationEngine.getStats();
      
      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching automation statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch automation statistics',
        message: error.message
      });
    }
  }
);

/**
 * Toggle rule enabled status
 * PATCH /api/automation/rules/:id/toggle
 */
router.patch('/rules/:id/toggle',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not available' });
      }

      const ruleId = req.params.id;

      // Check if rule exists
      const existingRule = automationEngine.getRule(ruleId);
      if (!existingRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      // Toggle enabled status
      const updatedRule = await automationEngine.updateRule(ruleId, {
        enabled: !existingRule.enabled
      });
      
      res.json({
        success: true,
        rule: updatedRule,
        message: `Rule ${updatedRule.enabled ? 'enabled' : 'disabled'} successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error toggling automation rule:', error);
      res.status(500).json({
        error: 'Failed to toggle automation rule',
        message: error.message
      });
    }
  }
);

/**
 * Example automation rules templates
 * GET /api/automation/templates
 */
router.get('/templates',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const templates = [
        {
          name: 'Auto-reply to specific sender',
          description: 'Automatically reply to emails from a specific sender',
          conditions: {
            operator: 'AND',
            conditions: [
              {
                field: 'sender',
                operator: 'contains',
                value: 'example@domain.com'
              }
            ]
          },
          actions: [
            {
              type: 'auto_reply',
              template: 'Thank you for your email. I will respond shortly.'
            }
          ],
          priority: 5
        },
        {
          name: 'Flag important emails',
          description: 'Flag emails with urgent or important in subject',
          conditions: {
            operator: 'OR',
            conditions: [
              {
                field: 'subject',
                operator: 'contains',
                value: 'urgent'
              },
              {
                field: 'subject',
                operator: 'contains',
                value: 'important'
              }
            ]
          },
          actions: [
            {
              type: 'mark_as_flagged',
              color: 1
            },
            {
              type: 'set_priority',
              priority: 'high'
            }
          ],
          priority: 10
        },
        {
          name: 'Archive newsletters',
          description: 'Automatically archive newsletter emails',
          conditions: {
            operator: 'OR',
            conditions: [
              {
                field: 'sender',
                operator: 'contains',
                value: 'newsletter'
              },
              {
                field: 'subject',
                operator: 'contains',
                value: 'unsubscribe'
              }
            ]
          },
          actions: [
            {
              type: 'move_to_folder',
              folder: 'Newsletters'
            },
            {
              type: 'mark_as_read'
            }
          ],
          priority: 3
        },
        {
          name: 'Create task from project emails',
          description: 'Create tasks from emails with project in subject',
          conditions: {
            operator: 'AND',
            conditions: [
              {
                field: 'subject',
                operator: 'contains',
                value: 'project'
              }
            ]
          },
          actions: [
            {
              type: 'create_task',
              task_template: {
                category: 'project',
                priority: 'medium'
              }
            },
            {
              type: 'add_label',
              label: 'project'
            }
          ],
          priority: 7
        },
        {
          name: 'Smart categorization',
          description: 'Use AI to categorize and prioritize emails',
          conditions: {
            operator: 'AND',
            conditions: [
              {
                field: 'has_attachments',
                operator: 'equals',
                value: 'false'
              }
            ]
          },
          actions: [
            {
              type: 'ai_classify'
            }
          ],
          priority: 1
        }
      ];
      
      res.json({
        success: true,
        templates,
        total: templates.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching automation templates:', error);
      res.status(500).json({
        error: 'Failed to fetch automation templates',
        message: error.message
      });
    }
  }
);

module.exports = router;