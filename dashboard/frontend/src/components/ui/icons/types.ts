/**
 * Icon Types and Interfaces
 * 
 * TypeScript definitions for the icon system including props,
 * size variants, and color variants for type safety.
 */

import { LucideProps } from 'lucide-react';
import { IconName, IconSizes, IconColors } from './index';

/**
 * Standard icon component props extending Lucide's base props
 */
export interface IconProps extends Omit<LucideProps, 'size'> {
  /** Icon name from the centralized Icons object */
  name?: IconName;
  /** Predefined size variant */
  size?: keyof typeof IconSizes | number;
  /** Predefined color variant */
  color?: keyof typeof IconColors;
  /** Custom className (will be merged with size and color) */
  className?: string;
}

/**
 * Icon button props for clickable icons
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name to display */
  icon: IconName;
  /** Icon size */
  iconSize?: keyof typeof IconSizes;
  /** Icon color */
  iconColor?: keyof typeof IconColors;
  /** Button variant */
  variant?: 'ghost' | 'solid' | 'outline';
  /** Loading state */
  loading?: boolean;
  /** Accessibility label */
  'aria-label': string;
}

/**
 * Icon with label props for icon + text combinations
 */
export interface IconWithLabelProps {
  /** Icon name */
  icon: IconName;
  /** Label text */
  label: string;
  /** Icon position relative to label */
  iconPosition?: 'left' | 'right' | 'top' | 'bottom';
  /** Icon size */
  iconSize?: keyof typeof IconSizes;
  /** Icon color */
  iconColor?: keyof typeof IconColors;
  /** Container className */
  className?: string;
}

/**
 * Status icon props for status indicators
 */
export interface StatusIconProps {
  /** Status type */
  status: 'success' | 'error' | 'warning' | 'info' | 'pending';
  /** Icon size */
  size?: keyof typeof IconSizes;
  /** Show background circle */
  withBackground?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Navigation icon props for menu and navigation items
 */
export interface NavigationIconProps {
  /** Icon name */
  icon: IconName;
  /** Whether item is active */
  active?: boolean;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Badge count for notifications */
  badge?: number;
  /** Icon size */
  size?: keyof typeof IconSizes;
}

/**
 * Urgency level mapping for task/email urgency indicators
 */
export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Task status mapping for task status indicators (imported from core types)
 */
import { TaskStatus } from '../../../types/core';
export type { TaskStatus };

/**
 * Icon configuration for urgency levels
 */
export interface UrgencyIconConfig {
  icon: IconName;
  color: string;
  bgColor: string;
  darkBgColor: string;
  label: string;
  pulse: boolean;
}

/**
 * Icon configuration for task statuses
 */
export interface TaskStatusIconConfig {
  icon: IconName;
  color: string;
  bgColor: string;
  label: string;
}

/**
 * Migration utility type for Heroicons -> Lucide mapping
 */
export type HeroiconName = 
  | 'PaperAirplaneIcon'
  | 'SparklesIcon'
  | 'ChatBubbleLeftRightIcon'
  | 'ExclamationCircleIcon'
  | 'CheckCircleIcon'
  | 'ArrowPathIcon'
  | 'LightBulbIcon'
  | 'ClockIcon'
  | 'MicrophoneIcon'
  | 'StopIcon'
  | 'UserIcon'
  | 'CalendarDaysIcon'
  | 'ExclamationTriangleIcon'
  | 'PlayIcon'
  | 'PauseIcon'
  | 'TrashIcon'
  | 'EllipsisHorizontalIcon'
  | 'TagIcon'
  | 'UserGroupIcon'
  | 'DocumentTextIcon'
  | 'ArrowTopRightOnSquareIcon'
  | 'FireIcon'
  | 'BoltIcon';

export default IconProps;