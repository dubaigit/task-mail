import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const switchVariants = cva(
  'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200',
        destructive: 'data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-gray-200',
        success: 'data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-200',
      },
      size: {
        sm: 'h-4 w-7',
        default: 'h-5 w-9',
        lg: 'h-6 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const switchThumbVariants = cva(
  'pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform',
  {
    variants: {
      size: {
        sm: 'h-3 w-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0',
        default: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        lg: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof switchVariants> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ 
    className, 
    variant, 
    size,
    label,
    description,
    error = false,
    checked,
    onCheckedChange,
    onChange,
    id,
    disabled,
    ...props 
  }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
      onChange?.(e);
    };

    const renderSwitch = () => (
      <label
        htmlFor={switchId}
        className={cn(
          switchVariants({ variant: error ? 'destructive' : variant, size }),
          className
        )}
        data-state={checked ? 'checked' : 'unchecked'}
      >
        <input
          ref={ref}
          type="checkbox"
          id={switchId}
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          role="switch"
          aria-checked={checked}
          {...props}
        />
        <span
          className={switchThumbVariants({ size })}
          data-state={checked ? 'checked' : 'unchecked'}
        />
      </label>
    );

    if (!label && !description) {
      return renderSwitch();
    }

    return (
      <div className="flex items-start space-x-3">
        {renderSwitch()}
        
        <div className="flex-1 min-w-0">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                'text-sm font-medium leading-none cursor-pointer',
                error ? 'text-red-600' : 'text-gray-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {label}
            </label>
          )}
          
          {description && (
            <p className={cn(
              'mt-1 text-xs',
              error ? 'text-red-500' : 'text-gray-500'
            )}>
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';

// Switch with icons
export interface IconSwitchProps extends SwitchProps {
  checkedIcon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
}

export const IconSwitch = React.forwardRef<HTMLInputElement, IconSwitchProps>(
  ({ checkedIcon, uncheckedIcon, checked, ...props }, ref) => {
    return (
      <div className="relative">
        <Switch ref={ref} checked={checked} {...props} />
        
        {(checkedIcon || uncheckedIcon) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center justify-center text-xs text-white">
              {checked ? checkedIcon : uncheckedIcon}
            </div>
          </div>
        )}
      </div>
    );
  }
);

IconSwitch.displayName = 'IconSwitch';

// Switch group for multiple switches
export interface SwitchGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const SwitchGroup: React.FC<SwitchGroupProps> = ({
  children,
  className,
  orientation = 'vertical',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  return (
    <div
      className={cn(
        'flex',
        orientation === 'vertical' ? 'flex-col space-y-4' : 'flex-row space-x-6',
        className
      )}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </div>
  );
};

export default Switch;