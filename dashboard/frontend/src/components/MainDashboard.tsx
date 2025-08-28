import React, { useState, useEffect } from 'react';

const MainDashboard = () => {
  // Design System - 2025 Dark Mode Tokens
  const designTokens = `
    :root[data-theme="dark"] {
      --bg: #0B0F14;
      --bg-elev: #111726;
      --surface: #141B2A;
      --text: #E6EAF2;
      --text-dim: #B8C0CF;
      --muted: #8593AE;
      --primary: #6EA8FE;
      --primary-600: #4C8CF7;
      --primary-700: #2E6FEF;
      --success: #3ED598;
      --warning: #F5C451;
      --danger: #FF6B6B;
      --border: #1E2637;
      --ring: #3B82F6;
      --shadow-1: 0 1px 2px rgba(0,0,0,.35);
      --shadow-2: 0 6px 24px rgba(0,0,0,.35);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --space-1: 8px;
      --space-2: 12px;
      --space-3: 16px;
      --space-4: 24px;
      --space-5: 32px;
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 1ms !important;
      }
    }

    :focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
      padding: var(--space-4);
    }

    .card--elev {
      box-shadow: var(--shadow-2);
    }

    .animate-hover {
      transition: transform 160ms ease-out;
    }

    .animate-hover:hover {
      transform: scale(1.02);
    }

    .animate-fade-in {
      animation: fadeInUp 240ms ease-out;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  // Professional SVG Icons
  const Icons = {
    Search: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    Mail: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    Reply: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9,17 4,12 9,7"/>
        <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
      </svg>
    ),
    Archive: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="21,8 21,21 3,21 3,8"/>
        <rect x="1" y="3" width="22" height="5"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
    Star: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/>
      </svg>
    ),
    Bot: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="10" rx="2" ry="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
      </svg>
    ),
    Plus: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    AlertCircle: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    Clock: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
    ),
    CheckCircle: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22,4 12,14.01 9,11.01"/>
      </svg>
    ),
    X: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
    Send: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22,2 15,22 11,13 2,9 22,2"/>
      </svg>
    ),
    Edit: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    Calendar: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    Tag: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    )
  };

  // Sample email data with proper task categories
  const [emails] = useState([
    {
      id: 1,
      subject: 'Project Proposal Review',
      sender: 'sarah.johnson@company.com',
      preview: 'Please review the attached proposal for the Q4 marketing campaign...',
      time: '2 hours ago',
      isRead: false,
      category: 'needs-reply',
      taskType: 'review',
      priority: 'high',
      status: 'urgent'
    },
    {
      id: 2,
      subject: 'Meeting Follow-up',
      sender: 'mike.chen@startup.io',
      preview: 'Thanks for the productive meeting today. Here are the action items...',
      time: '4 hours ago',
      isRead: true,
      category: 'follow-up',
      taskType: 'follow-up',
      priority: 'medium',
      status: 'pending'
    },
    {
      id: 3,
      subject: 'Budget Approval Request',
      sender: 'finance@company.com',
      preview: 'Please approve the Q1 budget allocation for the marketing department...',
      time: '1 day ago',
      isRead: false,
      category: 'approval-required',
      taskType: 'approval',
      priority: 'high',
      status: 'action-required'
    },
    {
      id: 4,
      subject: 'Team Meeting Agenda',
      sender: 'hr@company.com',
      preview: 'Weekly team meeting scheduled for Friday at 2 PM...',
      time: '2 days ago',
      isRead: true,
      category: 'meetings',
      taskType: 'meeting',
      priority: 'medium',
      status: 'pending'
    },
    {
      id: 5,
      subject: 'Task Assignment',
      sender: 'project.manager@company.com',
      preview: 'Please delegate the following tasks to your team members...',
      time: '3 days ago',
      isRead: false,
      category: 'delegate',
      taskType: 'delegation',
      priority: 'medium',
      status: 'pending'
    },
    {
      id: 6,
      subject: 'Company Newsletter',
      sender: 'newsletter@company.com',
      preview: 'Monthly company updates and announcements...',
      time: '1 week ago',
      isRead: true,
      category: 'fyi-only',
      taskType: 'information',
      priority: 'low',
      status: 'completed'
    }
  ]);

  // Email task categories with proper icons
  const categories = [
    { id: 'all', name: 'All Categories', count: emails.length, color: 'var(--primary)', icon: Icons.Mail },
    { id: 'needs-reply', name: 'Needs Reply', count: emails.filter(e => e.category === 'needs-reply').length, color: 'var(--danger)', icon: Icons.Reply },
    { id: 'approval-required', name: 'Approval Required', count: emails.filter(e => e.category === 'approval-required').length, color: '#8B5CF6', icon: Icons.CheckCircle },
    { id: 'delegate', name: 'Delegate', count: emails.filter(e => e.category === 'delegate').length, color: '#6366F1', icon: Icons.Send },
    { id: 'follow-up', name: 'Follow Up', count: emails.filter(e => e.category === 'follow-up').length, color: 'var(--success)', icon: Icons.Clock },
    { id: 'meetings', name: 'Meetings', count: emails.filter(e => e.category === 'meetings').length, color: '#06B6D4', icon: Icons.Calendar },
    { id: 'fyi-only', name: 'FYI Only', count: emails.filter(e => e.category === 'fyi-only').length, color: '#22C55E', icon: Icons.Mail }
  ];

  // State management
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState([
    { type: 'ai', message: 'Hello! I can help you manage emails, create drafts, send messages, and automate workflows. What would you like me to do?' }
  ]);

  // Initialize dark mode
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  // Filter emails based on selected criteria
  const filteredEmails = emails.filter(email => {
    const matchesCategory = selectedCategory === 'all' || email.category === selectedCategory;
    const matchesStatus = statusFilter === 'all' || email.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Handle email selection
  const handleEmailSelect = (email: any) => {
    setSelectedEmail(email);
    email.isRead = true;
  };

  // Get status color and icon
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'urgent': return { 
        backgroundColor: 'rgba(255, 107, 107, 0.15)', 
        color: 'var(--danger)', 
        border: '1px solid rgba(255, 107, 107, 0.3)',
        icon: Icons.AlertCircle
      };
      case 'pending': return { 
        backgroundColor: 'rgba(245, 196, 81, 0.15)', 
        color: 'var(--warning)', 
        border: '1px solid rgba(245, 196, 81, 0.3)',
        icon: Icons.Clock
      };
      case 'action-required': return { 
        backgroundColor: 'rgba(249, 115, 22, 0.15)', 
        color: '#FB923C', 
        border: '1px solid rgba(249, 115, 22, 0.3)',
        icon: Icons.AlertCircle
      };
      case 'completed': return { 
        backgroundColor: 'rgba(62, 213, 152, 0.15)', 
        color: 'var(--success)', 
        border: '1px solid rgba(62, 213, 152, 0.3)',
        icon: Icons.CheckCircle
      };
      default: return { 
        backgroundColor: 'rgba(133, 147, 174, 0.15)', 
        color: 'var(--muted)', 
        border: '1px solid rgba(133, 147, 174, 0.3)',
        icon: Icons.Clock
      };
    }
  };

  // Get priority style
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high': return { color: 'var(--danger)', icon: Icons.AlertCircle };
      case 'medium': return { color: 'var(--warning)', icon: Icons.Clock };
      case 'low': return { color: 'var(--success)', icon: Icons.CheckCircle };
      default: return { color: 'var(--muted)', icon: Icons.Clock };
    }
  };

  // Handle AI message
  const handleAIMessage = () => {
    if (aiMessage.trim()) {
      setAiChatHistory([...aiChatHistory, 
        { type: 'user', message: aiMessage },
        { type: 'ai', message: 'I\'ll help you create a draft. Opening the draft editor now.' }
      ]);
      setAiMessage('');
      setShowDraftModal(true);
    }
  };

  // Handle draft save
  const handleDraftSave = () => {
    setShowDraftModal(false);
    setAiChatHistory([...aiChatHistory, 
      { type: 'ai', message: 'Draft saved successfully! You can find it in your drafts folder.' }
    ]);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: designTokens }} />
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        backgroundColor: 'var(--bg)', 
        color: 'var(--text)', 
        fontFamily: 'Inter, system-ui, sans-serif' 
      }}>
        {/* Left Sidebar - Categories */}
        <div className="card animate-fade-in" style={{ 
          width: '280px', 
          backgroundColor: 'var(--bg-elev)', 
          borderRight: '1px solid var(--border)',
          padding: 'var(--space-4)',
          overflowY: 'auto',
          margin: 0,
          borderRadius: 0,
          border: 'none'
        }}>
          <h2 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-4)',
            color: 'var(--text)'
          }}>Task Mail</h2>
          
          {/* Search */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 'var(--space-2)', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                <Icons.Search />
              </div>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="animate-hover"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-2) var(--space-2) 40px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  transition: 'border-color 160ms ease-out'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ 
              fontSize: '0.75rem', 
              fontWeight: '500', 
              marginBottom: 'var(--space-2)',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Categories</h3>
            
            {categories.map(category => {
              const IconComponent = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="animate-hover"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    marginBottom: 'var(--space-1)',
                    backgroundColor: selectedCategory === category.id ? 'rgba(110, 168, 254, 0.15)' : 'transparent',
                    border: selectedCategory === category.id ? '1px solid rgba(110, 168, 254, 0.3)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 160ms ease-out'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(110, 168, 254, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ color: category.color, marginRight: 'var(--space-2)' }}>
                      <IconComponent />
                    </div>
                    {category.name}
                  </div>
                  <span style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px var(--space-1)',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ 
              fontSize: '0.75rem', 
              fontWeight: '500', 
              marginBottom: 'var(--space-2)',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Filters</h3>
            
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="animate-hover"
                style={{
                  width: '100%',
                  padding: 'var(--space-1) var(--space-2)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.875rem'
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="animate-hover"
                style={{
                  width: '100%',
                  padding: 'var(--space-1) var(--space-2)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.875rem'
                }}
              >
                <option value="all">All Status</option>
                <option value="urgent">Urgent</option>
                <option value="pending">Pending</option>
                <option value="action-required">Action Required</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setShowAiChat(!showAiChat)}
              className="animate-hover"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 160ms ease-out'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-600)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
            >
              <Icons.Bot />
              AI Assistant
            </button>

            <button
              onClick={() => setShowDraftModal(true)}
              className="animate-hover"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--success)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 160ms ease-out'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2DD4BF'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--success)'}
            >
              <Icons.Plus />
              New Draft
            </button>
          </div>
        </div>

        {/* Middle Panel - Email List */}
        <div style={{ 
          width: '400px', 
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--border)'
          }}>
            <h2 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              margin: '0',
              color: 'var(--text)'
            }}>
              Email Tasks ({filteredEmails.length})
            </h2>
          </div>

          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            padding: '0'
          }}>
            {filteredEmails.map(email => {
              const statusStyle = getStatusStyle(email.status);
              const priorityStyle = getPriorityStyle(email.priority);
              const StatusIcon = statusStyle.icon;
              const PriorityIcon = priorityStyle.icon;
              
              return (
                <div
                  key={email.id}
                  onClick={() => handleEmailSelect(email)}
                  className="animate-hover"
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    backgroundColor: selectedEmail?.id === email.id ? 'rgba(110, 168, 254, 0.08)' : 'transparent',
                    borderLeft: selectedEmail?.id === email.id ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 160ms ease-out'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedEmail?.id !== email.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(110, 168, 254, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedEmail?.id !== email.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                    <div style={{
                      color: categories.find(c => c.id === email.category)?.color || 'var(--muted)',
                      marginRight: 'var(--space-1)'
                    }}>
                      <Icons.Mail />
                    </div>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: email.isRead ? '400' : '600',
                      color: email.isRead ? 'var(--text-dim)' : 'var(--text)',
                      flex: 1
                    }}>
                      {email.subject}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {email.time}
                    </span>
                  </div>
                  
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--muted)',
                    marginBottom: 'var(--space-1)'
                  }}>
                    {email.sender}
                  </div>
                  
                  <div style={{ 
                    fontSize: '0.8125rem', 
                    color: 'var(--text-dim)',
                    marginBottom: 'var(--space-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {email.preview}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      color: priorityStyle.color 
                    }}>
                      <PriorityIcon />
                    </div>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: '500',
                      padding: '2px var(--space-1)', 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      ...statusStyle
                    }}>
                      <StatusIcon />
                      {email.status.replace('-', ' ').toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      backgroundColor: 'rgba(133, 147, 174, 0.15)',
                      color: 'var(--muted)',
                      padding: '2px var(--space-1)',
                      borderRadius: '4px'
                    }}>
                      {email.taskType.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Email Details & AI */}
        <div style={{ 
          flex: 1, 
          backgroundColor: 'var(--bg-elev)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedEmail ? (
            <>
              {/* Email Details */}
              <div className="animate-fade-in" style={{ 
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--border)'
              }}>
                <h2 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  marginBottom: 'var(--space-2)',
                  color: 'var(--text)'
                }}>
                  {selectedEmail.subject}
                </h2>
                
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-dim)',
                  marginBottom: 'var(--space-3)'
                }}>
                  {selectedEmail.sender}
                </div>
                
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-dim)',
                  lineHeight: '1.6',
                  marginBottom: 'var(--space-4)'
                }}>
                  {selectedEmail.preview}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <button className="animate-hover" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-3)',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#FFFFFF',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}>
                    <Icons.Reply />
                    Reply
                  </button>
                  <button className="animate-hover" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-3)',
                    backgroundColor: 'var(--muted)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#FFFFFF',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}>
                    <Icons.Archive />
                    Archive
                  </button>
                  <button className="animate-hover" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-3)',
                    backgroundColor: 'var(--warning)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#FFFFFF',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}>
                    <Icons.Star />
                    Star
                  </button>
                </div>

                {/* AI Suggestions */}
                <div>
                  <h3 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: 'var(--space-2)',
                    color: 'var(--muted)'
                  }}>AI Suggestions</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <button className="animate-hover" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-2)',
                      backgroundColor: 'rgba(110, 168, 254, 0.1)',
                      border: '1px solid rgba(110, 168, 254, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--primary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}>
                      <Icons.Edit />
                      Draft a professional reply
                    </button>
                    <button className="animate-hover" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-2)',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#A78BFA',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}>
                      <Icons.Calendar />
                      Schedule follow-up reminder
                    </button>
                    <button className="animate-hover" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-2)',
                      backgroundColor: 'rgba(62, 213, 152, 0.1)',
                      border: '1px solid rgba(62, 213, 152, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--success)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}>
                      <Icons.Tag />
                      Categorize and archive
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: '1rem'
            }}>
              Select an email to view details
            </div>
          )}

          {/* AI Chat Panel */}
          {showAiChat && (
            <div className="animate-fade-in" style={{ 
              height: '300px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ 
                padding: 'var(--space-3)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  margin: '0',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}>
                  <Icons.Bot />
                  AI Assistant
                </h3>
                <button
                  onClick={() => setShowAiChat(false)}
                  className="animate-hover"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <Icons.X />
                </button>
              </div>
              
              <div style={{ 
                flex: 1, 
                padding: 'var(--space-3)',
                overflowY: 'auto'
              }}>
                {aiChatHistory.map((chat, index) => (
                  <div key={index} style={{ 
                    marginBottom: 'var(--space-2)',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: chat.type === 'ai' ? 'rgba(110, 168, 254, 0.1)' : 'rgba(133, 147, 174, 0.1)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-dim)'
                  }}>
                    <strong style={{ color: chat.type === 'ai' ? 'var(--primary)' : 'var(--muted)' }}>
                      {chat.type === 'ai' ? 'AI: ' : 'You: '}
                    </strong>
                    {chat.message}
                  </div>
                ))}
              </div>
              
              <div style={{ 
                padding: 'var(--space-3)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 'var(--space-1)'
              }}>
                <input
                  type="text"
                  placeholder="Ask AI to help with emails..."
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAIMessage()}
                  style={{
                    flex: 1,
                    padding: 'var(--space-1) var(--space-2)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  onClick={handleAIMessage}
                  className="animate-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 'var(--space-1) var(--space-2)',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: '#FFFFFF',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  <Icons.Send />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Draft Modal */}
        {showDraftModal && (
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
            zIndex: 1000
          }}>
            <div className="card card--elev animate-fade-in" style={{
              backgroundColor: 'var(--bg-elev)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              width: '600px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              border: '1px solid var(--border)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  margin: '0',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}>
                  <Icons.Edit />
                  Compose Draft
                </h2>
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="animate-hover"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <Icons.X />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <input
                  type="text"
                  placeholder="To:"
                  className="animate-hover"
                  style={{
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.875rem'
                  }}
                />
                
                <input
                  type="text"
                  placeholder="Subject:"
                  className="animate-hover"
                  style={{
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.875rem'
                  }}
                />
                
                <textarea
                  placeholder="Compose your message..."
                  rows={8}
                  className="animate-hover"
                  style={{
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowDraftModal(false)}
                    className="animate-hover"
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      backgroundColor: 'var(--muted)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#FFFFFF',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDraftSave}
                    className="animate-hover"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-2) var(--space-4)',
                      backgroundColor: 'var(--primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#FFFFFF',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Icons.Send />
                    Save Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MainDashboard;

