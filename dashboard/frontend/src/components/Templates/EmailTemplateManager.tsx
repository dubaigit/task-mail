/**
 * Email Template and Signature Manager Component
 * 
 * Comprehensive interface for managing email templates and signatures with:
 * - Template creation with rich text editor
 * - Signature management and customization
 * - Scheduled sending capabilities
 * - Template categorization and organization
 * - Preview and testing functionality
 * 
 * Follows the task-centric dashboard design pattern adapted for email templates.
 * 
 * @author Enterprise Email Management System
 * @date 2025-08-17
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mail, 
  Plus, 
  Edit3, 
  Copy, 
  Trash2, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Calendar, 
  Clock, 
  Eye, 
  Send, 
  Save, 
  Settings,
  FileText,
  PenTool,
  Zap,
  CheckCircle,
  MoreHorizontal,
  Star,
  Users,
  Tag
} from 'lucide-react';

// Alias PenTool as Signature for clarity
const Signature = PenTool;
import './EmailTemplateManager.css';

// Type definitions
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  htmlContent: string;
  category: 'business' | 'personal' | 'marketing' | 'support' | 'newsletter';
  type: 'template' | 'signature';
  tags: string[];
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  variables: TemplateVariable[];
  scheduling?: ScheduleConfig;
  status: 'draft' | 'active' | 'archived';
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'date' | 'number' | 'email' | 'custom';
  defaultValue?: string;
  required: boolean;
  description: string;
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate?: string;
  time: string;
  timezone: string;
  recipients: string[];
  conditions?: string[];
}

interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  signatures: number;
  totalUsage: number;
  categoryCounts: Record<string, number>;
  recentActivity: number;
}

interface TemplateColumnProps {
  title: string;
  templates: EmailTemplate[];
  count: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TemplateColumn: React.FC<TemplateColumnProps> = ({ 
  title, 
  templates, 
  count, 
  color, 
  icon: Icon 
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'business': return FileText;
      case 'personal': return Mail;
      case 'marketing': return Zap;
      case 'support': return Users;
      case 'newsletter': return Send;
      default: return Mail;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'draft': return 'text-yellow-500';
      case 'archived': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="template-column">
      <div className="column-header">
        <div className="header-content">
          <div className={`column-indicator ${color}`}></div>
          <Icon className="header-icon" />
          <h3 className="column-title">{title}</h3>
          <span className="column-count">{count}</span>
        </div>
        <button className="add-button">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="templates-list">
        {templates.map((template) => {
          const CategoryIcon = getCategoryIcon(template.category);
          
          return (
            <div key={template.id} className="template-card">
              <div className="card-header">
                <div className="template-info">
                  <div className="template-icon-wrapper">
                    <CategoryIcon className="template-icon" />
                    {template.type === 'signature' && (
                      <Signature className="signature-badge" />
                    )}
                  </div>
                  <div className="template-details">
                    <h4 className="template-name" title={template.name}>
                      {template.name}
                    </h4>
                    <p className="template-subject">
                      {template.subject || 'No subject'}
                    </p>
                    <p className="template-meta">
                      {template.category} • Used {template.usageCount} times
                    </p>
                  </div>
                </div>
                <button className="more-button">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              
              <div className="template-preview">
                <div className="preview-content">
                  {template.content.slice(0, 150)}
                  {template.content.length > 150 && '...'}
                </div>
              </div>
              
              <div className="card-tags">
                {template.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="tag-more">+{template.tags.length - 3}</span>
                )}
                <span className={`status-tag ${getStatusColor(template.status)}`}>
                  {template.status}
                </span>
                {template.scheduling?.enabled && (
                  <span className="schedule-tag">
                    <Clock className="w-3 h-3" />
                    Scheduled
                  </span>
                )}
              </div>
              
              <div className="card-footer">
                <div className="template-meta">
                  <span className="created-date">
                    Created: {formatDate(template.createdAt)}
                  </span>
                  {template.lastUsed && (
                    <span className="last-used">
                      Last used: {formatDate(template.lastUsed)}
                    </span>
                  )}
                </div>
                
                <div className="card-actions">
                  <button className="action-btn" title="Preview">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="action-btn" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button className="action-btn" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="action-btn" title="Schedule">
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button className="action-btn danger" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        
        {templates.length === 0 && (
          <div className="empty-column">
            <Icon className="empty-icon" />
            <p>No {title.toLowerCase()}</p>
            <button className="create-first-btn">
              <Plus className="w-4 h-4" />
              Create First {title.slice(0, -1)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EmailTemplateManager: React.FC = () => {
  // State management
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'signatures'>('templates');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration
  const mockTemplates: EmailTemplate[] = [
    {
      id: '1',
      name: 'Welcome Email',
      subject: 'Welcome to {{company_name}}!',
      content: 'Hello {{first_name}},\n\nWelcome to our platform! We\'re excited to have you on board.\n\nBest regards,\nThe Team',
      htmlContent: '<p>Hello {{first_name}},</p><p>Welcome to our platform! We\'re excited to have you on board.</p><p>Best regards,<br>The Team</p>',
      category: 'business',
      type: 'template',
      tags: ['onboarding', 'welcome', 'new-user'],
      isActive: true,
      usageCount: 45,
      lastUsed: '2024-12-15T10:30:00Z',
      createdAt: '2024-12-01T09:00:00Z',
      updatedAt: '2024-12-10T14:20:00Z',
      variables: [
        { name: 'first_name', type: 'text', required: true, description: 'User\'s first name' },
        { name: 'company_name', type: 'text', required: true, description: 'Company name' }
      ],
      status: 'active'
    },
    {
      id: '2',
      name: 'Newsletter Template',
      subject: '{{newsletter_title}} - {{month}} {{year}}',
      content: 'Dear {{first_name}},\n\nHere are this month\'s highlights:\n\n{{content}}\n\nStay tuned for more updates!',
      htmlContent: '<p>Dear {{first_name}},</p><p>Here are this month\'s highlights:</p><div>{{content}}</div><p>Stay tuned for more updates!</p>',
      category: 'newsletter',
      type: 'template',
      tags: ['newsletter', 'monthly', 'updates'],
      isActive: true,
      usageCount: 12,
      lastUsed: '2024-12-12T16:45:00Z',
      createdAt: '2024-11-15T11:30:00Z',
      updatedAt: '2024-12-05T09:15:00Z',
      variables: [
        { name: 'first_name', type: 'text', required: true, description: 'Recipient\'s first name' },
        { name: 'newsletter_title', type: 'text', required: true, description: 'Newsletter title' },
        { name: 'month', type: 'text', required: true, description: 'Current month' },
        { name: 'year', type: 'number', required: true, description: 'Current year' },
        { name: 'content', type: 'custom', required: true, description: 'Newsletter content' }
      ],
      scheduling: {
        enabled: true,
        frequency: 'monthly',
        startDate: '2024-12-01',
        time: '09:00',
        timezone: 'UTC',
        recipients: ['subscribers@company.com']
      },
      status: 'active'
    },
    {
      id: '3',
      name: 'Professional Signature',
      subject: '',
      content: 'Best regards,\n{{full_name}}\n{{title}}\n{{company}}\n{{phone}} | {{email}}\n{{website}}',
      htmlContent: '<p>Best regards,</p><p><strong>{{full_name}}</strong><br>{{title}}<br>{{company}}<br>{{phone}} | {{email}}<br><a href="{{website}}">{{website}}</a></p>',
      category: 'business',
      type: 'signature',
      tags: ['professional', 'corporate', 'contact'],
      isActive: true,
      usageCount: 230,
      lastUsed: '2024-12-15T14:22:00Z',
      createdAt: '2024-10-01T08:00:00Z',
      updatedAt: '2024-11-20T16:30:00Z',
      variables: [
        { name: 'full_name', type: 'text', required: true, description: 'Full name' },
        { name: 'title', type: 'text', required: true, description: 'Job title' },
        { name: 'company', type: 'text', required: true, description: 'Company name' },
        { name: 'phone', type: 'text', required: false, description: 'Phone number' },
        { name: 'email', type: 'email', required: true, description: 'Email address' },
        { name: 'website', type: 'text', required: false, description: 'Website URL' }
      ],
      status: 'active'
    },
    {
      id: '4',
      name: 'Support Follow-up',
      subject: 'Following up on your support request #{{ticket_id}}',
      content: 'Hi {{customer_name}},\n\nI wanted to follow up on your recent support request.\n\nIs everything working as expected now?\n\nBest,\n{{agent_name}}',
      htmlContent: '<p>Hi {{customer_name}},</p><p>I wanted to follow up on your recent support request.</p><p>Is everything working as expected now?</p><p>Best,<br>{{agent_name}}</p>',
      category: 'support',
      type: 'template',
      tags: ['support', 'follow-up', 'customer-service'],
      isActive: false,
      usageCount: 8,
      createdAt: '2024-12-10T13:15:00Z',
      updatedAt: '2024-12-10T13:15:00Z',
      variables: [
        { name: 'customer_name', type: 'text', required: true, description: 'Customer\'s name' },
        { name: 'ticket_id', type: 'text', required: true, description: 'Support ticket ID' },
        { name: 'agent_name', type: 'text', required: true, description: 'Support agent name' }
      ],
      status: 'draft'
    }
  ];

  const mockStats: TemplateStats = {
    totalTemplates: 4,
    activeTemplates: 3,
    signatures: 1,
    totalUsage: 295,
    categoryCounts: {
      business: 2,
      newsletter: 1,
      support: 1
    },
    recentActivity: 5
  };

  // Initialize with mock data
  useEffect(() => {
    setTemplates(mockTemplates);
    setStats(mockStats);
  }, []);

  // Filter templates based on search, category, and type
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesType = activeTab === 'templates' ? template.type === 'template' : template.type === 'signature';
    
    return matchesSearch && matchesCategory && matchesType;
  });

  // Group templates by status for board view
  const templateColumns = [
    {
      title: 'Active Templates',
      templates: filteredTemplates.filter(t => t.status === 'active'),
      count: filteredTemplates.filter(t => t.status === 'active').length,
      color: 'bg-green-400',
      icon: CheckCircle
    },
    {
      title: 'Draft Templates',
      templates: filteredTemplates.filter(t => t.status === 'draft'),
      count: filteredTemplates.filter(t => t.status === 'draft').length,
      color: 'bg-yellow-400',
      icon: Edit3
    },
    {
      title: 'Scheduled Templates',
      templates: filteredTemplates.filter(t => t.scheduling?.enabled),
      count: filteredTemplates.filter(t => t.scheduling?.enabled).length,
      color: 'bg-blue-400',
      icon: Calendar
    },
    {
      title: 'Archived Templates',
      templates: filteredTemplates.filter(t => t.status === 'archived'),
      count: filteredTemplates.filter(t => t.status === 'archived').length,
      color: 'bg-gray-400',
      icon: FileText
    }
  ];

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    const duplicated = {
      ...template,
      id: `${template.id}_copy_${Date.now()}`,
      name: `${template.name} (Copy)`,
      status: 'draft' as const,
      usageCount: 0,
      lastUsed: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTemplates(prev => [...prev, duplicated]);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  return (
    <div className="email-template-manager">
      {/* Header Section */}
      <div className="manager-header">
        <div className="header-content">
          <h1 className="header-title">
            <Mail className="title-icon" />
            Email Templates & Signatures
          </h1>
          <div className="header-stats">
            <span className="stat-item">
              {stats?.totalTemplates || 0} Templates
            </span>
            <span className="stat-item">
              {stats?.totalUsage || 0} Total Uses
            </span>
          </div>
        </div>
        
        {error && (
          <div className="error-banner">
            <span className="error-text">{error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText className="w-4 h-4" />
          Templates ({templates.filter(t => t.type === 'template').length})
        </button>
        <button
          className={`tab-button ${activeTab === 'signatures' ? 'active' : ''}`}
          onClick={() => setActiveTab('signatures')}
        >
          <Signature className="w-4 h-4" />
          Signatures ({templates.filter(t => t.type === 'signature').length})
        </button>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="search-controls">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
            <option value="marketing">Marketing</option>
            <option value="support">Support</option>
            <option value="newsletter">Newsletter</option>
          </select>
        </div>
        
        <div className="view-controls">
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button className="filter-btn">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          
          <button className="create-btn" onClick={handleCreateTemplate}>
            <Plus className="w-4 h-4" />
            Create {activeTab === 'templates' ? 'Template' : 'Signature'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-value">{stats?.totalTemplates || 0}</div>
            <div className="stat-label">Total {activeTab}</div>
          </div>
          <FileText className="stat-icon" />
        </div>
        
        <div className="stat-card active">
          <div className="stat-content">
            <div className="stat-value">{stats?.activeTemplates || 0}</div>
            <div className="stat-label">Active</div>
          </div>
          <CheckCircle className="stat-icon" />
        </div>
        
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-value">{stats?.totalUsage || 0}</div>
            <div className="stat-label">Total Usage</div>
          </div>
          <Send className="stat-icon" />
        </div>
        
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-value">{stats?.recentActivity || 0}</div>
            <div className="stat-label">Recent Activity</div>
          </div>
          <Zap className="stat-icon" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="content-header">
          <h2 className="content-title">
            {activeTab === 'templates' ? 'Template' : 'Signature'} Board
          </h2>
          <div className="content-actions">
            <button className="action-btn secondary">
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button className="action-btn primary" onClick={handleCreateTemplate}>
              <Plus className="w-4 h-4" />
              New {activeTab === 'templates' ? 'Template' : 'Signature'}
            </button>
          </div>
        </div>
        
        {/* Template Board */}
        {viewMode === 'board' ? (
          <div className="template-board">
            {templateColumns.map((column) => (
              <TemplateColumn
                key={column.title}
                title={column.title}
                templates={column.templates}
                count={column.count}
                color={column.color}
                icon={column.icon}
              />
            ))}
          </div>
        ) : (
            <div className="template-list">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Subject</th>
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Usage</th>
                    <th className="py-2 pr-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-2 font-medium">{t.name}</td>
                      <td className="py-2 pr-2 text-muted-foreground line-clamp-1">{t.subject || '—'}</td>
                      <td className="py-2 pr-2">{t.category}</td>
                      <td className="py-2 pr-2">{t.type}</td>
                      <td className="py-2 pr-2">{t.status}</td>
                      <td className="py-2 pr-2">{t.usageCount}</td>
                      <td className="py-2 pr-2">{new Date(t.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">No items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplateManager;