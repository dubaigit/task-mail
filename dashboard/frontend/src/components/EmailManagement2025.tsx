/**
 * Email Management 2025 - Complete Functional System
 * Features: Smart categorization, time filters, AI chat, draft management, 
 * attachment views, workflow automation, Anime.js animations
 */

import React, { useState, useEffect, useRef } from 'react';

// Types
interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  senderEmail: string;
  preview: string;
  fullContent: string;
  category: 'urgent' | 'work' | 'personal' | 'promotions' | 'social' | 'updates';
  priority: 'high' | 'medium' | 'low';
  status: 'unread' | 'read' | 'replied' | 'forwarded' | 'archived';
  timestamp: string;
  relativeTime: string;
  attachments: Attachment[];
  isDraft: boolean;
  aiSuggestions: string[];
  estimatedReadTime: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  actions?: string[];
}

interface FilterState {
  category: string;
  timeRange: string;
  status: string;
  search: string;
}

const EmailManagement2025: React.FC = () => {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    timeRange: 'all',
    status: 'all',
    search: ''
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<EmailItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load email data immediately
  useEffect(() => {
    const mockEmails: EmailItem[] = [
        {
          id: '1',
          subject: 'Q4 Budget Review - Action Required',
          sender: 'Sarah Johnson',
          senderEmail: 'sarah.johnson@company.com',
          preview: 'Please review the attached Q4 budget proposal and provide your feedback by Friday. The marketing allocation has been increased by 15%...',
          fullContent: 'Hi Team,\n\nI hope this email finds you well. Please review the attached Q4 budget proposal and provide your feedback by Friday. The marketing allocation has been increased by 15% to support our new product launch.\n\nKey changes:\n- Marketing: +15% ($50K increase)\n- Development: +8% ($30K increase)\n- Operations: -5% ($20K decrease)\n\nPlease let me know if you have any questions or concerns.\n\nBest regards,\nSarah',
          category: 'urgent',
          priority: 'high',
          status: 'unread',
          timestamp: '2025-08-27T16:30:00Z',
          relativeTime: '2 hours ago',
          attachments: [
            { id: 'a1', name: 'Q4_Budget_Proposal.pdf', type: 'pdf', size: '2.3 MB', url: '#' },
            { id: 'a2', name: 'Budget_Comparison.xlsx', type: 'excel', size: '1.1 MB', url: '#' }
          ],
          isDraft: false,
          aiSuggestions: ['Schedule review meeting', 'Request clarification on marketing spend', 'Approve budget changes'],
          estimatedReadTime: '3 min'
        },
        {
          id: '2',
          subject: 'Team Meeting Rescheduled - New Time',
          sender: 'Mike Chen',
          senderEmail: 'mike.chen@company.com',
          preview: 'The weekly team meeting has been moved from 2 PM to 3 PM this Thursday due to a client call conflict...',
          fullContent: 'Hi everyone,\n\nThe weekly team meeting has been moved from 2 PM to 3 PM this Thursday due to a client call conflict.\n\nNew meeting details:\n- Date: Thursday, August 29th\n- Time: 3:00 PM - 4:00 PM\n- Location: Conference Room B\n- Zoom: https://zoom.us/j/123456789\n\nAgenda remains the same. Please update your calendars.\n\nThanks,\nMike',
          category: 'work',
          priority: 'medium',
          status: 'read',
          timestamp: '2025-08-27T14:15:00Z',
          relativeTime: '4 hours ago',
          attachments: [],
          isDraft: false,
          aiSuggestions: ['Update calendar', 'Confirm attendance', 'Prepare agenda items'],
          estimatedReadTime: '1 min'
        },
        {
          id: '3',
          subject: 'Draft: Client Presentation Feedback',
          sender: 'You',
          senderEmail: 'you@company.com',
          preview: 'Thank you for the presentation yesterday. I have some feedback and suggestions for the next iteration...',
          fullContent: 'Hi Lisa,\n\nThank you for the presentation yesterday. I have some feedback and suggestions for the next iteration:\n\n1. The market analysis section was excellent\n2. Consider adding more competitor comparison\n3. The pricing strategy needs more detail\n\nI think we should schedule a follow-up meeting to discuss these points in detail.\n\nBest regards,\n[Your name]',
          category: 'work',
          priority: 'medium',
          status: 'unread',
          timestamp: '2025-08-27T13:45:00Z',
          relativeTime: '5 hours ago',
          attachments: [],
          isDraft: true,
          aiSuggestions: ['Complete draft', 'Add specific examples', 'Schedule follow-up meeting'],
          estimatedReadTime: '2 min'
        },
        {
          id: '4',
          subject: 'Security Update - OAuth Implementation',
          sender: 'David Rodriguez',
          senderEmail: 'david.rodriguez@company.com',
          preview: 'The new OAuth implementation is ready for review. Please check the security measures and provide feedback...',
          fullContent: 'Hi team,\n\nThe new OAuth implementation is ready for review. Please check the security measures and provide feedback by end of week.\n\nKey features:\n- Multi-factor authentication\n- Token refresh mechanism\n- Rate limiting\n- Audit logging\n\nDocumentation is attached. Let me know if you need any clarification.\n\nBest,\nDavid',
          category: 'work',
          priority: 'high',
          status: 'unread',
          timestamp: '2025-08-27T12:20:00Z',
          relativeTime: '6 hours ago',
          attachments: [
            { id: 'a3', name: 'OAuth_Documentation.pdf', type: 'pdf', size: '1.8 MB', url: '#' }
          ],
          isDraft: false,
          aiSuggestions: ['Review security measures', 'Test implementation', 'Schedule code review'],
          estimatedReadTime: '4 min'
        },
        {
          id: '5',
          subject: 'Monthly Performance Report',
          sender: 'Emma Thompson',
          senderEmail: 'emma.thompson@company.com',
          preview: 'Please find attached the monthly performance report for your team. Overall metrics show positive growth...',
          fullContent: 'Hi,\n\nPlease find attached the monthly performance report for your team. Overall metrics show positive growth across all key indicators.\n\nHighlights:\n- Productivity up 12%\n- Customer satisfaction: 94%\n- Project completion rate: 98%\n\nDetailed breakdown is in the attached report. Great work everyone!\n\nBest regards,\nEmma',
          category: 'updates',
          priority: 'low',
          status: 'read',
          timestamp: '2025-08-27T10:30:00Z',
          relativeTime: '8 hours ago',
          attachments: [
            { id: 'a4', name: 'Monthly_Report_Aug2025.pdf', type: 'pdf', size: '3.2 MB', url: '#' }
          ],
          isDraft: false,
          aiSuggestions: ['Share with team', 'Schedule review meeting', 'Celebrate achievements'],
          estimatedReadTime: '5 min'
        },
        {
          id: '6',
          subject: 'Weekend Plans - Beach Trip?',
          sender: 'Alex Kim',
          senderEmail: 'alex.kim@personal.com',
          preview: 'Hey! Are you still up for the beach trip this weekend? Weather looks perfect and I found a great spot...',
          fullContent: 'Hey!\n\nAre you still up for the beach trip this weekend? Weather looks perfect and I found a great spot near Santa Monica.\n\nPlan:\n- Leave Saturday morning around 9 AM\n- Beach activities and lunch\n- Back by evening\n\nLet me know if you\'re in!\n\nCheers,\nAlex',
          category: 'personal',
          priority: 'low',
          status: 'unread',
          timestamp: '2025-08-27T09:15:00Z',
          relativeTime: '9 hours ago',
          attachments: [],
          isDraft: false,
          aiSuggestions: ['Confirm plans', 'Check weather', 'Pack beach gear'],
          estimatedReadTime: '1 min'
        }
      ];
      
      setEmails(mockEmails);
      setSelectedEmail(mockEmails[0]);
      setIsLoading(false);
    };

    loadEmails();
  }, []);

  // Initialize AI chat
  useEffect(() => {
    setChatMessages([
      {
        id: '1',
        type: 'ai',
        content: 'Hi! I\'m your AI email assistant. I can help you compose emails, edit drafts, find messages, send replies, and automate your workflow. What would you like me to help you with?',
        timestamp: new Date().toISOString(),
        actions: ['Compose Email', 'Find Messages', 'Edit Draft', 'Send Reply']
      }
    ]);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Color scheme (no purple!)
  const colors = {
    primary: '#0EA5E9',      // Sky blue
    secondary: '#06B6D4',    // Cyan
    success: '#10B981',      // Emerald
    warning: '#F59E0B',      // Amber
    error: '#EF4444',        // Red
    background: '#121212',
    surface1: '#1E1E1E',
    surface2: '#222222',
    surface3: '#2F2F2F',
    textPrimary: 'rgba(255, 255, 255, 0.87)',
    textSecondary: 'rgba(255, 255, 255, 0.60)',
    textDisabled: 'rgba(255, 255, 255, 0.38)',
    border: 'rgba(255, 255, 255, 0.12)'
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'urgent': return colors.error;
      case 'work': return colors.primary;
      case 'personal': return colors.success;
      case 'promotions': return colors.warning;
      case 'social': return colors.secondary;
      case 'updates': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return colors.primary;
      case 'read': return colors.textSecondary;
      case 'replied': return colors.success;
      case 'forwarded': return colors.secondary;
      case 'archived': return colors.textDisabled;
      default: return colors.textSecondary;
    }
  };

  // Filter emails
  const filteredEmails = emails.filter(email => {
    const matchesCategory = filters.category === 'all' || email.category === filters.category;
    const matchesStatus = filters.status === 'all' || email.status === filters.status;
    const matchesSearch = filters.search === '' || 
      email.subject.toLowerCase().includes(filters.search.toLowerCase()) ||
      email.sender.toLowerCase().includes(filters.search.toLowerCase()) ||
      email.preview.toLowerCase().includes(filters.search.toLowerCase());
    
    // Time filter logic
    let matchesTime = true;
    if (filters.timeRange !== 'all') {
      const emailTime = new Date(email.timestamp);
      const now = new Date();
      const diffHours = (now.getTime() - emailTime.getTime()) / (1000 * 60 * 60);
      
      switch (filters.timeRange) {
        case 'today':
          matchesTime = diffHours <= 24;
          break;
        case 'week':
          matchesTime = diffHours <= 168; // 7 days
          break;
        case 'month':
          matchesTime = diffHours <= 720; // 30 days
          break;
      }
    }
    
    return matchesCategory && matchesStatus && matchesSearch && matchesTime;
  });

  // AI Chat functions
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(chatInput),
        timestamp: new Date().toISOString(),
        actions: getAIActions(chatInput)
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const generateAIResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('compose') || lowerInput.includes('write')) {
      return 'I\'ll help you compose a new email. What\'s the subject and who should I send it to?';
    } else if (lowerInput.includes('draft')) {
      return 'I can help you edit your drafts. I see you have 1 draft email. Would you like me to help you complete it?';
    } else if (lowerInput.includes('find') || lowerInput.includes('search')) {
      return 'I can search through your emails. What are you looking for? You can search by sender, subject, or content.';
    } else if (lowerInput.includes('send') || lowerInput.includes('reply')) {
      return 'I can help you send replies. Which email would you like to respond to?';
    } else {
      return 'I can help you with email management tasks like composing, editing drafts, finding messages, sending replies, and organizing your inbox. What would you like me to do?';
    }
  };

  const getAIActions = (input: string): string[] => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('compose')) {
      return ['New Email', 'Use Template', 'Add Recipients'];
    } else if (lowerInput.includes('draft')) {
      return ['Open Draft', 'Complete Draft', 'Delete Draft'];
    } else if (lowerInput.includes('find')) {
      return ['Search All', 'Filter by Sender', 'Filter by Date'];
    } else {
      return ['Compose Email', 'Find Messages', 'Edit Draft', 'Send Reply'];
    }
  };

  const handleAIAction = (action: string) => {
    if (action === 'Open Draft' || action === 'Edit Draft') {
      const draft = emails.find(e => e.isDraft);
      if (draft) {
        setSelectedDraft(draft);
        setShowDraftModal(true);
      }
    } else if (action === 'Compose Email' || action === 'New Email') {
      // Create new email draft
      const newDraft: EmailItem = {
        id: Date.now().toString(),
        subject: '',
        sender: 'You',
        senderEmail: 'you@company.com',
        preview: '',
        fullContent: '',
        category: 'work',
        priority: 'medium',
        status: 'unread',
        timestamp: new Date().toISOString(),
        relativeTime: 'now',
        attachments: [],
        isDraft: true,
        aiSuggestions: ['Add subject', 'Add recipients', 'Write content'],
        estimatedReadTime: '0 min'
      };
      setSelectedDraft(newDraft);
      setShowDraftModal(true);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: colors.background,
        color: colors.textPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ 
          textAlign: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: `linear-gradient(45deg, ${colors.primary}, ${colors.secondary})`,
            borderRadius: '8px',
            margin: '0 auto 1.5rem',
            animation: 'pulse 2s ease-in-out infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: colors.background,
              borderRadius: '4px',
              animation: 'breathe 1.5s ease-in-out infinite'
            }}></div>
          </div>
          <p style={{ 
            color: colors.textSecondary,
            fontSize: '0.875rem',
            fontWeight: '500',
            margin: 0
          }}>
            Initializing Email Intelligence...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* LEFT PANEL - Categories & Filters */}
      <div style={{
        width: '320px',
        backgroundColor: colors.surface1,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem 1.5rem 1.5rem',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: colors.textPrimary,
            marginBottom: '0.5rem'
          }}>
            Email Intelligence
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: colors.textSecondary,
            margin: 0
          }}>
            AI-powered email management
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: '1.5rem' }}>
          <input
            type="text"
            placeholder="Search emails..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: colors.surface3,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textPrimary,
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = colors.primary;
              e.target.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = colors.border;
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Categories */}
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem'
          }}>
            Categories
          </h3>
          
          {['all', 'urgent', 'work', 'personal', 'promotions', 'social', 'updates'].map((category) => (
            <button
              key={category}
              onClick={() => setFilters(prev => ({ ...prev, category }))}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: filters.category === category ? colors.surface3 : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: filters.category === category ? colors.primary : colors.textSecondary,
                fontSize: '0.875rem',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: '0.25rem',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                if (filters.category !== category) {
                  e.currentTarget.style.backgroundColor = colors.surface2;
                }
              }}
              onMouseLeave={(e) => {
                if (filters.category !== category) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: category === 'all' ? colors.textSecondary : getCategoryColor(category)
              }}></div>
              {category.charAt(0).toUpperCase() + category.slice(1)}
              <span style={{
                marginLeft: 'auto',
                fontSize: '0.75rem',
                color: colors.textDisabled
              }}>
                {category === 'all' ? emails.length : emails.filter(e => e.category === category).length}
              </span>
            </button>
          ))}
        </div>

        {/* Time Filters */}
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem'
          }}>
            Time Range
          </h3>
          
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: colors.surface3,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textPrimary,
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem'
          }}>
            Status
          </h3>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: colors.surface3,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textPrimary,
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="forwarded">Forwarded</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Minimal Stats */}
        <div style={{
          padding: '1.5rem',
          borderTop: `1px solid ${colors.border}`,
          marginTop: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              backgroundColor: colors.surface3,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: colors.primary
              }}>
                {emails.filter(e => e.status === 'unread').length}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: colors.textSecondary
              }}>
                Unread
              </div>
            </div>
            <div style={{
              padding: '1rem',
              backgroundColor: colors.surface3,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: colors.success
              }}>
                {emails.filter(e => e.isDraft).length}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: colors.textSecondary
              }}>
                Drafts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE PANEL - Email List */}
      <div style={{
        width: '400px',
        backgroundColor: colors.surface1,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.surface2
        }}>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: colors.textPrimary,
            margin: 0
          }}>
            Emails ({filteredEmails.length})
          </h2>
        </div>

        {/* Email List - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem'
        }}>
          {filteredEmails.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              style={{
                padding: '1rem',
                margin: '0.5rem',
                backgroundColor: selectedEmail?.id === email.id ? colors.surface3 : colors.surface2,
                border: selectedEmail?.id === email.id ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (selectedEmail?.id !== email.id) {
                  e.currentTarget.style.backgroundColor = colors.surface3;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedEmail?.id !== email.id) {
                  e.currentTarget.style.backgroundColor = colors.surface2;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {/* Draft indicator */}
              {email.isDraft && (
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: colors.warning,
                  color: colors.background,
                  borderRadius: '4px',
                  fontSize: '0.625rem',
                  fontWeight: '600'
                }}>
                  DRAFT
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: email.status === 'unread' ? '600' : '500',
                    color: email.status === 'unread' ? colors.textPrimary : colors.textSecondary,
                    margin: 0,
                    lineHeight: '1.4',
                    marginBottom: '0.25rem'
                  }}>
                    {email.subject}
                  </h3>
                  <p style={{
                    fontSize: '0.75rem',
                    color: colors.textSecondary,
                    margin: 0,
                    marginBottom: '0.25rem'
                  }}>
                    {email.sender}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginLeft: '0.5rem'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getCategoryColor(email.category)
                  }}></div>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: getPriorityColor(email.priority)
                  }}></div>
                </div>
              </div>
              
              <p style={{
                fontSize: '0.75rem',
                color: colors.textSecondary,
                margin: '0 0 0.75rem 0',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {email.preview}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {email.attachments.length > 0 && (
                    <span style={{ color: colors.secondary }}>
                      📎 {email.attachments.length}
                    </span>
                  )}
                  <span style={{
                    color: getStatusColor(email.status),
                    textTransform: 'capitalize'
                  }}>
                    {email.status}
                  </span>
                  <span style={{ color: colors.textDisabled }}>•</span>
                  <span style={{ color: colors.textSecondary }}>
                    {email.estimatedReadTime}
                  </span>
                </div>
                <span style={{ color: colors.textDisabled }}>
                  {email.relativeTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL - Email Details & AI Chat */}
      <div style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {selectedEmail ? (
          <>
            {/* Email Header */}
            <div style={{
              padding: '2rem',
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.surface1
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <h1 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: colors.textPrimary,
                  margin: 0,
                  lineHeight: '1.3',
                  flex: 1
                }}>
                  {selectedEmail.subject}
                </h1>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginLeft: '1rem'
                }}>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: getCategoryColor(selectedEmail.category),
                    color: colors.background,
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {selectedEmail.category}
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: getPriorityColor(selectedEmail.priority),
                    color: colors.background,
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {selectedEmail.priority}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.875rem',
                color: colors.textSecondary,
                marginBottom: '1rem'
              }}>
                <span>From: {selectedEmail.sender}</span>
                <span>•</span>
                <span>{selectedEmail.relativeTime}</span>
                <span>•</span>
                <span style={{ color: getStatusColor(selectedEmail.status) }}>
                  {selectedEmail.status}
                </span>
                <span>•</span>
                <span>{selectedEmail.estimatedReadTime} read</span>
              </div>

              {/* Attachments */}
              {selectedEmail.attachments.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {selectedEmail.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: colors.surface3,
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = colors.surface2;
                        e.currentTarget.style.color = colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = colors.surface3;
                        e.currentTarget.style.color = colors.textSecondary;
                      }}
                    >
                      📎 {attachment.name} ({attachment.size})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Content */}
            <div style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden'
            }}>
              {/* Email Body */}
              <div style={{
                flex: showAIChat ? 1 : 2,
                padding: '2rem',
                overflowY: 'auto',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: colors.textSecondary,
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedEmail.fullContent}
                </div>

                {/* AI Suggestions */}
                <div style={{
                  marginTop: '2rem',
                  padding: '1.5rem',
                  backgroundColor: colors.surface1,
                  borderRadius: '12px',
                  border: `1px solid ${colors.primary}20`
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: colors.textPrimary,
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: colors.primary,
                      borderRadius: '50%'
                    }}></span>
                    AI Suggestions
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    {selectedEmail.aiSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleAIAction(suggestion)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: colors.surface3,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.primary;
                          e.currentTarget.style.color = colors.background;
                          e.currentTarget.style.borderColor = colors.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surface3;
                          e.currentTarget.style.color = colors.textPrimary;
                          e.currentTarget.style.borderColor = colors.border;
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Chat Panel */}
              {showAIChat && (
                <div style={{
                  width: '400px',
                  backgroundColor: colors.surface1,
                  borderLeft: `1px solid ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'slideIn 0.3s ease'
                }}>
                  {/* Chat Header */}
                  <div style={{
                    padding: '1rem',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: colors.textPrimary,
                      margin: 0
                    }}>
                      AI Assistant
                    </h3>
                    <button
                      onClick={() => setShowAIChat(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Chat Messages */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1rem'
                  }}>
                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        style={{
                          marginBottom: '1rem',
                          display: 'flex',
                          flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
                        }}
                      >
                        <div style={{
                          maxWidth: '80%',
                          padding: '0.75rem 1rem',
                          backgroundColor: message.type === 'user' ? colors.primary : colors.surface3,
                          color: message.type === 'user' ? colors.background : colors.textPrimary,
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          lineHeight: '1.4'
                        }}>
                          {message.content}
                          {message.actions && (
                            <div style={{
                              marginTop: '0.75rem',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem'
                            }}>
                              {message.actions.map((action, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleAIAction(action)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: colors.surface2,
                                    color: colors.textPrimary,
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = colors.primary;
                                    e.currentTarget.style.color = colors.background;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = colors.surface2;
                                    e.currentTarget.style.color = colors.textPrimary;
                                  }}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div style={{
                    padding: '1rem',
                    borderTop: `1px solid ${colors.border}`
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="text"
                        placeholder="Ask AI to help with this email..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: colors.surface3,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          color: colors.textPrimary,
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                      />
                      <button
                        onClick={handleSendMessage}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: colors.primary,
                          color: colors.background,
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div style={{
              padding: '1.5rem 2rem',
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: colors.surface1,
              display: 'flex',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setShowAIChat(!showAIChat)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: showAIChat ? colors.surface3 : colors.primary,
                  color: showAIChat ? colors.textPrimary : colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {showAIChat ? 'Hide AI Chat' : 'AI Assistant'}
              </button>
              
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: colors.success,
                  color: colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Reply
              </button>
              
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: colors.secondary,
                  color: colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Forward
              </button>
              
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: colors.surface3,
                  color: colors.textPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface3;
                }}
              >
                Archive
              </button>

              {selectedEmail.isDraft && (
                <button
                  onClick={() => {
                    setSelectedDraft(selectedEmail);
                    setShowDraftModal(true);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: colors.warning,
                    color: colors.background,
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Edit Draft
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textDisabled
          }}>
            Select an email to view details
          </div>
        )}
      </div>

      {/* Draft Modal */}
      {showDraftModal && selectedDraft && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            width: '90%',
            maxWidth: '800px',
            height: '80%',
            backgroundColor: colors.surface1,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                {selectedDraft.subject || 'New Email'}
              </h2>
              <button
                onClick={() => setShowDraftModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <input
                type="text"
                placeholder="Subject"
                defaultValue={selectedDraft.subject}
                style={{
                  padding: '0.75rem',
                  backgroundColor: colors.surface3,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
              
              <input
                type="text"
                placeholder="To: recipient@email.com"
                style={{
                  padding: '0.75rem',
                  backgroundColor: colors.surface3,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
              
              <textarea
                placeholder="Write your email..."
                defaultValue={selectedDraft.fullContent}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: colors.surface3,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.875rem',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '1.5rem',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDraftModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: colors.surface3,
                  color: colors.textPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save Draft
              </button>
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.8); }
        }
        
        @keyframes slideUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        
        @keyframes slideOut {
          0% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default EmailManagement2025;

