import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../App';
import MobileTaskInterface from './MobileTaskInterface';
import BottomNavigation from './BottomNavigation';
import OfflineManager, { useOffline } from './OfflineManager';

interface ResponsiveLayoutProps {
  emails: any[];
  tasks: any[];
  drafts: any[];
  onTaskComplete: (taskId: number) => void;
  onTaskDelegate: (taskId: number, assignee: string) => void;
  onTaskEdit: (task: any) => void;
  onTaskCreate: (emailId: number) => void;
  onEmailSelect: (email: any) => void;
  onDraftEdit: (draft: any) => void;
  onRefresh: () => Promise<void>;
}

type ViewMode = 'emails' | 'tasks' | 'drafts' | 'search' | 'settings';
type BreakpointSize = 'mobile' | 'tablet' | 'desktop';

interface BreakpointConfig {
  size: BreakpointSize;
  minWidth: number;
  maxWidth?: number;
  panels: number;
  layout: 'single' | 'dual' | 'triple';
  navigation: 'bottom' | 'sidebar' | 'hybrid';
}

const breakpoints: BreakpointConfig[] = [
  {
    size: 'mobile',
    minWidth: 0,
    maxWidth: 767,
    panels: 1,
    layout: 'single',
    navigation: 'bottom'
  },
  {
    size: 'tablet',
    minWidth: 768,
    maxWidth: 1023,
    panels: 2,
    layout: 'dual',
    navigation: 'hybrid'
  },
  {
    size: 'desktop',
    minWidth: 1024,
    panels: 3,
    layout: 'triple',
    navigation: 'sidebar'
  }
];

// Hook for responsive breakpoints
const useBreakpoint = (): BreakpointConfig => {
  const [breakpoint, setBreakpoint] = useState<BreakpointConfig>(breakpoints[0]);

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      const currentBreakpoint = breakpoints.find(
        bp => width >= bp.minWidth && (!bp.maxWidth || width <= bp.maxWidth)
      ) || breakpoints[breakpoints.length - 1];
      
      setBreakpoint(currentBreakpoint);
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};

// Hook for orientation detection
const useOrientation = () => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return orientation;
};

// Layout Components
const EmailListPanel: React.FC<{
  emails: any[];
  selectedEmail: any;
  onEmailSelect: (email: any) => void;
  className?: string;
}> = ({ emails, selectedEmail, onEmailSelect, className = '' }) => {
  return (
    <div className={`email-list-panel ${className}`}>
      <div className="h-full overflow-y-auto">
        {emails.map(email => (
          <div
            key={email.id}
            className={`p-4 border-b border-border cursor-pointer hover:bg-accent transition-colors ${
              selectedEmail?.id === email.id ? 'bg-accent' : ''
            }`}
            onClick={() => onEmailSelect(email)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-sm truncate">{email.subject}</h3>
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                {new Date(email.date).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{email.sender}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{email.preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmailDetailPanel: React.FC<{
  email: any;
  className?: string;
}> = ({ email, className = '' }) => {
  if (!email) {
    return (
      <div className={`email-detail-panel flex items-center justify-center ${className}`}>
        <div className="text-center text-muted-foreground">
          <h3 className="text-lg font-medium mb-2">Select an email</h3>
          <p className="text-sm">Choose an email to view its content</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`email-detail-panel ${className}`}>
      <div className="h-full overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold mb-2">{email.subject}</h1>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>From: {email.sender} &lt;{email.senderEmail}&gt;</p>
            <p>Date: {new Date(email.date).toLocaleString()}</p>
            <p>Classification: {email.classification}</p>
          </div>
        </div>
        <div className="prose prose-sm max-w-none">
          <p>{email.content || email.preview}</p>
        </div>
      </div>
    </div>
  );
};

const DraftListPanel: React.FC<{
  drafts: any[];
  onDraftEdit: (draft: any) => void;
  className?: string;
}> = ({ drafts, onDraftEdit, className = '' }) => {
  return (
    <div className={`draft-list-panel ${className}`}>
      <div className="h-full overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Drafts</h2>
        {drafts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No drafts available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map(draft => (
              <div
                key={draft.id}
                className="p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onDraftEdit(draft)}
              >
                <p className="text-sm line-clamp-3">{draft.content}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  Created: {new Date(draft.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Responsive Layout Component
const ResponsiveLayoutContent: React.FC<ResponsiveLayoutProps> = ({
  emails,
  tasks,
  drafts,
  onTaskComplete,
  onTaskDelegate,
  onTaskEdit,
  onTaskCreate,
  onEmailSelect,
  onDraftEdit,
  onRefresh
}) => {
  const { isDark } = useTheme();
  const breakpoint = useBreakpoint();
  const orientation = useOrientation();
  const [currentView, setCurrentView] = useState<ViewMode>('emails');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  
  // Check if offline functionality is available
  let isOffline = false;
  let offlineManager = null;
  try {
    offlineManager = useOffline();
    isOffline = !offlineManager.isOnline;
  } catch {
    // Not wrapped in OfflineManager, continue without offline features
  }

  // Handle view changes based on breakpoint
  const handleViewChange = useCallback((view: ViewMode) => {
    setCurrentView(view);
    
    // Reset selected items when changing views on mobile
    if (breakpoint.size === 'mobile') {
      setSelectedEmail(null);
    }
  }, [breakpoint.size]);

  // Handle email selection
  const handleEmailSelect = useCallback((email: any) => {
    setSelectedEmail(email);
    onEmailSelect(email);
  }, [onEmailSelect]);

  // Render based on breakpoint
  const renderLayout = () => {
    switch (breakpoint.size) {
      case 'mobile':
        return (
          <div className="mobile-layout h-full flex flex-col">
            {currentView === 'emails' && (
              <div className="flex-1 overflow-hidden">
                <EmailListPanel
                  emails={emails}
                  selectedEmail={selectedEmail}
                  onEmailSelect={handleEmailSelect}
                  className="h-full"
                />
                {selectedEmail && (
                  <div className="fixed inset-0 bg-background z-40 slide-in-right">
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-semibold">Email</h2>
                        <button
                          onClick={() => setSelectedEmail(null)}
                          className="p-2 hover:bg-accent rounded-lg"
                        >
                          ✕
                        </button>
                      </div>
                      <EmailDetailPanel email={selectedEmail} className="flex-1" />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {currentView === 'tasks' && (
              <MobileTaskInterface
                tasks={tasks}
                emails={emails}
                onTaskComplete={onTaskComplete}
                onTaskDelegate={onTaskDelegate}
                onTaskEdit={onTaskEdit}
                onTaskCreate={onTaskCreate}
                onRefresh={onRefresh}
                isOffline={isOffline}
              />
            )}
            
            {currentView === 'drafts' && (
              <DraftListPanel
                drafts={drafts}
                onDraftEdit={onDraftEdit}
                className="h-full"
              />
            )}
            
            {currentView === 'search' && (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Search your tasks and emails</p>
              </div>
            )}
            
            {currentView === 'settings' && (
              <div className="h-full p-4">
                <h2 className="text-lg font-semibold mb-4">Settings</h2>
                <p className="text-muted-foreground">Configure notifications and preferences</p>
              </div>
            )}

            <BottomNavigation
              currentView={currentView}
              onViewChange={handleViewChange}
              taskCount={tasks.length}
              unreadCount={emails.filter(e => !e.isRead).length}
              draftCount={drafts.length}
              isOffline={isOffline}
            />
          </div>
        );

      case 'tablet':
        return (
          <div className="tablet-layout three-panel-layout">
            {/* Left Panel - Navigation/List */}
            <div className="tablet-sidebar bg-card border-r border-border">
              {currentView === 'emails' && (
                <EmailListPanel
                  emails={emails}
                  selectedEmail={selectedEmail}
                  onEmailSelect={handleEmailSelect}
                  className="h-full"
                />
              )}
              {currentView === 'tasks' && (
                <div className="h-full p-4">
                  <h2 className="text-lg font-semibold mb-4">Tasks</h2>
                  <div className="space-y-2">
                    {tasks.slice(0, 10).map(task => (
                      <div key={task.id} className="p-2 bg-background rounded border">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentView === 'drafts' && (
                <DraftListPanel
                  drafts={drafts}
                  onDraftEdit={onDraftEdit}
                  className="h-full"
                />
              )}
            </div>

            {/* Right Panel - Detail View */}
            <div className="tablet-main">
              {currentView === 'emails' && (
                <EmailDetailPanel email={selectedEmail} className="h-full" />
              )}
              {currentView === 'tasks' && (
                <div className="h-full p-6">
                  <h2 className="text-xl font-semibold mb-4">Task Details</h2>
                  <p className="text-muted-foreground">Select a task to view details</p>
                </div>
              )}
              {currentView === 'drafts' && (
                <div className="h-full p-6">
                  <h2 className="text-xl font-semibold mb-4">Draft Editor</h2>
                  <p className="text-muted-foreground">Select a draft to edit</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'desktop':
        return (
          <div className="desktop-layout three-panel-layout">
            {/* Sidebar */}
            <div className="desktop-sidebar bg-card border-r border-border p-4">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Navigation</h2>
                {(['emails', 'tasks', 'drafts', 'search', 'settings'] as ViewMode[]).map(view => (
                  <button
                    key={view}
                    onClick={() => handleViewChange(view)}
                    className={`w-full text-left p-2 rounded hover:bg-accent transition-colors ${
                      currentView === view ? 'bg-accent' : ''
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Email List */}
            <div className="desktop-email-list bg-background border-r border-border">
              {currentView === 'emails' && (
                <EmailListPanel
                  emails={emails}
                  selectedEmail={selectedEmail}
                  onEmailSelect={handleEmailSelect}
                  className="h-full"
                />
              )}
              {currentView === 'tasks' && (
                <div className="h-full p-4">
                  <h2 className="text-lg font-semibold mb-4">Task List</h2>
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} className="p-3 bg-card rounded border hover:bg-accent cursor-pointer">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                        <div className="flex justify-between mt-2 text-xs">
                          <span className={`px-2 py-1 rounded ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-muted-foreground">{task.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentView === 'drafts' && (
                <DraftListPanel
                  drafts={drafts}
                  onDraftEdit={onDraftEdit}
                  className="h-full"
                />
              )}
            </div>

            {/* Detail Panel */}
            <div className="desktop-detail-panel bg-card">
              {currentView === 'emails' && (
                <EmailDetailPanel email={selectedEmail} className="h-full" />
              )}
              {currentView === 'tasks' && (
                <div className="h-full p-6">
                  <h2 className="text-xl font-semibold mb-4">Task Management</h2>
                  <p className="text-muted-foreground mb-4">Desktop task interface with full features</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded border">
                      <h3 className="font-semibold mb-2">Active Tasks</h3>
                      <p className="text-2xl font-bold">{tasks.filter(t => t.status !== 'completed').length}</p>
                    </div>
                    <div className="p-4 bg-background rounded border">
                      <h3 className="font-semibold mb-2">Completed</h3>
                      <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
                    </div>
                  </div>
                </div>
              )}
              {currentView === 'drafts' && (
                <div className="h-full p-6">
                  <h2 className="text-xl font-semibold mb-4">Draft Editor</h2>
                  <p className="text-muted-foreground">Full-featured draft editing interface</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`responsive-layout ${breakpoint.size}-breakpoint ${orientation} ${isDark ? 'dark' : ''}`}>
      {renderLayout()}
    </div>
  );
};

// Wrapper component with OfflineManager
const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = (props) => {
  const handleSync = async (pendingActions: any[]) => {
    // Implement sync logic here
    console.log('Syncing pending actions:', pendingActions);
    // Process each pending action
    for (const action of pendingActions) {
      switch (action.type) {
        case 'task_complete':
          props.onTaskComplete(action.payload.taskId);
          break;
        case 'task_create':
          props.onTaskCreate(action.payload.emailId);
          break;
        // Add more action handlers as needed
      }
    }
  };

  return (
    <OfflineManager onSync={handleSync} syncInterval={5} maxRetries={3}>
      <ResponsiveLayoutContent {...props} />
    </OfflineManager>
  );
};

export default ResponsiveLayout;