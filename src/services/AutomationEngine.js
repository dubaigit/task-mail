/**
 * Automation Engine Service
 * 
 * Implements CLAUDE.md requirements:
 * - Rule-based email automation
 * - Smart filtering and actions
 * - Integration with GPT service
 * - Real-time rule execution
 */

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const EventEmitter = require('events');
const GPTService = require('./GPTService');

class AutomationEngine extends EventEmitter {
  constructor() {
    super();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/automation-engine.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    });

    this.rules = new Map();
    this.activeRules = new Set();
    this.isRunning = false;
    this.supabase = null;
    this.gptService = null;
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      lastExecutionTime: null
    };
  }

  /**
   * Initialize the automation engine
   */
  async initialize() {
    try {
      // Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Initialize GPT Service
      this.gptService = new GPTService();
      await this.gptService.initialize();

      // Load automation rules
      await this.loadRules();

      // Set up real-time subscription for rule changes
      this.setupRuleSubscriptions();

      this.isRunning = true;
      this.logger.info('✅ Automation Engine initialized');
      this.emit('initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize automation engine:', error);
      throw error;
    }
  }

  /**
   * Load all active automation rules from database
   */
  async loadRules() {
    try {
      const { data: rules, error } = await this.supabase
        .from('automation_rules')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      this.rules.clear();
      this.activeRules.clear();

      for (const rule of rules || []) {
        this.rules.set(rule.id, rule);
        if (rule.enabled) {
          this.activeRules.add(rule.id);
        }
      }

      this.logger.info(`Loaded ${this.rules.size} automation rules`);
      return this.rules;
    } catch (error) {
      this.logger.error('Failed to load automation rules:', error);
      return new Map();
    }
  }

  /**
   * Set up real-time subscriptions for rule changes
   */
  setupRuleSubscriptions() {
    // Subscribe to rule changes
    this.supabase
      .channel('automation_rules_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'automation_rules' 
        },
        (payload) => {
          this.handleRuleChange(payload);
        }
      )
      .subscribe();
  }

  /**
   * Handle rule changes in real-time
   */
  handleRuleChange(payload) {
    const { eventType, new: newRule, old: oldRule } = payload;

    switch (eventType) {
      case 'INSERT':
        if (newRule.enabled) {
          this.rules.set(newRule.id, newRule);
          this.activeRules.add(newRule.id);
          this.logger.info(`Added new rule: ${newRule.name}`);
        }
        break;

      case 'UPDATE':
        this.rules.set(newRule.id, newRule);
        if (newRule.enabled) {
          this.activeRules.add(newRule.id);
        } else {
          this.activeRules.delete(newRule.id);
        }
        this.logger.info(`Updated rule: ${newRule.name}`);
        break;

      case 'DELETE':
        this.rules.delete(oldRule.id);
        this.activeRules.delete(oldRule.id);
        this.logger.info(`Removed rule: ${oldRule.name}`);
        break;
    }

    this.emit('rules-updated', this.rules);
  }

  /**
   * Process email through automation rules
   */
  async processEmail(email) {
    if (!this.isRunning) {
      this.logger.warn('Automation engine is not running');
      return null;
    }

    const results = [];
    const applicableRules = await this.findApplicableRules(email);

    this.logger.info(`Found ${applicableRules.length} applicable rules for email ${email.id}`);

    for (const rule of applicableRules) {
      try {
        const result = await this.executeRule(rule, email);
        if (result) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            actions: result,
            executedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        this.logger.error(`Failed to execute rule ${rule.name}:`, error);
        this.executionStats.failedExecutions++;
      }
    }

    this.executionStats.totalExecutions++;
    this.executionStats.lastExecutionTime = new Date();

    if (results.length > 0) {
      this.executionStats.successfulExecutions++;
      this.emit('email-processed', { email, results });
    }

    return results;
  }

  /**
   * Find rules that apply to an email
   */
  async findApplicableRules(email) {
    const applicable = [];

    for (const ruleId of this.activeRules) {
      const rule = this.rules.get(ruleId);
      if (!rule) continue;

      const matches = await this.evaluateConditions(rule.conditions, email);
      if (matches) {
        applicable.push(rule);
      }
    }

    // Sort by priority
    applicable.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return applicable;
  }

  /**
   * Evaluate rule conditions against email
   */
  async evaluateConditions(conditions, email) {
    if (!conditions || conditions.length === 0) return false;

    const operator = conditions.operator || 'AND';
    const results = [];

    for (const condition of conditions.conditions || []) {
      const result = await this.evaluateCondition(condition, email);
      results.push(result);
    }

    if (operator === 'AND') {
      return results.every(r => r === true);
    } else if (operator === 'OR') {
      return results.some(r => r === true);
    }

    return false;
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition, email) {
    const { field, operator, value } = condition;
    const emailValue = this.getFieldValue(email, field);

    switch (operator) {
      case 'equals':
        return emailValue === value;
      
      case 'contains':
        return emailValue && emailValue.toString().toLowerCase().includes(value.toLowerCase());
      
      case 'starts_with':
        return emailValue && emailValue.toString().toLowerCase().startsWith(value.toLowerCase());
      
      case 'ends_with':
        return emailValue && emailValue.toString().toLowerCase().endsWith(value.toLowerCase());
      
      case 'matches_regex':
        try {
          const regex = new RegExp(value, 'i');
          return regex.test(emailValue);
        } catch (e) {
          return false;
        }
      
      case 'in_list':
        return Array.isArray(value) && value.includes(emailValue);
      
      case 'has_attachment':
        return email.has_attachments === (value === 'true');
      
      case 'is_flagged':
        return email.is_flagged === (value === 'true');
      
      case 'is_read':
        return email.is_read === (value === 'true');
      
      case 'priority_is':
        return email.priority === value;
      
      default:
        this.logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get field value from email
   */
  getFieldValue(email, field) {
    switch (field) {
      case 'sender':
        return email.sender;
      case 'subject':
        return email.subject;
      case 'content':
        return email.message_content;
      case 'to':
        return email.to_recipients?.join(', ');
      case 'cc':
        return email.cc_recipients?.join(', ');
      case 'folder':
        return email.folder_path;
      case 'has_attachments':
        return email.has_attachments;
      case 'attachment_count':
        return email.attachment_count;
      case 'is_flagged':
        return email.is_flagged;
      case 'is_read':
        return email.is_read;
      case 'priority':
        return email.priority;
      default:
        return email[field];
    }
  }

  /**
   * Execute rule actions
   */
  async executeRule(rule, email) {
    const results = [];

    for (const action of rule.actions || []) {
      try {
        const result = await this.executeAction(action, email, rule);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        this.logger.error(`Failed to execute action ${action.type}:`, error);
      }
    }

    // Log rule execution
    await this.logRuleExecution(rule, email, results);

    return results;
  }

  /**
   * Execute a single action
   */
  async executeAction(action, email, rule) {
    switch (action.type) {
      case 'move_to_folder':
        return await this.moveToFolder(email, action.folder);
      
      case 'add_label':
        return await this.addLabel(email, action.label);
      
      case 'mark_as_read':
        return await this.markAsRead(email);
      
      case 'mark_as_flagged':
        return await this.markAsFlagged(email, action.color);
      
      case 'set_priority':
        return await this.setPriority(email, action.priority);
      
      case 'auto_reply':
        return await this.createAutoReply(email, action.template);
      
      case 'forward':
        return await this.forwardEmail(email, action.recipients);
      
      case 'create_task':
        return await this.createTask(email, action.task_template);
      
      case 'categorize':
        return await this.categorizeEmail(email, action.category);
      
      case 'archive':
        return await this.archiveEmail(email);
      
      case 'delete':
        return await this.deleteEmail(email);
      
      case 'snooze':
        return await this.snoozeEmail(email, action.until);
      
      case 'webhook':
        return await this.callWebhook(email, action.webhook_url);
      
      case 'ai_classify':
        return await this.aiClassify(email);
      
      case 'ai_generate_draft':
        return await this.aiGenerateDraft(email, action.context);
      
      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  // Action implementations

  async moveToFolder(email, folder) {
    const { error } = await this.supabase
      .from('emails')
      .update({ folder_path: folder, mailbox: folder })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'move_to_folder', folder };
  }

  async addLabel(email, label) {
    const labels = email.labels || [];
    if (!labels.includes(label)) {
      labels.push(label);
      
      const { error } = await this.supabase
        .from('emails')
        .update({ labels })
        .eq('id', email.id);

      if (error) throw error;
    }
    return { action: 'add_label', label };
  }

  async markAsRead(email) {
    const { error } = await this.supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'mark_as_read' };
  }

  async markAsFlagged(email, color) {
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        is_flagged: true,
        flag_color: color || 1
      })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'mark_as_flagged', color };
  }

  async setPriority(email, priority) {
    const { error } = await this.supabase
      .from('emails')
      .update({ priority })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'set_priority', priority };
  }

  async createAutoReply(email, template) {
    const draft = await this.gptService.generateDraft(email, {
      template,
      type: 'auto_reply'
    });

    return { action: 'auto_reply', draft_id: draft.id };
  }

  async forwardEmail(email, recipients) {
    const draft = {
      subject: `Fwd: ${email.subject}`,
      content: `---------- Forwarded message ----------\nFrom: ${email.sender}\nDate: ${email.date_received}\nSubject: ${email.subject}\n\n${email.message_content}`,
      to_recipients: recipients,
      original_email_id: email.id,
      type: 'forward'
    };

    const { data, error } = await this.supabase
      .from('drafts')
      .insert(draft)
      .select()
      .single();

    if (error) throw error;
    return { action: 'forward', draft_id: data.id, recipients };
  }

  async createTask(email, taskTemplate) {
    const tasks = await this.gptService.generateTasks(email);
    
    if (taskTemplate) {
      // Merge with template
      tasks.forEach(task => {
        Object.assign(task, taskTemplate);
      });
    }

    const { data, error } = await this.supabase
      .from('tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return { action: 'create_task', task_ids: data.map(t => t.id) };
  }

  async categorizeEmail(email, category) {
    const { error } = await this.supabase
      .from('emails')
      .update({ category })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'categorize', category };
  }

  async archiveEmail(email) {
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        folder_path: 'Archive',
        archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'archive' };
  }

  async deleteEmail(email) {
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'delete' };
  }

  async snoozeEmail(email, until) {
    const snoozeUntil = new Date(until).toISOString();
    
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        snoozed: true,
        snoozed_until: snoozeUntil
      })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'snooze', until: snoozeUntil };
  }

  async callWebhook(email, webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: email.id,
          subject: email.subject,
          sender: email.sender,
          received_at: email.date_received
        })
      });

      return { 
        action: 'webhook', 
        url: webhookUrl, 
        status: response.status 
      };
    } catch (error) {
      this.logger.error(`Webhook call failed: ${error.message}`);
      return null;
    }
  }

  async aiClassify(email) {
    const classification = await this.gptService.classifyEmail(email);
    
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        category: classification.category,
        priority: classification.priority,
        ai_classification: classification
      })
      .eq('id', email.id);

    if (error) throw error;
    return { action: 'ai_classify', classification };
  }

  async aiGenerateDraft(email, context) {
    const draft = await this.gptService.generateDraft(email, context);
    return { action: 'ai_generate_draft', draft_id: draft.id };
  }

  /**
   * Log rule execution
   */
  async logRuleExecution(rule, email, results) {
    try {
      await this.supabase
        .from('automation_logs')
        .insert({
          rule_id: rule.id,
          rule_name: rule.name,
          email_id: email.id,
          actions_executed: results,
          executed_at: new Date().toISOString(),
          status: results.length > 0 ? 'success' : 'no_action'
        });
    } catch (error) {
      this.logger.error('Failed to log rule execution:', error);
    }
  }

  /**
   * Create a new automation rule
   */
  async createRule(ruleData) {
    try {
      const rule = {
        name: ruleData.name,
        description: ruleData.description,
        conditions: ruleData.conditions,
        actions: ruleData.actions,
        priority: ruleData.priority || 0,
        enabled: ruleData.enabled !== false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('automation_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;

      // Add to local cache
      this.rules.set(data.id, data);
      if (data.enabled) {
        this.activeRules.add(data.id);
      }

      this.emit('rule-created', data);
      return data;
    } catch (error) {
      this.logger.error('Failed to create rule:', error);
      throw error;
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('automation_rules')
        .update(updates)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      this.rules.set(ruleId, data);
      if (data.enabled) {
        this.activeRules.add(ruleId);
      } else {
        this.activeRules.delete(ruleId);
      }

      this.emit('rule-updated', data);
      return data;
    } catch (error) {
      this.logger.error('Failed to update rule:', error);
      throw error;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId) {
    try {
      const { error } = await this.supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      // Remove from local cache
      const rule = this.rules.get(ruleId);
      this.rules.delete(ruleId);
      this.activeRules.delete(ruleId);

      this.emit('rule-deleted', rule);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete rule:', error);
      throw error;
    }
  }

  /**
   * Get all rules
   */
  getRules() {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId) {
    return this.rules.get(ruleId);
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      ...this.executionStats,
      totalRules: this.rules.size,
      activeRules: this.activeRules.size,
      isRunning: this.isRunning
    };
  }

  /**
   * Stop the automation engine
   */
  async stop() {
    this.isRunning = false;
    this.logger.info('Automation engine stopped');
    this.emit('stopped');
  }

  /**
   * Restart the automation engine
   */
  async restart() {
    await this.stop();
    await this.initialize();
    this.logger.info('Automation engine restarted');
    this.emit('restarted');
  }
}

module.exports = AutomationEngine;