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
