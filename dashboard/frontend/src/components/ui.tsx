import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import { clsx } from 'clsx';

/* ===== BUTTON COMPONENT ===== */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}, ref) => {
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95 focus-visible:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70 focus-visible:ring-secondary',
    danger: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/95 focus-visible:ring-destructive',
    outline: 'border-2 border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80 focus-visible:ring-ring',
    ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80 focus-visible:ring-ring',
    success: 'bg-green-600 text-white shadow-sm hover:bg-green-700 active:bg-green-800 focus-visible:ring-green-600',
    warning: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 focus-visible:ring-amber-500'
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs font-medium min-h-[1.75rem]',
    sm: 'px-3 py-1.5 text-sm font-medium min-h-[2rem]',
    md: 'px-4 py-2 text-sm font-medium min-h-[2.25rem]',
    lg: 'px-6 py-2.5 text-base font-medium min-h-[2.75rem]',
    xl: 'px-8 py-3 text-lg font-semibold min-h-[3.25rem]'
  };

  return (
    <button
      ref={ref}
      className={clsx(
        // Base styles
        'email-button',
        'relative inline-flex items-center justify-center gap-2 rounded-md',
        'font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:scale-[0.98]',
        // Variant and size
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="animate-spin h-4 w-4">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span className={clsx(loading && 'opacity-70')}>{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';

/* ===== CARD COMPONENT ===== */
interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  hover?: boolean;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  hover = false,
  interactive = false
}) => {
  const variantClasses = {
    default: 'bg-card text-card-foreground border border-border',
    elevated: 'bg-card text-card-foreground shadow-lg border border-border/50',
    outlined: 'bg-card text-card-foreground border-2 border-border',
    glass: 'glass-effect text-card-foreground'
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  return (
    <div
      className={clsx(
        'email-card',
        'rounded-lg transition-all duration-200',
        variantClasses[variant],
        paddingClasses[padding],
        hover && 'hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5',
        interactive && 'cursor-pointer select-none active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  );
};

/* ===== BADGE COMPONENT ===== */
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false
}) => {
  const variantClasses = {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-muted text-muted-foreground',
    success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    warning: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    danger: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    info: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    outline: 'border border-border bg-background text-foreground'
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-2.5 py-1 text-sm'
  };

  return (
    <span
      className={clsx(
        'email-badge',
        'inline-flex items-center gap-1 rounded-full font-medium border border-transparent',
        'transition-colors duration-150',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 bg-current rounded-full flex-shrink-0" />}
      {children}
    </span>
  );
};

/* ===== INPUT COMPONENT ===== */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: 'default' | 'filled' | 'outlined';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  className = '',
  ...props
}, ref) => {
  const inputId = props.id || props.name;
  
  const variantClasses = {
    default: 'border-input bg-background focus:border-primary focus:ring-primary',
    filled: 'border-transparent bg-secondary focus:border-primary focus:ring-primary',
    outlined: 'border-2 border-border bg-background focus:border-primary focus:ring-primary'
  };

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'block w-full rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'shadow-sm transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            error ? 'border-destructive focus:border-destructive focus:ring-destructive' : variantClasses[variant],
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive animate-slide-in-down">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/* ===== TEXTAREA COMPONENT ===== */
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  label,
  error,
  helperText,
  resize = 'vertical',
  className = '',
  ...props
}, ref) => {
  const textareaId = props.id || props.name;
  
  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  };

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          'block w-full rounded-md border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
          'shadow-sm transition-colors duration-200',
          'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-destructive focus:border-destructive focus:ring-destructive' : '',
          resizeClasses[resize],
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive animate-slide-in-down">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

/* ===== SELECT COMPONENT ===== */
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  error,
  helperText,
  placeholder,
  className = '',
  ...props
}, ref) => {
  const selectId = props.id || props.name;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={clsx(
          'block w-full rounded-md border-input bg-background px-3 py-2 text-sm text-foreground',
          'shadow-sm transition-colors duration-200 cursor-pointer',
          'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-destructive focus:border-destructive focus:ring-destructive' : '',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-destructive animate-slide-in-down">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

/* ===== LOADING SKELETON ===== */
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = false
}) => {
  return (
    <div
      className={clsx(
        'skeleton animate-pulse',
        rounded ? 'rounded-full' : 'rounded',
        className
      )}
      style={{ width, height }}
    />
  );
};

/* ===== SPINNER COMPONENT ===== */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  return (
    <div className={clsx('animate-spin', sizeClasses[size], className)}>
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          className="opacity-75"
        />
      </svg>
    </div>
  );
};

/* ===== ALERT COMPONENT ===== */
interface AlertProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  dismissible = false,
  onDismiss,
  className = ''
}) => {
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
    danger: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
  };

  const iconMap = {
    info: '✓',
    success: '✓',
    warning: '⚠',
    danger: '✕'
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 animate-slide-in-down',
        variantClasses[variant],
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-lg font-bold">
          {iconMap[variant]}
        </div>
        <div className="flex-1">
          {title && (
            <h3 className="font-semibold mb-1">{title}</h3>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-lg font-bold hover:opacity-70 transition-opacity"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/* ===== TOOLTIP WRAPPER ===== */
interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top'
}) => {
  return (
    <div className="relative group">
      {children}
      <div
        className={clsx(
          'absolute z-tooltip invisible opacity-0 group-hover:visible group-hover:opacity-100',
          'bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-lg',
          'transition-all duration-200 pointer-events-none',
          'max-w-xs break-words',
          position === 'top' && 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
          position === 'bottom' && 'top-full left-1/2 transform -translate-x-1/2 mt-1',
          position === 'left' && 'right-full top-1/2 transform -translate-y-1/2 mr-1',
          position === 'right' && 'left-full top-1/2 transform -translate-y-1/2 ml-1'
        )}
      >
        {content}
        {/* Arrow */}
        <div
          className={clsx(
            'absolute w-0 h-0 border-solid',
            position === 'top' && 'top-full left-1/2 transform -translate-x-1/2 border-t-popover border-l-transparent border-r-transparent border-b-transparent border-4',
            position === 'bottom' && 'bottom-full left-1/2 transform -translate-x-1/2 border-b-popover border-l-transparent border-r-transparent border-t-transparent border-4',
            position === 'left' && 'left-full top-1/2 transform -translate-y-1/2 border-l-popover border-t-transparent border-b-transparent border-r-transparent border-4',
            position === 'right' && 'right-full top-1/2 transform -translate-y-1/2 border-r-popover border-t-transparent border-b-transparent border-l-transparent border-4'
          )}
        />
      </div>
    </div>
  );
};
