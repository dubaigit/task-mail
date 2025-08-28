import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarDaysIcon,
  FireIcon,
  BoltIcon,
  Icons
} from '../../icons';
import { Circle, Star } from 'lucide-react';
import { Task } from '../../../../types/Task';
import { TaskStatus, TaskPriority } from '../../../../types/core';
import { TaskCardConfig, UrgencyConfig, StatusConfig } from '../types';

// Utility for class name merging
export const cn = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Get urgency configuration based on task priority and visual settings
export const getUrgencyConfig = (priority: TaskPriority | string, visual: TaskCardConfig['visual']): UrgencyConfig => {
  const configs = {
    // Four-tier system (TaskCentric style)
    fourTier: {
      CRITICAL: {
        color: '#DC2626', // red-600
        bgColor: '#FEE2E2', // red-100
        darkBgColor: '#7F1D1D', // red-900
        icon: FireIcon,
        label: 'Critical',
        pulse: true
      },
      HIGH: {
        color: '#EA580C', // orange-600
        bgColor: '#FED7AA', // orange-100
        darkBgColor: '#9A3412', // orange-900
        icon: ExclamationTriangleIcon,
        label: 'High',
        pulse: false
      },
      MEDIUM: {
        color: '#2563EB', // blue-600
        bgColor: '#DBEAFE', // blue-100
        darkBgColor: '#1E3A8A', // blue-900
        icon: BoltIcon,
        label: 'Medium',
        pulse: false
      },
      LOW: {
        color: '#6B7280', // gray-500
        bgColor: '#F3F4F6', // gray-100
        darkBgColor: '#374151', // gray-700
        icon: ClockIcon,
        label: 'Low',
        pulse: false
      }
    },
    // Three-tier system (TaskManagement style)
    threeTier: {
      urgent: {
        color: '#DC2626', // red-600
        bgColor: '#FEE2E2', // red-100
        darkBgColor: '#7F1D1D', // red-900
        icon: ExclamationTriangleIcon,
        label: 'Urgent',
        pulse: true
      },
      high: {
        color: '#EA580C', // orange-600
        bgColor: '#FED7AA', // orange-100
        darkBgColor: '#9A3412', // orange-900
        icon: ExclamationTriangleIcon,
        label: 'High',
        pulse: false
      },
      medium: {
        color: '#D97706', // amber-600
        bgColor: '#FEF3C7', // amber-100
        darkBgColor: '#92400E', // amber-800
        icon: BoltIcon,
        label: 'Medium',
        pulse: false
      },
      low: {
        color: '#059669', // emerald-600
        bgColor: '#D1FAE5', // emerald-100
        darkBgColor: '#064E3B', // emerald-900
        icon: ClockIcon,
        label: 'Low',
        pulse: false
      }
    }
  };

  const system = visual.urgencySystem === 'four-tier' ? configs.fourTier : configs.threeTier;
  const priorityKey = visual.urgencySystem === 'four-tier' 
    ? (priority === 'urgent' ? 'CRITICAL' : priority.toUpperCase())
    : priority.toLowerCase();
  
  const fallback = visual.urgencySystem === 'four-tier' 
    ? configs.fourTier.LOW 
    : configs.threeTier.low;
  
  return system[priorityKey as keyof typeof system] || fallback;
};

// Get status configuration
export const getStatusConfig = (status: TaskStatus): StatusConfig => {
  const configs: Record<TaskStatus, StatusConfig> = {
    [TaskStatus.TODO]: {
      color: '#D97706', // amber-600
      bgColor: '#FEF3C7', // amber-100
      icon: Circle,
      label: 'To Do'
    },
    [TaskStatus.IN_PROGRESS]: {
      color: '#059669', // emerald-600
      bgColor: '#D1FAE5', // emerald-100
      icon: PlayIcon,
      label: 'In Progress'
    },
    [TaskStatus.COMPLETED]: {
      color: '#059669', // emerald-600
      bgColor: '#D1FAE5', // emerald-100
      icon: CheckCircleIcon,
      label: 'Completed'
    },
    [TaskStatus.CANCELLED]: {
      color: '#6B7280', // gray-500
      bgColor: '#F3F4F6', // gray-100
      icon: Icons.trash,
      label: 'Cancelled'
    },
    [TaskStatus.WAITING_FOR_REPLY]: {
      color: '#7C3AED', // violet-600
      bgColor: '#EDE9FE', // violet-100
      icon: Icons.clock,
      label: 'Waiting'
    },
    [TaskStatus.REVIEW]: {
      color: '#DC2626', // red-600
      bgColor: '#FEE2E2', // red-100
      icon: Icons.eye,
      label: 'Review'
    },
    [TaskStatus.BLOCKED]: {
      color: '#EF4444', // red-500
      bgColor: '#FECACA', // red-200
      icon: Icons.alert,
      label: 'Blocked'
    },
    [TaskStatus.DONE]: {
      color: '#059669', // emerald-600
      bgColor: '#D1FAE5', // emerald-100
      icon: CheckCircleIcon,
      label: 'Done'
    },
    [TaskStatus.DELEGATED]: {
      color: '#7C3AED', // violet-600
      bgColor: '#EDE9FE', // violet-100
      icon: UserGroupIcon,
      label: 'Delegated'
    },
    [TaskStatus.DEFERRED]: {
      color: '#6B7280', // gray-500
      bgColor: '#F3F4F6', // gray-100
      icon: CalendarDaysIcon,
      label: 'Deferred'
    }
  };
  return configs[status] || configs[TaskStatus.TODO];
};

// Get layout-specific classes
export const getLayoutClass = (layout: TaskCardConfig['layout']): string => {
  const classes = {
    compact: 'task-card-compact',
    detailed: 'task-card-detailed',
    business: 'task-card-business',
    minimal: 'task-card-minimal'
  };
  return classes[layout] || classes.detailed;
};

// Get theme-specific classes
export const getThemeClass = (visual: TaskCardConfig['visual']): string => {
  const baseClasses = ['task-card-base'];
  
  if (visual.darkMode) {
    baseClasses.push('task-card-dark');
  }
  
  if (visual.compactSpacing) {
    baseClasses.push('task-card-compact-spacing');
  }
  
  if (visual.centerAlignment) {
    baseClasses.push('task-card-center');
  }
  
  if (visual.hoverEffects) {
    baseClasses.push('task-card-hover-effects');
  }
  
  baseClasses.push(`task-card-${visual.colorScheme}`);
  
  return baseClasses.join(' ');
};

// Calculate importance score for business variant
export const calculateImportanceScore = (task: any, config: TaskCardConfig): number => {
  if (!config.features.importanceScore) return 0;
  
  let score = 0;
  
  // Priority scoring
  if (task.priority === 'urgent') score += 40;
  else if (task.priority === 'high') score += 30;
  else if (task.priority === 'medium') score += 20;
  else score += 10;
  
  // AI confidence scoring
  const confidence = task.confidence || task.aiConfidence || 50;
  score += Math.min(30, confidence * 0.3);
  
  // Related emails scoring
  const relatedEmails = task.relatedEmails || 0;
  score += Math.min(20, relatedEmails * 3);
  
  // Draft status bonus
  if (task.draftGenerated) score += 10;
  
  return Math.min(100, Math.round(score));
};

// Get category icon
export const getCategoryIcon = (category: string) => {
  const icons = {
    NEEDS_REPLY: ChatBubbleLeftRightIcon,
    APPROVAL_REQUIRED: CheckCircleIcon,
    DELEGATE: UserGroupIcon,
    DO_MYSELF: Icons.user,
    ASSIGN: Icons.users,
    FOLLOW_UP: Icons.clock,
    FYI_ONLY: Icons.document,
    MEETING_REQUEST: Icons.calendar,
    RESEARCH: Icons.document,
    ADMINISTRATIVE: Icons.document
  };
  return icons[category as keyof typeof icons] || Icons.document;
};

// Get professional color scheme for business variant
export const getProfessionalColors = (classification: string) => {
  const categoryColors = {
    NEEDS_REPLY: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    CREATE_TASK: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    APPROVAL_REQUIRED: { bg: 'bg-amber-900/20', border: 'border-amber-700/40', icon: 'text-amber-200', accent: 'bg-amber-700' },
    DELEGATE: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    FOLLOW_UP: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    MEETING_REQUEST: { bg: 'bg-blue-900/20', border: 'border-blue-700/40', icon: 'text-blue-200', accent: 'bg-blue-700' },
    DOCUMENT_REVIEW: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' },
    ESCALATION: { bg: 'bg-red-900/20', border: 'border-red-700/40', icon: 'text-red-200', accent: 'bg-red-700' },
    DEFAULT: { bg: 'bg-slate-800/80', border: 'border-slate-600/60', icon: 'text-slate-300', accent: 'bg-slate-600' }
  };
  
  return categoryColors[classification as keyof typeof categoryColors] || categoryColors.DEFAULT;
};