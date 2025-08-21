import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Clock,
  Database,
  Edit3,
  Mail,
  FileText,
  Settings,
  Trash2,
  Copy,
  RefreshCw,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  metadata?: {
    emailsReferenced?: number;
    queryType?: 'search' | 'analysis' | 'compose' | 'automation';
    executionTime?: number;
    sqlQuery?: string;
    emailIds?: string[];
  };
}

interface EmailSuggestion {
  id: string;
  subject: string;
  sender: string;
  preview: string;
  relevanceScore: number;
}

interface AIChatProps {
  visible: boolean;
  onClose: () => void;
}

export const AIChat: React.FC<AIChatProps> = ({ visible, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<EmailSuggestion[]>([]);
  const [showDatabasePanel, setShowDatabasePanel] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [editingPrompt, setEditingPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial system prompt and welcome message
  useEffect(() => {
    if (visible && messages.length === 0) {
      loadSystemPrompt();
      addWelcomeMessage();
    }
  }, [visible, messages.length]);

  const loadSystemPrompt = async () => {
    try {
      const response = await fetch('/api/ai/chat/system-prompt');
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.systemPrompt);
      }
    } catch (error) {
      console.error('Failed to load system prompt:', error);
      setSystemPrompt(`You are an AI assistant with access to the user's email database. You can:
1. Search and analyze emails using natural language queries
2. Create drafts and responses based on email context
3. Suggest task priorities and automation opportunities
4. Extract insights from email patterns and relationships
5. Help compose emails with recipient autocomplete
6. Edit and optimize prompts for better AI responses

Always provide helpful, context-aware responses based on the user's email data.`);
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'ai',
      content: `👋 Welcome to AI Email Assistant! I have access to your email database and can help you:

• **Search emails**: "Show me urgent emails from this week"
• **Analyze patterns**: "What are my most common email types?"
• **Draft responses**: "Help me reply to the budget proposal"
• **Automate tasks**: "Create a rule for newsletter emails"
• **Compose emails**: "Draft an email to the marketing team"

What would you like to do first?`,
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: 'analysis',
        emailsReferenced: 0
      }
    };
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user', 
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          systemPrompt: systemPrompt,
          chatHistory: messages.slice(-10) // Send last 10 messages for context
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const aiMessage: ChatMessage = {
          id: Date.now().toString() + '_ai',
          type: 'ai',
          content: data.response,
          timestamp: new Date().toISOString(),
          metadata: {
            emailsReferenced: data.emailsReferenced || 0,
            queryType: data.queryType || 'analysis',
            executionTime: data.executionTime,
            sqlQuery: data.sqlQuery,
            emailIds: data.emailIds
          }
        };

        setMessages(prev => [...prev, aiMessage]);
        
        // Update email suggestions if provided
        if (data.emailSuggestions) {
          setEmailSuggestions(data.emailSuggestions);
        }
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        type: 'ai',
        content: '❌ I apologize, but I encountered an error processing your request. Please check that the AI service is running and try again.',
        timestamp: new Date().toISOString(),
        metadata: {
          queryType: 'analysis',
          emailsReferenced: 0
        }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const updateSystemPrompt = async (newPrompt: string) => {
    try {
      const response = await fetch('/api/ai/chat/system-prompt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ systemPrompt: newPrompt })
      });

      if (response.ok) {
        setSystemPrompt(newPrompt);
        setEditingPrompt(false);
      }
    } catch (error) {
      console.error('Failed to update system prompt:', error);
    }
  };

  const clearChat = () => {
    setMessages([]);
    addWelcomeMessage();
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getQueryTypeIcon = (type?: string) => {
    switch (type) {
      case 'search': return <Search className="w-3 h-3" />;
      case 'compose': return <Mail className="w-3 h-3" />;
      case 'automation': return <Settings className="w-3 h-3" />;
      default: return <Database className="w-3 h-3" />;
    }
  };

  const getQueryTypeColor = (type?: string) => {
    switch (type) {
      case 'search': return 'text-blue-400';
      case 'compose': return 'text-green-400';
      case 'automation': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Email Assistant</h2>
              <p className="text-xs text-slate-400">Database-powered email intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDatabasePanel(!showDatabasePanel)}
              className={`p-2 rounded-lg transition-colors ${
                showDatabasePanel ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-slate-700 text-slate-400'
              }`}
              title="Database panel"
            >
              <Database className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditingPrompt(!editingPrompt)}
              className={`p-2 rounded-lg transition-colors ${
                editingPrompt ? 'bg-green-500/20 text-green-300' : 'hover:bg-slate-700 text-slate-400'
              }`}
              title="Edit system prompt"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={clearChat}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Close chat"
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* System Prompt Editor */}
            {editingPrompt && (
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-300">System Prompt</span>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 font-mono resize-none"
                  rows={4}
                  placeholder="Define how the AI should behave and what capabilities it has..."
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setEditingPrompt(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateSystemPrompt(systemPrompt)}
                    className="px-3 py-1.5 text-xs bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                  >
                    Save Prompt
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'ai' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'order-last' : ''}`}>
                    <div
                      className={`rounded-lg p-3 ${
                        message.type === 'user'
                          ? 'bg-blue-500/20 border border-blue-500/30'
                          : 'bg-slate-800/50 border border-slate-700/50'
                      }`}
                    >
                      <div className="text-sm text-slate-200 whitespace-pre-wrap">
                        {message.content}
                      </div>
                      
                      {/* Metadata */}
                      {message.metadata && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400">
                          <div className={`flex items-center gap-1 ${getQueryTypeColor(message.metadata.queryType)}`}>
                            {getQueryTypeIcon(message.metadata.queryType)}
                            <span>{message.metadata.queryType}</span>
                          </div>
                          {message.metadata.emailsReferenced && message.metadata.emailsReferenced > 0 && (
                            <span>{message.metadata.emailsReferenced} emails</span>
                          )}
                          {message.metadata.executionTime && (
                            <span>{message.metadata.executionTime}ms</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(message.timestamp)}</span>
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                        title="Copy message"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing emails...
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me about your emails, request drafts, or create automation rules..."
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-300 placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
                    rows={2}
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-700/30 disabled:text-slate-500 text-purple-300 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Database Panel */}
          {showDatabasePanel && (
            <div className="w-80 border-l border-slate-700 bg-slate-800/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="font-medium text-white">Database Access</h3>
              </div>
              
              {/* Email Suggestions */}
              {emailSuggestions.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-slate-300">Referenced Emails</h4>
                  {emailSuggestions.map((email) => (
                    <div key={email.id} className="bg-slate-700/30 rounded-lg p-2 border border-slate-600/30">
                      <div className="text-xs font-medium text-white truncate">{email.subject}</div>
                      <div className="text-xs text-slate-400 truncate">{email.sender}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{email.preview}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300">Quick Actions</h4>
                <div className="space-y-1">
                  <button className="w-full text-left text-xs bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-2 transition-colors">
                    Show unread emails
                  </button>
                  <button className="w-full text-left text-xs bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-2 transition-colors">
                    Find urgent tasks
                  </button>
                  <button className="w-full text-left text-xs bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-2 transition-colors">
                    Draft responses
                  </button>
                  <button className="w-full text-left text-xs bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-2 transition-colors">
                    Create automation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};