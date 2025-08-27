import { TaskStatus, TaskPriority, TaskCategory } from '../../types';
/**
 * Magic MCP Framework Manager Component
 * 
 * Provides a comprehensive interface for Magic MCP framework capabilities including:
 * - UI component generation for email interfaces
 * - Content analysis and web scraping
 * - Advanced search and research capabilities
 * - Email template generation
 * - Problem solving with sequential thinking
 * 
 * Features:
 * - Real-time WebSocket updates
 * - Interactive controls for all MCP operations
 * - Progress tracking and result visualization
 * - Professional enterprise UI design
 * - Full accessibility support
 * 
 * @author Enterprise Email Management System
 * @date 2025-08-17
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MagicMCPManager.css';

// Type definitions
interface MCPServiceStatus {
  status: string;
  active_requests: number;
  completed_requests: number;
  available_servers: string[];
  cache_dir: string;
  config: Record<string, any>;
  last_updated: string;
}

interface UIGenerationRequest {
  message: string;
  search_query: string;
  component_type: string;
  style_preferences: Record<string, string>;
  accessibility_requirements: string[];
}

interface ContentAnalysisRequest {
  urls: string[];
  analysis_type: string;
  extract_images: boolean;
  extract_links: boolean;
}

interface SearchRequest {
  query: string;
  search_type: 'simple' | 'complex';
  max_results: number;
  include_content: boolean;
}

interface TemplateGenerationRequest {
  template_type: string;
  context: Record<string, any>;
  style_preferences: Record<string, string>;
  accessibility_requirements: string[];
}

interface ProblemSolvingRequest {
  problem_description: string;
  context: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface MCPOperation {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | TaskStatus.COMPLETED | 'failed';
  start_time: string;
  end_time?: string;
  result?: any;
  error?: string;
  progress?: number;
}

interface WebSocketMessage {
  type: string;
  timestamp: string;
  [key: string]: any;
}

const MagicMCPManager: React.FC = () => {
  // State management
  const [serviceStatus, setServiceStatus] = useState<MCPServiceStatus | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ui-generation');
  const [operations, setOperations] = useState<MCPOperation[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [uiRequest, setUiRequest] = useState<UIGenerationRequest>({
    message: '',
    search_query: '',
    component_type: 'email',
    style_preferences: {},
    accessibility_requirements: []
  });

  const [contentRequest, setContentRequest] = useState<ContentAnalysisRequest>({
    urls: [''],
    analysis_type: 'content',
    extract_images: true,
    extract_links: true
  });

  const [searchRequest, setSearchRequest] = useState<SearchRequest>({
    query: '',
    search_type: 'simple',
    max_results: 10,
    include_content: true
  });

  const [templateRequest, setTemplateRequest] = useState<TemplateGenerationRequest>({
    template_type: 'welcome',
    context: {},
    style_preferences: {},
    accessibility_requirements: []
  });

  const [problemRequest, setProblemRequest] = useState<ProblemSolvingRequest>({
    problem_description: '',
    context: {},
    priority: 'medium'
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    try {
      wsRef.current = new WebSocket('ws://localhost:8000/ws');
      
      wsRef.current.onopen = () => {
        console.log('Magic MCP WebSocket connected');
        setIsConnected(true);
        setError(null);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('Magic MCP WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('Magic MCP WebSocket error:', error);
        setError('WebSocket connection error');
      };
      
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to connect to Magic MCP service');
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const operationId = `${message.type}_${Date.now()}`;
    
    switch (message.type) {
      case 'component_generation_started':
      case 'content_analysis_started':
      case 'advanced_search_started':
      case 'template_generation_started':
      case 'problem_solving_started':
        setOperations(prev => [...prev, {
          id: operationId,
          type: message.type,
          status: 'in_progress',
          start_time: message.timestamp,
          progress: 0
        }]);
        break;
        
      case 'component_generation_completed':
      case 'content_analysis_completed':
      case 'advanced_search_completed':
      case 'template_generation_completed':
      case 'problem_solving_completed':
        setOperations(prev => prev.map(op => 
          op.type === message.type.replace('_completed', '_started') && op.status === 'in_progress'
            ? { ...op, status: TaskStatus.COMPLETED, end_time: message.timestamp, progress: 100 }
            : op
        ));
        break;
        
      case 'component_generation_failed':
      case 'content_analysis_failed':
      case 'advanced_search_failed':
      case 'template_generation_failed':
      case 'problem_solving_failed':
        setOperations(prev => prev.map(op => 
          op.type === message.type.replace('_failed', '_started') && op.status === 'in_progress'
            ? { ...op, status: 'failed', end_time: message.timestamp, error: message.error }
            : op
        ));
        break;
        
      case 'batch_progress':
        // Handle batch operation progress
        console.log(`Batch progress: ${message.current}/${message.total}`);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, []);

  // API calls
  const fetchServiceStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/status');
      if (response.ok) {
        const status = await response.json();
        setServiceStatus(status);
      } else {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching service status:', err);
      setError('Failed to fetch service status');
    }
  }, []);

  const generateUIComponent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/ui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uiRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('UI Component generated:', result);
      
      // Reset form
      setUiRequest({
        message: '',
        search_query: '',
        component_type: 'email',
        style_preferences: {},
        accessibility_requirements: []
      });
      
    } catch (err) {
      console.error('Error generating UI component:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate UI component');
    } finally {
      setLoading(false);
    }
  };

  const analyzeContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contentRequest,
          urls: contentRequest.urls.filter(url => url.trim() !== '')
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Content analyzed:', result);
      
    } catch (err) {
      console.error('Error analyzing content:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze content');
    } finally {
      setLoading(false);
    }
  };

  const performAdvancedSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/search/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Search completed:', result);
      
    } catch (err) {
      console.error('Error performing search:', err);
      setError(err instanceof Error ? err.message : 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const generateTemplate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Template generation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Template generated:', result);
      
    } catch (err) {
      console.error('Error generating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate template');
    } finally {
      setLoading(false);
    }
  };

  const solveProblem = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/problems/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problemRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Problem solving failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Problem solved:', result);
      
    } catch (err) {
      console.error('Error solving problem:', err);
      setError(err instanceof Error ? err.message : 'Failed to solve problem');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup cache
  const cleanupCache = async () => {
    try {
      const response = await fetch('http://localhost:8000/cache/cleanup', {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Cache cleaned:', result);
      }
    } catch (err) {
      console.error('Error cleaning cache:', err);
    }
  };

  // Effects
  useEffect(() => {
    connectWebSocket();
    fetchServiceStatus();
    
    // Fetch status every 30 seconds
    const statusInterval = setInterval(fetchServiceStatus, 30000);
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(statusInterval);
    };
  }, [connectWebSocket, fetchServiceStatus]);

  // Helper functions
  const addUrlField = () => {
    setContentRequest(prev => ({
      ...prev,
      urls: [...prev.urls, '']
    }));
  };

  const updateUrl = (index: number, value: string) => {
    setContentRequest(prev => ({
      ...prev,
      urls: prev.urls.map((url, i) => i === index ? value : url)
    }));
  };

  const removeUrl = (index: number) => {
    setContentRequest(prev => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index)
    }));
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = endTime.getTime() - startTime.getTime();
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="magic-mcp-manager">
      <div className="mcp-header">
        <div className="header-content">
          <h1 className="header-title">
            <span className="icon">🪄</span>
            Magic MCP Framework
          </h1>
          <div className="status-indicators">
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {serviceStatus && (
              <div className="service-info">
                <span className="active-requests">
                  Active: {serviceStatus.active_requests}
                </span>
                <span className="completed-requests">
                  Completed: {serviceStatus.completed_requests}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {error && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="mcp-tabs">
        {[
          { id: 'ui-generation', label: 'UI Generation', icon: '🎨' },
          { id: 'content-analysis', label: 'Content Analysis', icon: '🔍' },
          { id: 'advanced-search', label: 'Advanced Search', icon: '🔎' },
          { id: 'template-generation', label: 'Templates', icon: '📄' },
          { id: 'problem-solving', label: 'Problem Solving', icon: '🧠' },
          { id: 'operations', label: 'Operations', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mcp-content">
        {activeTab === 'ui-generation' && (
          <div className="content-panel">
            <h2>UI Component Generation</h2>
            <p className="panel-description">
              Generate React components for email interfaces using AI-powered design
            </p>
            
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="ui-message">Component Description</label>
                <textarea
                  id="ui-message"
                  value={uiRequest.message}
                  onChange={(e) => setUiRequest(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Describe the email component you need..."
                  rows={3}
                />
              </div>
              
              <div className="form-field">
                <label htmlFor="ui-search-query">Search Query</label>
                <input
                  id="ui-search-query"
                  type="text"
                  value={uiRequest.search_query}
                  onChange={(e) => setUiRequest(prev => ({ ...prev, search_query: e.target.value }))}
                  placeholder="email list component"
                />
              </div>
              
              <div className="form-field">
                <label htmlFor="ui-component-type">Component Type</label>
                <select
                  id="ui-component-type"
                  value={uiRequest.component_type}
                  onChange={(e) => setUiRequest(prev => ({ ...prev, component_type: e.target.value }))}
                >
                  <option value="email">Email Component</option>
                  <option value="form">Form Component</option>
                  <option value="button">Button Component</option>
                  <option value="modal">Modal Component</option>
                  <option value="table">Table Component</option>
                </select>
              </div>
            </div>
            
            <button
              className="action-button primary"
              onClick={generateUIComponent}
              disabled={loading || !uiRequest.message.trim()}
            >
              {loading ? 'Generating...' : 'Generate Component'}
            </button>
          </div>
        )}

        {activeTab === 'content-analysis' && (
          <div className="content-panel">
            <h2>Content Analysis</h2>
            <p className="panel-description">
              Analyze email content from web pages and extract meaningful data
            </p>
            
            <div className="form-field">
              <label>URLs to Analyze</label>
              {contentRequest.urls.map((url, index) => (
                <div key={index} className="url-input-group">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://example.com"
                  />
                  {contentRequest.urls.length > 1 && (
                    <button
                      className="remove-button"
                      onClick={() => removeUrl(index)}
                      aria-label={`Remove URL ${index + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button className="add-button" onClick={addUrlField}>
                + Add URL
              </button>
            </div>
            
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="analysis-type">Analysis Type</label>
                <select
                  id="analysis-type"
                  value={contentRequest.analysis_type}
                  onChange={(e) => setContentRequest(prev => ({ ...prev, analysis_type: e.target.value }))}
                >
                  <option value="content">Content Analysis</option>
                  <option value="structure">Structure Analysis</option>
                  <option value="links">Link Extraction</option>
                </select>
              </div>
              
              <div className="form-field">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={contentRequest.extract_images}
                      onChange={(e) => setContentRequest(prev => ({ ...prev, extract_images: e.target.checked }))}
                    />
                    Extract Images
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={contentRequest.extract_links}
                      onChange={(e) => setContentRequest(prev => ({ ...prev, extract_links: e.target.checked }))}
                    />
                    Extract Links
                  </label>
                </div>
              </div>
            </div>
            
            <button
              className="action-button primary"
              onClick={analyzeContent}
              disabled={loading || contentRequest.urls.filter(url => url.trim()).length === 0}
            >
              {loading ? 'Analyzing...' : 'Analyze Content'}
            </button>
          </div>
        )}

        {activeTab === 'advanced-search' && (
          <div className="content-panel">
            <h2>Advanced Search</h2>
            <p className="panel-description">
              Perform intelligent search queries for email management insights
            </p>
            
            <div className="form-grid">
              <div className="form-field full-width">
                <label htmlFor="search-query">Search Query</label>
                <input
                  id="search-query"
                  type="text"
                  value={searchRequest.query}
                  onChange={(e) => setSearchRequest(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="Best practices for email organization..."
                />
              </div>
              
              <div className="form-field">
                <label htmlFor="search-type">Search Type</label>
                <select
                  id="search-type"
                  value={searchRequest.search_type}
                  onChange={(e) => setSearchRequest(prev => ({ ...prev, search_type: e.target.value as 'simple' | 'complex' }))}
                >
                  <option value="simple">Simple Search</option>
                  <option value="complex">Complex Analysis</option>
                </select>
              </div>
              
              <div className="form-field">
                <label htmlFor="max-results">Max Results</label>
                <input
                  id="max-results"
                  type="number"
                  min="1"
                  max="50"
                  value={searchRequest.max_results}
                  onChange={(e) => setSearchRequest(prev => ({ ...prev, max_results: parseInt(e.target.value) }))}
                />
              </div>
              
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={searchRequest.include_content}
                    onChange={(e) => setSearchRequest(prev => ({ ...prev, include_content: e.target.checked }))}
                  />
                  Include Full Content
                </label>
              </div>
            </div>
            
            <button
              className="action-button primary"
              onClick={performAdvancedSearch}
              disabled={loading || !searchRequest.query.trim()}
            >
              {loading ? 'Searching...' : 'Perform Search'}
            </button>
          </div>
        )}

        {activeTab === 'template-generation' && (
          <div className="content-panel">
            <h2>Email Template Generation</h2>
            <p className="panel-description">
              Generate professional email templates with customizable styling
            </p>
            
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="template-type">Template Type</label>
                <select
                  id="template-type"
                  value={templateRequest.template_type}
                  onChange={(e) => setTemplateRequest(prev => ({ ...prev, template_type: e.target.value }))}
                >
                  <option value="welcome">Welcome Email</option>
                  <option value="notification">Notification</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="invitation">Invitation</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="confirmation">Confirmation</option>
                </select>
              </div>
            </div>
            
            <button
              className="action-button primary"
              onClick={generateTemplate}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Template'}
            </button>
          </div>
        )}

        {activeTab === 'problem-solving' && (
          <div className="content-panel">
            <h2>Email Problem Solving</h2>
            <p className="panel-description">
              Use AI-powered sequential thinking to solve complex email management challenges
            </p>
            
            <div className="form-grid">
              <div className="form-field full-width">
                <label htmlFor="problem-description">Problem Description</label>
                <textarea
                  id="problem-description"
                  value={problemRequest.problem_description}
                  onChange={(e) => setProblemRequest(prev => ({ ...prev, problem_description: e.target.value }))}
                  placeholder="Describe the email management problem you're facing..."
                  rows={4}
                />
              </div>
              
              <div className="form-field">
                <label htmlFor="problem-priority">Priority</label>
                <select
                  id="problem-priority"
                  value={problemRequest.priority}
                  onChange={(e) => setProblemRequest(prev => ({ ...prev, priority: e.target.value as any }))}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            
            <button
              className="action-button primary"
              onClick={solveProblem}
              disabled={loading || !problemRequest.problem_description.trim()}
            >
              {loading ? 'Solving...' : 'Solve Problem'}
            </button>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="content-panel">
            <h2>Operation History</h2>
            <p className="panel-description">
              Track and monitor all Magic MCP operations in real-time
            </p>
            
            <div className="operations-header">
              <div className="operations-stats">
                <span className="stat-item">
                  Total Operations: {operations.length}
                </span>
                <span className="stat-item">
                  Active: {operations.filter(op => op.status === 'in_progress').length}
                </span>
                <span className="stat-item">
                  Completed: {operations.filter(op => op.status === TaskStatus.COMPLETED).length}
                </span>
              </div>
              <button
                className="action-button secondary"
                onClick={cleanupCache}
              >
                Cleanup Cache
              </button>
            </div>
            
            <div className="operations-list">
              {operations.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <p>No operations yet. Start using Magic MCP features to see activity here.</p>
                </div>
              ) : (
                operations.slice().reverse().map(operation => (
                  <div key={operation.id} className={`operation-item ${operation.status}`}>
                    <div className="operation-header">
                      <span className="operation-type">
                        {operation.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="operation-status">{operation.status}</span>
                    </div>
                    <div className="operation-meta">
                      <span className="operation-time">
                        Started: {new Date(operation.start_time).toLocaleTimeString()}
                      </span>
                      {operation.end_time && (
                        <span className="operation-duration">
                          Duration: {formatDuration(operation.start_time, operation.end_time)}
                        </span>
                      )}
                      {operation.status === 'in_progress' && operation.progress !== undefined && (
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${operation.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    {operation.error && (
                      <div className="operation-error">
                        Error: {operation.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MagicMCPManager;