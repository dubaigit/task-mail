"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Clock, 
  Flag, 
  CheckCircle, 
  Circle, 
  MoreHorizontal,
  Zap,
  Brain,
  Link,
  FileText,
  Calendar,
  Users,
  Search,
  Filter,
  Plus,
  Settings,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Star,
  AlertCircle,
  TrendingUp,
  X
} from 'lucide-react';

// Utility function for className merging
const cn = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  aiConfidence: number;
  draftGenerated: boolean;
  emailSubject: string;
  sender: string;
  senderEmail: string;
  estimatedTime: string;
  tags: string[];
  relatedEmails: number;
  createdAt: Date;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface SyncStatus {
  emailsInPostgres: number;
  emailsInAppleMail: number;
  percentComplete: number;
  isSynced: boolean;
  emailBreakdown: {
    total: number;
    tasks: {
      count: number;
      percentage: number;
    };
    fyi: {
      count: number;
      percentage: number;
    };
  };
  syncState: {
    isInitialSyncComplete: boolean;
    isSyncing: boolean;
  };
}

interface RelatedItem {
  id: string;
  type: 'email' | 'task' | 'contact' | 'document';
  title: string;
  description: string;
  relevance: number;
}

interface EmailPopupProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: (task: Task) => void;
}

interface BGPatternProps {
  variant?: 'grid' | 'dots' | 'diagonal-stripes' | 'horizontal-lines' | 'vertical-lines' | 'checkerboard';
  mask?: 'fade-edges' | 'fade-center' | 'fade-top' | 'fade-bottom' | 'fade-left' | 'fade-right' | 'fade-x' | 'fade-y' | 'none';
  size?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

const BGPattern: React.FC<BGPatternProps> = ({ 
  variant = 'grid', 
  mask = 'fade-edges', 
  size = 24, 
  fill = '#1e293b', 
  className, 
  style, 
  ...props 
}) => {
  const maskClasses: Record<string, string> = {
    'fade-edges': '[mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]',
    'fade-center': '[mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]',
    'fade-top': '[mask-image:linear-gradient(to_bottom,transparent,var(--background))]',
    'fade-bottom': '[mask-image:linear-gradient(to_bottom,var(--background),transparent)]',
    'fade-left': '[mask-image:linear-gradient(to_right,transparent,var(--background))]',
    'fade-right': '[mask-image:linear-gradient(to_right,var(--background),transparent)]',
    'fade-x': '[mask-image:linear-gradient(to_right,transparent,var(--background),transparent)]',
    'fade-y': '[mask-image:linear-gradient(to_bottom,transparent,var(--background),transparent)]',
    'none': '',
  };

  const getBgImage = (variant: string, fill: string, size: number) => {
    switch (variant) {
      case 'dots':
        return `radial-gradient(${fill} 1px, transparent 1px)`;
      case 'grid':
        return `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
      case 'diagonal-stripes':
        return `repeating-linear-gradient(45deg, ${fill}, ${fill} 1px, transparent 1px, transparent ${size}px)`;
      case 'horizontal-lines':
        return `linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
      case 'vertical-lines':
        return `linear-gradient(to right, ${fill} 1px, transparent 1px)`;
      case 'checkerboard':
        return `linear-gradient(45deg, ${fill} 25%, transparent 25%), linear-gradient(-45deg, ${fill} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${fill} 75%), linear-gradient(-45deg, transparent 75%, ${fill} 75%)`;
      default:
        return undefined;
    }
  };

  const bgSize = `${size}px ${size}px`;
  const backgroundImage = getBgImage(variant, fill, size);

  return (
    <div
      className={cn('absolute inset-0 z-[-10] size-full', maskClasses[mask], className)}
      style={{
        backgroundImage,
        backgroundSize: bgSize,
        ...style,
      }}
      {...props}
    />
  );
};

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  onClick?: (task: Task) => void;
}

// Email Statistics Header Component
const EmailStatsHeader: React.FC<{ syncStatus: SyncStatus | null }> = ({ syncStatus }) => {
  if (!syncStatus) {
    return (
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span className="text-slate-400">Loading email statistics...</span>
        </div>
      </div>
    );
  }

  const { emailsInPostgres, emailsInAppleMail, emailBreakdown, syncState, percentComplete } = syncStatus;
  const totalSynced = emailBreakdown.total || emailsInPostgres;
  
  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-slate-700/50 rounded-xl p-4 mb-6 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {/* Sync Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncState.isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`}></div>
            <span className="text-sm font-medium text-slate-200">
              {syncState.isSyncing ? 'Syncing...' : 'Synced'}
            </span>
          </div>
          
          {/* Total Emails */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
            <Mail className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">
              <span className="font-semibold text-blue-400">{totalSynced.toLocaleString()}</span>
              <span className="text-slate-500"> / {emailsInAppleMail.toLocaleString()}</span>
              <span className="ml-1 text-xs">emails</span>
            </span>
          </div>

          {/* Sync Progress */}
          {percentComplete < 100 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-slate-300">{percentComplete}% synced</span>
            </div>
          )}
        </div>

        {/* Tasks vs FYI Breakdown */}
        <div className="flex items-center gap-4">
          {/* Tasks */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <div className="text-sm">
              <span className="font-semibold text-red-400">{emailBreakdown.tasks.count.toLocaleString()}</span>
              <span className="text-red-300 ml-1">tasks</span>
              <span className="text-slate-500 ml-1">({emailBreakdown.tasks.percentage}%)</span>
            </div>
          </div>

          {/* FYI */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 border border-green-500/30 rounded-lg">
            <FileText className="w-4 h-4 text-green-400" />
            <div className="text-sm">
              <span className="font-semibold text-green-400">{emailBreakdown.fyi.count.toLocaleString()}</span>
              <span className="text-green-300 ml-1">FYI</span>
              <span className="text-slate-500 ml-1">({emailBreakdown.fyi.percentage}%)</span>
            </div>
          </div>

          {/* Efficiency from existing stats */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-300">AI Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onPriorityChange, onClick }) => {
  const priorityColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500'
  };

  const priorityTextColors = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    urgent: 'text-red-400'
  };

  const statusIcons = {
    pending: Circle,
    'in-progress': Clock,
    completed: CheckCircle
  };

  const StatusIcon = statusIcons[task.status];

  // Calculate importance score (0-100)
  const getImportanceScore = () => {
    let score = 0;
    if (task.priority === 'urgent') score += 40;
    else if (task.priority === 'high') score += 30;
    else if (task.priority === 'medium') score += 20;
    else score += 10;
    
    score += Math.min(30, task.aiConfidence * 0.3);
    score += Math.min(20, task.relatedEmails * 3);
    if (task.draftGenerated) score += 10;
    
    return Math.min(100, Math.round(score));
  };

  const importanceScore = getImportanceScore();

  return (
    <div 
      className="group relative bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:bg-slate-800/70 transition-all duration-200 hover:border-blue-500/30 cursor-pointer"
      onClick={() => onClick?.(task)}
    >
      {/* Priority Indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${priorityColors[task.priority]} rounded-l-lg`} />
      
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon 
            className={cn(
              "w-3 h-3",
              task.status === 'completed' ? 'text-green-400' : 'text-slate-400'
            )} 
          />
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorityTextColors[task.priority]} bg-slate-700/50`}>
            {task.priority.charAt(0).toUpperCase()}
          </span>
        </div>
        
        {/* Importance Score */}
        <div className="flex items-center gap-1">
          <Star className={`w-3 h-3 ${importanceScore > 70 ? 'text-yellow-400' : importanceScore > 40 ? 'text-orange-400' : 'text-slate-500'}`} />
          <span className="text-xs text-slate-400">{importanceScore}</span>
        </div>
      </div>

      {/* Compact Content */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium text-slate-200 line-clamp-1 leading-tight">{task.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-1">{task.sender}</p>
      </div>

      {/* Metrics Row */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          {/* Related Emails Count */}
          <div className="flex items-center gap-1">
            <Mail className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-slate-400">{task.relatedEmails}</span>
          </div>
          
          {/* AI Confidence */}
          <div className="flex items-center gap-1">
            <Brain className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-slate-400">{task.aiConfidence}%</span>
          </div>
          
          {/* Draft Status */}
          {task.draftGenerated && (
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400">Draft</span>
            </div>
          )}
        </div>
        
        {/* Time Estimate */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-xs text-slate-500">{task.estimatedTime}</span>
        </div>
      </div>

      {/* Tags (if any) */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded">
            {task.tags[0]}
          </span>
          {task.tags.length > 1 && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded">
              +{task.tags.length - 1}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const EmailPopup: React.FC<EmailPopupProps> = ({ task, isOpen, onClose, onTaskUpdate }) => {
  const [emailContent, setEmailContent] = useState('');
  const [draftReply, setDraftReply] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  // Load email content when task changes
  useEffect(() => {
    if (task && isOpen) {
      loadEmailContent();
      loadDraftReply();
      // Initialize chat with task context
      setChatHistory([
        {
          id: '1',
          content: `I'm here to help you with "${task.title}". I can help you edit the draft reply, send the email, update task status, or answer questions about this email thread.`,
          sender: 'ai',
          timestamp: new Date()
        }
      ]);
    }
  }, [task, isOpen]);

  const loadEmailContent = async () => {
    if (!task) return;
    setIsLoadingEmail(true);
    try {
      // Mock email content - in real implementation, fetch from API
      setTimeout(() => {
        setEmailContent(`
From: ${task.sender} <${task.senderEmail}>
To: You
Subject: ${task.emailSubject}
Date: ${task.createdAt.toLocaleDateString()}

Dear [Name],

This is the original email content that would be fetched from the email database. It contains the full context of the email thread and all the details needed to understand the task requirements.

The AI has analyzed this email and identified it as a task with ${task.aiConfidence}% confidence.

Best regards,
${task.sender}
        `);
        setIsLoadingEmail(false);
      }, 500);
    } catch (error) {
      console.error('Error loading email:', error);
      setIsLoadingEmail(false);
    }
  };

  const loadDraftReply = async () => {
    if (!task) return;
    setIsLoadingDraft(true);
    try {
      // Real GPT-5 mini API call for draft generation
      const response = await fetch('http://localhost:8000/api/ai/generate-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'your_jwt_secret_here'
        },
        body: JSON.stringify({
          emailContent: emailContent || task.title,
          subject: task.title,
          sender: task.sender,
          context: {
            urgency: task.priority,
            previousInteractions: task.relatedEmails,
            relationship: 'professional',
            estimatedTime: task.estimatedTime
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setDraftReply(data.draft);
        console.log(`Draft generated with ${data.model_used}, cost: $${data.cost}`);
      } else {
        // Fallback template if API fails
        setDraftReply(`Dear ${task.sender},\n\nThank you for your email regarding "${task.title}".\n\n[AI service temporarily unavailable - please complete draft manually]\n\nBest regards,\n[Your Name]`);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      setDraftReply(`Dear ${task.sender},\n\nRegarding: ${task.title}\n\n[Please complete your response here]\n\nBest regards`);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const handleChatSubmit = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');

    // Process command and generate AI response with real GPT-5
    try {
      const aiResponse = await processCommand(message);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'I encountered an error processing your request. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  };

  const processCommand = async (command: string): Promise<string> => {
    try {
      // Call GPT-5 nano API for fast command processing
      const response = await fetch('http://localhost:8000/api/ai/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'your_jwt_secret_here'
        },
        body: JSON.stringify({
          command,
          context: {
            selectedTask: task ? {
              title: task.title,
              status: task.status,
              priority: task.priority,
              hasDraft: task.draftGenerated,
              sender: task.sender
            } : null,
            emailContent: emailContent.substring(0, 500),
            draftContent: draftReply.substring(0, 500)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error processing command with GPT-5:', error);
      
      // Fallback to basic pattern matching
      const cmd = command.toLowerCase();
      
      if (cmd.includes('edit') && cmd.includes('draft')) {
        return "I'll help you edit the draft. What specific changes would you like me to make? You can say things like 'make it more formal', 'add urgency', or 'make it shorter'.";
      }
      
      if (cmd.includes('send') && cmd.includes('email')) {
        return "I can help you send this email. Would you like me to review the draft first, or should I send it as-is? I can also schedule it to be sent later.";
      }
      
      if (cmd.includes('complete') || cmd.includes('done')) {
        return "I'll mark this task as completed. Should I also send a completion notification to the original sender?";
      }
      
      if (cmd.includes('priority') || cmd.includes('urgent')) {
        return "I can update the task priority. What priority level would you like: low, medium, high, or urgent?";
      }
      
      if (cmd.includes('deadline') || cmd.includes('due')) {
        return "I can set a deadline for this task. When would you like this to be completed by?";
      }

      return "I can help you with: editing the draft reply, sending emails, updating task status, setting priorities, adding deadlines, or answering questions about this email thread. What would you like to do?";
    }
  };

  const shortcutButtons = [
    {
      label: 'Edit Draft',
      icon: FileText,
      action: () => handleChatSubmit('Edit the draft reply to be more professional'),
      variant: 'primary' as const
    },
    {
      label: 'Send Email',
      icon: Send,
      action: () => handleChatSubmit('Send this email'),
      variant: 'success' as const
    },
    {
      label: 'Mark Complete',
      icon: CheckCircle,
      action: () => handleChatSubmit('Mark this task as completed'),
      variant: 'success' as const
    },
    {
      label: 'Set Priority',
      icon: Flag,
      action: () => handleChatSubmit('Change the priority of this task'),
      variant: 'secondary' as const
    }
  ];

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{task.title}</h2>
              <p className="text-sm text-slate-400">Task Details & Email Thread</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Email Content */}
          <div className="w-1/2 border-r border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-200 mb-2">Original Email</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className={`w-2 h-2 rounded-full ${task.priority === 'urgent' ? 'bg-red-400' : task.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                <span>{task.priority.toUpperCase()} priority</span>
                <span>•</span>
                <span>{task.aiConfidence}% AI confidence</span>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto">
              {isLoadingEmail ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {emailContent}
                </pre>
              )}
            </div>
          </div>

          {/* Right Panel - Draft & Chat */}
          <div className="w-1/2 flex flex-col">
            {/* Draft Reply Section */}
            <div className="h-1/2 border-b border-slate-700 flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-medium text-slate-200">Draft Reply</h3>
                {task.draftGenerated && (
                  <div className="flex items-center gap-1 mt-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400">AI Generated</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 p-4">
                {isLoadingDraft ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  </div>
                ) : (
                  <textarea
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    placeholder={task.draftGenerated ? "AI-generated draft will appear here..." : "No draft available. Use the chat to generate one."}
                    className="w-full h-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            {/* Chat Interface */}
            <div className="h-1/2 flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-medium text-slate-200">AI Assistant</h3>
                <p className="text-xs text-slate-400">Ask me to edit drafts, send emails, or update tasks</p>
              </div>
              
              {/* Chat History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatHistory.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shortcut Buttons */}
              <div className="p-4 border-t border-slate-700">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {shortcutButtons.map((button, index) => (
                    <button
                      key={index}
                      onClick={button.action}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                        button.variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                        button.variant === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                        'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                    >
                      <button.icon className="w-3 h-3" />
                      {button.label}
                    </button>
                  ))}
                </div>
                
                {/* Chat Input */}
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit(chatInput)}
                    placeholder="Ask me to edit the draft, send email, or update task..."
                    className="flex-1 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleChatSubmit(chatInput)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  taskCount: number;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, taskCount }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/50">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-200">AI Assistant</h3>
          <p className="text-xs text-slate-400">Natural language commands</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.sender === 'ai' && (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                message.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/50 text-slate-200'
              )}
            >
              {message.content}
            </div>
            {message.sender === 'user' && (
              <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask about your ${taskCount} tasks... Try "show urgent tasks" or "draft reply for budget email"`}
            className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
};

interface ContextSidebarProps {
  relatedItems: RelatedItem[];
  suggestions: Array<{ title: string; description: string }>;
}

const ContextSidebar: React.FC<ContextSidebarProps> = ({ relatedItems, suggestions }) => {
  return (
    <div className="h-full overflow-y-auto">
      {/* Related Items */}
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Link className="w-4 h-4" />
          Related Items
        </h3>
        <div className="space-y-2">
          {relatedItems.map((item) => (
            <div key={item.id} className="p-2 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                {item.type === 'email' && <Mail className="w-3 h-3 text-blue-400" />}
                {item.type === 'task' && <CheckCircle className="w-3 h-3 text-green-400" />}
                {item.type === 'contact' && <Users className="w-3 h-3 text-purple-400" />}
                {item.type === 'document' && <FileText className="w-3 h-3 text-orange-400" />}
                <span className="text-xs font-medium text-slate-200">{item.title}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500 capitalize">{item.type}</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-slate-400">{item.relevance}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Suggestions
        </h3>
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-2">
                <Brain className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-200">{suggestion.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{suggestion.description}</p>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EmailTaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>('tasks');
  const [stats, setStats] = useState({
    efficiency: 0,
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  // Chat and context state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string }>>([]);
  
  // Email popup state
  const [selectedEmail, setSelectedEmail] = useState<Task | null>(null);
  const [isEmailPopupOpen, setIsEmailPopupOpen] = useState(false);
  
  // Email popup handlers
  const handleTaskClick = (task: Task) => {
    setSelectedEmail(task);
    setIsEmailPopupOpen(true);
  };
  
  const handleCloseEmailPopup = () => {
    setIsEmailPopupOpen(false);
    setSelectedEmail(null);
  };
  
  // Lazy loading with intersection observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastTaskElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreTasks();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore]);

  // Fetch tasks from API with aggressive caching
  const fetchTasks = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      
      // Add cache-busting for fresh data or use cache headers
      const cacheParam = reset ? `&_t=${Date.now()}` : '';
      const response = await fetch(
        `http://localhost:8000/api/tasks?limit=50&offset=${newOffset}&filter=${filter}${cacheParam}`,
        {
          headers: {
            'Cache-Control': reset ? 'no-cache' : 'public, max-age=60'
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch tasks');
      
      const data = await response.json();
      
      // Map API response to frontend Task interface
      const mappedTasks = data.items.map((item: any) => ({
        id: item.id,
        title: item.taskTitle || item.subject || 'No Title',
        description: item.taskDescription || item.snippet || 'No Description',
        priority: item.priority || 'medium',
        status: item.status || 'pending',
        aiConfidence: item.confidence || 50,
        draftGenerated: item.draftGenerated || false,
        emailSubject: item.subject || '',
        sender: item.sender || 'Unknown Sender',
        senderEmail: item.senderEmail || '',
        estimatedTime: item.estimatedTime || '10 min',
        tags: item.tags || [],
        relatedEmails: item.relatedEmails || 1,
        createdAt: new Date(item.date || Date.now())
      }));
      
      setTasks(prev => reset ? mappedTasks : [...prev, ...mappedTasks]);
      setHasMore(data.hasMore);
      setOffset(newOffset + 50); // Increased batch size
      
      // Update stats only on reset
      if (reset) {
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [offset, filter, loading]);

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/statistics');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync-status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  // Load more tasks for infinite scroll
  const loadMoreTasks = () => {
    if (!loading && hasMore) {
      fetchTasks(false);
    }
  };



  // Load initial data with performance optimization
  useEffect(() => {
    // Preload tasks immediately
    fetchTasks(true);
    fetchSyncStatus();
    
    // Set up auto-refresh every 30 seconds for new data
    const autoRefresh = setInterval(() => {
      if (!loading) {
        fetchTasks(true);
        fetchSyncStatus();
      }
    }, 30000);
    
    return () => clearInterval(autoRefresh);
  }, [filter]);

  // Add welcome message when tasks are loaded
  useEffect(() => {
    if (tasks.length > 0 && messages.length === 0) {
      const urgentCount = tasks.filter(t => t.priority === 'urgent').length;
      const pendingCount = tasks.filter(t => t.status === 'pending').length;
      
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        content: `Welcome! I found ${tasks.length} email tasks for you. ${urgentCount > 0 ? `${urgentCount} are urgent and need immediate attention.` : 'Everything looks manageable!'} ${pendingCount > 0 ? `You have ${pendingCount} pending tasks.` : ''} How can I help you prioritize?`,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    }
  }, [tasks, messages.length]);

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const response = await fetch(`http://localhost:8000/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };



  // Generate dynamic related items and suggestions based on current tasks
  useEffect(() => {
    if (tasks.length > 0) {
      // Generate related items from task data
      const dynamicRelatedItems: RelatedItem[] = [];
      const seenSenders = new Set<string>();
      
      tasks.slice(0, 5).forEach((task, index) => {
        if (task.senderEmail && !seenSenders.has(task.senderEmail)) {
          seenSenders.add(task.senderEmail);
          dynamicRelatedItems.push({
            id: `contact-${index}`,
            type: 'contact',
            title: task.sender,
            description: `${task.relatedEmails} related emails`,
            relevance: Math.min(95, 70 + task.relatedEmails * 5)
          });
        }
        
        if (task.tags.length > 0) {
          dynamicRelatedItems.push({
            id: `email-${index}`,
            type: 'email',
            title: task.emailSubject,
            description: task.description,
            relevance: task.aiConfidence
          });
        }
      });
      
      setRelatedItems(dynamicRelatedItems.slice(0, 6));
      
      // Generate dynamic suggestions based on current tasks
      const dynamicSuggestions = [];
      const urgentTasks = tasks.filter(t => t.priority === 'urgent');
      const tasksWithDrafts = tasks.filter(t => t.draftGenerated);
      const meetingTasks = tasks.filter(t => t.tags.includes('meeting'));
      
      if (urgentTasks.length > 0) {
        dynamicSuggestions.push({
          title: `Prioritize ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''}`,
          description: 'Focus on high-priority items first for maximum impact.'
        });
      }
      
      if (tasksWithDrafts.length > 0) {
        dynamicSuggestions.push({
          title: `Review ${tasksWithDrafts.length} AI-generated draft${tasksWithDrafts.length > 1 ? 's' : ''}`,
          description: 'Quickly send pre-written responses to save time.'
        });
      }
      
      if (meetingTasks.length > 0) {
        dynamicSuggestions.push({
          title: 'Schedule pending meetings',
          description: 'Coordinate with team members to finalize meeting times.'
        });
      }
      
      dynamicSuggestions.push({
        title: 'Bulk update task status',
        description: 'Mark multiple completed tasks as done in one action.'
      });
      
      setSuggestions(dynamicSuggestions.slice(0, 4));
    }
  }, [tasks]);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Generate AI response asynchronously
    try {
      const aiResponseContent = await generateAIResponse(content);
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiResponseContent,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error generating AI response:', error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'I encountered an error processing your request. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    }
  };

  const generateAIResponse = async (userInput: string): Promise<string> => {
    const input = userInput.toLowerCase();
    
    // Get current task data for dynamic responses
    const urgentTasks = tasks.filter(t => t.priority === 'urgent');
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' || t.priority === 'urgent');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const tasksWithDrafts = tasks.filter(t => t.draftGenerated);
    
    try {
      // Call GPT-5 nano API for fast chat responses
      const response = await fetch('http://localhost:8000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'your_jwt_secret_here'
        },
        body: JSON.stringify({
          message: userInput,
          context: {
            tasks: {
              total: tasks.length,
              urgent: urgentTasks.length,
              highPriority: highPriorityTasks.length,
              pending: pendingTasks.length,
              withDrafts: tasksWithDrafts.length,
              inProgress: tasks.filter(t => t.status === 'in-progress').length,
              completed: tasks.filter(t => t.status === 'completed').length,
              meeting: tasks.filter(t => t.tags.includes('meeting')).length
            },
            stats: {
              efficiency: stats.efficiency,
              averageResponseTime: stats.averageResponseTime || 0
            },
            urgentTaskTitles: urgentTasks.slice(0, 3).map(t => t.title),
            tasksWithDraftTitles: tasksWithDrafts.slice(0, 3).map(t => t.title)
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('AI chat response error:', error);
      
      // Fallback to pattern-based responses if AI service fails
      if (input.includes('high priority') || input.includes('urgent')) {
        if (urgentTasks.length > 0) {
          const taskList = urgentTasks.slice(0, 3).map(t => `"${t.title}"`).join(', ');
          return `I found ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''}: ${taskList}. ${tasksWithDrafts.length > 0 ? 'Some have AI-generated drafts ready for review.' : ''}`;
        }
        return 'No urgent tasks found. You\'re doing great with your priorities!';
      }
      
      if (input.includes('draft') || input.includes('write')) {
        if (tasksWithDrafts.length > 0) {
          return `I found ${tasksWithDrafts.length} task${tasksWithDrafts.length > 1 ? 's' : ''} with AI-generated drafts ready. Would you like me to show you the drafts or help you refine them?`;
        }
        return 'I can generate email drafts for any of your pending tasks. Which task would you like me to draft a response for?';
      }
      
      if (input.includes('status') || input.includes('complete') || input.includes('done')) {
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
        return `You have ${pendingTasks.length} pending and ${inProgressTasks.length} in-progress tasks. Would you like me to help you prioritize or mark any as complete?`;
      }
      
      if (input.includes('schedule') || input.includes('meeting')) {
        const meetingTasks = tasks.filter(t => t.tags.includes('meeting'));
        if (meetingTasks.length > 0) {
          return `I found ${meetingTasks.length} meeting-related task${meetingTasks.length > 1 ? 's' : ''}. I can help you schedule these or coordinate with participants.`;
        }
        return 'I can help schedule meetings by finding optimal time slots for all participants. What meeting would you like to schedule?';
      }
      
      if (input.includes('summary') || input.includes('overview')) {
        return `You have ${tasks.length} total tasks: ${pendingTasks.length} pending, ${tasks.filter(t => t.status === 'in-progress').length} in progress, and ${tasks.filter(t => t.status === 'completed').length} completed. Your efficiency score is ${stats.efficiency}%.`;
      }
      
      return `I can help you with task management, email drafting, scheduling, and priority analysis. You currently have ${tasks.length} tasks to manage. What would you like me to assist with?`;
    }
  };

  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-hidden">
      <BGPattern variant="grid" mask="fade-edges" size={32} fill="rgba(59, 130, 246, 0.1)" />
      
      {/* Header - Fixed positioning to prevent disappearing */}
      <div className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50 min-h-[4rem] will-change-transform">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Email Task Manager</h1>
              <p className="text-xs text-slate-400">AI-powered email workflow automation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-800/50 rounded-lg text-sm text-slate-300 border border-slate-700/50"
            >
              <option value="tasks">Task Emails</option>
              <option value="all">All Emails</option>
              <option value="non-tasks">Non-Task Emails</option>
            </select>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-300">{stats.efficiency || 0}% efficiency</span>
            </div>
            <button className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Email Statistics Header */}
      <div className="w-full bg-slate-900/50 border-b border-slate-700/30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <EmailStatsHeader syncStatus={syncStatus} />
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-8rem)]">
        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Task Columns */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Pending Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    Pending Tasks
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs">
                      {pendingTasks.length}
                    </span>
                  </h2>
                  <button className="p-1 hover:bg-slate-800/50 rounded transition-colors">
                    <Plus className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {pendingTasks.map((task, index) => (
                    <div 
                      key={task.id}
                      ref={index === pendingTasks.length - 1 ? lastTaskElementRef : null}
                    >
                      <TaskCard 
                        task={task} 
                        onStatusChange={updateTaskStatus}
                        onClick={handleTaskClick}
                      />
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {!loading && pendingTasks.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No pending tasks
                    </div>
                  )}
                </div>
              </div>

              {/* In Progress Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    In Progress
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">
                      {inProgressTasks.length}
                    </span>
                  </h2>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {inProgressTasks.map(task => (
                    <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
                  ))}
                </div>
              </div>

              {/* Completed Tasks */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Completed
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">
                      {completedTasks.length}
                    </span>
                  </h2>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {completedTasks.map(task => (
                    <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="w-80 border-l border-slate-700/50 bg-slate-800/30">
            <ChatInterface messages={messages} onSendMessage={handleSendMessage} taskCount={tasks.length} />
          </div>
        </div>

        {/* Context Sidebar */}
        <div className="w-72 border-l border-slate-700/50 bg-slate-800/30">
          <ContextSidebar relatedItems={relatedItems} suggestions={suggestions} />
        </div>
      </div>

      {/* EmailPopup - CRITICAL: This was missing! */}
      {isEmailPopupOpen && selectedEmail && (
        <EmailPopup 
          task={selectedEmail} 
          isOpen={isEmailPopupOpen} 
          onClose={handleCloseEmailPopup}
          onTaskUpdate={(updatedTask) => {
            setTasks(prev => prev.map(t =>
              t.id === updatedTask.id ? updatedTask : t
            ));
          }}
        />
      )}
    </div>
  );
};

export default EmailTaskDashboard;
