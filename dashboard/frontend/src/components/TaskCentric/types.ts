// Task-Centric Interface Type Definitions
// Implementation of whitepaper specifications for three-panel task-centric interface

export interface TaskCentricEmail {
  id: number;
  subject: string;
  sender: string;
  senderEmail: string;
  recipient?: string;
  date: string;
  classification: string;
  urgency: TaskUrgencyLevel;
  confidence: number;
  has_draft: boolean;
  preview?: string;
  content?: string;
  isRead?: boolean;
  isStarred?: boolean;
  tags?: string[];
  estimatedResponseTime?: string;
  // Colleague tracking fields for "Waiting for Reply" workflow
  to_addresses?: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  // Task-specific properties
  actionItems?: ActionItem[];
  deadlines?: Deadline[];
  assignedTo?: string[];
  relatedTasks?: number[];
}

export type TaskUrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskCategory = 
  | 'NEEDS_REPLY'
  | 'APPROVAL_REQUIRED'
  | 'DELEGATE'
  | 'DO_MYSELF'
  | 'ASSIGN'
  | 'FOLLOW_UP'
  | 'FYI_ONLY'
  | 'MEETING_REQUEST'
  | 'RESEARCH'
  | 'ADMINISTRATIVE';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING_FOR_REPLY' | 'COMPLETED' | 'CANCELLED';

// Kanban-specific types for the task board interface
export type KanbanTaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING_FOR_REPLY' | 'DONE';

export const TaskStatus = {
  TODO: 'TODO' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  WAITING_FOR_REPLY: 'WAITING_FOR_REPLY' as const,
  DONE: 'DONE' as const,
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: KanbanTaskStatus;
  urgency: TaskUrgencyLevel;
  priority: TaskUrgencyLevel; // Alias for urgency
  assignedTo?: string;
  assignedBy?: string;
  assignee?: string; // Alias for assignedTo
  dueDate?: string;
  createdAt: string;
  progress: number;
  tags: string[];
  email: TaskCentricEmail;
  confidence: number;
  confidenceScore: number; // Alias for confidence
}

export interface KanbanTaskItem extends KanbanTask {
  // Alias for compatibility
}

export interface TaskItem {
  id: number;
  title: string;
  description: string;
  category: TaskCategory;
  urgency: TaskUrgencyLevel;
  status: TaskStatus;
  estimatedDuration?: number; // in minutes
  actualDuration?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  assignedTo?: string;
  assignedBy?: string;
  emailId: number;
  relatedEmailIds?: number[];
  progress: number; // 0-100
  tags?: string[];
  // AI-generated insights
  aiConfidence: number;
  aiReasoning: string;
  suggestedActions?: string[];
  dependencies?: number[];
  blockers?: string[];
}

export interface ActionItem {
  id: number;
  text: string;
  type: 'action' | 'decision' | 'follow_up' | 'deadline';
  assignee?: string;
  dueDate?: string;
  completed: boolean;
  aiExtracted: boolean;
  confidence: number;
}

export interface Deadline {
  id: number;
  description: string;
  date: string;
  urgency: TaskUrgencyLevel;
  type: 'hard' | 'soft' | 'preferred';
  source: 'explicit' | 'inferred' | 'ai_predicted';
  confidence: number;
}

export interface TaskCentricDraft {
  id: number;
  emailId: number;
  taskId?: number;
  content: string;
  subject: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  confidence: number;
  tone: 'formal' | 'casual' | 'urgent' | 'friendly' | 'direct';
  style: 'concise' | 'detailed' | 'bullet_points' | 'narrative';
  aiGenerated: boolean;
  templateUsed?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready_to_send' | 'sent' | 'discarded';
  revisionCount: number;
  userFeedback?: DraftFeedback;
}

export interface DraftFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  comments?: string;
  improveInstructions?: string;
  acceptedVersion?: number;
}

export interface TaskFilter {
  categories: TaskCategory[];
  urgencyLevels: TaskUrgencyLevel[];
  statuses: TaskStatus[];
  assignedTo?: string[];
  dueDateRange?: {
    start?: string;
    end?: string;
  };
  searchQuery?: string;
  tags?: string[];
  showCompleted: boolean;
  sortBy: 'dueDate' | 'urgency' | 'createdAt' | 'title' | 'assignee';
  sortOrder: 'asc' | 'desc';
}

export interface TaskPanelConfig {
  showLeftPanel: boolean;
  showCenterPanel: boolean;
  showRightPanel: boolean;
  leftPanelWidth: number; // pixels
  centerPanelWidth: number; // pixels
  // rightPanel takes remaining space (flex: 1)
  collapsedLeftPanel: boolean;
  collapsedRightPanel: boolean;
  selectedView: 'list' | 'board' | 'calendar' | 'timeline';
  compactMode: boolean;
  autoExpandDetails: boolean;
}

export interface TaskNavigationCategory {
  id: string;
  label: string;
  icon: string; // Icon component name
  count: number;
  color?: string;
  subcategories?: TaskNavigationSubcategory[];
  collapsed?: boolean;
  customFilter?: TaskFilter;
}

export interface TaskNavigationSubcategory {
  id: string;
  label: string;
  count: number;
  filter: Partial<TaskFilter>;
}

export interface TaskCardConfig {
  showAvatar: boolean;
  showPreview: boolean;
  showTags: boolean;
  showProgress: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showUrgencyIndicator: boolean;
  expandedByDefault: boolean;
  maxPreviewLength: number;
  enableQuickActions: boolean;
  enableDragAndDrop: boolean;
}

export interface TaskPanelProps {
  tasks: TaskItem[];
  selectedTask: TaskItem | null;
  onTaskSelect: (task: TaskItem | null) => void;
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  config: TaskPanelConfig;
  onConfigChange: (config: TaskPanelConfig) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export interface TaskDetailPanelProps {
  task: TaskItem | null;
  email: TaskCentricEmail | null;
  drafts: TaskCentricDraft[];
  onTaskUpdate: (task: TaskItem) => void;
  onDraftCreate: (task: TaskItem) => void;
  onDraftUpdate: (draft: TaskCentricDraft) => void;
  onDraftSend: (draft: TaskCentricDraft) => void;
  isGeneratingDraft: boolean;
  className?: string;
}

export interface TaskNavigationPanelProps {
  categories: TaskNavigationCategory[];
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export interface TaskListPanelProps {
  tasks: TaskItem[];
  selectedTask: TaskItem | null;
  onTaskSelect: (task: TaskItem) => void;
  filter: TaskFilter;
  config: TaskCardConfig;
  onTaskUpdate: (task: TaskItem) => void;
  onTaskComplete: (taskId: number) => void;
  onTaskDelete: (taskId: number) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export interface TaskCardProps {
  task: TaskItem;
  email?: TaskCentricEmail;
  isSelected: boolean;
  onClick: (task: TaskItem) => void;
  onUpdate: (task: TaskItem) => void;
  onComplete: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  config: TaskCardConfig;
  className?: string;
}

// Performance and Analytics
export interface TaskCentricMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  averageCompletionTime: number; // minutes
  categoryCounts: Record<TaskCategory, number>;
  urgencyCounts: Record<TaskUrgencyLevel, number>;
  productivityScore: number; // 0-100
  aiAccuracyScore: number; // 0-100
  lastUpdated: string;
}

export interface TaskCentricPerformance {
  renderTime: number;
  memoryUsage: number;
  taskLoadTime: number;
  searchResponseTime: number;
  filterResponseTime: number;
  virtualScrollPerformance: {
    visibleItems: number;
    totalItems: number;
    scrollFps: number;
  };
}

// Error handling
export interface TaskCentricError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  recoverable: boolean;
  userMessage: string;
}

// Theme and styling
export interface TaskCentricTheme {
  urgencyColors: Record<TaskUrgencyLevel, string>;
  categoryColors: Record<TaskCategory, string>;
  statusColors: Record<TaskStatus, string>;
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    card: string;
    hover: string;
    selected: string;
  };
}