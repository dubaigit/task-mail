# Automation Workflow Implementation Guide

## Overview

This guide provides detailed implementation specifications for the comprehensive automation workflow interface, designed to integrate seamlessly with the existing Apple Mail Task Management system.

## Phase 1: Foundation Implementation (Weeks 1-2)

### 1.1 Database Schema Implementation

#### Step 1: Create Core Automation Tables

```sql
-- File: /Users/iamomen/apple-mcp/database/migrations/005_automation_workflow_schema.sql

-- Core workflow definition table
CREATE TABLE automation_workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    user_id INTEGER DEFAULT 1, -- Will reference users table when implemented
    is_active BOOLEAN DEFAULT false,
    workflow_data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    category VARCHAR(50) DEFAULT 'custom',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_executed TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0
);

-- Workflow execution tracking
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES automation_workflows(id) ON DELETE CASCADE,
    email_id BIGINT REFERENCES messages(ROWID),
    execution_status VARCHAR(20) CHECK (execution_status IN ('pending', 'running', 'success', 'failed', 'partial')) DEFAULT 'pending',
    execution_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    actions_performed JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Individual action execution tracking
CREATE TABLE action_executions (
    id SERIAL PRIMARY KEY,
    workflow_execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL,
    execution_status VARCHAR(20) CHECK (execution_status IN ('success', 'failed', 'skipped', 'retry')) DEFAULT 'pending',
    result_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Automation processing queue
CREATE TABLE automation_queue (
    id SERIAL PRIMARY KEY,
    email_id BIGINT REFERENCES messages(ROWID),
    event_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    scheduled_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    workflow_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow templates for reuse
CREATE TABLE workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    complexity VARCHAR(20) CHECK (complexity IN ('simple', 'intermediate', 'advanced')) DEFAULT 'simple',
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    created_by INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_workflows_user_active ON automation_workflows(user_id, is_active);
CREATE INDEX idx_workflows_category ON automation_workflows(category, is_active);
CREATE INDEX idx_executions_workflow_status ON workflow_executions(workflow_id, execution_status);
CREATE INDEX idx_executions_email_time ON workflow_executions(email_id, started_at);
CREATE INDEX idx_action_executions_workflow ON action_executions(workflow_execution_id);
CREATE INDEX idx_queue_status_priority ON automation_queue(status, priority, scheduled_at);
CREATE INDEX idx_queue_email ON automation_queue(email_id);
CREATE INDEX idx_templates_category_public ON workflow_templates(category, is_public);

-- Add trigger for workflow update timestamp
CREATE OR REPLACE FUNCTION update_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_update_trigger
    BEFORE UPDATE ON automation_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_timestamp();
```

#### Step 2: Create PostgreSQL Triggers for Real-time Processing

```sql
-- File: /Users/iamomen/apple-mcp/database/functions/automation_triggers.sql

-- Function to process new emails for automation
CREATE OR REPLACE FUNCTION process_email_automation()
RETURNS TRIGGER AS $$
DECLARE
    active_workflow_count INTEGER;
BEGIN
    -- Check if there are any active workflows
    SELECT COUNT(*) INTO active_workflow_count 
    FROM automation_workflows 
    WHERE is_active = true;
    
    -- Only queue for processing if there are active workflows
    IF active_workflow_count > 0 THEN
        -- Insert into automation queue
        INSERT INTO automation_queue (
            email_id, 
            event_type, 
            priority,
            scheduled_at
        ) VALUES (
            NEW.ROWID, 
            CASE 
                WHEN NEW.remote_id IS NULL THEN 'EMAIL_SENT'
                ELSE 'EMAIL_RECEIVED'
            END,
            CASE 
                WHEN (NEW.flags & 1) > 0 THEN 'high'  -- Flagged emails get high priority
                WHEN (NEW.flags & 2) > 0 THEN 'urgent' -- Read flag sometimes indicates urgency
                ELSE 'normal'
            END,
            NOW()
        );
        
        -- Notify the Node.js application via PostgreSQL NOTIFY
        PERFORM pg_notify('email_automation', json_build_object(
            'email_id', NEW.ROWID,
            'event_type', CASE 
                WHEN NEW.remote_id IS NULL THEN 'EMAIL_SENT'
                ELSE 'EMAIL_RECEIVED'
            END,
            'priority', CASE 
                WHEN (NEW.flags & 1) > 0 THEN 'high'
                ELSE 'normal'
            END,
            'timestamp', extract(epoch from NOW())
        )::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS email_automation_trigger ON messages;
CREATE TRIGGER email_automation_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION process_email_automation();

-- Function to get active workflows for a specific trigger type
CREATE OR REPLACE FUNCTION get_active_workflows_for_trigger(trigger_type TEXT)
RETURNS TABLE (
    workflow_id INTEGER,
    workflow_name TEXT,
    workflow_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aw.id,
        aw.name,
        aw.workflow_data
    FROM automation_workflows aw
    WHERE aw.is_active = true
      AND aw.workflow_data->'nodes' @> json_build_array(
          json_build_object('type', trigger_type)
      )::jsonb;
END;
$$ LANGUAGE plpgsql;

-- Function to update workflow execution statistics
CREATE OR REPLACE FUNCTION update_workflow_stats(
    p_workflow_id INTEGER,
    p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    UPDATE automation_workflows 
    SET 
        execution_count = execution_count + 1,
        success_count = CASE WHEN p_success THEN success_count + 1 ELSE success_count END,
        failure_count = CASE WHEN NOT p_success THEN failure_count + 1 ELSE failure_count END,
        last_executed = NOW()
    WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;
```

### 1.2 Backend API Implementation

#### Step 1: Create Express Routes for Workflow Management

```javascript
// File: /Users/iamomen/apple-mcp/src/routes/automation-routes.js

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const WorkflowManager = require('../services/WorkflowManager');
const WorkflowValidator = require('../services/WorkflowValidator');
const WorkflowExecutor = require('../services/WorkflowExecutor');

const router = express.Router();
const workflowManager = new WorkflowManager();
const workflowValidator = new WorkflowValidator();
const workflowExecutor = new WorkflowExecutor();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

// Create new workflow
router.post('/workflows', [
  body('name').isLength({ min: 1, max: 200 }).trim(),
  body('description').optional().isLength({ max: 1000 }),
  body('workflowData').isObject(),
  body('isActive').optional().isBoolean(),
  body('category').optional().isLength({ max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, description, workflowData, isActive = false, category = 'custom' } = req.body;
    
    // Validate workflow structure
    const validationResult = await workflowValidator.validateWorkflow(workflowData);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WORKFLOW_INVALID',
          message: 'Workflow validation failed',
          details: validationResult.errors
        }
      });
    }
    
    // Create workflow
    const workflow = await workflowManager.createWorkflow({
      name,
      description,
      workflowData,
      isActive,
      category,
      userId: req.user?.id || 1 // Default user for now
    });
    
    res.status(201).json({
      success: true,
      workflowId: workflow.id,
      version: workflow.version,
      validationResult,
      createdAt: workflow.created_at
    });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

// List workflows
router.get('/workflows', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isLength({ max: 50 }),
  query('isActive').optional().isBoolean(),
  query('search').optional().isLength({ max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      isActive,
      search,
      sortBy = 'updated_at',
      sortOrder = 'desc'
    } = req.query;
    
    const result = await workflowManager.listWorkflows({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      isActive: isActive ? JSON.parse(isActive) : undefined,
      search,
      sortBy,
      sortOrder,
      userId: req.user?.id || 1
    });
    
    res.json({
      success: true,
      workflows: result.workflows,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

// Get workflow details
router.get('/workflows/:id', [
  param('id').isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const workflow = await workflowManager.getWorkflow(workflowId, req.user?.id || 1);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found'
        }
      });
    }
    
    // Get execution statistics
    const statistics = await workflowManager.getWorkflowStatistics(workflowId);
    
    res.json({
      success: true,
      workflow: {
        ...workflow,
        statistics
      }
    });
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

// Update workflow
router.put('/workflows/:id', [
  param('id').isInt(),
  body('name').optional().isLength({ min: 1, max: 200 }),
  body('description').optional().isLength({ max: 1000 }),
  body('workflowData').optional().isObject(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const updates = req.body;
    
    // Validate workflow if workflowData is being updated
    if (updates.workflowData) {
      const validationResult = await workflowValidator.validateWorkflow(updates.workflowData);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WORKFLOW_INVALID',
            message: 'Workflow validation failed',
            details: validationResult.errors
          }
        });
      }
    }
    
    const workflow = await workflowManager.updateWorkflow(workflowId, updates, req.user?.id || 1);
    
    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

// Test workflow
router.post('/workflows/:id/test', [
  param('id').isInt(),
  body('testData').isObject(),
  body('dryRun').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { testData, dryRun = true } = req.body;
    
    const testResult = await workflowExecutor.testWorkflow(workflowId, testData, dryRun);
    
    res.json({
      success: true,
      testExecutionId: testResult.executionId,
      results: testResult
    });
  } catch (error) {
    console.error('Test workflow error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message
      }
    });
  }
});

// Get workflow executions
router.get('/executions', [
  query('workflowId').optional().isInt(),
  query('status').optional().isIn(['success', 'failed', 'partial', 'running']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const filters = {
      workflowId: req.query.workflowId ? parseInt(req.query.workflowId) : undefined,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: parseInt(req.query.page || 1),
      limit: parseInt(req.query.limit || 20)
    };
    
    const result = await workflowManager.getExecutions(filters);
    
    res.json({
      success: true,
      executions: result.executions,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get executions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

// Get workflow templates
router.get('/templates', [
  query('category').optional().isLength({ max: 50 }),
  query('complexity').optional().isIn(['simple', 'intermediate', 'advanced']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { category, complexity, limit = 20 } = req.query;
    
    const templates = await workflowManager.getTemplates({
      category,
      complexity,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router;
```

#### Step 2: Create Core Workflow Services

```javascript
// File: /Users/iamomen/apple-mcp/src/services/WorkflowManager.js

const { Pool } = require('pg');

class WorkflowManager {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'apple_mail_db',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
  }

  async createWorkflow(workflowData) {
    const client = await this.pool.connect();
    try {
      const {
        name,
        description,
        workflowData: data,
        isActive,
        category,
        userId
      } = workflowData;

      const result = await client.query(`
        INSERT INTO automation_workflows (
          name, description, user_id, is_active, 
          workflow_data, category
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, description, userId, isActive, JSON.stringify(data), category]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async listWorkflows(options) {
    const client = await this.pool.connect();
    try {
      const {
        page,
        limit,
        category,
        isActive,
        search,
        sortBy,
        sortOrder,
        userId
      } = options;

      let whereClause = 'WHERE user_id = $1';
      let params = [userId];
      let paramIndex = 2;

      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        params.push(isActive);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total 
        FROM automation_workflows 
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get workflows
      const workflowsResult = await client.query(`
        SELECT 
          id,
          name,
          description,
          category,
          is_active,
          version,
          execution_count,
          success_count,
          failure_count,
          last_executed,
          created_at,
          updated_at,
          CASE 
            WHEN execution_count > 0 THEN ROUND((success_count::decimal / execution_count) * 100, 1)
            ELSE 0
          END as success_rate
        FROM automation_workflows 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        workflows: workflowsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } finally {
      client.release();
    }
  }

  async getWorkflow(workflowId, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM automation_workflows 
        WHERE id = $1 AND user_id = $2
      `, [workflowId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateWorkflow(workflowId, updates, userId) {
    const client = await this.pool.connect();
    try {
      const setClause = [];
      const params = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'workflowData') {
          setClause.push(`workflow_data = $${paramIndex}`);
          params.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${paramIndex}`);
          params.push(value);
        }
        paramIndex++;
      });

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push('version = version + 1');

      const result = await client.query(`
        UPDATE automation_workflows 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `, [...params, workflowId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Workflow not found or access denied');
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getWorkflowStatistics(workflowId) {
    const client = await this.pool.connect();
    try {
      // Get execution statistics
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN execution_status = 'success' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN execution_status = 'failed' THEN 1 END) as failed_executions,
          AVG(execution_time_ms) as average_execution_time
        FROM workflow_executions 
        WHERE workflow_id = $1
      `, [workflowId]);

      // Get latest execution
      const latestResult = await client.query(`
        SELECT 
          id,
          execution_status,
          started_at,
          completed_at,
          execution_time_ms,
          error_message
        FROM workflow_executions 
        WHERE workflow_id = $1 
        ORDER BY started_at DESC 
        LIMIT 1
      `, [workflowId]);

      return {
        totalExecutions: parseInt(statsResult.rows[0].total_executions),
        successfulExecutions: parseInt(statsResult.rows[0].successful_executions),
        failedExecutions: parseInt(statsResult.rows[0].failed_executions),
        averageExecutionTime: Math.round(parseFloat(statsResult.rows[0].average_execution_time) || 0),
        lastExecution: latestResult.rows[0] || null
      };
    } finally {
      client.release();
    }
  }

  async getExecutions(filters) {
    const client = await this.pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramIndex = 1;

      if (filters.workflowId) {
        whereClause += ` AND workflow_id = $${paramIndex}`;
        params.push(filters.workflowId);
        paramIndex++;
      }

      if (filters.status) {
        whereClause += ` AND execution_status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.dateFrom) {
        whereClause += ` AND started_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        whereClause += ` AND started_at <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      const offset = (filters.page - 1) * filters.limit;

      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total 
        FROM workflow_executions we
        JOIN automation_workflows aw ON we.workflow_id = aw.id
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get executions
      const executionsResult = await client.query(`
        SELECT 
          we.id,
          we.workflow_id,
          aw.name as workflow_name,
          we.email_id,
          we.execution_status,
          we.execution_time_ms,
          jsonb_array_length(we.actions_performed) as actions_performed,
          we.error_message,
          we.started_at,
          we.completed_at
        FROM workflow_executions we
        JOIN automation_workflows aw ON we.workflow_id = aw.id
        ${whereClause}
        ORDER BY we.started_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, filters.limit, offset]);

      return {
        executions: executionsResult.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit)
        }
      };
    } finally {
      client.release();
    }
  }

  async getTemplates(options) {
    const client = await this.pool.connect();
    try {
      let whereClause = 'WHERE is_public = true';
      let params = [];
      let paramIndex = 1;

      if (options.category) {
        whereClause += ` AND category = $${paramIndex}`;
        params.push(options.category);
        paramIndex++;
      }

      if (options.complexity) {
        whereClause += ` AND complexity = $${paramIndex}`;
        params.push(options.complexity);
        paramIndex++;
      }

      const result = await client.query(`
        SELECT 
          id,
          name,
          description,
          category,
          complexity,
          usage_count,
          rating,
          template_data,
          created_at,
          jsonb_array_length(template_data->'nodes') as node_count
        FROM workflow_templates 
        ${whereClause}
        ORDER BY usage_count DESC, rating DESC
        LIMIT $${paramIndex}
      `, [...params, options.limit]);

      return result.rows.map(template => ({
        ...template,
        preview: {
          nodeCount: template.node_count,
          triggerTypes: this.extractNodeTypes(template.template_data, 'trigger'),
          actionTypes: this.extractNodeTypes(template.template_data, 'action'),
          estimatedSetupTime: this.estimateSetupTime(template.template_data)
        }
      }));
    } finally {
      client.release();
    }
  }

  extractNodeTypes(templateData, typePrefix) {
    if (!templateData.nodes) return [];
    
    return templateData.nodes
      .filter(node => node.type.toLowerCase().startsWith(typePrefix))
      .map(node => node.type)
      .filter((type, index, arr) => arr.indexOf(type) === index); // Remove duplicates
  }

  estimateSetupTime(templateData) {
    if (!templateData.nodes) return 5;
    
    const nodeCount = templateData.nodes.length;
    const complexityFactors = {
      EMAIL_TRIGGER: 1,
      CONDITION_AI: 3,
      ACTION_REPLY: 2,
      ACTION_TASK: 2,
      LOGIC_AND: 1,
      LOGIC_OR: 1
    };

    const totalComplexity = templateData.nodes.reduce((sum, node) => {
      return sum + (complexityFactors[node.type] || 2);
    }, 0);

    return Math.max(5, Math.round(totalComplexity * 1.5)); // Minimum 5 minutes
  }
}

module.exports = WorkflowManager;
```

### 1.3 Queue Processing System

```javascript
// File: /Users/iamomen/apple-mcp/src/services/AutomationQueueProcessor.js

const { Pool } = require('pg');
const WorkflowExecutor = require('./WorkflowExecutor');
const logger = require('../utils/logger');

class AutomationQueueProcessor {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'apple_mail_db',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });

    this.workflowExecutor = new WorkflowExecutor();
    this.isProcessing = false;
    this.maxConcurrency = parseInt(process.env.AUTOMATION_MAX_CONCURRENCY) || 5;
    this.processingInterval = parseInt(process.env.AUTOMATION_PROCESSING_INTERVAL) || 2000;
    this.workers = [];
  }

  async start() {
    logger.info('🚀 Starting Automation Queue Processor');
    
    // Listen for PostgreSQL notifications
    const notificationClient = await this.pool.connect();
    await notificationClient.query('LISTEN email_automation');
    
    notificationClient.on('notification', async (notification) => {
      if (notification.channel === 'email_automation') {
        try {
          const payload = JSON.parse(notification.payload);
          logger.info(`📧 Received email automation notification:`, payload);
          
          // Trigger immediate processing for high priority emails
          if (payload.priority === 'high' || payload.priority === 'urgent') {
            await this.processQueueItem(payload.email_id);
          }
        } catch (error) {
          logger.error('Error processing notification:', error);
        }
      }
    });

    // Start worker processes
    for (let i = 0; i < this.maxConcurrency; i++) {
      this.workers.push(this.startWorker(i));
    }

    logger.info(`🔧 Started ${this.maxConcurrency} automation workers`);
  }

  async startWorker(workerId) {
    logger.info(`👷 Starting automation worker ${workerId}`);
    
    while (true) {
      try {
        if (!this.isProcessing) {
          const processed = await this.processNextQueueItem(workerId);
          
          if (!processed) {
            // No items to process, wait before checking again
            await this.sleep(this.processingInterval);
          }
        } else {
          await this.sleep(1000);
        }
      } catch (error) {
        logger.error(`❌ Worker ${workerId} error:`, error);
        await this.sleep(5000); // Wait longer on error
      }
    }
  }

  async processNextQueueItem(workerId) {
    const client = await this.pool.connect();
    
    try {
      // Get next queue item with row-level locking
      await client.query('BEGIN');
      
      const queueResult = await client.query(`
        SELECT * FROM automation_queue 
        WHERE status = 'pending' 
          AND (scheduled_at <= NOW() OR priority IN ('high', 'urgent'))
          AND retry_count < max_retries
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (queueResult.rows.length === 0) {
        await client.query('COMMIT');
        return false; // No items to process
      }

      const queueItem = queueResult.rows[0];
      
      // Mark as processing
      await client.query(`
        UPDATE automation_queue 
        SET status = 'processing', 
            processing_started_at = NOW()
        WHERE id = $1
      `, [queueItem.id]);

      await client.query('COMMIT');
      
      logger.info(`🔄 Worker ${workerId} processing queue item ${queueItem.id} (email ${queueItem.email_id})`);

      // Process the queue item
      await this.processQueueItem(queueItem.email_id, queueItem);
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async processQueueItem(emailId, queueItem = null) {
    const startTime = Date.now();
    
    try {
      // Get email data
      const emailData = await this.getEmailData(emailId);
      if (!emailData) {
        logger.warn(`📧 Email ${emailId} not found, skipping processing`);
        return;
      }

      // Get active workflows that match this email event
      const workflows = await this.getMatchingWorkflows(emailData, queueItem?.event_type || 'EMAIL_RECEIVED');
      
      logger.info(`🔍 Found ${workflows.length} matching workflows for email ${emailId}`);

      let successCount = 0;
      let failureCount = 0;

      // Execute each matching workflow
      for (const workflow of workflows) {
        try {
          const executionResult = await this.workflowExecutor.executeWorkflow(
            workflow,
            emailData,
            queueItem?.event_type || 'EMAIL_RECEIVED'
          );
          
          if (executionResult.success) {
            successCount++;
            logger.info(`✅ Workflow ${workflow.id} executed successfully for email ${emailId}`);
          } else {
            failureCount++;
            logger.warn(`⚠️ Workflow ${workflow.id} execution failed for email ${emailId}:`, executionResult.error);
          }
        } catch (error) {
          failureCount++;
          logger.error(`❌ Workflow ${workflow.id} execution error for email ${emailId}:`, error);
        }
      }

      // Update queue item status
      if (queueItem) {
        await this.updateQueueItemStatus(queueItem.id, 'completed', null, {
          workflows_executed: workflows.length,
          successful_executions: successCount,
          failed_executions: failureCount,
          processing_time_ms: Date.now() - startTime
        });
      }

      logger.info(`📊 Processed email ${emailId}: ${successCount} success, ${failureCount} failures`);

    } catch (error) {
      logger.error(`❌ Queue processing error for email ${emailId}:`, error);
      
      if (queueItem) {
        // Check if we should retry
        if (queueItem.retry_count < queueItem.max_retries) {
          await this.scheduleRetry(queueItem.id, error.message);
        } else {
          await this.updateQueueItemStatus(queueItem.id, 'failed', error.message);
        }
      }
    }
  }

  async getEmailData(emailId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          m.ROWID as id,
          m.message_id,
          m.global_message_id,
          s.subject,
          a.address as sender_email,
          a.comment as sender_name,
          m.date_received,
          m.date_sent,
          m.flags,
          m.read,
          m.flagged,
          mb.url as mailbox_url,
          
          -- Get AI analysis if available
          ai.classification,
          ai.urgency,
          ai.confidence,
          ai.task_title,
          ai.task_description,
          ai.suggested_action,
          ai.tags
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses a ON m.sender = a.ROWID  
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        LEFT JOIN email_ai_analysis ai ON m.ROWID = ai.message_rowid
        WHERE m.ROWID = $1
      `, [emailId]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getMatchingWorkflows(emailData, eventType) {
    const client = await this.pool.connect();
    try {
      // Get all active workflows
      const result = await client.query(`
        SELECT id, name, workflow_data 
        FROM automation_workflows 
        WHERE is_active = true
      `);

      const matchingWorkflows = [];

      for (const workflow of result.rows) {
        if (await this.workflowMatchesEmail(workflow, emailData, eventType)) {
          matchingWorkflows.push(workflow);
        }
      }

      return matchingWorkflows;
    } finally {
      client.release();
    }
  }

  async workflowMatchesEmail(workflow, emailData, eventType) {
    try {
      const workflowData = workflow.workflow_data;
      const triggerNodes = workflowData.nodes.filter(node => 
        node.type === 'EMAIL_TRIGGER' || node.type.startsWith('TRIGGER_')
      );

      for (const triggerNode of triggerNodes) {
        if (await this.evaluateTrigger(triggerNode, emailData, eventType)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error(`Error evaluating workflow ${workflow.id} match:`, error);
      return false;
    }
  }

  async evaluateTrigger(triggerNode, emailData, eventType) {
    const properties = triggerNode.properties || {};

    // Check event type match
    if (properties.eventType && properties.eventType !== eventType.toLowerCase()) {
      return false;
    }

    // Check sender filter
    if (properties.senderFilter && properties.senderFilter.length > 0) {
      const senderMatches = properties.senderFilter.some(filter => {
        if (filter.includes('@')) {
          // Exact email match
          return emailData.sender_email === filter;
        } else {
          // Domain match
          return emailData.sender_email?.endsWith(`@${filter}`);
        }
      });
      
      if (!senderMatches) {
        return false;
      }
    }

    // Check subject pattern
    if (properties.subjectPattern) {
      try {
        const regex = new RegExp(properties.subjectPattern, 'i');
        if (!regex.test(emailData.subject || '')) {
          return false;
        }
      } catch (error) {
        logger.warn(`Invalid regex pattern in trigger: ${properties.subjectPattern}`);
        return false;
      }
    }

    // Check mailbox filter
    if (properties.mailboxFilter && properties.mailboxFilter.length > 0) {
      const mailboxMatches = properties.mailboxFilter.some(filter => 
        emailData.mailbox_url?.includes(filter)
      );
      
      if (!mailboxMatches) {
        return false;
      }
    }

    // Check time window
    if (properties.timeWindow) {
      const emailTime = new Date(emailData.date_received * 1000);
      if (!this.isInTimeWindow(emailTime, properties.timeWindow)) {
        return false;
      }
    }

    return true;
  }

  isInTimeWindow(emailTime, timeWindow) {
    const emailDay = emailTime.getDay(); // 0 = Sunday
    const emailHour = emailTime.getHours();
    const emailMinute = emailTime.getMinutes();

    // Check day of week
    if (timeWindow.daysOfWeek && !timeWindow.daysOfWeek.includes(emailDay)) {
      return false;
    }

    // Check time range
    if (timeWindow.start && timeWindow.end) {
      const [startHour, startMinute] = timeWindow.start.split(':').map(Number);
      const [endHour, endMinute] = timeWindow.end.split(':').map(Number);

      const emailMinutes = emailHour * 60 + emailMinute;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (startMinutes <= endMinutes) {
        // Same day range
        return emailMinutes >= startMinutes && emailMinutes <= endMinutes;
      } else {
        // Overnight range
        return emailMinutes >= startMinutes || emailMinutes <= endMinutes;
      }
    }

    return true;
  }

  async updateQueueItemStatus(queueId, status, errorMessage = null, metadata = null) {
    const client = await this.pool.connect();
    try {
      await client.query(`
        UPDATE automation_queue 
        SET 
          status = $1,
          processing_completed_at = NOW(),
          error_message = $2
        WHERE id = $3
      `, [status, errorMessage, queueId]);

      if (metadata) {
        logger.info(`📈 Queue item ${queueId} metadata:`, metadata);
      }
    } finally {
      client.release();
    }
  }

  async scheduleRetry(queueId, errorMessage) {
    const client = await this.pool.connect();
    try {
      await client.query(`
        UPDATE automation_queue 
        SET 
          status = 'pending',
          retry_count = retry_count + 1,
          scheduled_at = NOW() + INTERVAL '5 minutes',
          error_message = $1,
          processing_started_at = NULL,
          processing_completed_at = NULL
        WHERE id = $2
      `, [errorMessage, queueId]);

      logger.info(`🔄 Scheduled retry for queue item ${queueId}`);
    } finally {
      client.release();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    logger.info('🛑 Stopping Automation Queue Processor');
    this.isProcessing = true; // Stop processing new items
    
    // Wait for current operations to complete
    await this.sleep(5000);
    
    await this.pool.end();
    logger.info('✅ Automation Queue Processor stopped');
  }
}

module.exports = AutomationQueueProcessor;
```

This implementation guide provides the foundation for the automation workflow system. The next sections would cover the frontend React components, advanced AI integration, and production deployment considerations.

Key features implemented:
1. **Comprehensive database schema** with proper indexing and triggers
2. **RESTful API endpoints** with validation and error handling  
3. **Queue processing system** with worker pool and retry mechanisms
4. **Workflow matching engine** with flexible trigger evaluation
5. **Real-time notifications** using PostgreSQL LISTEN/NOTIFY
6. **Scalable architecture** supporting multiple concurrent workers

The system is designed to integrate seamlessly with the existing Apple Mail task management infrastructure while providing powerful automation capabilities.