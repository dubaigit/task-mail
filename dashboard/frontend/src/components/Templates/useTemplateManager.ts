import { useState, useEffect, useCallback } from 'react';
import { EmailTemplate, TemplateFilters, Email } from './types';

export const useTemplateManager = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [filters, setFilters] = useState<TemplateFilters>({
    category: 'all',
    search: '',
    starred: false,
    recentlyUsed: false
  });
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
  const generateSuggestions = useCallback((selectedEmail: Email | null) => {
    if (selectedEmail && templates.length > 0) {
      const suggested = templates.filter(template => 
        template.suggested_for.includes(selectedEmail.classification) ||
        (selectedEmail.urgency === 'HIGH' && template.tags.includes('urgent')) ||
        (selectedEmail.subject.toLowerCase().includes('meeting') && template.category === 'meeting')
      );
      setSuggestedTemplates(suggested.slice(0, 3));
    }
  }, [templates]);

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

  const updateUsageCount = useCallback((templateId: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === templateId 
        ? { ...t, usage_count: t.usage_count + 1, updated_at: new Date().toISOString() }
        : t
    ));
  }, []);

  const toggleStar = useCallback((templateId: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === templateId ? { ...t, isStarred: !t.isStarred } : t
    ));
  }, []);

  return {
    templates,
    filteredTemplates,
    filters,
    setFilters,
    isLoading,
    suggestedTemplates,
    generateSuggestions,
    updateUsageCount,
    toggleStar
  };
};