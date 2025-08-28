import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const checkboxVariants = cva(
  'peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'data-[state=checked]:bg-blue-600 data-[state=checked]:text-white data-[state=checked]:border-blue-600',
        destructive: 'data-[state=checked]:bg-red-600 data-[state=checked]:text-white data-[state=checked]:border-red-600',
        success: 'data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=checked]:border-green-600',
      },
      size: {
        sm: 'h-3 w-3',
        default: 'h-4 w-4',
        lg: 'h-5 w-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof checkboxVariants> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ 
    className, 
    variant, 
    size, 
    label, 
    description, 
    error,
    indeterminate = false,
    checked,
    id,
    ...props 
  }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // Handle indeterminate state
    React.useEffect(() => {
      const input = inputRef.current;
      if (input) {
        input.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    const renderCheckbox = () => (
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="checkbox"
          id={checkboxId}
          className={cn(
            checkboxVariants({ variant: error ? 'destructive' : variant, size }),
            'appearance-none',
            className
          )}
          data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
          checked={checked}
          {...props}
        />
        
        {/* Custom checkbox indicator */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center pointer-events-none',
          size === 'sm' && 'text-[8px]',
          size === 'default' && 'text-[10px]',
          size === 'lg' && 'text-xs'
        )}>
          {indeterminate ? (
            <svg
              className="fill-current text-white"
              width="8"
              height="2"
              viewBox="0 0 8 2"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="8" height="2" rx="1" fill="currentColor" />
            </svg>
          ) : checked ? (
            <svg
              className="fill-current text-white"
              width="8"
              height="6"
              viewBox="0 0 8 6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 4.58579L1.41421 3L0.707107 3.70711L3 6L7.70711 1.29289L7 0.585786L3 4.58579Z"
                fill="currentColor"
              />
            </svg>
          ) : null}
        </div>
      </div>
    );

    if (!label && !description) {
      return renderCheckbox();
    }

    return (
      <div className="flex items-start space-x-3">
        {renderCheckbox()}
        
        <div className="flex-1 min-w-0">
          {label && (
            <label
              htmlFor={checkboxId}
              className={cn(
                'text-sm font-medium leading-none cursor-pointer',
                error ? 'text-red-600' : 'text-gray-700',
                props.disabled && 'opacity-50 cursor-not-allowed'
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

Checkbox.displayName = 'Checkbox';

// Checkbox group component
export interface CheckboxGroupProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  value = [],
  onValueChange,
  children,
  className,
  orientation = 'vertical',
  disabled = false,
}) => {
  const handleChange = (itemValue: string, checked: boolean) => {
    if (disabled) return;
    
    const newValue = checked
      ? [...value, itemValue]
      : value.filter(v => v !== itemValue);
    
    onValueChange?.(newValue);
  };

  return (
    <div
      className={cn(
        'flex',
        orientation === 'vertical' ? 'flex-col space-y-3' : 'flex-row space-x-6',
        className
      )}
      role="group"
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && child.type === CheckboxGroupItem) {
          return React.cloneElement(child, {
            ...child.props,
            checked: value.includes(child.props.value),
            onCheckedChange: (checked: boolean) => {
              handleChange(child.props.value, checked);
              child.props.onCheckedChange?.(checked);
            },
            disabled: disabled || child.props.disabled,
          });
        }
        return child;
      })}
    </div>
  );
};

// Checkbox group item
export interface CheckboxGroupItemProps extends Omit<CheckboxProps, 'checked'> {
  value: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const CheckboxGroupItem: React.FC<CheckboxGroupItemProps> = ({
  value,
  checked,
  onCheckedChange,
  onChange,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
    onChange?.(e);
  };

  return (
    <Checkbox
      {...props}
      checked={checked}
      onChange={handleChange}
      value={value}
    />
  );
};

export default Checkbox;