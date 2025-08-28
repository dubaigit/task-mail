/**
 * Task Types - Unified Interface
 * Re-exports from core types with backward compatibility
 * 
 * @deprecated Individual imports - import from core types instead
 * This file maintains backward compatibility but new code should use:
 * import { Task, TaskStatus, TaskPriority } from './core';
 */

// Import and re-export unified types
export type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskFilters,
  TaskStats,
  SubTask,
  TaskComment,
  ActionItem,
  Deadline
} from './core';

export {
  DEFAULT_TASK_VALUES,
  PRIORITY_ORDER,
  STATUS_ORDER,
  TASK_COLORS,
  isTaskStatus,
  isTaskPriority,
  isTaskCategory,
  isTask
} from './core';

// Import migration utilities
export {
  migrateTaskStatus,
  migrateTaskPriority,
  migrateTaskCategory,
  migrateTaskObject,
  migrateTasks,
  MigrationUtils
} from './core/migrations';

// Import validation utilities
export {
  validateTask,
  validateTaskFilters,
  validateTasks,
  ValidationUtils,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning
} from './core/validation';

// ==========================================
// LEGACY TYPE ALIASES FOR BACKWARD COMPATIBILITY
// ==========================================

/**
 * @deprecated Use TaskStatus enum instead
 * Legacy type alias for string union - will be removed in v3.0
 */
export type LegacyTaskStatus = 'todo' | 'in-progress' | 'completed' | 'cancelled';

/**
 * @deprecated Use TaskPriority enum instead
 * Legacy type alias for string union - will be removed in v3.0
 */
export type LegacyTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * @deprecated Use Task interface from core instead
 * Legacy interface shape - will be removed in v3.0
 */
export interface LegacyTask {
  id: string;
  title: string;
  description?: string;
  priority: LegacyTaskPriority;
  status: LegacyTaskStatus;
  tags?: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedTime?: number;
  actualTime?: number;
  assignedTo?: string;
  createdFromMessageId?: string;
  aiConfidence?: number;
  classification?: string;
}

/**
 * @deprecated Use TaskFilters from core instead
 * Legacy filters interface - will be removed in v3.0
 */
export interface LegacyTaskFilters {
  status?: LegacyTaskStatus | 'all';
  priority?: LegacyTaskPriority | 'all';
  search?: string;
  tags?: string[];
  assignedTo?: string;
  dueDateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'priority' | 'dueDate' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * @deprecated Use TaskStats from core instead
 * Legacy stats interface - will be removed in v3.0
 */
export interface LegacyTaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
}