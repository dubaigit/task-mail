import React, { useState, useEffect, useCallback } from 'react';
import {
  DocumentTextIcon,
  PlusIcon,
  StarIcon,
  ClockIcon,
  TagIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  EyeIcon,
  BookmarkIcon,
  UserGroupIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface Email {
  id: number;
  subject: string;
  sender: string;
  classification: string;
  urgency: string;
}

interface Draft {
  id: number;
  content: string;
  confidence: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: 'response' | 'follow-up' | 'approval' | 'delegation' | 'meeting' | 'custom';
  tags: string[];
  isStarred: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  author: string;
  is_public: boolean;
  suggested_for: string[];
}

interface TemplateManagerProps {
  selectedEmail: Email | null;
  currentDraft: Draft | null;
  onTemplateApply: (template: EmailTemplate) => void;
  onTemplateCreate: (content: string, metadata: Partial<EmailTemplate>) => void;
  className?: string;
}

interface TemplateFilters {
  category: string;
  search: string;
  starred: boolean;
  recentlyUsed: boolean;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  selectedEmail,
  currentDraft,
  onTemplateApply,
  onTemplateCreate,
  className = ''
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [filters, setFilters] = useState<TemplateFilters>({
    category: 'all',
    search: '',
    starred: false,
    recentlyUsed: false
  });
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [suggestedTemplates, setSuggestedTemplates] = useState<EmailTemplate[]>([]);

  // Sample templates - in real implementation, these would come from backend
  const sampleTemplates: EmailTemplate[] = [
    {
      id: 'tmpl-1',
      name: 'Professional Response',
      description: 'Standard professional response template',
      content: `Dear [Name],

Thank you for your email regarding [Subject].

I have reviewed your request and [Response Content].

[Action Items/Next Steps]

Please let me know if you need any additional information.

Best regards,
[Your Name]`,
      category: 'response',
      tags: ['professional', 'standard', 'business'],
      isStarred: true,
      usage_count: 45,
      created_at: '2025-08-10T10:00:00Z',
      updated_at: '2025-08-15T14:30:00Z',
      author: 'System',
      is_public: true,
      suggested_for: ['NEEDS_REPLY', 'APPROVAL_REQUIRED']
    },
    {
      id: 'tmpl-2',
      name: 'Meeting Request Response',
      description: 'Template for responding to meeting requests',
      content: `Hi [Name],

Thank you for the meeting invitation.

I am available on [Date/Time] and look forward to discussing [Topic].

Please send me the meeting details and agenda when you have a chance.

Best regards,
[Your Name]`,
      category: 'meeting',
      tags: ['meeting', 'scheduling', 'availability'],
      isStarred: false,
      usage_count: 23,
      created_at: '2025-08-12T09:00:00Z',
      updated_at: '2025-08-12T09:00:00Z',
      author: 'User',
      is_public: false,
      suggested_for: ['NEEDS_REPLY']
    },
    {
      id: 'tmpl-3',
      name: 'Approval Request',
      description: 'Template for requesting approval',
      content: `Dear [Name],

I am writing to request your approval for [Item/Project].

[Brief Description and Justification]

Key details:
• [Detail 1]
• [Detail 2]
• [Detail 3]

Please review and let me know if you approve by [Deadline].

Thank you for your consideration.

Best regards,
[Your Name]`,
      category: 'approval',
      tags: ['approval', 'request', 'formal'],
      isStarred: true,
      usage_count: 67,
      created_at: '2025-08-05T15:00:00Z',
      updated_at: '2025-08-14T11:20:00Z',
      author: 'System',
      is_public: true,
      suggested_for: ['APPROVAL_REQUIRED']
    },
    {
      id: 'tmpl-4',
      name: 'Task Delegation',
      description: 'Template for delegating tasks',
      content: `Hi [Name],

I hope this email finds you well.

I would like to delegate the following task to you: [Task Description]

Details:
• Objective: [Objective]
• Deadline: [Deadline]
• Resources: [Resources/Support Available]
• Expected Outcome: [Expected Result]

Please confirm your availability and let me know if you have any questions.

Thanks,
[Your Name]`,
      category: 'delegation',
      tags: ['delegation', 'task', 'assignment'],
      isStarred: false,
      usage_count: 34,
      created_at: '2025-08-08T13:00:00Z',
      updated_at: '2025-08-13T16:45:00Z',
      author: 'User',
      is_public: true,
      suggested_for: ['DELEGATE', 'CREATE_TASK']
    },
    {
      id: 'tmpl-5',
      name: 'Follow-up Reminder',
      description: 'Gentle follow-up template',
      content: `Hi [Name],

I wanted to follow up on my previous email regarding [Subject].

[Brief Recap of Original Request]

I understand you may be busy, but I would appreciate an update when you have a moment.

Please let me know if you need any additional information from my end.

Thanks,
[Your Name]`,
      category: 'follow-up',
      tags: ['follow-up', 'reminder', 'gentle'],
      isStarred: false,
      usage_count: 56,
      created_at: '2025-08-01T08:00:00Z',
      updated_at: '2025-08-14T10:15:00Z',
      author: 'System',
      is_public: true,
      suggested_for: ['FOLLOW_UP']
    }
  ];

  // Initialize templates
  useEffect(() => {
    setIsLoading(true);
    // Simulate loading
    setTimeout(() => {
      setTemplates(sampleTemplates);
      setIsLoading(false);
    }, 500);
  }, []);

  // Generate AI suggestions based on selected email
  useEffect(() => {
    if (selectedEmail && templates.length > 0) {
      const suggested = templates.filter(template => 
        template.suggested_for.includes(selectedEmail.classification) ||
        (selectedEmail.urgency === 'HIGH' && template.tags.includes('urgent')) ||
        (selectedEmail.subject.toLowerCase().includes('meeting') && template.category === 'meeting')
      );
      setSuggestedTemplates(suggested.slice(0, 3));
    }
  }, [selectedEmail, templates]);

  // Apply filters
  useEffect(() => {
    let filtered = [...templates];

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Search filter
    if (filters.search.trim()) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.content.toLowerCase().includes(search) ||
        t.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }

    // Starred filter
    if (filters.starred) {
      filtered = filtered.filter(t => t.isStarred);
    }

    // Recently used filter
    if (filters.recentlyUsed) {
      filtered = filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
    } else {
      // Sort by usage count by default
      filtered = filtered.sort((a, b) => b.usage_count - a.usage_count);
    }

    setFilteredTemplates(filtered);
  }, [templates, filters]);

  const handleTemplateSelect = useCallback((template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  }, []);

  const handleTemplateApply = useCallback((template: EmailTemplate) => {
    // Update usage count
    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { ...t, usage_count: t.usage_count + 1, updated_at: new Date().toISOString() }
        : t
    ));
    
    onTemplateApply(template);
    setShowPreview(false);
    setSelectedTemplate(null);
  }, [onTemplateApply]);

  const handleStarToggle = useCallback((templateId: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === templateId ? { ...t, isStarred: !t.isStarred } : t
    ));
  }, []);

  const handleCreateFromDraft = useCallback(() => {
    if (!currentDraft) return;
    
    const metadata: Partial<EmailTemplate> = {
      name: `Draft Template ${new Date().toLocaleDateString()}`,
      description: 'Template created from current draft',
      category: 'custom',
      tags: ['custom', 'user-created'],
      author: 'User',
      is_public: false
    };
    
    onTemplateCreate(currentDraft.content, metadata);
    setShowCreateModal(false);
  }, [currentDraft, onTemplateCreate]);

  const getCategoryIcon = (category: EmailTemplate['category']) => {
    switch (category) {
      case 'response': return <DocumentTextIcon className="w-4 h-4" />;
      case 'follow-up': return <ClockIcon className="w-4 h-4" />;
      case 'approval': return <BuildingOfficeIcon className="w-4 h-4" />;
      case 'delegation': return <UserGroupIcon className="w-4 h-4" />;
      case 'meeting': return <BookmarkIcon className="w-4 h-4" />;
      case 'custom': return <PencilIcon className="w-4 h-4" />;
      default: return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: EmailTemplate['category']) => {
    switch (category) {
      case 'response': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'follow-up': return 'bg-green-50 text-green-700 border-green-200';
      case 'approval': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'delegation': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'meeting': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'custom': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <DocumentTextIcon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Templates</h3>
            <span className="text-sm text-muted-foreground">
              ({filteredTemplates.length} available)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!currentDraft}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              title={!currentDraft ? 'Generate a draft first' : 'Create template from current draft'}
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filter options */}
          <div className="flex items-center space-x-4 text-sm">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-1.5 border border-border rounded-md bg-background text-foreground"
            >
              <option value="all">All Categories</option>
              <option value="response">Response</option>
              <option value="follow-up">Follow-up</option>
              <option value="approval">Approval</option>
              <option value="delegation">Delegation</option>
              <option value="meeting">Meeting</option>
              <option value="custom">Custom</option>
            </select>

            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={filters.starred}
                onChange={(e) => setFilters(prev => ({ ...prev, starred: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <StarIcon className="w-4 h-4" />
              <span>Starred</span>
            </label>

            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={filters.recentlyUsed}
                onChange={(e) => setFilters(prev => ({ ...prev, recentlyUsed: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <ClockIcon className="w-4 h-4" />
              <span>Recently Used</span>
            </label>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestedTemplates.length > 0 && (
        <div className="border-b border-border p-4 bg-muted/30">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
            <SparklesIcon className="w-4 h-4 mr-2" />
            AI Suggested for "{selectedEmail?.classification}"
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {suggestedTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="text-left p-3 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center space-x-2 mb-1">
                  {getCategoryIcon(template.category)}
                  <span className="text-sm font-medium truncate">{template.name}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${getCategoryColor(template.category)}`}>
                    {template.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {template.usage_count} uses
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading templates...</p>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm">Try adjusting your filters or create a new template</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow bg-background"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {getCategoryIcon(template.category)}
                      <h4 className="font-medium">{template.name}</h4>
                      {template.isStarred && (
                        <StarSolidIcon className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                    
                    {/* Tags */}
                    <div className="flex items-center space-x-1 mb-2">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center space-x-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                        >
                          <TagIcon className="w-3 h-3" />
                          <span>{tag}</span>
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{template.tags.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>{template.usage_count} uses</span>
                      <span>Updated {formatTimeAgo(template.updated_at)}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 ml-4">
                    <button
                      onClick={() => handleStarToggle(template.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      title={template.isStarred ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {template.isStarred ? (
                        <StarSolidIcon className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <StarIcon className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleTemplateSelect(template)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      title="Preview template"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleTemplateApply(template)}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-96">
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                {selectedTemplate.content}
              </pre>
            </div>
            
            <div className="border-t border-border p-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTemplateApply(selectedTemplate)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-md w-full">
            <div className="border-b border-border p-4">
              <h3 className="text-lg font-semibold">Create Template from Draft</h3>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                This will create a new template using your current draft content.
              </p>
              {currentDraft && (
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <strong>Preview:</strong>
                  <div className="mt-2 text-muted-foreground">
                    {currentDraft.content.substring(0, 200)}...
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-border p-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromDraft}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};