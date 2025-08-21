import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  TaskDetailPanelProps,
  TaskItem,
  TaskCentricEmail,
  TaskCentricDraft,
  TaskStatus,
  TaskUrgencyLevel
} from './types';
import {
  ClockIcon,
  UserIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import {
  BookmarkIcon as BookmarkSolidIcon,
  StarIcon as StarSolidIcon
} from '@heroicons/react/24/solid';

/**
 * TaskDetailPanel - Right panel for detailed task information and draft composition
 * 
 * BRIEF_RATIONALE: Implements whitepaper-specified right panel with full email thread
 * access, extracted action items, deadline information, and AI-powered draft composition.
 * Supports conversational AI refinement and contextual task management.
 * 
 * ASSUMPTIONS:
 * - Tasks contain extracted action items and AI-generated insights
 * - Email thread context is available for draft composition
 * - AI draft generation supports iterative refinement with user feedback
 * - Task updates are real-time synchronized across interface
 * 
 * DECISION_LOG:
 * - Used tabbed interface for task details, email context, and draft composition
 * - Implemented AI confidence indicators and reasoning display
 * - Added conversational draft refinement with specific instruction support
 * - Integrated task progress tracking and deadline management
 * 
 * EVIDENCE: Based on whitepaper right panel specifications for comprehensive
 * task detail view with integrated email context and AI-powered workflows.
 */

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  email,
  drafts,
  onTaskUpdate,
  onDraftCreate,
  onDraftUpdate,
  onDraftSend,
  isGeneratingDraft,
  className = ''
}) => {
  // Local state for panel interactions
  const [activeTab, setActiveTab] = useState<'details' | 'email' | 'drafts'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<TaskItem | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<TaskCentricDraft | null>(null);
  const [draftInstructions, setDraftInstructions] = useState('');
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Refs for scroll management
  const detailsRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const draftsRef = useRef<HTMLDivElement>(null);

  // Task progress and status management
  const handleTaskStatusChange = useCallback(async (newStatus: TaskStatus) => {
    if (!task) return;
    
    const updatedTask = {
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'COMPLETED' && { 
        completedAt: new Date().toISOString(),
        progress: 100
      })
    };
    
    await onTaskUpdate(updatedTask);
  }, [task, onTaskUpdate]);

  const handleProgressUpdate = useCallback(async (progress: number) => {
    if (!task) return;
    
    const updatedTask = {
      ...task,
      progress: Math.min(100, Math.max(0, progress)),
      updatedAt: new Date().toISOString(),
      ...(progress === 100 && { 
        status: 'COMPLETED' as TaskStatus,
        completedAt: new Date().toISOString()
      })
    };
    
    await onTaskUpdate(updatedTask);
  }, [task, onTaskUpdate]);

  // Edit task details
  const handleStartEdit = useCallback(() => {
    if (!task) return;
    setEditedTask({ ...task });
    setIsEditing(true);
  }, [task]);

  const handleSaveEdit = useCallback(async () => {
    if (!editedTask) return;
    
    const updatedTask = {
      ...editedTask,
      updatedAt: new Date().toISOString()
    };
    
    await onTaskUpdate(updatedTask);
    setIsEditing(false);
    setEditedTask(null);
  }, [editedTask, onTaskUpdate]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedTask(null);
  }, []);

  // Draft management
  const handleCreateDraft = useCallback(async () => {
    if (!task) return;
    await onDraftCreate(task);
  }, [task, onDraftCreate]);

  const handleRefineDraft = useCallback(async () => {
    if (!selectedDraft || !draftInstructions.trim()) return;
    
    const refinedDraft = {
      ...selectedDraft,
      content: selectedDraft.content + `\n\n[Refinement: ${draftInstructions}]`,
      revisionCount: selectedDraft.revisionCount + 1,
      updatedAt: new Date().toISOString()
    };
    
    await onDraftUpdate(refinedDraft);
    setDraftInstructions('');
  }, [selectedDraft, draftInstructions, onDraftUpdate]);

  // Render urgency indicator
  const renderUrgencyIndicator = (urgency: TaskUrgencyLevel) => {
    const configs = {
      CRITICAL: { color: '#DC2626', label: 'Critical', pulse: true },
      HIGH: { color: '#EA580C', label: 'High', pulse: false },
      MEDIUM: { color: '#2563EB', label: 'Medium', pulse: false },
      LOW: { color: '#6B7280', label: 'Low', pulse: false }
    };
    
    const config = configs[urgency] || configs.LOW;
    
    return (
      <div 
        className={`urgency-indicator ${config.pulse ? 'pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      >
        <ExclamationTriangleIcon className="w-4 h-4 text-white" />
        <span className="urgency-label text-white">{config.label}</span>
      </div>
    );
  };

  // Render task details tab
  const renderTaskDetails = () => {
    if (!task) return null;

    return (
      <div ref={detailsRef} className="task-details-content">
        {/* Task Header */}
        <div className="task-header">
          <div className="task-title-section">
            {isEditing ? (
              <input
                type="text"
                value={editedTask?.title || ''}
                onChange={(e) => setEditedTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                className="task-title-input"
                placeholder="Task title"
              />
            ) : (
              <h1 className="task-title">{task.title}</h1>
            )}
            
            <div className="task-meta">
              {renderUrgencyIndicator(task.urgency)}
              <div className="task-category">
                <TagIcon className="w-4 h-4" />
                <span>{task.category.replace('_', ' ')}</span>
              </div>
              <div className="task-created">
                <ClockIcon className="w-4 h-4" />
                <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="task-actions">
            {isEditing ? (
              <>
                <button onClick={handleSaveEdit} className="save-button">
                  <CheckCircleIcon className="w-4 h-4" />
                  Save
                </button>
                <button onClick={handleCancelEdit} className="cancel-button">
                  <XMarkIcon className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={handleStartEdit} className="edit-button">
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </button>
                <button className="bookmark-button">
                  <BookmarkSolidIcon className="w-4 h-4" />
                </button>
                <button className="share-button">
                  <ShareIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Task Status and Progress */}
        <div className="task-status-section">
          <div className="status-controls">
            <label className="control-label">Status</label>
            <select
              value={task.status}
              onChange={(e) => handleTaskStatusChange(e.target.value as TaskStatus)}
              className="status-select"
              disabled={isEditing}
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING">Waiting</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="progress-controls">
            <label className="control-label">Progress</label>
            <div className="progress-input-container">
              <input
                type="range"
                min="0"
                max="100"
                value={task.progress}
                onChange={(e) => handleProgressUpdate(Number(e.target.value))}
                className="progress-slider"
                disabled={isEditing}
              />
              <span className="progress-percentage">{task.progress}%</span>
            </div>
          </div>
        </div>

        {/* Task Description */}
        <div className="task-description-section">
          <label className="section-label">Description</label>
          {isEditing ? (
            <textarea
              value={editedTask?.description || ''}
              onChange={(e) => setEditedTask(prev => prev ? { ...prev, description: e.target.value } : null)}
              className="task-description-input"
              rows={4}
              placeholder="Task description"
            />
          ) : (
            <p className="task-description">{task.description}</p>
          )}
        </div>

        {/* Task Metadata */}
        <div className="task-metadata">
          <div className="metadata-grid">
            {task.dueDate && (
              <div className="metadata-item">
                <CalendarDaysIcon className="w-4 h-4" />
                <span className="metadata-label">Due Date</span>
                <span className="metadata-value">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {task.assignedTo && (
              <div className="metadata-item">
                <UserIcon className="w-4 h-4" />
                <span className="metadata-label">Assigned To</span>
                <span className="metadata-value">{task.assignedTo}</span>
              </div>
            )}
            
            {task.estimatedDuration && (
              <div className="metadata-item">
                <ClockIcon className="w-4 h-4" />
                <span className="metadata-label">Estimated</span>
                <span className="metadata-value">{task.estimatedDuration} min</span>
              </div>
            )}
            
            {task.tags && task.tags.length > 0 && (
              <div className="metadata-item">
                <TagIcon className="w-4 h-4" />
                <span className="metadata-label">Tags</span>
                <div className="task-tags">
                  {task.tags.map((tag, index) => (
                    <span key={index} className="task-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Insights */}
        {showAIInsights && (
          <div className="ai-insights-section">
            <div className="section-header">
              <div className="section-title">
                <SparklesIcon className="w-5 h-5" />
                <span>AI Insights</span>
              </div>
              <button 
                onClick={() => setShowAIInsights(false)}
                className="toggle-button"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="ai-insights-content">
              <div className="confidence-indicator">
                <span className="confidence-label">Confidence:</span>
                <span className="confidence-value">{Math.round(task.aiConfidence * 100)}%</span>
              </div>
              
              <div className="ai-reasoning">
                <p>{task.aiReasoning}</p>
              </div>
              
              {task.suggestedActions && task.suggestedActions.length > 0 && (
                <div className="suggested-actions">
                  <h4>Suggested Actions</h4>
                  <ul>
                    {task.suggestedActions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {task.blockers && task.blockers.length > 0 && (
                <div className="blockers">
                  <h4>Potential Blockers</h4>
                  <ul>
                    {task.blockers.map((blocker, index) => (
                      <li key={index} className="blocker-item">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render email context tab
  const renderEmailContext = () => {
    if (!email) {
      return (
        <div className="empty-email-state">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-muted-foreground" />
          <h3>No email context</h3>
          <p>This task is not associated with an email</p>
        </div>
      );
    }

    return (
      <div ref={emailRef} className="email-context-content">
        {/* Email Header */}
        <div className="email-header">
          <h2 className="email-subject">{email.subject}</h2>
          <div className="email-meta">
            <span className="email-sender">{email.sender}</span>
            <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
            <span className={`email-classification ${email.classification.toLowerCase()}`}>
              {email.classification.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Email Content */}
        <div className="email-content">
          <div 
            className="email-body"
            dangerouslySetInnerHTML={{ __html: email.content || '' }}
          />
        </div>

        {/* Email Actions */}
        <div className="email-actions">
          <button className="email-action-button">
            <EyeIcon className="w-4 h-4" />
            View Full Thread
          </button>
          <button className="email-action-button">
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            Reply
          </button>
        </div>
      </div>
    );
  };

  // Render drafts tab
  const renderDrafts = () => {
    return (
      <div ref={draftsRef} className="drafts-content">
        {/* Drafts Header */}
        <div className="drafts-header">
          <h3>AI Draft Responses</h3>
          <button
            onClick={handleCreateDraft}
            disabled={isGeneratingDraft}
            className="create-draft-button"
          >
            {isGeneratingDraft ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
            {isGeneratingDraft ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>

        {/* Drafts List */}
        {drafts.length > 0 ? (
          <div className="drafts-list">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={`draft-item ${selectedDraft?.id === draft.id ? 'selected' : ''}`}
                onClick={() => setSelectedDraft(draft)}
              >
                <div className="draft-header">
                  <div className="draft-meta">
                    <span className="draft-id">Draft #{draft.id}</span>
                    <span className="draft-confidence">
                      {Math.round(draft.confidence * 100)}% confidence
                    </span>
                    <span className="draft-date">
                      {new Date(draft.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="draft-status">
                    <span className={`status-badge ${draft.status}`}>
                      {draft.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="draft-preview">
                  <p>{draft.content.substring(0, 150)}...</p>
                </div>
                
                <div className="draft-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDraftSend(draft);
                    }}
                    className="draft-action-button send"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDraft(draft);
                    }}
                    className="draft-action-button edit"
                  >
                    <PencilIcon className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-drafts-state">
            <PaperAirplaneIcon className="w-12 h-12 text-muted-foreground" />
            <h3>No drafts generated</h3>
            <p>Generate AI-powered draft responses for this task</p>
          </div>
        )}

        {/* Draft Composition */}
        {selectedDraft && (
          <div className="draft-composition">
            <div className="draft-content">
              <h4>Draft Content</h4>
              <div className="draft-text">
                <pre>{selectedDraft.content}</pre>
              </div>
            </div>
            
            <div className="draft-refinement">
              <h4>Refine Draft</h4>
              <textarea
                value={draftInstructions}
                onChange={(e) => setDraftInstructions(e.target.value)}
                placeholder="Provide specific instructions to refine this draft (e.g., 'Make it more formal', 'Add technical details', 'Shorten the response')"
                className="refinement-input"
                rows={3}
              />
              <button
                onClick={handleRefineDraft}
                disabled={!draftInstructions.trim() || isGeneratingDraft}
                className="refine-button"
              >
                <SparklesIcon className="w-4 h-4" />
                Refine Draft
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // No task selected state
  if (!task) {
    return (
      <div className={`task-detail-panel empty ${className}`}>
        <div className="empty-state">
          <DocumentTextIcon className="w-16 h-16 text-muted-foreground" />
          <h2>Select a task</h2>
          <p>Choose a task from the list to view details and manage drafts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-detail-panel ${className}`}>
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('details')}
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          Details
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
          Email Context
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`tab-button ${activeTab === 'drafts' ? 'active' : ''}`}
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          Drafts
          {drafts.length > 0 && (
            <span className="tab-badge">{drafts.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'details' && renderTaskDetails()}
        {activeTab === 'email' && renderEmailContext()}
        {activeTab === 'drafts' && renderDrafts()}
      </div>
    </div>
  );
};

export default React.memo(TaskDetailPanel);