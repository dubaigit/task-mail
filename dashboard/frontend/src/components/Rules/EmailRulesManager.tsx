/**
 * Email Rules Manager Component
 * 
 * Comprehensive interface for managing automated email processing rules.
 * Features advanced rule builder, testing capabilities, performance monitoring,
 * and real-time execution tracking with enterprise-grade user experience.
 * 
 * Features:
 * - Visual rule builder with condition/action management
 * - Real-time rule testing and validation
 * - Performance analytics and execution monitoring
 * - Bulk operations and rule templates
 * - WebSocket integration for live updates
 * - Task-centric dashboard design with dark theme
 * - Accessibility-compliant interface
 * 
 * @author Enterprise Email Management System
 * @date 2025-08-17
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Edit,
  Copy,
  Trash2,
  MoreVertical,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  TestTube,
  BarChart3,
  Workflow,
  Save,
  X,
  Zap,
  Target,
  Mail,
  Tag,
  Folder,
  Star,
  Archive,
  Forward,
  Reply
} from 'lucide-react';
import './EmailRulesManager.css';

// Types and interfaces

interface RuleCondition {
  id: string;
  type: string;
  operator: string;
  value: any;
  case_sensitive: boolean;
  negate: boolean;
}

interface RuleAction {
  id: string;
  type: string;
  parameters: Record<string, any>;
  enabled: boolean;
}

interface EmailRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  logic_operator: 'and' | 'or';
  actions: RuleAction[];
  priority: number;
  status: 'active' | 'inactive' | 'draft' | 'error';
  created_at: string;
  updated_at: string;
  last_executed?: string;
  execution_count: number;
  success_count: number;
  error_count: number;
}

interface RuleStatistics {
  rule_counts_by_status: Record<string, number>;
  top_performing_rules: Array<{
    name: string;
    execution_count: number;
    success_count: number;
    error_count: number;
    success_rate: number;
  }>;
  total_rules: number;
  total_executions: number;
  total_successes: number;
  total_errors: number;
  engine_stats: {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    avg_execution_time_ms: number;
  };
}

interface TestResult {
  rule_id: string;
  rule_name: string;
  conditions_matched: boolean;
  actions_would_execute: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  processing_time_ms: number;
}

// Constants

const CONDITION_TYPES = [
  { value: 'sender_email', label: 'Sender Email', icon: Mail },
  { value: 'sender_domain', label: 'Sender Domain', icon: Mail },
  { value: 'recipient_email', label: 'Recipient Email', icon: Mail },
  { value: 'subject_contains', label: 'Subject Contains', icon: Mail },
  { value: 'subject_regex', label: 'Subject Regex', icon: Mail },
  { value: 'body_contains', label: 'Body Contains', icon: Mail },
  { value: 'body_regex', label: 'Body Regex', icon: Mail },
  { value: 'has_attachment', label: 'Has Attachment', icon: Target },
  { value: 'attachment_type', label: 'Attachment Type', icon: Target },
  { value: 'email_size', label: 'Email Size', icon: Target },
  { value: 'date_received', label: 'Date Received', icon: Clock },
  { value: 'priority', label: 'Priority', icon: Star },
  { value: 'is_reply', label: 'Is Reply', icon: Reply },
  { value: 'is_forward', label: 'Is Forward', icon: Forward },
  { value: 'ai_sentiment', label: 'AI Sentiment', icon: Target },
  { value: 'ai_category', label: 'AI Category', icon: Tag }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex_match', label: 'Regex Match' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in_list', label: 'In List' },
  { value: 'not_in_list', label: 'Not In List' }
];

const ACTION_TYPES = [
  { value: 'move_to_folder', label: 'Move to Folder', icon: Folder },
  { value: 'copy_to_folder', label: 'Copy to Folder', icon: Copy },
  { value: 'add_tag', label: 'Add Tag', icon: Tag },
  { value: 'remove_tag', label: 'Remove Tag', icon: Tag },
  { value: 'set_priority', label: 'Set Priority', icon: Star },
  { value: 'mark_read', label: 'Mark as Read', icon: CheckCircle },
  { value: 'mark_unread', label: 'Mark as Unread', icon: CheckCircle },
  { value: 'delete', label: 'Delete', icon: Trash2 },
  { value: 'archive', label: 'Archive', icon: Archive },
  { value: 'forward', label: 'Forward', icon: Forward },
  { value: 'reply_template', label: 'Reply with Template', icon: Reply },
  { value: 'set_category', label: 'Set Category', icon: Tag },
  { value: 'create_task', label: 'Create Task', icon: Plus },
  { value: 'webhook', label: 'Trigger Webhook', icon: Zap },
  { value: 'stop_processing', label: 'Stop Processing', icon: Pause }
];

const EmailRulesManager: React.FC = () => {
  // State management
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [statistics, setStatistics] = useState<RuleStatistics | null>(null);
  const [selectedRule, setSelectedRule] = useState<EmailRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeView, setActiveView] = useState<'rules' | 'statistics' | 'testing'>('rules');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testEmail, setTestEmail] = useState({
    sender_email: '',
    subject: '',
    body_text: '',
    attachments: [],
    priority: 'normal'
  });

  // Rule form state
  const [ruleForm, setRuleForm] = useState<Partial<EmailRule>>({
    name: '',
    description: '',
    conditions: [],
    logic_operator: 'and',
    actions: [],
    priority: 100,
    status: 'active'
  });

  // WebSocket connection
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Load rules and statistics
  const loadRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/email-rules/');
      if (response.ok) {
        const rulesData = await response.json();
        setRules(rulesData);
      } else {
        throw new Error('Failed to load rules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/email-rules/statistics');
      if (response.ok) {
        const statsData = await response.json();
        setStatistics(statsData);
      }
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  }, []);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/email-rules/ws`);
      
      ws.onopen = () => {
        console.log('Rules WebSocket connected');
        setWsConnection(ws);
      };
      
      ws.onmessage = (event) => {
        const message = event.data;
        if (message.startsWith('rule_')) {
          // Reload rules on any rule change
          loadRules();
          loadStatistics();
        }
      };
      
      ws.onclose = () => {
        console.log('Rules WebSocket disconnected');
        setWsConnection(null);
        // Attempt to reconnect after 5 seconds
        setTimeout(initializeWebSocket, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('Rules WebSocket error:', error);
      };
      
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
    }
  }, [loadRules, loadStatistics]);

  // Initialize component
  useEffect(() => {
    loadRules();
    loadStatistics();
    initializeWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  // Filter rules based on search and status
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rule.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || rule.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rules, searchTerm, statusFilter]);

  // Rule CRUD operations
  const createRule = async (rule: Partial<EmailRule>) => {
    try {
      const response = await fetch('/api/v1/email-rules/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      
      if (response.ok) {
        const newRule = await response.json();
        setRules(prev => [...prev, newRule]);
        setIsCreating(false);
        setRuleForm({
          name: '',
          description: '',
          conditions: [],
          logic_operator: 'and',
          actions: [],
          priority: 100,
          status: 'active'
        });
      } else {
        throw new Error('Failed to create rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const updateRule = async (ruleId: string, rule: Partial<EmailRule>) => {
    try {
      const response = await fetch(`/api/v1/email-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      
      if (response.ok) {
        const updatedRule = await response.json();
        setRules(prev => prev.map(r => r.id === ruleId ? updatedRule : r));
        setIsEditing(false);
        setSelectedRule(null);
      } else {
        throw new Error('Failed to update rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/v1/email-rules/${ruleId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
        if (selectedRule?.id === ruleId) {
          setSelectedRule(null);
        }
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  // Bulk operations
  const handleBulkOperation = async (operation: string) => {
    if (selectedRules.size === 0) return;
    
    try {
      const response = await fetch('/api/v1/email-rules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_ids: Array.from(selectedRules),
          operation
        })
      });
      
      if (response.ok) {
        await loadRules();
        setSelectedRules(new Set());
      } else {
        throw new Error(`Failed to ${operation} rules`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${operation} rules`);
    }
  };

  // Rule testing
  const testRules = async () => {
    try {
      const response = await fetch('/api/v1/email-rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_data: testEmail
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
      } else {
        throw new Error('Failed to test rules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test rules');
    }
  };

  // Add condition to rule form
  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: `condition-${Date.now()}`,
      type: 'sender_email',
      operator: 'equals',
      value: '',
      case_sensitive: false,
      negate: false
    };
    
    setRuleForm(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), newCondition]
    }));
  };

  // Add action to rule form
  const addAction = () => {
    const newAction: RuleAction = {
      id: `action-${Date.now()}`,
      type: 'add_tag',
      parameters: {},
      enabled: true
    };
    
    setRuleForm(prev => ({
      ...prev,
      actions: [...(prev.actions || []), newAction]
    }));
  };

  // Update condition in rule form
  const updateCondition = (index: number, field: string, value: any) => {
    setRuleForm(prev => ({
      ...prev,
      conditions: prev.conditions?.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      ) || []
    }));
  };

  // Update action in rule form
  const updateAction = (index: number, field: string, value: any) => {
    setRuleForm(prev => ({
      ...prev,
      actions: prev.actions?.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      ) || []
    }));
  };

  // Remove condition from rule form
  const removeCondition = (index: number) => {
    setRuleForm(prev => ({
      ...prev,
      conditions: prev.conditions?.filter((_, i) => i !== index) || []
    }));
  };

  // Remove action from rule form
  const removeAction = (index: number) => {
    setRuleForm(prev => ({
      ...prev,
      actions: prev.actions?.filter((_, i) => i !== index) || []
    }));
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'inactive': return 'text-gray-500';
      case 'draft': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'inactive': return Pause;
      case 'draft': return Edit;
      case 'error': return XCircle;
      default: return Clock;
    }
  };

  // Calculate success rate
  const getSuccessRate = (rule: EmailRule) => {
    if (rule.execution_count === 0) return 0;
    return Math.round((rule.success_count / rule.execution_count) * 100);
  };

  return (
    <div className="email-rules-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-content">
          <div className="header-title">
            <Settings className="title-icon" />
            <h1>Email Rules Manager</h1>
          </div>
          
          <div className="header-stats">
            {statistics && (
              <>
                <div className="stat-item">
                  <span>Total Rules: {statistics.total_rules}</span>
                </div>
                <div className="stat-item">
                  <span>Executions: {statistics.total_executions}</span>
                </div>
                <div className="stat-item">
                  <span>Success Rate: {statistics.total_executions > 0 
                    ? Math.round((statistics.total_successes / statistics.total_executions) * 100) 
                    : 0}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span className="error-text">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeView === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveView('rules')}
        >
          <Workflow size={16} />
          Rules
        </button>
        <button 
          className={`tab-button ${activeView === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveView('statistics')}
        >
          <BarChart3 size={16} />
          Statistics
        </button>
        <button 
          className={`tab-button ${activeView === 'testing' ? 'active' : ''}`}
          onClick={() => setActiveView('testing')}
        >
          <TestTube size={16} />
          Testing
        </button>
      </div>

      {/* Rules View */}
      {activeView === 'rules' && (
        <>
          {/* Controls Bar */}
          <div className="controls-bar">
            <div className="search-controls">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select 
                className="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="view-controls">
              {selectedRules.size > 0 && (
                <div className="bulk-controls">
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleBulkOperation('activate')}
                  >
                    <Play size={16} />
                    Activate ({selectedRules.size})
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleBulkOperation('deactivate')}
                  >
                    <Pause size={16} />
                    Deactivate
                  </button>
                  <button 
                    className="action-btn danger"
                    onClick={() => handleBulkOperation('delete')}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              )}
              
              <button 
                className="create-btn"
                onClick={() => setIsCreating(true)}
              >
                <Plus size={16} />
                Create Rule
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="main-content">
            {isLoading ? (
              <div className="loading-state">
                <Activity className="loading-icon" size={32} />
                <p>Loading rules...</p>
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="empty-state">
                <Workflow size={48} />
                <h3>No Rules Found</h3>
                <p>Create your first email rule to automate email processing</p>
                <button className="create-first-btn" onClick={() => setIsCreating(true)}>
                  <Plus size={16} />
                  Create First Rule
                </button>
              </div>
            ) : (
              <div className="rules-grid">
                {filteredRules.map(rule => {
                  const StatusIcon = getStatusIcon(rule.status);
                  const successRate = getSuccessRate(rule);
                  
                  return (
                    <div 
                      key={rule.id} 
                      className={`rule-card ${selectedRules.has(rule.id) ? 'selected' : ''}`}
                    >
                      <div className="card-header">
                        <div className="rule-info">
                          <input
                            type="checkbox"
                            checked={selectedRules.has(rule.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRules);
                              if (e.target.checked) {
                                newSelected.add(rule.id);
                              } else {
                                newSelected.delete(rule.id);
                              }
                              setSelectedRules(newSelected);
                            }}
                          />
                          
                          <div className="rule-details">
                            <h3 className="rule-name">{rule.name}</h3>
                            <p className="rule-description">{rule.description}</p>
                          </div>
                        </div>
                        
                        <button className="more-button">
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      <div className="rule-stats">
                        <div className="stat-row">
                          <StatusIcon size={16} className={getStatusColor(rule.status)} />
                          <span className={`status-text ${getStatusColor(rule.status)}`}>
                            {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="stat-row">
                          <span className="stat-label">Executions:</span>
                          <span className="stat-value">{rule.execution_count}</span>
                        </div>
                        
                        <div className="stat-row">
                          <span className="stat-label">Success Rate:</span>
                          <span className={`stat-value ${successRate >= 90 ? 'text-green-500' : 
                                                         successRate >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {successRate}%
                          </span>
                        </div>
                        
                        <div className="stat-row">
                          <span className="stat-label">Priority:</span>
                          <span className="stat-value">{rule.priority}</span>
                        </div>
                      </div>

                      <div className="rule-summary">
                        <div className="conditions-summary">
                          <span className="summary-label">Conditions:</span>
                          <span className="summary-value">
                            {rule.conditions.length} condition(s) with {rule.logic_operator.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="actions-summary">
                          <span className="summary-label">Actions:</span>
                          <span className="summary-value">
                            {rule.actions.length} action(s)
                          </span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button 
                          className="action-btn small secondary"
                          onClick={() => {
                            setSelectedRule(rule);
                            setRuleForm(rule);
                            setIsEditing(true);
                          }}
                        >
                          <Edit size={14} />
                          Edit
                        </button>
                        
                        <button 
                          className="action-btn small secondary"
                          onClick={() => {
                            setRuleForm({
                              ...rule,
                              id: undefined,
                              name: `${rule.name} (Copy)`,
                              created_at: undefined,
                              updated_at: undefined
                            });
                            setIsCreating(true);
                          }}
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        
                        <button 
                          className="action-btn small danger"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Statistics View */}
      {activeView === 'statistics' && statistics && (
        <div className="statistics-view">
          <div className="stats-grid">
            {/* Status Distribution */}
            <div className="stat-card">
              <h3>Rules by Status</h3>
              <div className="status-chart">
                {Object.entries(statistics.rule_counts_by_status).map(([status, count]) => (
                  <div key={status} className="status-bar">
                    <span className={`status-label ${getStatusColor(status)}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                    <span className="status-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="stat-card">
              <h3>Performance Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Total Executions</span>
                  <span className="metric-value">{statistics.total_executions}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Success Rate</span>
                  <span className="metric-value">
                    {statistics.total_executions > 0 
                      ? Math.round((statistics.total_successes / statistics.total_executions) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Avg Processing Time</span>
                  <span className="metric-value">
                    {statistics.engine_stats.avg_execution_time_ms.toFixed(2)}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Top Performing Rules */}
            <div className="stat-card full-width">
              <h3>Top Performing Rules</h3>
              <div className="top-rules-table">
                <div className="table-header">
                  <span>Rule Name</span>
                  <span>Executions</span>
                  <span>Success Rate</span>
                  <span>Errors</span>
                </div>
                {statistics.top_performing_rules.map((rule, index) => (
                  <div key={index} className="table-row">
                    <span className="rule-name">{rule.name}</span>
                    <span className="execution-count">{rule.execution_count}</span>
                    <span className={`success-rate ${rule.success_rate >= 90 ? 'high' : 
                                                     rule.success_rate >= 70 ? 'medium' : 'low'}`}>
                      {rule.success_rate}%
                    </span>
                    <span className="error-count">{rule.error_count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Testing View */}
      {activeView === 'testing' && (
        <div className="testing-view">
          <div className="test-form-section">
            <h3>Test Email Data</h3>
            <div className="test-form">
              <div className="form-group">
                <label>Sender Email</label>
                <input
                  type="email"
                  value={testEmail.sender_email}
                  onChange={(e) => setTestEmail(prev => ({ ...prev, sender_email: e.target.value }))}
                  placeholder="sender@example.com"
                />
              </div>
              
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={testEmail.subject}
                  onChange={(e) => setTestEmail(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </div>
              
              <div className="form-group">
                <label>Body Text</label>
                <textarea
                  value={testEmail.body_text}
                  onChange={(e) => setTestEmail(prev => ({ ...prev, body_text: e.target.value }))}
                  placeholder="Email body content"
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={testEmail.priority}
                  onChange={(e) => setTestEmail(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <button className="test-button" onClick={testRules}>
                <TestTube size={16} />
                Test Rules
              </button>
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="test-results-section">
              <h3>Test Results</h3>
              <div className="test-results">
                {testResults.map((result, index) => (
                  <div key={index} className="test-result-card">
                    <div className="result-header">
                      <h4>{result.rule_name}</h4>
                      <div className={`match-status ${result.conditions_matched ? 'matched' : 'no-match'}`}>
                        {result.conditions_matched ? (
                          <>
                            <CheckCircle size={16} />
                            Matched
                          </>
                        ) : (
                          <>
                            <XCircle size={16} />
                            No Match
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="result-details">
                      <div className="processing-time">
                        Processing Time: {result.processing_time_ms}ms
                      </div>
                      
                      {result.conditions_matched && result.actions_would_execute.length > 0 && (
                        <div className="would-execute">
                          <h5>Actions that would execute:</h5>
                          <ul>
                            {result.actions_would_execute.map((action, i) => (
                              <li key={i}>
                                {action.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                {Object.keys(action.parameters).length > 0 && (
                                  <span className="action-params">
                                    {JSON.stringify(action.parameters)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rule Creation/Editing Modal */}
      {(isCreating || isEditing) && (
        <div className="modal-overlay">
          <div className="rule-modal">
            <div className="modal-header">
              <h2>{isCreating ? 'Create New Rule' : 'Edit Rule'}</h2>
              <button 
                className="close-button"
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                  setSelectedRule(null);
                  setRuleForm({
                    name: '',
                    description: '',
                    conditions: [],
                    logic_operator: 'and',
                    actions: [],
                    priority: 100,
                    status: 'active'
                  });
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              {/* Basic Information */}
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Rule Name</label>
                    <input
                      type="text"
                      value={ruleForm.name || ''}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter rule name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Priority</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={ruleForm.priority || 100}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      value={ruleForm.description || ''}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this rule does"
                      rows={2}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={ruleForm.status || 'active'}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, status: e.target.value as any }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Logic Operator</label>
                    <select
                      value={ruleForm.logic_operator || 'and'}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, logic_operator: e.target.value as any }))}
                    >
                      <option value="and">AND (all conditions must match)</option>
                      <option value="or">OR (any condition can match)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Conditions</h3>
                  <button className="add-button" onClick={addCondition}>
                    <Plus size={16} />
                    Add Condition
                  </button>
                </div>
                
                <div className="conditions-list">
                  {ruleForm.conditions?.map((condition, index) => (
                    <div key={condition.id} className="condition-item">
                      <div className="condition-header">
                        <span className="condition-number">{index + 1}</span>
                        <button 
                          className="remove-button"
                          onClick={() => removeCondition(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="condition-form">
                        <select
                          value={condition.type}
                          onChange={(e) => updateCondition(index, 'type', e.target.value)}
                        >
                          {CONDITION_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                        >
                          {OPERATORS.map(operator => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                        
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          placeholder="Condition value"
                        />
                        
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={condition.case_sensitive}
                            onChange={(e) => updateCondition(index, 'case_sensitive', e.target.checked)}
                          />
                          Case Sensitive
                        </label>
                        
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={condition.negate}
                            onChange={(e) => updateCondition(index, 'negate', e.target.checked)}
                          />
                          Negate
                        </label>
                      </div>
                    </div>
                  ))}
                  
                  {(!ruleForm.conditions || ruleForm.conditions.length === 0) && (
                    <div className="empty-message">
                      No conditions added. Click "Add Condition" to get started.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Actions</h3>
                  <button className="add-button" onClick={addAction}>
                    <Plus size={16} />
                    Add Action
                  </button>
                </div>
                
                <div className="actions-list">
                  {ruleForm.actions?.map((action, index) => (
                    <div key={action.id} className="action-item">
                      <div className="action-header">
                        <span className="action-number">{index + 1}</span>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={action.enabled}
                            onChange={(e) => updateAction(index, 'enabled', e.target.checked)}
                          />
                          Enabled
                        </label>
                        <button 
                          className="remove-button"
                          onClick={() => removeAction(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="action-form">
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(index, 'type', e.target.value)}
                        >
                          {ACTION_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        
                        {/* Action-specific parameters */}
                        {(action.type === 'move_to_folder' || action.type === 'copy_to_folder') && (
                          <input
                            type="text"
                            placeholder="Folder name"
                            value={action.parameters.folder || ''}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, folder: e.target.value })}
                          />
                        )}
                        
                        {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                          <input
                            type="text"
                            placeholder="Tag name"
                            value={action.parameters.tag || ''}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, tag: e.target.value })}
                          />
                        )}
                        
                        {action.type === 'set_priority' && (
                          <select
                            value={action.parameters.priority || 'normal'}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, priority: e.target.value })}
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        )}
                        
                        {action.type === 'forward' && (
                          <input
                            type="email"
                            placeholder="Forward to email"
                            value={action.parameters.email || ''}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, email: e.target.value })}
                          />
                        )}
                        
                        {action.type === 'webhook' && (
                          <input
                            type="url"
                            placeholder="Webhook URL"
                            value={action.parameters.url || ''}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, url: e.target.value })}
                          />
                        )}
                        
                        {action.type === 'create_task' && (
                          <input
                            type="text"
                            placeholder="Task title"
                            value={action.parameters.title || ''}
                            onChange={(e) => updateAction(index, 'parameters', { ...action.parameters, title: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {(!ruleForm.actions || ruleForm.actions.length === 0) && (
                    <div className="empty-message">
                      No actions added. Click "Add Action" to get started.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="action-btn secondary"
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                  setSelectedRule(null);
                }}
              >
                Cancel
              </button>
              
              <button 
                className="action-btn primary"
                onClick={() => {
                  if (isCreating) {
                    createRule(ruleForm);
                  } else {
                    updateRule(selectedRule!.id, ruleForm);
                  }
                }}
                disabled={!ruleForm.name || !ruleForm.conditions?.length || !ruleForm.actions?.length}
              >
                <Save size={16} />
                {isCreating ? 'Create Rule' : 'Update Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailRulesManager;