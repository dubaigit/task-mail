import React, { useState } from 'react';

const MainDashboard = () => {
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

  // Email task categories based on old design
  const categories = [
    { id: 'all', name: 'All Categories', count: emails.length, color: '#3B82F6' },
    { id: 'needs-reply', name: 'Needs Reply', count: emails.filter(e => e.category === 'needs-reply').length, color: '#EF4444' },
    { id: 'approval-required', name: 'Approval Required', count: emails.filter(e => e.category === 'approval-required').length, color: '#8B5CF6' },
    { id: 'delegate', name: 'Delegate', count: emails.filter(e => e.category === 'delegate').length, color: '#6366F1' },
    { id: 'follow-up', name: 'Follow Up', count: emails.filter(e => e.category === 'follow-up').length, color: '#10B981' },
    { id: 'meetings', name: 'Meetings', count: emails.filter(e => e.category === 'meetings').length, color: '#06B6D4' },
    { id: 'fyi-only', name: 'FYI Only', count: emails.filter(e => e.category === 'fyi-only').length, color: '#22C55E' }
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
    // Mark as read
    email.isRead = true;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'pending': return { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'action-required': return { backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#FB923C', border: '1px solid rgba(249, 115, 22, 0.3)' };
      case 'draft': return { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)' };
      case 'completed': return { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80', border: '1px solid rgba(34, 197, 94, 0.3)' };
      case 'archived': return { backgroundColor: 'rgba(107, 114, 128, 0.2)', color: '#9CA3AF', border: '1px solid rgba(107, 114, 128, 0.3)' };
      default: return { backgroundColor: 'rgba(107, 114, 128, 0.2)', color: '#9CA3AF', border: '1px solid rgba(107, 114, 128, 0.3)' };
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
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
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: '#121212', 
      color: '#FFFFFF', 
      fontFamily: 'Inter, system-ui, sans-serif' 
    }}>
      {/* Left Sidebar - Categories */}
      <div style={{ 
        width: '280px', 
        backgroundColor: '#1E1E1E', 
        borderRight: '1px solid #333333',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '20px',
          color: '#FFFFFF'
        }}>Task Mail</h2>
        
        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#2A2A2A',
              border: '1px solid #404040',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Categories */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '500', 
            marginBottom: '12px',
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Categories</h3>
          
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                marginBottom: '8px',
                backgroundColor: selectedCategory === category.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: selectedCategory === category.id ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: category.color,
                  marginRight: '12px'
                }} />
                {category.name}
              </div>
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {category.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '500', 
            marginBottom: '12px',
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Filters</h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2A2A2A',
                border: '1px solid #404040',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '14px'
              }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2A2A2A',
                border: '1px solid #404040',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '14px'
              }}
            >
              <option value="all">All Status</option>
              <option value="urgent">Urgent</option>
              <option value="pending">Pending</option>
              <option value="action-required">Action Required</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* AI Assistant Button */}
        <button
          onClick={() => setShowAiChat(!showAiChat)}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#3B82F6',
            border: 'none',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '12px'
          }}
        >
          🤖 AI Assistant
        </button>

        {/* New Draft Button */}
        <button
          onClick={() => setShowDraftModal(true)}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#10B981',
            border: 'none',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ✉️ New Draft
        </button>
      </div>

      {/* Middle Panel - Email List */}
      <div style={{ 
        width: '400px', 
        backgroundColor: '#1A1A1A',
        borderRight: '1px solid #333333',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '20px',
          borderBottom: '1px solid #333333'
        }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            margin: '0',
            color: '#FFFFFF'
          }}>
            Email Tasks ({filteredEmails.length})
          </h2>
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '0'
        }}>
          {filteredEmails.map(email => (
            <div
              key={email.id}
              onClick={() => handleEmailSelect(email)}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #333333',
                cursor: 'pointer',
                backgroundColor: selectedEmail?.id === email.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                borderLeft: selectedEmail?.id === email.id ? '3px solid #3B82F6' : '3px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: categories.find(c => c.id === email.category)?.color || '#9CA3AF',
                  marginRight: '8px'
                }} />
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: email.isRead ? '400' : '600',
                  color: email.isRead ? '#D1D5DB' : '#FFFFFF',
                  flex: 1
                }}>
                  {email.subject}
                </span>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {email.time}
                </span>
              </div>
              
              <div style={{ 
                fontSize: '12px', 
                color: '#9CA3AF',
                marginBottom: '8px'
              }}>
                {email.sender}
              </div>
              
              <div style={{ 
                fontSize: '13px', 
                color: '#D1D5DB',
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {email.preview}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px' }}>
                  {getPriorityIcon(email.priority)}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  ...getStatusColor(email.status)
                }}>
                  {email.status.replace('-', ' ').toUpperCase()}
                </span>
                <span style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(107, 114, 128, 0.2)',
                  color: '#9CA3AF',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  {email.taskType.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Email Details & AI */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#1E1E1E',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedEmail ? (
          <>
            {/* Email Details */}
            <div style={{ 
              padding: '20px',
              borderBottom: '1px solid #333333'
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '12px',
                color: '#FFFFFF'
              }}>
                {selectedEmail.subject}
              </h2>
              
              <div style={{ 
                fontSize: '14px', 
                color: '#9CA3AF',
                marginBottom: '16px'
              }}>
                {selectedEmail.sender}
              </div>
              
              <div style={{ 
                fontSize: '14px', 
                color: '#D1D5DB',
                lineHeight: '1.6',
                marginBottom: '20px'
              }}>
                {selectedEmail.preview}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#3B82F6',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  Reply
                </button>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#6B7280',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  Archive
                </button>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#F59E0B',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  Star
                </button>
              </div>

              {/* AI Suggestions */}
              <div>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '12px',
                  color: '#9CA3AF'
                }}>AI Suggestions</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    color: '#60A5FA',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    📝 Draft a professional reply
                  </button>
                  <button style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '6px',
                    color: '#A78BFA',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    📅 Schedule follow-up reminder
                  </button>
                  <button style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    color: '#34D399',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    🏷️ Categorize and archive
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
            color: '#9CA3AF',
            fontSize: '16px'
          }}>
            Select an email to view details
          </div>
        )}

        {/* AI Chat Panel */}
        {showAiChat && (
          <div style={{ 
            height: '300px',
            borderTop: '1px solid #333333',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              padding: '16px',
              borderBottom: '1px solid #333333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                margin: '0',
                color: '#FFFFFF'
              }}>AI Assistant</h3>
              <button
                onClick={() => setShowAiChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ 
              flex: 1, 
              padding: '16px',
              overflowY: 'auto'
            }}>
              {aiChatHistory.map((chat, index) => (
                <div key={index} style={{ 
                  marginBottom: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: chat.type === 'ai' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  fontSize: '13px',
                  color: '#D1D5DB'
                }}>
                  <strong style={{ color: chat.type === 'ai' ? '#60A5FA' : '#9CA3AF' }}>
                    {chat.type === 'ai' ? 'AI: ' : 'You: '}
                  </strong>
                  {chat.message}
                </div>
              ))}
            </div>
            
            <div style={{ 
              padding: '16px',
              borderTop: '1px solid #333333',
              display: 'flex',
              gap: '8px'
            }}>
              <input
                type="text"
                placeholder="Ask AI to help with emails..."
                value={aiMessage}
                onChange={(e) => setAiMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAIMessage()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#2A2A2A',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleAIMessage}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3B82F6',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Send
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
          <div style={{
            backgroundColor: '#1E1E1E',
            borderRadius: '12px',
            padding: '24px',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            border: '1px solid #333333'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                margin: '0',
                color: '#FFFFFF'
              }}>Compose Draft</h2>
              <button
                onClick={() => setShowDraftModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder="To:"
                style={{
                  padding: '12px',
                  backgroundColor: '#2A2A2A',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px'
                }}
              />
              
              <input
                type="text"
                placeholder="Subject:"
                style={{
                  padding: '12px',
                  backgroundColor: '#2A2A2A',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px'
                }}
              />
              
              <textarea
                placeholder="Compose your message..."
                rows={8}
                style={{
                  padding: '12px',
                  backgroundColor: '#2A2A2A',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDraftModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6B7280',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDraftSave}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3B82F6',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '14px',
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

