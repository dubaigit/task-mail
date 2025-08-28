import React, { useState } from 'react';

// Professional Email Dashboard with Pixel-Perfect 2025 Design Standards
const MainDashboard: React.FC = () => {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: 'ai', content: 'Hello! I can help you manage emails, create drafts, and automate workflows. What would you like me to do?' }
  ]);

  // Design System Integration - Using CSS Custom Properties
  const designTokens = {
    // Color System - Using CSS Custom Properties
    colors: {
      // Base Colors
      background: 'hsl(var(--background))',
      surface: 'hsl(var(--surface))',
      surfaceHover: 'hsl(var(--surface-secondary))',
      border: 'hsl(var(--border-primary))',
      borderLight: 'hsl(var(--border-secondary))',
      
      // Text Colors
      textPrimary: 'hsl(var(--text-primary))',
      textSecondary: 'hsl(var(--text-secondary))',
      textMuted: 'hsl(var(--text-muted))',
      
      // Brand Colors
      primary: 'hsl(var(--primary-500))',
      primaryHover: 'hsl(var(--primary-600))',
      
      // Status Colors - Using CSS Custom Properties
      success: 'hsl(var(--success-600))',
      warning: 'hsl(var(--warning-500))',
      error: 'hsl(var(--error-500))',
      info: 'hsl(var(--info-500))',
      
      // Status Light Variants
      successLight: 'hsl(var(--success-700))',
      warningLight: 'hsl(var(--warning-700))',
      errorLight: 'hsl(var(--error-700))',
      infoLight: 'hsl(var(--info-700))',
    },
    
    // Typography Scale - Using CSS Custom Properties
    typography: {
      // Font Sizes
      xs: 'var(--font-size-xs)',
      sm: 'var(--font-size-sm)',
      base: 'var(--font-size-base)',
      lg: 'var(--font-size-lg)',
      xl: 'var(--font-size-xl)',
      '2xl': 'var(--font-size-2xl)',
      '3xl': 'var(--font-size-3xl)',
      
      // Line Heights
      tight: 'var(--line-height-tight)',
      normal: 'var(--line-height-normal)',
      relaxed: 'var(--line-height-relaxed)',
      
      // Font Weights
      fontNormal: 'var(--font-weight-normal)',
      medium: 'var(--font-weight-medium)',
      semibold: 'var(--font-weight-semibold)',
      bold: 'var(--font-weight-bold)',
    },
    
    // Spacing System - Using CSS Custom Properties
    spacing: {
      xs: '0.25rem',    // 4px - fallback for very small spacing
      sm: 'var(--space-component-gap-sm)',     // 8px
      md: 'var(--space-component-gap)',        // 12px
      lg: 'var(--space-component-gap-lg)',     // 16px
      xl: 'var(--space-component-padding-lg)', // 24px
      '2xl': 'var(--space-layout-section)',    // 32px
      '3xl': '3rem',    // 48px - fallback for large spacing
    },
    
    // Border Radius - Using CSS Custom Properties
    radius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
    },
    
    // Shadows - Using CSS Custom Properties
    shadows: {
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
    }
  };

  // Sample email data
  const emails = [
    {
      id: 1,
      subject: 'Project Proposal Review',
      sender: 'sarah.johnson@company.com',
      preview: 'Please review the attached proposal for the Q4 marketing campaign and provide feedback by end of week.',
      time: '2 hours ago',
      status: 'urgent',
      category: 'needs_reply',
      taskType: 'review',
      priority: 'high'
    },
    {
      id: 2,
      subject: 'Meeting Follow-up',
      sender: 'mike.chen@startup.io',
      preview: 'Thanks for the productive meeting today. Here are the action items we discussed and next steps.',
      time: '4 hours ago',
      status: 'pending',
      category: 'follow_up',
      taskType: 'follow-up',
      priority: 'medium'
    },
    {
      id: 3,
      subject: 'Budget Approval Request',
      sender: 'finance@company.com',
      preview: 'Please approve the Q1 budget allocation for the marketing department. Requires executive sign-off.',
      time: '1 day ago',
      status: 'action_required',
      category: 'approval_required',
      taskType: 'approval',
      priority: 'high'
    },
    {
      id: 4,
      subject: 'Team Meeting Agenda',
      sender: 'hr@company.com',
      preview: 'Weekly team meeting scheduled for Friday at 2 PM. Please review the agenda and prepare updates.',
      time: '2 days ago',
      status: 'pending',
      category: 'meetings',
      taskType: 'meeting',
      priority: 'medium'
    },
    {
      id: 5,
      subject: 'Task Assignment',
      sender: 'project.manager@company.com',
      preview: 'Please delegate the following tasks to your team members and confirm completion timeline.',
      time: '3 days ago',
      status: 'pending',
      category: 'delegate',
      taskType: 'delegation',
      priority: 'medium'
    },
    {
      id: 6,
      subject: 'Company Newsletter',
      sender: 'newsletter@company.com',
      preview: 'Monthly company updates and announcements. New product launches and team achievements.',
      time: '1 week ago',
      status: 'completed',
      category: 'fyi_only',
      taskType: 'information',
      priority: 'low'
    }
  ];

  // Email categories with refined colors
  const categories = [
    { id: 'all', name: 'All Categories', count: emails.length, color: designTokens.colors.primary },
    { id: 'needs_reply', name: 'Needs Reply', count: emails.filter(e => e.category === 'needs_reply').length, color: designTokens.colors.error },
    { id: 'approval_required', name: 'Approval Required', count: emails.filter(e => e.category === 'approval_required').length, color: '#8B5CF6' },
    { id: 'delegate', name: 'Delegate', count: emails.filter(e => e.category === 'delegate').length, color: designTokens.colors.info },
    { id: 'follow_up', name: 'Follow Up', count: emails.filter(e => e.category === 'follow_up').length, color: designTokens.colors.success },
    { id: 'meetings', name: 'Meetings', count: emails.filter(e => e.category === 'meetings').length, color: designTokens.colors.warning },
    { id: 'fyi_only', name: 'FYI Only', count: emails.filter(e => e.category === 'fyi_only').length, color: designTokens.colors.textMuted }
  ];

  // Filter emails
  const filteredEmails = emails.filter(email => {
    const matchesCategory = selectedCategory === 'all' || email.category === selectedCategory;
    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.preview.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Email metrics
  const emailMetrics = {
    totalEmails: emails.length,
    urgentEmails: emails.filter(e => e.status === 'urgent').length,
    pendingEmails: emails.filter(e => e.status === 'pending').length,
    completedEmails: emails.filter(e => e.status === 'completed').length,
    responseRate: 85,
    avgResponseTime: '2.4h'
  };

  const handleEmailSelect = (email: any) => {
    setSelectedEmail(email);
  };

  const handleAIMessage = (message: string) => {
    setAiMessages([...aiMessages, { role: 'user', content: message }]);
    
    setTimeout(() => {
      if (message.toLowerCase().includes('draft') || message.toLowerCase().includes('reply')) {
        setAiMessages(prev => [...prev, { role: 'ai', content: "I'll help you create a draft. Opening the draft editor now." }]);
        setShowDraftModal(true);
      } else {
        setAiMessages(prev => [...prev, { role: 'ai', content: "I can help you with email management, drafting replies, scheduling follow-ups, and organizing your inbox. What specific task would you like assistance with?" }]);
      }
    }, 1000);
  };

  // Professional SVG Icons
  const icons = {
    email: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    alert: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
    ),
    search: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    close: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
    ai: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8V4H8"/>
        <rect width="16" height="12" x="4" y="8" rx="2"/>
        <path d="M2 14h2"/>
        <path d="M20 14h2"/>
        <path d="M15 13v2"/>
        <path d="M9 13v2"/>
      </svg>
    )
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: designTokens.colors.background,
      color: designTokens.colors.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Professional Header with Perfect Spacing */}
      <header style={{
        backgroundColor: designTokens.colors.surface,
        borderBottom: `1px solid ${designTokens.colors.border}`,
        padding: `${designTokens.spacing.lg} ${designTokens.spacing['2xl']}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px', // Fixed height for consistency
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.lg }}>
          <h1 style={{ 
            fontSize: designTokens.typography['2xl'],
            fontWeight: designTokens.typography.bold,
            margin: 0,
            background: `linear-gradient(135deg, ${designTokens.colors.primary}, #8B5CF6)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: designTokens.typography.tight
          }}>
            TaskMail Dashboard
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing.xl }}>
          {/* Professional Search Bar */}
          <div style={{ 
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              position: 'absolute',
              left: designTokens.spacing.md,
              color: designTokens.colors.textMuted,
              pointerEvents: 'none'
            }}>
              {icons.search}
            </div>
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                backgroundColor: designTokens.colors.surfaceHover,
                border: `1px solid ${designTokens.colors.border}`,
                borderRadius: designTokens.radius.lg,
                padding: `${designTokens.spacing.md} ${designTokens.spacing.lg} ${designTokens.spacing.md} ${designTokens.spacing['2xl']}`,
                color: designTokens.colors.textPrimary,
                width: '320px',
                fontSize: designTokens.typography.sm,
                lineHeight: designTokens.typography.normal,
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* User Avatar */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: designTokens.colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: designTokens.typography.semibold,
            fontSize: designTokens.typography.sm
          }}>
            JD
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 72px)' }}>
        {/* Left Sidebar - Perfect Spacing & Typography */}
        <aside style={{
          width: '280px',
          backgroundColor: designTokens.colors.surface,
          borderRight: `1px solid ${designTokens.colors.border}`,
          padding: designTokens.spacing.xl,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: designTokens.spacing.xl
        }}>
          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.sm }}>
            <button
              onClick={() => setShowDraftModal(true)}
              style={{
                width: '100%',
                backgroundColor: designTokens.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: designTokens.radius.lg,
                padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                fontSize: designTokens.typography.sm,
                fontWeight: designTokens.typography.semibold,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: designTokens.spacing.sm,
                lineHeight: designTokens.typography.normal
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = designTokens.colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = designTokens.colors.primary}
            >
              {icons.email}
              New Draft
            </button>
            
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              style={{
                width: '100%',
                backgroundColor: '#8B5CF6',
                color: 'white',
                border: 'none',
                borderRadius: designTokens.radius.lg,
                padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                fontSize: designTokens.typography.sm,
                fontWeight: designTokens.typography.semibold,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: designTokens.spacing.sm,
                lineHeight: designTokens.typography.normal
              }}
            >
              {icons.ai}
              AI Assistant
            </button>
          </div>

          {/* Categories with Perfect Typography Hierarchy */}
          <div>
            <h3 style={{ 
              fontSize: designTokens.typography.xs,
              fontWeight: designTokens.typography.semibold,
              color: designTokens.colors.textMuted,
              marginBottom: designTokens.spacing.lg,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: designTokens.typography.tight,
              margin: `0 0 ${designTokens.spacing.lg} 0`
            }}>
              Categories
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.xs }}>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`
                    w-full flex items-center justify-between u-px-6 u-py-4
                    ${selectedCategory === category.id ? 'u-bg-surface-secondary u-border-secondary' : 'bg-transparent border-transparent'}
                    border rounded-xl cursor-pointer u-text-sm u-font-medium
                    transition-all duration-200 ease-in-out u-leading-normal text-left
                    min-h-11 box-border hover:u-bg-surface-secondary hover:u-text-primary
                    ${selectedCategory === category.id ? 'u-text-primary' : 'u-text-secondary'}
                  `}
                  style={{
                    borderLeft: `3px solid ${selectedCategory === category.id ? category.color : 'transparent'}`
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = '#2a2a2a';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = '#404040';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#a1a1aa';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${category.name}, ${category.count} items`}
                  aria-pressed={selectedCategory === category.id}
                >
                  <div className="flex-1 text-left u-whitespace-nowrap overflow-hidden u-text-ellipsis">
                    {category.name}
                  </div>
                  <div className="w-4 flex-shrink-0"></div>
                  <div 
                    className="text-white rounded-md u-px-2 u-py-1 u-text-xs u-font-semibold u-leading-none min-w-6 h-5 inline-flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  >
                    {category.count}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area - Optimized Layout */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: designTokens.colors.background, position: 'relative' }}>
          {/* Dashboard Metrics Cards - Relocated to Bottom Left */}
          <div style={{
            position: 'absolute',
            bottom: designTokens.spacing.lg,
            left: designTokens.spacing.lg,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: designTokens.spacing.md,
            width: '320px',
            zIndex: 10
          }}>
            {/* Total Emails Card - Compact Professional Design */}
            <div className="
              u-bg-surface rounded-xl u-p-4 u-border-primary border
              shadow-lg hover:shadow-xl transition-all duration-300 ease-out
              min-h-20 flex items-center relative overflow-hidden group
              hover:-translate-y-1 hover:scale-102
              backdrop-blur-sm
            " style={{
              background: 'rgba(59, 130, 246, 0.05)',
              backdropFilter: 'blur(5px)'
            }}>
              <div className="flex items-center gap-3 w-full">
                <div className="
                  w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600
                  flex items-center justify-center text-white text-sm
                  shadow-md group-hover:shadow-lg group-hover:scale-105
                  transition-all duration-300 ease-out flex-shrink-0
                ">
                  {icons.email}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="
                    u-text-secondary u-text-xs u-font-medium u-leading-tight
                    uppercase tracking-wide u-mb-1
                  ">
                    Total Emails
                  </p>
                  <p className="
                    text-xl font-semibold u-text-primary u-leading-tight
                    group-hover:text-blue-400 transition-all duration-300
                  ">
                    {emailMetrics.totalEmails}
                  </p>
                </div>
              </div>
            </div>

            {/* Urgent Emails Card - Compact Alert Design */}
            <div className="
              u-bg-surface rounded-xl u-p-4 u-border-error border
              shadow-lg hover:shadow-xl transition-all duration-300 ease-out
              min-h-20 flex items-center relative overflow-hidden group
              hover:-translate-y-1 hover:scale-102
              backdrop-blur-sm
            " style={{
              background: 'rgba(239, 68, 68, 0.05)',
              backdropFilter: 'blur(5px)'
            }}>
              <div className="flex items-center gap-3 w-full">
                <div className="
                  w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600
                  flex items-center justify-center text-white text-sm
                  shadow-md group-hover:shadow-lg group-hover:scale-105
                  transition-all duration-300 ease-out flex-shrink-0
                ">
                  {icons.alert}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="
                    u-text-secondary u-text-xs u-font-medium u-leading-tight
                    uppercase tracking-wide u-mb-1
                  ">
                    Urgent
                  </p>
                  <p className="
                    text-xl font-semibold u-text-error u-leading-tight
                    group-hover:text-red-400 transition-all duration-300
                  ">
                    {emailMetrics.urgentEmails}
                  </p>
                </div>
              </div>
            </div>

            {/* Response Rate Card - Compact Success Design */}
            <div className="
              u-bg-surface rounded-xl u-p-4 u-border-success border
              shadow-lg hover:shadow-xl transition-all duration-300 ease-out
              min-h-20 flex items-center relative overflow-hidden group
              hover:-translate-y-1 hover:scale-102
              backdrop-blur-sm
            " style={{
              background: 'rgba(34, 197, 94, 0.05)',
              backdropFilter: 'blur(5px)'
            }}>
              <div className="flex items-center gap-3 w-full">
                <div className="
                  w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600
                  flex items-center justify-center text-white text-sm
                  shadow-md group-hover:shadow-lg group-hover:scale-105
                  transition-all duration-300 ease-out flex-shrink-0
                ">
                  {icons.chart}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="
                    u-text-secondary u-text-xs u-font-medium u-leading-tight
                    uppercase tracking-wide u-mb-1
                  ">
                    Response Rate
                  </p>
                  <p className="
                    text-xl font-semibold u-text-success u-leading-tight
                    group-hover:text-green-400 transition-all duration-300
                  ">
                    {emailMetrics.responseRate}%
                  </p>
                </div>
              </div>
            </div>

            {/* Avg Response Time Card - Compact Performance Design */}
            <div className="
              u-bg-surface rounded-xl u-p-4 u-border-warning border
              shadow-lg hover:shadow-xl transition-all duration-300 ease-out
              min-h-20 flex items-center relative overflow-hidden group
              hover:-translate-y-1 hover:scale-102
              backdrop-blur-sm
            " style={{
              background: 'rgba(245, 158, 11, 0.05)',
              backdropFilter: 'blur(5px)'
            }}>
              <div className="flex items-center gap-3 w-full">
                <div className="
                  w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600
                  flex items-center justify-center text-white text-sm
                  shadow-md group-hover:shadow-lg group-hover:scale-105
                  transition-all duration-300 ease-out flex-shrink-0
                ">
                  {icons.clock}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="
                    u-text-secondary u-text-xs u-font-medium u-leading-tight
                    uppercase tracking-wide u-mb-1
                  ">
                    Avg Response Time
                  </p>
                  <p className="
                    text-xl font-semibold u-text-warning u-leading-tight
                    group-hover:text-yellow-400 transition-all duration-300
                  ">
                    {emailMetrics.avgResponseTime}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Email List and Details - Now with More Vertical Space */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            padding: designTokens.spacing.lg,
            gap: designTokens.spacing.xl
          }}>
            {/* Email List */}
            <div style={{
              flex: 1,
              backgroundColor: designTokens.colors.surface,
              borderRadius: designTokens.radius.xl,
              border: `1px solid ${designTokens.colors.border}`,
              overflow: 'hidden',
              boxShadow: designTokens.shadows.md
            }}>
              <div style={{
                padding: designTokens.spacing.xl,
                borderBottom: `1px solid ${designTokens.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{ 
                  fontSize: designTokens.typography.lg, 
                  fontWeight: designTokens.typography.semibold, 
                  margin: 0,
                  color: designTokens.colors.textPrimary,
                  lineHeight: designTokens.typography.tight
                }}>
                  Email Tasks ({filteredEmails.length})
                </h2>
              </div>
              
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredEmails.map((email, index) => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailSelect(email)}
                    style={{
                      padding: designTokens.spacing.xl,
                      borderBottom: index < filteredEmails.length - 1 ? `1px solid ${designTokens.colors.border}` : 'none',
                      cursor: 'pointer',
                      backgroundColor: selectedEmail?.id === email.id ? designTokens.colors.surfaceHover : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedEmail?.id !== email.id) {
                        e.currentTarget.style.backgroundColor = designTokens.colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedEmail?.id !== email.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: designTokens.spacing.lg }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          fontSize: designTokens.typography.base,
                          fontWeight: designTokens.typography.semibold,
                          margin: `0 0 ${designTokens.spacing.xs} 0`,
                          color: designTokens.colors.textPrimary,
                          lineHeight: designTokens.typography.tight,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email.subject}
                        </h3>
                        <p style={{ 
                          fontSize: designTokens.typography.sm,
                          color: designTokens.colors.textMuted,
                          margin: `0 0 ${designTokens.spacing.sm} 0`,
                          lineHeight: designTokens.typography.normal
                        }}>
                          {email.sender}
                        </p>
                        <p style={{ 
                          fontSize: designTokens.typography.sm,
                          color: designTokens.colors.textSecondary,
                          margin: 0,
                          lineHeight: designTokens.typography.normal,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email.preview}
                        </p>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'flex-end', 
                        gap: designTokens.spacing.sm,
                        flexShrink: 0
                      }}>
                        <span style={{ 
                          fontSize: designTokens.typography.xs, 
                          color: designTokens.colors.textMuted,
                          fontWeight: designTokens.typography.medium,
                          lineHeight: designTokens.typography.normal
                        }}>
                          {email.time}
                        </span>
                        
                        <div 
                          className="flex flex-wrap items-center u-gap-2"
                          role="group" 
                          aria-label="Email status indicators"
                        >
                          <div 
                            className={`
                              text-white u-text-xs u-font-bold u-px-2 u-py-1 rounded-md
                              u-uppercase u-leading-none u-whitespace-nowrap u-tracking-wide
                              shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105
                              ${email.status === 'urgent' ? 'u-bg-error-solid' : 
                                email.status === 'pending' ? 'u-bg-warning-solid' : 
                                email.status === 'action_required' ? 'bg-purple-600' : 'u-bg-success-solid'}
                            `}
                            role="status" 
                            aria-label={`${email.status.replace('_', ' ')} priority`}
                          >
                            {email.status.replace('_', ' ').toUpperCase()}
                          </div>
                          
                          <div 
                            className="u-bg-surface-secondary u-text-secondary u-text-xs u-font-semibold u-px-2 u-py-1 rounded-md u-uppercase u-leading-none u-whitespace-nowrap u-tracking-wide u-border-secondary border transition-all duration-200 hover:u-bg-surface-tertiary hover:u-text-primary"
                            role="status" 
                            aria-label={`${email.taskType} task type`}
                          >
                            {email.taskType.replace('-', ' ').toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Details Panel */}
            <div style={{
              width: '400px',
              backgroundColor: designTokens.colors.surface,
              borderRadius: designTokens.radius.xl,
              border: `1px solid ${designTokens.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: designTokens.shadows.md,
              flexShrink: 0
            }}>
              {selectedEmail ? (
                <>
                  <div style={{
                    padding: designTokens.spacing.xl,
                    borderBottom: `1px solid ${designTokens.colors.border}`
                  }}>
                    <h2 style={{ 
                      fontSize: designTokens.typography.lg, 
                      fontWeight: designTokens.typography.semibold, 
                      margin: `0 0 ${designTokens.spacing.sm} 0`,
                      color: designTokens.colors.textPrimary,
                      lineHeight: designTokens.typography.tight
                    }}>
                      {selectedEmail.subject}
                    </h2>
                    <p style={{ 
                      fontSize: designTokens.typography.sm, 
                      color: designTokens.colors.textMuted, 
                      margin: 0,
                      lineHeight: designTokens.typography.normal
                    }}>
                      {selectedEmail.sender}
                    </p>
                  </div>
                  
                  <div style={{ 
                    padding: designTokens.spacing.xl, 
                    flex: 1,
                    overflowY: 'auto'
                  }}>
                    <p style={{ 
                      fontSize: designTokens.typography.sm, 
                      lineHeight: designTokens.typography.relaxed, 
                      color: designTokens.colors.textSecondary,
                      margin: 0
                    }}>
                      {selectedEmail.preview}
                    </p>
                  </div>
                  
                  <div style={{
                    padding: designTokens.spacing.xl,
                    borderTop: `1px solid ${designTokens.colors.border}`,
                    display: 'flex',
                    gap: designTokens.spacing.sm
                  }}>
                    <button style={{
                      backgroundColor: designTokens.colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: designTokens.radius.lg,
                      padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                      fontSize: designTokens.typography.sm,
                      fontWeight: designTokens.typography.semibold,
                      cursor: 'pointer',
                      flex: 1,
                      transition: 'all 0.2s ease',
                      lineHeight: designTokens.typography.normal
                    }}>
                      Reply
                    </button>
                    <button style={{
                      backgroundColor: designTokens.colors.surfaceHover,
                      color: designTokens.colors.textMuted,
                      border: 'none',
                      borderRadius: designTokens.radius.lg,
                      padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                      fontSize: designTokens.typography.sm,
                      fontWeight: designTokens.typography.semibold,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      lineHeight: designTokens.typography.normal
                    }}>
                      Archive
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: designTokens.spacing.xl,
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: designTokens.colors.surfaceHover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: designTokens.spacing.xl,
                    border: `2px solid ${designTokens.colors.border}`
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: designTokens.colors.textMuted }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  
                  <h3 style={{
                    fontSize: designTokens.typography.lg,
                    fontWeight: designTokens.typography.semibold,
                    color: designTokens.colors.textPrimary,
                    margin: `0 0 ${designTokens.spacing.sm} 0`,
                    lineHeight: designTokens.typography.tight
                  }}>
                    No Email Selected
                  </h3>
                  
                  <p style={{
                    fontSize: designTokens.typography.sm,
                    color: designTokens.colors.textMuted,
                    lineHeight: designTokens.typography.relaxed,
                    margin: `0 0 ${designTokens.spacing.xl} 0`,
                    maxWidth: '280px'
                  }}>
                    Choose an email from the list to view its details, reply, or take action on the task.
                  </p>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: designTokens.spacing.md,
                    width: '100%',
                    maxWidth: '240px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: designTokens.spacing.sm,
                      padding: designTokens.spacing.md,
                      backgroundColor: designTokens.colors.surfaceHover,
                      borderRadius: designTokens.radius.lg,
                      border: `1px solid ${designTokens.colors.border}`
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: designTokens.colors.error,
                        flexShrink: 0
                      }}></div>
                      <span style={{
                        fontSize: designTokens.typography.xs,
                        color: designTokens.colors.textSecondary,
                        fontWeight: designTokens.typography.medium
                      }}>
                        {emailMetrics.urgentEmails} urgent emails need attention
                      </span>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: designTokens.spacing.sm,
                      padding: designTokens.spacing.md,
                      backgroundColor: designTokens.colors.surfaceHover,
                      borderRadius: designTokens.radius.lg,
                      border: `1px solid ${designTokens.colors.border}`
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: designTokens.colors.success,
                        flexShrink: 0
                      }}></div>
                      <span style={{
                        fontSize: designTokens.typography.xs,
                        color: designTokens.colors.textSecondary,
                        fontWeight: designTokens.typography.medium
                      }}>
                        {emailMetrics.responseRate}% response rate this week
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* AI Chat Panel - Professional Design */}
      {showAIChat && (
        <div style={{
          position: 'fixed',
          bottom: designTokens.spacing.xl,
          right: designTokens.spacing.xl,
          width: '380px',
          height: '480px',
          backgroundColor: designTokens.colors.surface,
          borderRadius: designTokens.radius.xl,
          border: `1px solid ${designTokens.colors.border}`,
          boxShadow: designTokens.shadows.xl,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div style={{
            padding: designTokens.spacing.xl,
            borderBottom: `1px solid ${designTokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ 
              fontSize: designTokens.typography.base, 
              fontWeight: designTokens.typography.semibold, 
              margin: 0,
              color: designTokens.colors.textPrimary,
              lineHeight: designTokens.typography.tight
            }}>
              AI Assistant
            </h3>
            <button
              onClick={() => setShowAIChat(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: designTokens.colors.textMuted,
                cursor: 'pointer',
                padding: designTokens.spacing.xs,
                borderRadius: designTokens.radius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {icons.close}
            </button>
          </div>
          
          <div style={{ 
            flex: 1, 
            padding: designTokens.spacing.xl, 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: designTokens.spacing.lg
          }}>
            {aiMessages.map((msg, index) => (
              <div key={index} style={{
                padding: designTokens.spacing.lg,
                borderRadius: designTokens.radius.lg,
                backgroundColor: msg.role === 'ai' ? designTokens.colors.surfaceHover : designTokens.colors.primary,
                color: msg.role === 'ai' ? designTokens.colors.textPrimary : 'white',
                fontSize: designTokens.typography.sm,
                lineHeight: designTokens.typography.relaxed,
                maxWidth: '85%',
                alignSelf: msg.role === 'ai' ? 'flex-start' : 'flex-end'
              }}>
                <div style={{ 
                  fontWeight: designTokens.typography.semibold, 
                  marginBottom: designTokens.spacing.xs,
                  fontSize: designTokens.typography.xs,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {msg.role === 'ai' ? 'AI Assistant' : 'You'}
                </div>
                {msg.content}
              </div>
            ))}
          </div>
          
          <div style={{ 
            padding: designTokens.spacing.xl, 
            borderTop: `1px solid ${designTokens.colors.border}` 
          }}>
            <input
              type="text"
              placeholder="Ask AI to help with emails..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleAIMessage(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              style={{
                width: '100%',
                backgroundColor: designTokens.colors.surfaceHover,
                border: `1px solid ${designTokens.colors.border}`,
                borderRadius: designTokens.radius.lg,
                padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                color: designTokens.colors.textPrimary,
                fontSize: designTokens.typography.sm,
                lineHeight: designTokens.typography.normal,
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      )}

      {/* Draft Modal - Professional Design */}
      {showDraftModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: designTokens.spacing.xl
        }}>
          <div style={{
            backgroundColor: designTokens.colors.surface,
            borderRadius: designTokens.radius.xl,
            border: `1px solid ${designTokens.colors.border}`,
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: designTokens.shadows.xl
          }}>
            <div style={{
              padding: designTokens.spacing.xl,
              borderBottom: `1px solid ${designTokens.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ 
                fontSize: designTokens.typography.lg, 
                fontWeight: designTokens.typography.semibold, 
                margin: 0,
                color: designTokens.colors.textPrimary,
                lineHeight: designTokens.typography.tight
              }}>
                Compose Draft
              </h2>
              <button
                onClick={() => setShowDraftModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: designTokens.colors.textMuted,
                  cursor: 'pointer',
                  padding: designTokens.spacing.xs,
                  borderRadius: designTokens.radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                {icons.close}
              </button>
            </div>
            
            <div style={{ 
              padding: designTokens.spacing.xl,
              display: 'flex',
              flexDirection: 'column',
              gap: designTokens.spacing.lg
            }}>
              <div>
                <input
                  type="email"
                  placeholder="To:"
                  style={{
                    width: '100%',
                    backgroundColor: designTokens.colors.surfaceHover,
                    border: `1px solid ${designTokens.colors.border}`,
                    borderRadius: designTokens.radius.lg,
                    padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                    color: designTokens.colors.textPrimary,
                    fontSize: designTokens.typography.sm,
                    lineHeight: designTokens.typography.normal,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <input
                  type="text"
                  placeholder="Subject:"
                  style={{
                    width: '100%',
                    backgroundColor: designTokens.colors.surfaceHover,
                    border: `1px solid ${designTokens.colors.border}`,
                    borderRadius: designTokens.radius.lg,
                    padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                    color: designTokens.colors.textPrimary,
                    fontSize: designTokens.typography.sm,
                    lineHeight: designTokens.typography.normal,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <textarea
                  placeholder="Message..."
                  rows={8}
                  style={{
                    width: '100%',
                    backgroundColor: designTokens.colors.surfaceHover,
                    border: `1px solid ${designTokens.colors.border}`,
                    borderRadius: designTokens.radius.lg,
                    padding: `${designTokens.spacing.md} ${designTokens.spacing.lg}`,
                    color: designTokens.colors.textPrimary,
                    fontSize: designTokens.typography.sm,
                    lineHeight: designTokens.typography.relaxed,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: designTokens.spacing.sm, 
                justifyContent: 'flex-end',
                paddingTop: designTokens.spacing.lg
              }}>
                <button
                  onClick={() => setShowDraftModal(false)}
                  style={{
                    backgroundColor: designTokens.colors.surfaceHover,
                    color: designTokens.colors.textMuted,
                    border: 'none',
                    borderRadius: designTokens.radius.lg,
                    padding: `${designTokens.spacing.md} ${designTokens.spacing.xl}`,
                    fontSize: designTokens.typography.sm,
                    fontWeight: designTokens.typography.semibold,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    lineHeight: designTokens.typography.normal
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDraftModal(false);
                  }}
                  style={{
                    backgroundColor: designTokens.colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: designTokens.radius.lg,
                    padding: `${designTokens.spacing.md} ${designTokens.spacing.xl}`,
                    fontSize: designTokens.typography.sm,
                    fontWeight: designTokens.typography.semibold,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    lineHeight: designTokens.typography.normal
                  }}
                >
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainDashboard;

