import React, { useState, useEffect } from 'react';
import { ResponsiveLayout } from './index';
import '../../styles/responsive/responsive-breakpoints.css';
import '../../styles/responsive/mobile-animations.css';

// Example integration component showing how to use mobile components
// with existing email intelligence system

interface MobileIntegrationExampleProps {
  // Props that would come from existing ModernEmailInterface
  existingEmails?: any[];
  existingTasks?: any[];
  existingDrafts?: any[];
}

const MobileIntegrationExample: React.FC<MobileIntegrationExampleProps> = ({
  existingEmails = [],
  existingTasks = [],
  existingDrafts = []
}) => {
  const [emails, setEmails] = useState(existingEmails);
  const [tasks, setTasks] = useState(existingTasks);
  const [drafts, setDrafts] = useState(existingDrafts);
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration (replace with real data)
  useEffect(() => {
    if (emails.length === 0) {
      setEmails([
        {
          id: 1,
          subject: 'Project Update Required',
          sender: 'John Smith',
          senderEmail: 'john@company.com',
          date: '2025-01-15T10:30:00Z',
          classification: 'NEEDS_REPLY',
          urgency: 'high',
          preview: 'Please provide an update on the Q1 project status...',
          content: 'Hi team, we need an update on the Q1 project status for the board meeting next week.',
          isRead: false
        },
        {
          id: 2,
          subject: 'Meeting Notes - Strategic Planning',
          sender: 'Sarah Johnson',
          senderEmail: 'sarah@company.com',
          date: '2025-01-15T09:15:00Z',
          classification: 'FYI_ONLY',
          urgency: 'medium',
          preview: 'Attached are the notes from yesterday\'s strategic planning session...',
          content: 'Team, here are the notes from our strategic planning session.',
          isRead: true
        }
      ]);

      setTasks([
        {
          id: 1,
          title: 'Respond to John about project update',
          description: 'Compile Q1 project status and metrics for board presentation',
          status: 'pending',
          priority: 'high',
          category: 'needs_reply',
          due_date: '2025-01-16T17:00:00Z',
          email_id: 1,
          created_at: '2025-01-15T10:35:00Z',
          updated_at: '2025-01-15T10:35:00Z',
          confidence: 0.92
        },
        {
          id: 2,
          title: 'Review strategic planning notes',
          description: 'Review and identify action items from Sarah\'s meeting notes',
          status: 'pending',
          priority: 'medium',
          category: 'do_myself',
          email_id: 2,
          created_at: '2025-01-15T09:20:00Z',
          updated_at: '2025-01-15T09:20:00Z',
          confidence: 0.87
        }
      ]);

      setDrafts([
        {
          id: 1,
          email_id: 1,
          content: 'Hi John,\n\nThanks for reaching out about the Q1 project update. I\'ll have the comprehensive status report ready for you by tomorrow morning, including all key metrics and milestone progress.\n\nBest regards',
          confidence: 0.89,
          created_at: '2025-01-15T10:40:00Z'
        }
      ]);
    }
  }, [emails.length]);

  // Handler functions for mobile interface
  const handleTaskComplete = async (taskId: number) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'completed', updated_at: new Date().toISOString() }
        : task
    ));
    
    // Trigger haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleTaskDelegate = async (taskId: number, assignee: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'delegated', assignee, updated_at: new Date().toISOString() }
        : task
    ));
  };

  const handleTaskEdit = async (task: any) => {
    // In real implementation, this would open a task editing modal
    console.log('Edit task:', task);
  };

  const handleTaskCreate = async (emailId: number) => {
    const newTask = {
      id: Date.now(),
      title: 'New Task',
      description: 'Task created from email',
      status: 'pending',
      priority: 'medium',
      category: 'do_myself',
      email_id: emailId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      confidence: 0.75
    };
    
    setTasks(prev => [...prev, newTask]);
  };

  const handleEmailSelect = async (email: any) => {
    // Mark email as read
    setEmails(prev => prev.map(e => 
      e.id === email.id ? { ...e, isRead: true } : e
    ));
  };

  const handleDraftEdit = async (draft: any) => {
    // In real implementation, this would open a draft editing interface
    console.log('Edit draft:', draft);
  };

  const handleRefresh = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In real implementation, this would fetch fresh data from the API
    console.log('Refreshing data...');
    
    setLoading(false);
  };

  return (
    <div className="mobile-integration-example h-screen bg-background">
      <ResponsiveLayout
        emails={emails}
        tasks={tasks}
        drafts={drafts}
        onTaskComplete={handleTaskComplete}
        onTaskDelegate={handleTaskDelegate}
        onTaskEdit={handleTaskEdit}
        onTaskCreate={handleTaskCreate}
        onEmailSelect={handleEmailSelect}
        onDraftEdit={handleDraftEdit}
        onRefresh={handleRefresh}
      />
      
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Refreshing...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileIntegrationExample;