/**
 * Enterprise Email Management - Threaded Conversation Views
 * Advanced email conversation threading with drag-and-drop organization
 * 
 * Features:
 * - Intelligent email threading and grouping
 * - Drag-and-drop email organization
 * - Collapsible conversation threads
 * - Context-aware actions and shortcuts
 * - Accessibility-compliant interactions
 * - Performance optimized for large conversations
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { EmailMessage as BaseEmailMessage } from '../../types/index';

// Extended EmailMessage type for threaded view compatibility
interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage extends BaseEmailMessage {
  from?: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  receivedAt?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low' | 'normal';
  textContent?: string;
  htmlContent?: string;
  attachments?: { id: string; filename: string; size: number }[];
  modifiedAt?: string;
  isArchived?: boolean;
  isSpam?: boolean;
}

// Temporary local type definitions to fix missing exports
export interface ConversationThread {
  id: string;
  subject: string;
  emails: EmailMessage[];
  isCollapsed?: boolean;
}

export type EmailAction = 'reply' | 'archive' | 'delete';

// Stub hooks until implemented
export const useVirtualScroll = (_: any) => ({
  virtualItems: [],
  totalSize: 0,
  scrollElementRef: { current: null }
});

export const useEmailActions = () => ({
  executeAction: async (_action: EmailAction, _ids: string[]) => {}
});

// Simple date formatters
export const formatDate = (date: string | number | Date) =>
  new Date(date).toLocaleString();
export const formatRelativeTime = (date: string | number | Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface ThreadedConversationViewProps {
  threads: ConversationThread[];
  selectedEmailIds: string[];
  onEmailSelect: (emailId: string, isMultiple?: boolean) => void;
  onEmailAction: (action: EmailAction, emailIds: string[]) => void;
  onThreadCollapse: (threadId: string, collapsed: boolean) => void;
  onEmailMove: (emailId: string, targetThreadId: string, position: number) => void;
  onThreadReorder: (threadId: string, newPosition: number) => void;
  className?: string;
  showAttachments?: boolean;
  showPreviews?: boolean;
  enableVirtualization?: boolean;
  maxPreviewLength?: number;
}

interface DragData {
  type: 'email' | 'thread';
  id: string;
  threadId?: string;
  position?: number;
}

/**
 * Individual Email Item Component with Sortable functionality
 */
interface SortableEmailItemProps {
  email: EmailMessage;
  threadId: string;
  isSelected: boolean;
  isExpanded: boolean;
  showAttachments: boolean;
  showPreview: boolean;
  maxPreviewLength: number;
  onSelect: (emailId: string, isMultiple?: boolean) => void;
  onAction: (action: EmailAction, emailId: string) => void;
  onToggleExpand: (emailId: string) => void;
}

const SortableEmailItem: React.FC<SortableEmailItemProps> = React.memo(({
  email,
  threadId,
  isSelected,
  isExpanded,
  showAttachments,
  showPreview,
  maxPreviewLength,
  onSelect,
  onAction,
  onToggleExpand
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: email.id,
    data: {
      type: 'email',
      id: email.id,
      threadId,
      position: 0
    } satisfies DragData
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    onSelect(email.id, e.shiftKey || e.ctrlKey || e.metaKey);
  }, [email.id, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(email.id, e.shiftKey || e.ctrlKey || e.metaKey);
    } else if (e.key === 'ArrowRight' && !isExpanded) {
      e.preventDefault();
      onToggleExpand(email.id);
    } else if (e.key === 'ArrowLeft' && isExpanded) {
      e.preventDefault();
      onToggleExpand(email.id);
    }
  }, [email.id, isSelected, isExpanded, onSelect, onToggleExpand]);

  const truncatedPreview = useMemo(() => {
    if (!showPreview || !email.preview) return '';
    return email.preview.length > maxPreviewLength
      ? `${email.preview.substring(0, maxPreviewLength)}...`
      : email.preview;
  }, [email.preview, showPreview, maxPreviewLength]);

  const priorityClass = useMemo(() => {
    switch (email.priority || 'normal') {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  }, [email.priority]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        email-item ${isSelected ? 'selected' : ''} ${email.isRead ? 'read' : 'unread'}
        ${priorityClass} ${isDragging ? 'dragging' : ''}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
      aria-expanded={isExpanded}
      {...attributes}
      {...listeners}
    >
      {/* Drag Handle */}
      <div 
        className="drag-handle"
        aria-label="Drag to reorder email"
        {...listeners}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="3" cy="3" r="1"/>
          <circle cx="9" cy="3" r="1"/>
          <circle cx="3" cy="9" r="1"/>
          <circle cx="9" cy="9" r="1"/>
        </svg>
      </div>

      {/* Selection Checkbox */}
      <div className="email-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(email.id, false)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select email from ${email.from?.name || email.from?.email || email.sender}`}
        />
      </div>

      {/* Email Content */}
      <div className="email-content flex-1">
        {/* Header */}
        <div className="email-header">
          <div className="email-from">
            <span className="sender-name">
              {email.from?.name || email.from?.email || email.sender}
            </span>
            {email.from?.name && (
              <span className="sender-email text-muted">
                &lt;{email.from?.email || email.senderEmail}&gt;
              </span>
            )}
          </div>
          
          <div className="email-meta">
            <time 
              dateTime={email.receivedAt || email.date} 
              className="email-date"
              title={formatDate(email.receivedAt || email.date)}
            >
              {formatRelativeTime(email.receivedAt || email.date)}
            </time>
            
            {showAttachments && email.hasAttachments && (
              <span 
                className="attachment-indicator"
                title={`${email.attachmentCount || 1} attachment(s)`}
                aria-label={`${email.attachmentCount || 1} attachments`}
              >
                📎
              </span>
            )}
            
            {email.priority && email.priority !== 'normal' && (
              <span 
                className={`priority-indicator ${priorityClass}`}
                title={`Priority: ${email.priority}`}
                aria-label={`Priority: ${email.priority}`}
              >
                {email.priority === 'critical' ? '🔴' : 
                 email.priority === 'high' ? '🟠' : 
                 email.priority === 'low' ? '🔵' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="email-subject">
          <button
            className="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(email.id);
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse email' : 'Expand email'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="subject-text">{email.subject || '(No Subject)'}</span>
        </div>

        {/* Preview */}
        {showPreview && truncatedPreview && (
          <div className="email-preview text-muted">
            {truncatedPreview}
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="email-expanded-content">
            <div className="email-recipients">
              {email.to && email.to.length > 0 && (
                <div className="recipients-line">
                  <span className="label">To:</span>
                  <span className="recipients">
                    {email.to.map((recipient, index) => (
                      <React.Fragment key={recipient.email}>
                        {index > 0 && ', '}
                        <span className="recipient">
                          {recipient.name || recipient.email}
                        </span>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              )}
              
              {email.cc && email.cc.length > 0 && (
                <div className="recipients-line">
                  <span className="label">Cc:</span>
                  <span className="recipients">
                    {email.cc.map((recipient, index) => (
                      <React.Fragment key={recipient.email}>
                        {index > 0 && ', '}
                        <span className="recipient">
                          {recipient.name || recipient.email}
                        </span>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Attachments */}
            {showAttachments && email.hasAttachments && (
              <div className="email-attachments">
                <div className="attachments-label">Attachments:</div>
                <div className="attachments-list">
                  {email.attachments?.map((attachment) => (
                    <div key={attachment.id} className="attachment-item">
                      <span className="attachment-name">{attachment.filename}</span>
                      <span className="attachment-size text-muted">
                        ({Math.round(attachment.size / 1024)}KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Body Preview */}
            <div className="email-body">
              {email.textContent && (
                <div className="email-text-content">
                  {email.textContent.substring(0, 500)}
                  {email.textContent.length > 500 && '...'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="email-actions">
        <button
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            onAction('reply', email.id);
          }}
          title="Reply"
          aria-label="Reply to this email"
        >
          ↩️
        </button>
        
        <button
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            onAction('archive', email.id);
          }}
          title="Archive"
          aria-label="Archive this email"
        >
          📦
        </button>
        
        <button
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            onAction('delete', email.id);
          }}
          title="Delete"
          aria-label="Delete this email"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

SortableEmailItem.displayName = 'SortableEmailItem';

/**
 * Conversation Thread Component
 */
interface ConversationThreadProps {
  thread: ConversationThread;
  selectedEmailIds: string[];
  expandedEmailIds: string[];
  showAttachments: boolean;
  showPreview: boolean;
  maxPreviewLength: number;
  onEmailSelect: (emailId: string, isMultiple?: boolean) => void;
  onEmailAction: (action: EmailAction, emailId: string) => void;
  onEmailToggleExpand: (emailId: string) => void;
  onThreadCollapse: (threadId: string, collapsed: boolean) => void;
}

const ConversationThread: React.FC<ConversationThreadProps> = React.memo(({
  thread,
  selectedEmailIds,
  expandedEmailIds,
  showAttachments,
  showPreview,
  maxPreviewLength,
  onEmailSelect,
  onEmailAction,
  onEmailToggleExpand,
  onThreadCollapse
}) => {
  const sortedEmails = useMemo(() => 
    [...thread.emails].sort((a, b) => 
      new Date(a.receivedAt || a.date).getTime() - new Date(b.receivedAt || b.date).getTime()
    ), [thread.emails]
  );

  const threadStats = useMemo(() => ({
    totalEmails: thread.emails.length,
    unreadCount: thread.emails.filter(e => !e.isRead).length,
    hasAttachments: thread.emails.some(e => e.attachments && e.attachments.length > 0),
    latestDate: Math.max(...thread.emails.map(e => new Date(e.receivedAt || e.date).getTime()))
  }), [thread.emails]);

  const handleThreadToggle = useCallback(() => {
    onThreadCollapse(thread.id, !thread.isCollapsed);
  }, [thread.id, thread.isCollapsed, onThreadCollapse]);

  return (
    <div 
      className={`conversation-thread ${thread.isCollapsed ? 'collapsed' : 'expanded'}`}
      role="group"
      aria-label={`Email thread: ${thread.subject}`}
    >
      {/* Thread Header */}
      <div className="thread-header" onClick={handleThreadToggle}>
        <button
          className="thread-toggle"
          aria-expanded={!thread.isCollapsed}
          aria-label={thread.isCollapsed ? 'Expand thread' : 'Collapse thread'}
        >
          {thread.isCollapsed ? '▶' : '▼'}
        </button>
        
        <div className="thread-info">
          <div className="thread-subject">{thread.subject || '(No Subject)'}</div>
          <div className="thread-meta">
            <span className="email-count">
              {threadStats.totalEmails} email{threadStats.totalEmails !== 1 ? 's' : ''}
            </span>
            {threadStats.unreadCount > 0 && (
              <span className="unread-badge">
                {threadStats.unreadCount} unread
              </span>
            )}
            {threadStats.hasAttachments && (
              <span className="attachment-badge" title="Thread contains attachments">
                📎
              </span>
            )}
            <time 
              dateTime={new Date(threadStats.latestDate).toISOString()}
              className="latest-date"
            >
              {formatRelativeTime(new Date(threadStats.latestDate).toISOString())}
            </time>
          </div>
        </div>
      </div>

      {/* Thread Content */}
      {!thread.isCollapsed && (
        <div className="thread-content">
          <SortableContext 
            items={sortedEmails.map(email => email.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="thread-emails" role="list">
              {sortedEmails.map((email) => (
                <SortableEmailItem
                  key={email.id}
                  email={email}
                  threadId={thread.id}
                  isSelected={selectedEmailIds.includes(email.id)}
                  isExpanded={expandedEmailIds.includes(email.id)}
                  showAttachments={showAttachments}
                  showPreview={showPreview}
                  maxPreviewLength={maxPreviewLength}
                  onSelect={onEmailSelect}
                  onAction={onEmailAction}
                  onToggleExpand={onEmailToggleExpand}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  );
});

ConversationThread.displayName = 'ConversationThread';

/**
 * Main Threaded Conversation View Component
 */
export const ThreadedConversationView: React.FC<ThreadedConversationViewProps> = ({
  threads,
  selectedEmailIds,
  onEmailSelect,
  onEmailAction,
  onThreadCollapse,
  onEmailMove,
  onThreadReorder,
  className = '',
  showAttachments = true,
  showPreviews = true,
  enableVirtualization = false,
  maxPreviewLength = 150
}) => {
  const [expandedEmailIds, setExpandedEmailIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [dragData, setDragData] = useState<DragData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Virtualization setup (if enabled)
  const { 
    virtualItems, 
    totalSize, 
    scrollElementRef 
  } = useVirtualScroll({
    count: threads.length,
    getItemSize: useCallback((index: number) => {
      const thread = threads[index];
      if (thread.isCollapsed) return 80; // Collapsed height
      return 80 + (thread.emails.length * 120); // Header + emails
    }, [threads]),
    enabled: enableVirtualization
  }) as {
    virtualItems: Array<{ index: number; size: number; start: number }>;
    totalSize: number;
    scrollElementRef: React.RefObject<HTMLDivElement>;
  };

  // Email actions hook
  const { executeAction } = useEmailActions();

  // Handle email expand/collapse
  const handleEmailToggleExpand = useCallback((emailId: string) => {
    setExpandedEmailIds(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  }, []);

  // Handle email action
  const handleEmailAction = useCallback(async (action: EmailAction, emailId: string) => {
    try {
      await executeAction(action, [emailId]);
      onEmailAction(action, [emailId]);
    } catch (error) {
      console.error('Failed to execute email action:', error);
    }
  }, [executeAction, onEmailAction]);

  // Drag start handler
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    
    const data = active.data.current as DragData;
    setDragData(data);
  }, []);

  // Drag over handler
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeData = active.data.current as DragData;
    const overData = over.data.current as DragData;

    if (activeData.type === 'email' && overData?.type === 'email') {
      // Email reordering within or between threads
      if (activeData.threadId !== overData.threadId) {
        // Moving between threads - handled in drag end
      }
    }
  }, []);

  // Drag end handler
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setDragData(null);

    if (!over) return;

    const activeData = active.data.current as DragData;
    const overData = over.data.current as DragData;

    if (activeData.type === 'email' && overData?.type === 'email') {
      if (activeData.threadId === overData.threadId) {
        // Reordering within same thread
        const thread = threads.find(t => t.id === activeData.threadId);
        if (thread) {
          const oldIndex = thread.emails.findIndex(e => e.id === active.id);
          const newIndex = thread.emails.findIndex(e => e.id === over.id);
          
          if (oldIndex !== newIndex) {
            onEmailMove(active.id as string, activeData.threadId!, newIndex);
          }
        }
      } else {
        // Moving between threads
        const targetThread = threads.find(t => t.id === overData.threadId);
        if (targetThread) {
          const targetIndex = targetThread.emails.findIndex(e => e.id === over.id);
          onEmailMove(active.id as string, overData.threadId!, targetIndex);
        }
      }
    } else if (activeData.type === 'thread' && overData?.type === 'thread') {
      // Thread reordering
      const oldIndex = threads.findIndex(t => t.id === active.id);
      const newIndex = threads.findIndex(t => t.id === over.id);
      
      if (oldIndex !== newIndex) {
        onThreadReorder(active.id as string, newIndex);
      }
    }
  }, [threads, onEmailMove, onThreadReorder]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body && !(e.target as Element).closest('.threaded-conversation-view')) {
        return;
      }

      switch (e.key) {
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Select all visible emails
            const allEmailIds = threads.flatMap(t => t.emails.map(e => e.id));
            allEmailIds.forEach(id => onEmailSelect(id, true));
          }
          break;
        
        case 'Escape':
          // Clear selection
          setExpandedEmailIds([]);
          break;
          
        case 'Enter':
          if (selectedEmailIds.length === 1) {
            // Toggle expand first selected email
            handleEmailToggleExpand(selectedEmailIds[0]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [threads, selectedEmailIds, onEmailSelect, handleEmailToggleExpand]);

  const renderContent = () => {
    if (enableVirtualization) {
      return (
        <div
          ref={scrollElementRef}
          className="virtual-scroll-container"
          style={{
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const thread = threads[virtualRow.index];
              return (
                <div
                  key={thread.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConversationThread
                    thread={thread}
                    selectedEmailIds={selectedEmailIds}
                    expandedEmailIds={expandedEmailIds}
                    showAttachments={showAttachments}
                    showPreview={showPreviews}
                    maxPreviewLength={maxPreviewLength}
                    onEmailSelect={onEmailSelect}
                    onEmailAction={handleEmailAction}
                    onEmailToggleExpand={handleEmailToggleExpand}
                    onThreadCollapse={onThreadCollapse}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="threads-container">
        {threads.map((thread) => (
          <ConversationThread
            key={thread.id}
            thread={thread}
            selectedEmailIds={selectedEmailIds}
            expandedEmailIds={expandedEmailIds}
            showAttachments={showAttachments}
            showPreview={showPreviews}
            maxPreviewLength={maxPreviewLength}
            onEmailSelect={onEmailSelect}
            onEmailAction={handleEmailAction}
            onEmailToggleExpand={handleEmailToggleExpand}
            onThreadCollapse={onThreadCollapse}
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className={`threaded-conversation-view ${className}`}
      role="region"
      aria-label="Email conversations"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      >
        <SortableContext 
          items={threads.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {renderContent()}
        </SortableContext>

        <DragOverlay>
          {activeId && dragData ? (
            <div className="drag-overlay">
              {dragData.type === 'email' ? (
                <div className="dragging-email">
                  📧 Moving email...
                </div>
              ) : (
                <div className="dragging-thread">
                  💬 Moving thread...
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {threads.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-title">No conversations</div>
          <div className="empty-description">
            Your email conversations will appear here when you receive messages.
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadedConversationView;
