import { TaskStatus, TaskPriority, TaskCategory } from '../../types/core';
import React, { useState, useCallback, useMemo } from 'react';
import { ThreePanelLayout } from './index';
import type {
  TaskItem,
  TaskCentricEmail,
  TaskCentricDraft,
  TaskUrgencyLevel
} from './types';

/**
 * TaskCentricIntegration - Integration layer between existing email interface and task-centric layout
 * 
 * BRIEF_RATIONALE: Provides integration example showing how to transform existing email
 * data into task-centric format and connect with ModernEmailInterface. Demonstrates
 * data mapping, state management, and API integration patterns.
 * 
 * ASSUMPTIONS:
 * - Existing email data structure from ModernEmailInterface
 * - Task generation API endpoints are available
 * - Draft generation API endpoints are available
 * - Real-time updates via WebSocket or polling
 * 
 * DECISION_LOG:
 * - Used adapter pattern to transform email data to task format
 * - Implemented mock data for demonstration purposes
 * - Added error handling and loading states
 * - Provided integration hooks for existing systems
 * 
 * EVIDENCE: Based on existing ModernEmailInterface structure and whitepaper
 * specifications for seamless integration with current email workflow.
 */

interface TaskCentricIntegrationProps {
  // Props that would come from parent email interface
  emails?: any[];
  selectedEmail?: any;
  onEmailSelect?: (email: any) => void;
  // Integration flags
  enableTaskMode?: boolean;
  onTaskModeToggle?: (enabled: boolean) => void;
}

// Mock data generators for demonstration
const generateMockTasks = (emails: any[]): TaskItem[] => {
  return emails.slice(0, 10).map((email, index) => ({
    id: (index + 1).toString(),
    title: `Reply to: ${email.subject || 'Untitled Email'}`,
    description: `Process email from ${email.sender || 'Unknown Sender'}. ${email.preview || 'No preview available'}`,
    category: 'NEEDS_REPLY' as TaskCategory,
    urgency: 'MEDIUM' as TaskUrgencyLevel,
    priority: 'MEDIUM' as TaskUrgencyLevel,
    status: 'TODO' as TaskStatus,
    estimatedTime: Math.floor(Math.random() * 30) + 5, // 5-35 minutes
    dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: email.date || new Date().toISOString(),
    updatedAt: email.date || new Date().toISOString(),
    createdBy: 'System',
    sender: email.sender || 'Unknown Sender',
    senderEmail: email.senderEmail || email.sender || '',
    assignedTo: Math.random() > 0.7 ? 'John Doe' : undefined,
    emailId: email.id,
    progress: Math.floor(Math.random() * 30),
    tags: email.tags || [],
    draftGenerated: false,
    aiConfidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
    aiReasoning: `This email requires reply based on content analysis and sender importance.`,
    suggestedActions: [
      'Review email content thoroughly',
      'Prepare response within estimated timeframe',
      'Consider CC recipients if replying'
    ]
  }));
};

const generateMockEmails = (emails: any[]): TaskCentricEmail[] => {
  return emails.map(email => ({
    id: email.id || Math.random(),
    subject: email.subject || 'No Subject',
    sender: email.sender || 'Unknown Sender',
    senderEmail: email.senderEmail || email.sender || '',
    date: email.date || new Date().toISOString(),
    classification: email.classification || 'UNCLASSIFIED',
    urgency: mapEmailUrgencyToTaskUrgency(email.urgency),
    confidence: email.confidence || 0.8,
    has_draft: email.has_draft || false,
    preview: email.preview || '',
    content: email.content || '',
    isRead: email.isRead ?? false,
    isStarred: email.isStarred ?? false,
    tags: email.tags || []
  }));
};

const generateMockDrafts = (): TaskCentricDraft[] => {
  return [
    {
      id: 1,
      emailId: 1,
      taskId: 1,
      content: "Thank you for your email. I'll review the proposal and get back to you by Friday with our decision.\n\nBest regards,\nJohn Doe",
      subject: "Re: Proposal Review",
      recipients: ['sender@example.com'],
      confidence: 0.92,
      tone: 'formal',
      style: 'concise',
      aiGenerated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready_to_send',
      revisionCount: 0
    }
  ];
};

// Utility functions for data mapping
const mapEmailClassificationToTaskCategory = (classification: string): TaskCategory => {
  // Map to simplified category
  return 'NEEDS_REPLY' as TaskCategory;
};

const mapEmailUrgencyToTaskUrgency = (urgency: string): TaskUrgencyLevel => {
  switch(urgency) {
    case TaskPriority.CRITICAL: return TaskPriority.CRITICAL as TaskUrgencyLevel;
    case 'HIGH': return 'HIGH' as TaskUrgencyLevel;
    case 'MEDIUM': return 'MEDIUM' as TaskUrgencyLevel;
    case 'LOW': return 'LOW' as TaskUrgencyLevel;
    default: return 'MEDIUM' as TaskUrgencyLevel;
  }
};

const TaskCentricIntegration: React.FC<TaskCentricIntegrationProps> = ({
  emails = [],
  selectedEmail,
  onEmailSelect,
  enableTaskMode = false,
  onTaskModeToggle
}) => {
  // Transform email data to task-centric format
  const taskCentricEmails = useMemo(() => generateMockEmails(emails), [emails]);
  const [tasks, setTasks] = useState<TaskItem[]>(() => generateMockTasks(emails));
  const [drafts, setDrafts] = useState<TaskCentricDraft[]>(generateMockDrafts);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // Task management handlers
  const handleTaskUpdate = useCallback(async (updatedTask: TaskItem) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
    
    // Here you would typically make an API call to update the task
  }, []);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === String(taskId) 
        ? { 
            ...task, 
            status: TaskStatus.COMPLETED as TaskStatus, 
            progress: 100, 
            completedAt: new Date().toISOString() 
          }
        : task
    ));
    
    // Here you would typically make an API call to complete the task
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    
    // Here you would typically make an API call to delete the task
  }, []);

  // Draft management handlers
  const handleDraftCreate = useCallback(async (task: TaskItem) => {
    setIsGeneratingDraft(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find related email
      const relatedEmail = taskCentricEmails.find(email => email.id.toString() === task.emailId);
      
      // Generate mock draft
      const newDraft: TaskCentricDraft = {
        id: drafts.length + 1,
        emailId: parseInt(task.emailId || '0'),
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        content: `Thank you for your email regarding "${relatedEmail?.subject}". I have reviewed your request and will provide a detailed response shortly.\n\nBest regards,\nJohn Doe`,
        subject: `Re: ${relatedEmail?.subject || 'Your Email'}`,
        recipients: [relatedEmail?.senderEmail || 'unknown@example.com'],
        confidence: Math.random() * 0.2 + 0.8, // 0.8-1.0
        tone: 'formal',
        style: 'concise',
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        revisionCount: 0
      };
      
      setDrafts(prev => [...prev, newDraft]);
    } catch (error) {
      console.error('Failed to create draft:', error);
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [taskCentricEmails, drafts.length]);

  const handleDraftUpdate = useCallback(async (updatedDraft: TaskCentricDraft) => {
    setDrafts(prev => prev.map(draft => 
      draft.id === updatedDraft.id ? updatedDraft : draft
    ));
    
    // Here you would typically make an API call to update the draft
  }, []);

  const handleDraftSend = useCallback(async (draft: TaskCentricDraft) => {
    // Here you would typically make an API call to send the email
    
    // Update draft status
    const sentDraft = {
      ...draft,
      status: 'sent' as const,
      updatedAt: new Date().toISOString()
    };
    
    setDrafts(prev => prev.map(d => d.id === draft.id ? sentDraft : d));
    
    // Mark related task as completed
    if (draft.taskId) {
      await handleTaskComplete(draft.taskId.toString());
    }
  }, [handleTaskComplete]);

  // Integration with existing email interface
  const handleEmailToTaskConversion = useCallback((email: any) => {
    const newTask: TaskItem = {
      id: tasks.length + 1,
      title: `Process: ${email.subject}`,
      description: `Handle email from ${email.sender}. ${email.preview || ''}`,
      category: mapEmailClassificationToTaskCategory(email.classification),
      urgency: mapEmailUrgencyToTaskUrgency(email.urgency),
      priority: mapEmailUrgencyToTaskUrgency(email.urgency),
      status: 'TODO' as TaskStatus,
      estimatedDuration: 15,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailId: email.id,
      progress: 0,
      aiConfidence: 0.85,
      aiReasoning: 'Automatically generated from email classification and content analysis.',
      createdBy: 'System',
      sender: email.sender,
      senderEmail: email.senderEmail,
      draftGenerated: false,
      tags: email.tags || []
    };
    
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [tasks.length]);

  // Show regular email interface if task mode is disabled
  if (!enableTaskMode) {
    return (
      <div className="task-integration-placeholder">
        <div className="integration-notice">
          <h3>Task-Centric Interface Available</h3>
          <p>Switch to task mode to use the three-panel task-centric layout.</p>
          <button 
            onClick={() => onTaskModeToggle?.(true)}
            className="enable-task-mode-button"
          >
            Enable Task Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-centric-integration">
      {/* Integration header */}
      <div className="integration-header">
        <div className="mode-indicator">
          <span className="mode-label">Task-Centric Mode</span>
          <button 
            onClick={() => onTaskModeToggle?.(false)}
            className="exit-task-mode-button"
          >
            Exit Task Mode
          </button>
        </div>
        <div className="integration-stats">
          <span>{tasks.length} tasks</span>
          <span>{drafts.length} drafts</span>
          <span>{taskCentricEmails.length} emails</span>
        </div>
      </div>

      {/* Three-panel layout */}
      <ThreePanelLayout
        emails={taskCentricEmails}
        tasks={tasks}
        drafts={drafts}
        onTaskUpdate={handleTaskUpdate}
        onTaskComplete={handleTaskComplete}
        onTaskDelete={handleTaskDelete}
        onDraftCreate={handleDraftCreate}
        onDraftUpdate={handleDraftUpdate}
        onDraftSend={handleDraftSend}
        isGeneratingDraft={isGeneratingDraft}
        className="integrated-task-layout"
      />

      {/* Integration utilities */}
      {process.env.NODE_ENV === 'development' && (
        <div className="integration-debug">
          <h4>Integration Debug</h4>
          <button onClick={() => setTasks(generateMockTasks(emails))}>
            Regenerate Tasks
          </button>
          <button onClick={() => setDrafts(generateMockDrafts())}>
            Reset Drafts
          </button>
          <button onClick={() => alert('State logged to console')}>
            Log State
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskCentricIntegration;

// Export utility functions for external use
export {
  mapEmailClassificationToTaskCategory,
  mapEmailUrgencyToTaskUrgency,
  generateMockTasks,
  generateMockEmails,
  generateMockDrafts
};
