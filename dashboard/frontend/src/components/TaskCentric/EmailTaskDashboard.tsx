"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FocusTrap } from '../ui/accessibility';
import { 
  Mail, 
  Send, 
  Bot, 
  User, 
  Clock, 
  Flag, 
  CheckCircle, 
  Circle, 
  Zap,
  Brain,
  Link,
  FileText,
  Calendar,
  Users,
  Search,
  Settings,
  Star,
  AlertCircle,
  X
} from 'lucide-react';
import { EnhancedAIStatus } from '../AI/EnhancedAIStatus';
import { AIPromptViewer } from '../AI/AIPromptViewer';
import { AIChat } from '../AI/AIChat';
import AIUsageMetrics from '../AI/AIUsageMetrics';

// Utility function for className merging
const cn = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface Task {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  description?: string;
  taskDescription?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  aiConfidence?: number;
  confidence?: number;
  draftGenerated: boolean;
  emailSubject?: string;
  sender: string;
  senderEmail: string;
  estimatedTime: string;
  tags: string[];
  relatedEmails: number;
  createdAt?: Date;
  date?: string;
  isTask?: boolean;
  snippet?: string;
  suggestedAction?: string;
  classification?: string;
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
    today?: number;
    week?: number;
    month?: number;
  };
  aiProcessing?: {
    totalProcessed: number;
    analyzed: number;
    completed: number;
    pending: number;
    failed: number;
    processingRate: number;
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

// Removed EmailStatsHeader - replaced with minimal filters

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onPriorityChange, onClick }) => {
  // Professional color scheme for business environment
  const categoryColors = {
    NEEDS_REPLY: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    CREATE_TASK: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    APPROVAL_REQUIRED: { bg: 'bg-amber-900/20', border: 'border-amber-700/40', icon: 'text-amber-200', accent: 'bg-amber-700' },
    DELEGATE: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    FOLLOW_UP: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    MEETING_REQUEST: { bg: 'bg-blue-900/20', border: 'border-blue-700/40', icon: 'text-blue-200', accent: 'bg-blue-700' },
    DOCUMENT_REVIEW: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    ESCALATION: { bg: 'bg-red-900/20', border: 'border-red-700/40', icon: 'text-red-200', accent: 'bg-red-700' },
    DEFAULT: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' }
  };

  const priorityColors = {
    low: 'bg-slate-500',
    medium: 'bg-amber-600',
    high: 'bg-orange-600',
    urgent: 'bg-red-600'
  };

  const priorityTextColors = {
    low: 'text-slate-300',
    medium: 'text-amber-200',
    high: 'text-orange-200',
    urgent: 'text-red-200'
  };


  const statusIcons = {
    pending: Circle,
    'in-progress': Clock,
    completed: CheckCircle
  };

  const StatusIcon = statusIcons[task.status];

  // Get display title and description
  const displayTitle = task.taskTitle || task.title || task.subject || 'Untitled Task';
  const confidence = task.confidence || task.aiConfidence || 50;
  
  // Get category color scheme
  const categoryScheme = categoryColors[task.classification as keyof typeof categoryColors] || categoryColors.DEFAULT;
  
  // Calculate importance score (0-100)
  const getImportanceScore = () => {
    let score = 0;
    if (task.priority === 'urgent') score += 40;
    else if (task.priority === 'high') score += 30;
    else if (task.priority === 'medium') score += 20;
    else score += 10;
    
    score += Math.min(30, confidence * 0.3);
    score += Math.min(20, task.relatedEmails * 3);
    if (task.draftGenerated) score += 10;
    
    return Math.min(100, Math.round(score));
  };

  const importanceScore = getImportanceScore();

  return (
    <button 
      type="button"
      className={`group relative ${categoryScheme.bg} border ${categoryScheme.border} rounded-xl p-4 hover:bg-slate-700/60 transition-all duration-300 hover:border-slate-500/60 hover:shadow-lg cursor-pointer w-full text-left focus:outline-none focus:ring-2 focus:ring-slate-400/50 hover:scale-[1.02]`}
      onClick={() => onClick?.(task)}
      aria-label={`Open task: ${displayTitle} from ${task.sender}, priority ${task.priority}`}
    >
      {/* Enhanced Priority Indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${priorityColors[task.priority]} rounded-l-xl`} />
      
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StatusIcon 
            className={cn(
              "w-4 h-4 flex-shrink-0",
              task.status === 'completed' ? 'text-emerald-400' : categoryScheme.icon
            )} 
          />
          <span className={`text-xs font-medium px-2 py-1 rounded-md ${priorityTextColors[task.priority]} bg-slate-900/40 flex-shrink-0`}>
            {task.priority.toUpperCase()}
          </span>
          {task.classification && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${categoryScheme.icon} bg-slate-900/40 truncate`}>
              {task.classification.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        
        {/* Importance Score */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Star className={`w-3.5 h-3.5 ${importanceScore > 70 ? 'text-amber-400 fill-amber-400/30' : importanceScore > 40 ? 'text-slate-400 fill-slate-400/30' : 'text-slate-500'}`} />
          <span className="text-xs font-semibold text-slate-300">{importanceScore}</span>
        </div>
      </div>

      {/* Title and Sender - Centered and Properly Sized */}
      <div className="space-y-3 text-center">
        <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-relaxed overflow-hidden">{displayTitle}</h3>
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{task.sender}</span>
        </p>
        {/* Email Date */}
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : task.date ? new Date(task.date).toLocaleDateString() : 'Today'}</span>
        </p>
      </div>

      {/* Metrics Row - Standardized Text Size */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/40">
        <div className="flex items-center gap-3">
          {/* Related Emails Count */}
          <div className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">{task.relatedEmails}</span>
          </div>
          
          {/* AI Confidence */}
          <div className="flex items-center gap-1">
            <Brain className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">{confidence}%</span>
          </div>
          
          {/* Draft Status */}
          {task.draftGenerated && (
            <div className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Draft</span>
            </div>
          )}
        </div>
        
        {/* Time Estimate */}
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">{task.estimatedTime || '5m'}</span>
        </div>
      </div>

      {/* Tags (if any) */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 justify-center">
          <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded-md">
            {task.tags[0]}
          </span>
          {task.tags.length > 1 && (
            <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-md">
              +{task.tags.length - 1}
            </span>
          )}
        </div>
      )}
    </button>
  );
};

const EmailPopup: React.FC<EmailPopupProps> = ({ task, isOpen, onClose, onTaskUpdate }) => {
  // Get display fields
  const displayTitle = task ? (task.taskTitle || task.title || task.subject || 'Untitled Task') : '';

  const [emailContent, setEmailContent] = useState('');
  const [draftReply, setDraftReply] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  const loadEmailContent = useCallback(async () => {
    if (!task) return;
    setIsLoadingEmail(true);
    try {
      // Mock email content - in real implementation, fetch from API
      setTimeout(() => {
        setEmailContent(`
From: ${task.sender} <${task.senderEmail}>
To: You
Subject: ${task.emailSubject || task.subject || 'No Subject'}
Date: ${task.createdAt ? new Date(task.createdAt).toLocaleDateString() : task.date ? new Date(task.date).toLocaleDateString() : 'Today'}

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
  }, [task]);

  const loadDraftReply = useCallback(async () => {
    if (!task) return;
    setIsLoadingDraft(true);
    try {
      // Real GPT-5 mini API call for draft generation
      const response = await fetch('/api/ai/generate-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'your_jwt_secret_here'
        },
        body: JSON.stringify({
          emailContent: emailContent || displayTitle,
          subject: displayTitle,
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
        // Use AI service for draft generation
        try {
          const response = await fetch('/api/ai/generate-draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'your_jwt_secret_here' // TODO: Use proper API key
            },
            body: JSON.stringify({
              emailContent: emailContent || displayTitle,
              subject: displayTitle,
              sender: task.sender,
              context: 'reply'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            setDraftReply(result.draft || result.response || 'AI-generated draft will appear here...');
          } else {
            throw new Error('AI service unavailable');
          }
        } catch (error) {
          // Fallback template if AI service fails
          setDraftReply(`Dear ${task.sender},\n\nThank you for your email regarding "${displayTitle}".\n\nI will review this and get back to you shortly.\n\nBest regards,\n[Your Name]`);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      setDraftReply(`Dear ${task.sender},\n\nRegarding: ${displayTitle}\n\n[Please complete your response here]\n\nBest regards`);
    } finally {
      setIsLoadingDraft(false);
    }
  }, [task, emailContent, displayTitle]);

  // Load email content when task changes
  useEffect(() => {
    if (task && isOpen) {
      loadEmailContent();
      loadDraftReply();
      // Initialize chat with task context
      setChatHistory([
        {
          id: '1',
          content: `I'm here to help you with "${displayTitle}". I can help you edit the draft reply, send the email, update task status, or answer questions about this email thread.`,
          sender: 'ai',
          timestamp: new Date()
        }
      ]);
    }
  }, [task, isOpen, displayTitle, loadEmailContent, loadDraftReply]);

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
      const response = await fetch('/api/ai/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'your_jwt_secret_here'
        },
        body: JSON.stringify({
          command,
          context: {
            selectedTask: task ? {
              title: displayTitle,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <FocusTrap active={isOpen}>
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-dialog-title"
          aria-describedby="email-dialog-desc"
          className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-400" />
              <div>
                <h2 id="email-dialog-title" className="text-lg font-semibold text-slate-100">{displayTitle}</h2>
                <p id="email-dialog-desc" className="text-sm text-slate-400">Task Details & Email Thread</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              autoFocus
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
      </FocusTrap>
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



const EmailTaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>('tasks');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    efficiency: 0,
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    averageResponseTime: 0
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  // Chat and context state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string }>>([]);
  const [showAIPrompts, setShowAIPrompts] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [userProfile, setUserProfile] = useState<{email: string; name: string; displayName: string} | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
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
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const categoryParam = categoryFilter !== 'all' ? `&category=${categoryFilter}` : '';
      const response = await fetch(
        `http://localhost:8000/api/tasks?limit=50&offset=${newOffset}&filter=${filter}&dateRange=${dateFilter}${searchParam}${categoryParam}${cacheParam}`,
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
        createdAt: new Date(item.date_received || item.date || Date.now()),
        date: item.date_received || item.date
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
  }, [offset, filter, loading, categoryFilter, dateFilter, searchQuery]);

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
  const fetchSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync-status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  }, []);

  // Fetch category counts
  const fetchCategoryCounts = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/tasks/category-counts');
      if (response.ok) {
        const data = await response.json();
        setCategoryCounts(data);
      }
    } catch (error) {
      console.error('Error fetching category counts:', error);
    }
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
    fetchCategoryCounts();
    fetchUserProfile();
    
    // Set up auto-refresh every 30 seconds for new data
    const autoRefresh = setInterval(() => {
      if (!loading) {
        fetchTasks(true);
        fetchSyncStatus();
        fetchCategoryCounts();
      }
    }, 30000);
    
    return () => clearInterval(autoRefresh);
  }, [filter, dateFilter, searchQuery, categoryFilter, fetchTasks, fetchSyncStatus]);

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case '/':
          e.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder="Search tasks..."]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
          break;
        case '1':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('tasks');
          }
          break;
        case '2':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('all');
          }
          break;
        case '3':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('non-tasks');
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            fetchTasks(true);
            fetchSyncStatus();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [setFilter, fetchTasks, fetchSyncStatus]);

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
      const response = await fetch(`/api/tasks/${taskId}/status`, {
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

  // AI Operations Handlers
  const handleManualSync = async () => {
    try {
      const response = await fetch('/api/ai/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
        console.log('Manual sync initiated');
      }
    } catch (error) {
      console.error('Error initiating sync:', error);
    }
  };

  const handleResync = async () => {
    try {
      const response = await fetch('/api/ai/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
        console.log('Resync initiated');
      }
    } catch (error) {
      console.error('Error initiating resync:', error);
    }
  };

  const handleForceReanalyze = async () => {
    try {
      const response = await fetch('/api/ai/force-reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
        console.log('Force reanalyze initiated');
      }
    } catch (error) {
      console.error('Error initiating force reanalyze:', error);
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
            title: task.emailSubject || task.subject || 'Related Email',
            description: task.description || task.taskDescription || task.snippet || 'Email content',
            relevance: task.aiConfidence || task.confidence || 50
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
      // Call real AI chat API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'task-first-email-manager-jwt-secret-change-in-production'
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
            urgentTaskTitles: urgentTasks.slice(0, 3).map(t => t.title || t.taskTitle || t.subject || 'Untitled'),
            tasksWithDraftTitles: tasksWithDrafts.slice(0, 3).map(t => t.title || t.taskTitle || t.subject || 'Untitled'),
            currentFilter: filter,
            syncStatus: syncStatus
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Handle action commands that might need to update the UI
        if (data.action) {
          await handleChatAction(data.action, data.actionData);
        }
        
        return data.response || data.message || 'I received your message but couldn\'t generate a proper response.';
      } else {
        console.warn('AI service returned error:', response.status);
        throw new Error(`AI service error: ${response.status}`);
      }
    } catch (error) {
      console.error('AI chat response error:', error);
      
      // Enhanced fallback responses with real functionality
      if (input.includes('high priority') || input.includes('urgent')) {
        if (urgentTasks.length > 0) {
          const taskList = urgentTasks.slice(0, 3).map(t => `"${t.title || t.taskTitle || t.subject || 'Untitled'}"`).join(', ');
          return `I found ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''}: ${taskList}. ${tasksWithDrafts.length > 0 ? 'Some have AI-generated drafts ready for review.' : 'Click on any task to see details and generate drafts.'}`;
        }
        return 'No urgent tasks found. You\'re doing great with your priorities!';
      }
      
      if (input.includes('draft') || input.includes('write') || input.includes('email')) {
        if (tasksWithDrafts.length > 0) {
          return `I found ${tasksWithDrafts.length} task${tasksWithDrafts.length > 1 ? 's' : ''} with AI-generated drafts ready. Click on any task card to view and edit the draft.`;
        }
        return 'I can generate email drafts for your tasks. Click on any task card to open the detailed view where I can create a draft reply.';
      }
      
      if (input.includes('status') || input.includes('complete') || input.includes('done')) {
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
        return `Current status: ${pendingTasks.length} pending, ${inProgressTasks.length} in-progress, ${tasks.filter(t => t.status === 'completed').length} completed tasks. Click on task cards to update their status.`;
      }
      
      if (input.includes('filter') || input.includes('show') || input.includes('view')) {
        return `Currently showing: ${filter}. You can change the filter using the dropdown above. I can help you find specific types of tasks or emails.`;
      }
      
      if (input.includes('sync') || input.includes('email') || input.includes('process')) {
        const aiStatus = syncStatus?.aiProcessing;
        if (aiStatus) {
          return `Email sync status: ${syncStatus.emailsInPostgres} emails synced, ${aiStatus.analyzed} analyzed by AI, ${aiStatus.completed} processed successfully. ${aiStatus.pending > 0 ? `${aiStatus.pending} still processing.` : 'All caught up!'}`;
        }
        return 'I can help you understand the email sync status and AI processing. The system continuously processes new emails into actionable tasks.';
      }
      
      if (input.includes('summary') || input.includes('overview') || input.includes('stats')) {
        return `📊 Summary: ${tasks.length} total tasks, ${urgentTasks.length} urgent, ${pendingTasks.length} pending. Efficiency: ${stats.efficiency}%. ${syncStatus ? `${syncStatus.emailsInPostgres} emails synced from Apple Mail.` : ''}`;
      }
      
      // Default helpful response with better formatting
      return `🤖 **Your AI Task Assistant**

I have full access to your email database and can help you with:

**📋 Task Management**
• Show urgent/high priority tasks
• Mark tasks complete or update status
• Find tasks by sender or subject

**✉️ Email & Drafts** 
• Generate professional email replies
• Create drafts for any task
• Edit and improve existing drafts

**📊 Analytics & Insights**
• Task completion statistics
• Email processing status
• Productivity metrics

**🔍 Smart Search**
• Find emails by content or sender
• Filter by date, priority, or category
• Search across all your data

You currently have **${tasks.length} tasks** to manage. What would you like me to help with?`;
    }
  };

  // Handle AI-suggested actions
  const handleChatAction = async (action: string, actionData: any) => {
    switch (action) {
      case 'filter_tasks':
        if (actionData.filter && ['all', 'tasks', 'non-tasks'].includes(actionData.filter)) {
          setFilter(actionData.filter);
        }
        break;
      case 'refresh_data':
        fetchTasks(true);
        fetchSyncStatus();
        break;
      case 'open_task':
        if (actionData.taskId) {
          const task = tasks.find(t => t.id === actionData.taskId);
          if (task) {
            handleTaskClick(task);
          }
        }
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  // DERIVE COUNTS FROM SYNC STATUS FOR CONSISTENCY - SIMPLIFIED TO 2 STATES
  const totalTaskCount = syncStatus?.emailBreakdown?.tasks?.count ?? tasks.length;
  const completedCount = completedTasks.length; // This is a UI state, keep as is
  const pendingCount = totalTaskCount - completedCount; // All non-completed tasks are "pending"


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden">
      <BGPattern variant="grid" mask="fade-edges" size={32} fill="rgba(59, 130, 246, 0.1)" />
      


      {/* Content - Full Height */}
      <div className="flex h-screen">
        {/* Left Sidebar - Responsive with proper overflow */}
        <div className="min-w-60 max-w-80 flex-shrink-0 bg-slate-800/40 border-r border-slate-600/40 shadow-xl relative z-10 flex flex-col h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-lg font-bold text-white">TaskFlow</h1>
            <p className="text-xs text-slate-400">Task-first management</p>
          </div>

          {/* User Info */}
          <div className="mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-slate-200">
                {userProfile?.displayName || 'Your Account'}
              </span>
            </div>
            <p className="text-xs text-slate-400">{userProfile?.email || 'Loading...'}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-green-400">● Online</span>
                          <button 
              onClick={() => setShowSettings(true)}
              aria-label="Open user settings and preferences"
              className="text-xs text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-1"
            >
              <Settings className="w-3 h-3" />
            </button>
            </div>
          </div>

          {/* Task Overview Stats */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Overview</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{totalTaskCount}</div>
                <div className="text-xs text-slate-400">Total Tasks</div>
              </div>
              <div className="bg-amber-500/15 rounded-lg p-3 text-center border border-amber-400/30">
                <div className="text-xl font-bold text-amber-300">{pendingCount}</div>
                <div className="text-xs text-amber-200/70">Pending</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-emerald-500/15 rounded-lg p-3 text-center border border-emerald-400/30">
                <div className="text-xl font-bold text-emerald-300">{completedCount}</div>
                <div className="text-xs text-emerald-200/70">Completed</div>
              </div>
            </div>
          </div>

          {/* Task Categories */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setCategoryFilter('all')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'all' 
                    ? 'bg-blue-500/20 border border-blue-400/50 text-blue-200' 
                    : 'hover:bg-blue-500/10 text-blue-200'
                }`}
              >
                <div className="w-3 h-3 bg-blue-400 rounded-full shadow-sm"></div>
                <span>All Categories</span>
                <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">{totalTaskCount}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('NEEDS_REPLY')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'NEEDS_REPLY' 
                    ? 'bg-red-500/20 border border-red-400/50 text-red-200' 
                    : 'hover:bg-red-500/10 text-red-200'
                }`}
              >
                <div className="w-3 h-3 bg-red-400 rounded-full shadow-sm"></div>
                <span>Needs Reply</span>
                <span className="ml-auto text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{categoryCounts.NEEDS_REPLY || 0}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('APPROVAL_REQUIRED')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'APPROVAL_REQUIRED' 
                    ? 'bg-purple-500/20 border border-purple-400/50 text-purple-200' 
                    : 'hover:bg-purple-500/10 text-purple-200'
                }`}
              >
                <div className="w-3 h-3 bg-purple-400 rounded-full shadow-sm"></div>
                <span>Approval Required</span>
                <span className="ml-auto text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{categoryCounts.APPROVAL_REQUIRED || 0}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('DELEGATE')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'DELEGATE' 
                    ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-200' 
                    : 'hover:bg-indigo-500/10 text-indigo-200'
                }`}
              >
                <div className="w-3 h-3 bg-indigo-400 rounded-full shadow-sm"></div>
                <span>Delegate</span>
                <span className="ml-auto text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{categoryCounts.DELEGATE || 0}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('FOLLOW_UP')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'FOLLOW_UP' 
                    ? 'bg-teal-500/20 border border-teal-400/50 text-teal-200' 
                    : 'hover:bg-teal-500/10 text-teal-200'
                }`}
              >
                <div className="w-3 h-3 bg-teal-400 rounded-full shadow-sm"></div>
                <span>Follow Up</span>
                <span className="ml-auto text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{categoryCounts.FOLLOW_UP || 0}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('MEETING_REQUEST')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'MEETING_REQUEST' 
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200' 
                    : 'hover:bg-cyan-500/10 text-cyan-200'
                }`}
              >
                <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-sm"></div>
                <span>Meetings</span>
                <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{(categoryCounts.MEETING_REQUEST || 0) + (categoryCounts.MEETING_CANCELLED || 0)}</span>
              </button>
              <button 
                onClick={() => setCategoryFilter('FYI_ONLY')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  categoryFilter === 'FYI_ONLY' 
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200' 
                    : 'hover:bg-emerald-500/10 text-emerald-200'
                }`}
              >
                <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-sm"></div>
                <span>FYI Only</span>
                <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{syncStatus?.emailBreakdown?.fyi?.count || 0}</span>
              </button>
            </div>
          </div>

          {/* Enhanced AI Status */}
          <EnhancedAIStatus
            syncStatus={syncStatus}
            onSync={handleManualSync}
            onResync={handleResync}
            onForceReanalyze={handleForceReanalyze}
            showPrompts={showAIPrompts}
            onTogglePrompts={() => setShowAIPrompts(!showAIPrompts)}
            showChat={showAIChat}
            onToggleChat={() => setShowAIChat(!showAIChat)}
          />

          {/* AI Usage Metrics */}
          <div className="mt-6">
            <AIUsageMetrics />
          </div>

          {/* AI Suggestions */}
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI Suggestions</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="p-2 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2">
                    <Brain className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-200">{suggestion.title}</p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{suggestion.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Main Task Workflow Area - Recessed, Scrollable */}
          <div className="flex-1 p-6 bg-slate-900/60 shadow-inner relative overflow-y-auto">
            {/* Clean, minimal filters */}
            <div className="mb-6">
              {/* Search */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[320px]"
                  />
                </div>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex items-center justify-center gap-6">
                {/* Task Type Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilter('tasks')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === 'tasks' 
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Tasks ({syncStatus?.emailBreakdown?.tasks?.count || tasks.filter(t => t.status !== 'completed').length})
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === 'all' 
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    All ({syncStatus?.emailBreakdown?.total || syncStatus?.emailsInPostgres || 0})
                  </button>
                  <button
                    onClick={() => setFilter('non-tasks')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === 'non-tasks' 
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Info ({syncStatus?.emailBreakdown?.fyi?.count || 0})
                  </button>
                </div>
                
                {/* Time Filter Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDateFilter('today')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'today' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Today ({syncStatus?.emailBreakdown?.today || 0})
                  </button>
                  <button
                    onClick={() => setDateFilter('week')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'week' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Week ({syncStatus?.emailBreakdown?.week || 488})
                  </button>
                  <button
                    onClick={() => setDateFilter('month')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'month' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Month ({syncStatus?.emailBreakdown?.month || 1762})
                  </button>
                  <button
                    onClick={() => setDateFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'all' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    All Time ({syncStatus?.emailBreakdown?.total || 8081})
                  </button>
                </div>
              </div>
            </div>

            {/* Task Columns - Optimized Spacing */}
            <div className="grid grid-cols-2 gap-6">
              {/* Pending Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-lg"></div>
                  <h3 className="text-lg font-semibold text-amber-200">Pending Tasks</h3>
                  <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm font-medium border border-amber-400/30">
                    {pendingTasks.length + inProgressTasks.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {(pendingTasks.length + inProgressTasks.length) === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <AlertCircle className="w-16 h-16 text-amber-500/50 mb-4" />
                      <p className="text-amber-200/80 text-sm font-medium">No pending tasks</p>
                      <p className="text-amber-300/60 text-xs mt-2 text-center">AI will create tasks from emails when enabled</p>
                    </div>
                  ) : (
                    <>
                      {pendingTasks.map((task) => (
                        <TaskCard 
                          key={task.id}
                          task={task} 
                          onStatusChange={updateTaskStatus}
                          onClick={handleTaskClick}
                        />
                      ))}
                      {inProgressTasks.map((task) => (
                        <TaskCard 
                          key={task.id}
                          task={{...task, status: 'pending'}} 
                          onStatusChange={updateTaskStatus}
                          onClick={handleTaskClick}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Completed Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full shadow-lg"></div>
                  <h3 className="text-lg font-semibold text-emerald-200">Completed Tasks</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-medium border border-emerald-400/30">
                    {completedTasks.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {completedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                      <p className="text-emerald-200/80 text-sm font-medium">No completed tasks</p>
                      <p className="text-emerald-300/60 text-xs mt-2 text-center">Complete tasks will appear here</p>
                    </div>
                  ) : (
                    completedTasks.map(task => (
                      <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
                    ))
                  )}
                </div>
              </div>
            </div>
            
            {/* Infinite Scroll Trigger */}
            <div 
              ref={lastTaskElementRef}
              className="h-4 flex items-center justify-center mt-6"
            >
              {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  Loading more tasks...
                </div>
              )}
              {!loading && hasMore && (
                <button 
                  onClick={loadMoreTasks}
                  className="text-slate-400 hover:text-slate-300 text-sm px-4 py-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  Load more tasks ({tasks.length} of 393)
                </button>
              )}
            </div>
          </div>

          {/* Right Sidebar - Responsive with improved layout */}
          <div className="min-w-60 max-w-80 flex-shrink-0 border-l border-slate-600/40 bg-slate-800/40 flex flex-col shadow-xl relative z-10 h-full overflow-hidden">
            {/* Top Section: Related Items - Flexible height */}
            <div className="flex-shrink-0 max-h-[40%] p-4 border-b border-slate-700/30 overflow-y-auto">
              <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
                <Link className="w-4 h-4" />
                Related Items
              </h3>
              <div className="space-y-2 h-full overflow-y-auto pr-2">
                {relatedItems.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="mt-0.5 flex-shrink-0">
                        {item.type === 'email' && <Mail className="w-3.5 h-3.5 text-blue-400" />}
                        {item.type === 'task' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                        {item.type === 'contact' && <Users className="w-3.5 h-3.5 text-purple-400" />}
                        {item.type === 'document' && <FileText className="w-3.5 h-3.5 text-orange-400" />}
                      </div>
                      <span className="text-xs font-medium text-slate-200 line-clamp-1 break-all">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 pl-5">{item.description}</p>
                    <div className="flex items-center justify-between mt-2 pl-5">
                      <span className="text-xs text-slate-500 capitalize bg-slate-800/50 px-2 py-0.5 rounded">{item.type}</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400/20" />
                        <span className="text-xs font-medium text-slate-300">{item.relevance}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section: Chat Interface - Takes remaining space */}
            <div className="flex-1 p-4 overflow-hidden">
              <ChatInterface messages={messages} onSendMessage={handleSendMessage} taskCount={tasks.length} />
            </div>
          </div>
          </div>
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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <FocusTrap>
            <div 
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 id="settings-title" className="text-lg font-semibold text-slate-100">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  aria-label="Close settings"
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">User Preferences</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Enable desktop notifications</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Auto-refresh tasks</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">AI Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Enable AI task classification</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Generate draft replies</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}

      {/* AI Prompt Viewer */}
      <AIPromptViewer 
        visible={showAIPrompts}
        onClose={() => setShowAIPrompts(false)}
      />
      
      {/* AI Chat */}
      <AIChat
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
      />
    </div>
  );
};

export default EmailTaskDashboard;
