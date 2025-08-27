import { TaskStatus } from '../types';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle,
  Flag,
  FileText,
  Zap,
  X
} from 'lucide-react';
import { FocusTrap } from './accessibility';

interface Task {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  description?: string;
  taskDescription?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | TaskStatus.COMPLETED;
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

interface EmailPopupProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: (task: Task) => void;
}

const EmailPopup: React.FC<EmailPopupProps> = React.memo(({ task, isOpen, onClose, onTaskUpdate: _onTaskUpdate }) => {
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
});

EmailPopup.displayName = 'EmailPopup';

export { EmailPopup };
export type { EmailPopupProps, Task, ChatMessage };