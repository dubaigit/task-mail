// Main exports
// CSS Import
import './TaskCard.css';

export { UnifiedTaskCard } from '../UnifiedTaskCard';
export { UnifiedTaskCard as TaskCard } from '../UnifiedTaskCard';

// Types
export type {
  TaskCardConfig,
  UnifiedTaskCardProps,
  TaskCentricEmail,
  UrgencyConfig,
  StatusConfig
} from './types';

// Presets
export { TaskCardPresets, getPresetConfig } from './presets';

// Components (for advanced customization)
export { TaskCardHeader } from './components/TaskCardHeader';
export { TaskCardContent } from './components/TaskCardContent';
export { TaskCardFooter } from './components/TaskCardFooter';
export { QuickActions } from './components/QuickActions';
export { UrgencyBadge } from './components/UrgencyBadge';
export { StatusBadge } from './components/StatusBadge';
export { ImportanceScore } from './components/ImportanceScore';
export { ProgressBar } from './components/ProgressBar';
export { DueDateDisplay } from './components/DueDateDisplay';
export { AssigneeDisplay } from './components/AssigneeDisplay';
export { TagsList } from './components/TagsList';
export { TaskMetadata } from './components/TaskMetadata';
export { EmailLink } from './components/EmailLink';
export { BusinessMetrics } from './components/BusinessMetrics';
export { EditableTitle } from './components/EditableTitle';
export { EditableDescription } from './components/EditableDescription';
export { ExpandedActions } from './components/ExpandedActions';
export { LoadingOverlay } from './components/LoadingOverlay';

// Hooks
export { useTaskCardState } from './hooks/useTaskCardState';

// Utilities
export {
  cn,
  getUrgencyConfig,
  getStatusConfig,
  getLayoutClass,
  getThemeClass,
  calculateImportanceScore,
  getCategoryIcon,
  getProfessionalColors
} from './utils/styling';

export {
  formatDueDate,
  formatRelativeTime,
  formatShortDate,
  isOverdue
} from './utils/dateHelpers';