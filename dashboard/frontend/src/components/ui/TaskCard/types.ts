import { Task, TaskStatus, TaskPriority } from '../../../types/Task';

export interface TaskCentricEmail {
  sender: string;
  senderEmail: string;
  subject: string;
  messageId: string;
}

export interface TaskCardConfig {
  // Layout variations
  layout: 'compact' | 'detailed' | 'business' | 'minimal';
  
  // Feature toggles
  features: {
    urgencyIndicator?: boolean;
    progressBar?: boolean;
    quickActions?: boolean;
    expandableActions?: boolean;
    inlineEditing?: boolean;
    importanceScore?: boolean;
    avatar?: boolean;
    tags?: boolean;
    dueDate?: boolean;
    assignee?: boolean;
    metadata?: boolean;
    relatedEmailLink?: boolean;
    statusBadge?: boolean;
    aiConfidence?: boolean;
    relatedEmailsCount?: boolean;
    estimatedTime?: boolean;
    draftStatus?: boolean;
  };
  
  // Visual options
  visual: {
    urgencySystem: 'four-tier' | 'three-tier'; // CRITICAL/HIGH/MEDIUM/LOW vs urgent/high/medium
    colorScheme: 'professional' | 'urgency-based' | 'category-based';
    pulseAnimation?: boolean;
    hoverEffects?: boolean;
    darkMode?: boolean;
    compactSpacing?: boolean;
    centerAlignment?: boolean;
  };
  
  // Behavior
  behavior: {
    expandedByDefault?: boolean;
    enableKeyboardShortcuts?: boolean;
    enableDragDrop?: boolean;
    clickToExpand?: boolean;
    showActionsOnHover?: boolean;
  };
  
  // Content limits
  limits: {
    maxPreviewLength?: number;
    maxTagsShown?: number;
    characterLimit?: number;
  };
}

export interface UnifiedTaskCardProps {
  // Core data
  task: Task;
  email?: TaskCentricEmail;
  
  // Configuration
  config?: TaskCardConfig;
  variant?: 'centric' | 'management' | 'business' | 'custom';
  
  // State
  isSelected?: boolean;
  isEditing?: boolean;
  index?: number;
  
  // Event handlers
  onClick: (task: Task) => void;
  onUpdate?: (task: Task) => Promise<void>;
  onComplete?: (taskId: string) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (taskId: string, field: string, value: any) => Promise<void>;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onPriorityChange?: (taskId: string, priority: TaskPriority) => void;
  onSelect?: (taskId: string) => void;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
}

export interface UrgencyConfig {
  color: string;
  bgColor: string;
  darkBgColor?: string;
  icon: React.ComponentType<any>;
  label: string;
  pulse: boolean;
}

export interface StatusConfig {
  color: string;
  bgColor: string;
  icon: React.ComponentType<any>;
  label: string;
}

// Legacy prop interfaces for backward compatibility
export interface LegacyTaskCentricProps {
  task: any;
  email?: TaskCentricEmail;
  isSelected?: boolean;
  onClick: (task: any) => void;
  onUpdate: (task: any) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  config: any;
  className?: string;
}

export interface LegacyTaskManagementProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  index?: number;
  isSelected?: boolean;
  onSelect?: (taskId: string) => void;
}

export interface LegacyUITaskCardProps {
  task: any;
  onStatusChange?: (taskId: string, status: any) => void;
  onPriorityChange?: (taskId: string, priority: any) => void;
  onClick?: (task: any) => void;
}