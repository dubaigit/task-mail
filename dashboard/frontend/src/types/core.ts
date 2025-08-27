export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  URGENT = 'URGENT'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
  WAITING_FOR_REPLY = 'WAITING_FOR_REPLY',
  DELEGATED = 'DELEGATED',
  DEFERRED = 'DEFERRED',
  REVIEW = 'REVIEW',
  CANCELLED = 'CANCELLED'
}

export enum TaskCategory {
  EMAIL_RELATED = 'EMAIL_RELATED',
  MEETING = 'MEETING',
  PROJECT_WORK = 'PROJECT_WORK',
  ADMIN = 'ADMIN',
  PERSONAL = 'PERSONAL',
  FOLLOW_UP = 'FOLLOW_UP',
  RESEARCH = 'RESEARCH',
  DEVELOPMENT = 'DEVELOPMENT',
  REVIEW = 'REVIEW',
  BUG_FIX = 'BUG_FIX',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  DO_MYSELF = 'DO_MYSELF',
  NEEDS_REPLY = 'NEEDS_REPLY'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category?: TaskCategory;
  tags: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Optional fields
  sender?: string;
  senderEmail?: string;
  emailSubject?: string;
  aiConfidence?: number;
  confidence?: number;
  draftGenerated?: boolean;
  snippet?: string;
  suggestedAction?: string;
  suggestedActions?: string[];
  relatedEmailId?: string;
  relatedEmails?: string[];
  estimatedTime?: number;
  actualTime?: number;
  progress?: number;
  urgency: TaskPriority;
  emailId?: string;
  createdFromMessageId?: string;
  assignedTo?: string;
  createdBy?: string;
  classification?: string;
  estimatedDuration?: number;
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[] | 'all';
  priority?: TaskPriority | TaskPriority[] | 'all';
  category?: TaskCategory | TaskCategory[];
  tags?: string[] | string;
  search?: string;
  sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'urgency' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  showCompleted?: boolean;
  dueDateRange?: {
    start?: string;
    end?: string;
  };
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<TaskCategory | string, number>;
  lastUpdated: string;
  completedThisWeek: number;
  completedThisMonth: number;
  averageCompletionTime: number;
  productivityScore: number;
}

export const DEFAULT_TASK_VALUES = {
  status: TaskStatus.TODO,
  priority: TaskPriority.MEDIUM,
  category: TaskCategory.PROJECT_WORK,
  tags: [],
  urgency: TaskPriority.MEDIUM
};

// Add missing exports
export const PRIORITY_ORDER = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT, TaskPriority.CRITICAL];
export const STATUS_ORDER = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.COMPLETED];
export const TASK_COLORS = {
  [TaskPriority.LOW]: 'bg-green-100 text-green-800',
  [TaskPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800',
  [TaskPriority.HIGH]: 'bg-orange-100 text-orange-800',
  [TaskPriority.URGENT]: 'bg-red-100 text-red-800',
  [TaskPriority.CRITICAL]: 'bg-purple-100 text-purple-800'
};

// Add missing interfaces
export interface SubTask {
  id: string;
  parentTaskId: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  text: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedDuration?: number; // minutes
  assignedTo?: string;
  deadline?: string;
  completed: boolean;
}

export interface Deadline {
  id: string;
  text: string;
  date: string;
  priority: TaskPriority;
  source: 'EXPLICIT' | 'INFERRED';
}

// Add missing type guards
export const isTaskStatus = (value: any): value is TaskStatus => Object.values(TaskStatus).includes(value);
export const isTaskPriority = (value: any): value is TaskPriority => Object.values(TaskPriority).includes(value);
export const isTaskCategory = (value: any): value is TaskCategory => Object.values(TaskCategory).includes(value);
export const isTask = (value: any): value is Task => value && typeof value === 'object' && 'id' in value && 'title' in value;
