import React, { useState } from 'react';

// Modern Email Dashboard with 2025 Design Standards
const MainDashboard: React.FC = () => {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: 'ai', content: 'Hello! I can help you manage emails, create drafts, and automate workflows. What would you like me to do?' }
  ]);

  // Sample email data with metrics
  const emails = [
    {
      id: 1,
      subject: 'Project Proposal Review',
      sender: 'sarah.johnson@company.com',
      preview: 'Please review the attached proposal for the Q4 marketing campaign...',
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
      preview: 'Thanks for the productive meeting today. Here are the action items...',
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
      preview: 'Please approve the Q1 budget allocation for the marketing department...',
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
      preview: 'Weekly team meeting scheduled for Friday at 2 PM...',
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
      preview: 'Please delegate the following tasks to your team members...',
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
      preview: 'Monthly company updates and announcements...',
      time: '1 week ago',
      status: 'completed',
      category: 'fyi_only',
      taskType: 'information',
      priority: 'low'
    }
  ];

  // Email categories with counts
  const categories = [
    { id: 'all', name: 'All Categories', count: emails.length, color: '#3B82F6' },
    { id: 'needs_reply', name: 'Needs Reply', count: emails.filter(e => e.category === 'needs_reply').length, color: '#EF4444' },
    { id: 'approval_required', name: 'Approval Required', count: emails.filter(e => e.category === 'approval_required').length, color: '#8B5CF6' },
    { id: 'delegate', name: 'Delegate', count: emails.filter(e => e.category === 'delegate').length, color: '#06B6D4' },
    { id: 'follow_up', name: 'Follow Up', count: emails.filter(e => e.category === 'follow_up').length, color: '#10B981' },
    { id: 'meetings', name: 'Meetings', count: emails.filter(e => e.category === 'meetings').length, color: '#F59E0B' },
    { id: 'fyi_only', name: 'FYI Only', count: emails.filter(e => e.category === 'fyi_only').length, color: '#6B7280' }
  ];

  // Filter emails based on category and search
  const filteredEmails = emails.filter(email => {
    const matchesCategory = selectedCategory === 'all' || email.category === selectedCategory;
    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.preview.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Email metrics for dashboard cards
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
    
    // Simulate AI response
    setTimeout(() => {
      if (message.toLowerCase().includes('draft') || message.toLowerCase().includes('reply')) {
        setAiMessages(prev => [...prev, { role: 'ai', content: "I'll help you create a draft. Opening the draft editor now." }]);
        setShowDraftModal(true);
      } else {
        setAiMessages(prev => [...prev, { role: 'ai', content: "I can help you with email management, drafting replies, scheduling follow-ups, and organizing your inbox. What specific task would you like assistance with?" }]);
      }
    }, 1000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F172A', // Dark slate background
      color: '#E2E8F0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Modern Header */}
      <header style={{
        backgroundColor: '#1E293B',
        borderBottom: '1px solid #334155',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            margin: 0,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            TaskMail Dashboard
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                backgroundColor: '#334155',
                border: '1px solid #475569',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                color: '#E2E8F0',
                width: '300px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          {/* User Profile */}
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            backgroundColor: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600'
          }}>
            JD
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
        {/* Left Sidebar - Navigation */}
        <aside style={{
          width: '280px',
          backgroundColor: '#1E293B',
          borderRight: '1px solid #334155',
          padding: '1.5rem',
          overflowY: 'auto'
        }}>
          {/* Quick Actions */}
          <div style={{ marginBottom: '2rem' }}>
            <button
              onClick={() => setShowDraftModal(true)}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              ✉️ New Draft
            </button>
            
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              style={{
                width: '100%',
                backgroundColor: '#8B5CF6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🤖 AI Assistant
            </button>
          </div>

          {/* Categories */}
          <div>
            <h3 style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#94A3B8', 
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Categories
            </h3>
            
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: selectedCategory === category.id ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: selectedCategory === category.id ? '#E2E8F0' : '#94A3B8',
                  cursor: 'pointer',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                  borderLeft: `3px solid ${selectedCategory === category.id ? category.color : 'transparent'}`
                }}
              >
                <span>{category.name}</span>
                <span style={{
                  backgroundColor: category.color,
                  color: 'white',
                  borderRadius: '1rem',
                  padding: '0.125rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Dashboard Metrics Cards */}
          <div style={{
            padding: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            backgroundColor: '#0F172A'
          }}>
            {/* Total Emails Card */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>Total Emails</p>
                  <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.5rem 0', color: '#E2E8F0' }}>
                    {emailMetrics.totalEmails}
                  </p>
                </div>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  📧
                </div>
              </div>
            </div>

            {/* Urgent Emails Card */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>Urgent</p>
                  <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.5rem 0', color: '#EF4444' }}>
                    {emailMetrics.urgentEmails}
                  </p>
                </div>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  🚨
                </div>
              </div>
            </div>

            {/* Response Rate Card */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>Response Rate</p>
                  <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.5rem 0', color: '#10B981' }}>
                    {emailMetrics.responseRate}%
                  </p>
                </div>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  📈
                </div>
              </div>
            </div>

            {/* Avg Response Time Card */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>Avg Response Time</p>
                  <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.5rem 0', color: '#F59E0B' }}>
                    {emailMetrics.avgResponseTime}
                  </p>
                </div>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  ⏱️
                </div>
              </div>
            </div>
          </div>

          {/* Email List and Details */}
          <div style={{ flex: 1, display: 'flex', padding: '0 1.5rem 1.5rem' }}>
            {/* Email List */}
            <div style={{
              flex: 1,
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              marginRight: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                  Email Tasks ({filteredEmails.length})
                </h2>
              </div>
              
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredEmails.map(email => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailSelect(email)}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: '1px solid #334155',
                      cursor: 'pointer',
                      backgroundColor: selectedEmail?.id === email.id ? '#334155' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '600', 
                          margin: '0 0 0.25rem 0',
                          color: '#E2E8F0'
                        }}>
                          {email.subject}
                        </h3>
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: '#94A3B8', 
                          margin: '0 0 0.5rem 0' 
                        }}>
                          {email.sender}
                        </p>
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: '#64748B', 
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {email.preview}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          {email.time}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <span style={{
                            backgroundColor: email.status === 'urgent' ? '#EF4444' : 
                                           email.status === 'pending' ? '#F59E0B' : 
                                           email.status === 'action_required' ? '#8B5CF6' : '#10B981',
                            color: 'white',
                            fontSize: '0.625rem',
                            fontWeight: '600',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '0.25rem',
                            textTransform: 'uppercase'
                          }}>
                            {email.status.replace('_', ' ')}
                          </span>
                          
                          <span style={{
                            backgroundColor: '#334155',
                            color: '#94A3B8',
                            fontSize: '0.625rem',
                            fontWeight: '600',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '0.25rem',
                            textTransform: 'uppercase'
                          }}>
                            {email.taskType}
                          </span>
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
              backgroundColor: '#1E293B',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {selectedEmail ? (
                <>
                  <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #334155'
                  }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
                      {selectedEmail.subject}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: 0 }}>
                      {selectedEmail.sender}
                    </p>
                  </div>
                  
                  <div style={{ padding: '1.5rem', flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', lineHeight: '1.5', color: '#E2E8F0' }}>
                      {selectedEmail.preview}
                    </p>
                  </div>
                  
                  <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid #334155',
                    display: 'flex',
                    gap: '0.5rem'
                  }}>
                    <button style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: 1
                    }}>
                      Reply
                    </button>
                    <button style={{
                      backgroundColor: '#334155',
                      color: '#94A3B8',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}>
                      Archive
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  fontSize: '0.875rem'
                }}>
                  Select an email to view details
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* AI Chat Panel */}
      {showAIChat && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          width: '350px',
          height: '400px',
          backgroundColor: '#1E293B',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0 }}>AI Assistant</h3>
            <button
              onClick={() => setShowAIChat(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: '1.25rem'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
            {aiMessages.map((msg, index) => (
              <div key={index} style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: msg.role === 'ai' ? '#334155' : '#3B82F6',
                color: 'white',
                fontSize: '0.875rem'
              }}>
                <strong>{msg.role === 'ai' ? 'AI:' : 'You:'}</strong> {msg.content}
              </div>
            ))}
          </div>
          
          <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
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
                backgroundColor: '#334155',
                border: '1px solid #475569',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                color: '#E2E8F0',
                fontSize: '0.875rem'
              }}
            />
          </div>
        </div>
      )}

      {/* Draft Modal */}
      {showDraftModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
            width: '600px',
            maxHeight: '80vh',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>Compose Draft</h2>
              <button
                onClick={() => setShowDraftModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="email"
                  placeholder="To:"
                  style={{
                    width: '100%',
                    backgroundColor: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    color: '#E2E8F0',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Subject:"
                  style={{
                    width: '100%',
                    backgroundColor: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    color: '#E2E8F0',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <textarea
                  placeholder="Message..."
                  rows={8}
                  style={{
                    width: '100%',
                    backgroundColor: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    color: '#E2E8F0',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDraftModal(false)}
                  style={{
                    backgroundColor: '#334155',
                    color: '#94A3B8',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDraftModal(false);
                    // Add draft save logic here
                  }}
                  style={{
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
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

