// Shared UI Component Types
// Common TypeScript interfaces for all shared components

import { ReactNode, ComponentProps } from 'react';
import { ComponentSize, ComponentVariant, ComponentColor } from './tokens/types';

// Base component props
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

// Button component props
export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ComponentVariant;
  size?: ComponentSize;
  color?: ComponentColor;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

// Input component props
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ComponentSize;
  variant?: 'outline' | 'filled' | 'flushed';
  isInvalid?: boolean;
  isRequired?: boolean;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  helperText?: string;
  errorMessage?: string;
}

// Card component props
export interface CardProps extends BaseComponentProps {
  variant?: 'outline' | 'filled' | 'elevated';
  padding?: ComponentSize;
  radius?: ComponentSize;
}

// Badge component props
export interface BadgeProps extends BaseComponentProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  color?: ComponentColor;
}

// Avatar component props
export interface AvatarProps extends BaseComponentProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: ComponentSize;
  fallback?: ReactNode;
  showBorder?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

// Tooltip component props
export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  offset?: number;
  disabled?: boolean;
}

// Dialog component props
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ComponentSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
}

// DropdownMenu component props
export interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  disabled?: boolean;
}

// Progress component props
export interface ProgressProps extends BaseComponentProps {
  value: number;
  max?: number;
  size?: ComponentSize;
  color?: ComponentColor;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

// Tabs component props
export interface TabsProps extends BaseComponentProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'line' | 'enclosed' | 'soft-rounded';
}

// Separator component props
export interface SeparatorProps extends BaseComponentProps {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

// Toast component props
export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  isClosable?: boolean;
  position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ScrollArea component props
export interface ScrollAreaProps extends BaseComponentProps {
  maxHeight?: string | number;
  scrollbarWidth?: 'thin' | 'none' | 'auto';
  type?: 'always' | 'scroll' | 'hover' | 'auto';
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
}

// Error states
export interface ErrorState {
  hasError: boolean;
  error?: Error | string;
  errorMessage?: string;
}

// Validation states
export interface ValidationState {
  isValid?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  errorMessage?: string;
  helperText?: string;
}

// Responsive props
export interface ResponsiveProps<T = any> {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

// Animation props
export interface AnimationProps {
  animate?: boolean;
  animationDuration?: number;
  animationDelay?: number;
  animationEasing?: string;
}

// Accessibility props
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  role?: string;
  tabIndex?: number;
}

// Combined utility props
export interface UtilityProps extends BaseComponentProps, AccessibilityProps {
  id?: string;
  'data-testid'?: string;
}
