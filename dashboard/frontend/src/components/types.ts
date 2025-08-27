// Re-export types for component usage
export {
  TaskStatus,
  TaskPriority,
  TaskCategory,
  type Task,
  type TaskFilters,
  type TaskStats,
  type SubTask,
  type TaskComment,
  type ActionItem,
  type Deadline,
  DEFAULT_TASK_VALUES,
  PRIORITY_ORDER,
  STATUS_ORDER,
  TASK_COLORS,
  isTaskStatus,
  isTaskPriority,
  isTaskCategory,
  isTask
} from '../types/core';

export type {
  EmailMessage,
  EmailClassification,
  EmailUrgency,
  EmailSentiment,
  AIAnalysis,
  SuggestedAction,
  IntelligentEmail,
  AIUsageMetrics,
  TaskItem,
  EmailDraft
} from '../types';