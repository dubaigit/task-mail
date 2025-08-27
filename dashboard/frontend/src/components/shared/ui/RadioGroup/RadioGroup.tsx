import React, { createContext, useContext } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const radioVariants = cva(
  'aspect-square h-4 w-4 rounded-full border border-gray-300 text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600',
        destructive: 'border-gray-300 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600',
        success: 'border-gray-300 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600',
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

// Context for RadioGroup
interface RadioGroupContextValue {
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

const useRadioGroup = () => {
  const context = useContext(RadioGroupContext);
  if (context === undefined) {
    throw new Error('useRadioGroup must be used within a RadioGroup');
  }
  return context;
};

export interface RadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ 
    className, 
    value, 
    onValueChange, 
    name,
    disabled = false,
    required = false,
    children, 
    orientation = 'vertical',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props 
  }, ref) => {
    return (
      <RadioGroupContext.Provider
        value={{
          name,
          value,
          onValueChange,
          disabled,
          required,
        }}
      >
        <div
          className={cn(
            'grid gap-2',
            orientation === 'horizontal' && 'grid-flow-col auto-cols-max gap-6',
            className
          )}
          {...props}
          ref={ref}
          role="radiogroup"
          aria-required={required}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof radioVariants> {
  value: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ 
    className, 
    variant,
    size,
    value, 
    label, 
    description,
    error = false,
    disabled: itemDisabled,
    id,
    ...props 
  }, ref) => {
    const { name, value: groupValue, onValueChange, disabled: groupDisabled, required } = useRadioGroup();
    const radioId = id || `radio-${value}-${Math.random().toString(36).substr(2, 9)}`;
    
    const isDisabled = groupDisabled || itemDisabled;
    const isChecked = groupValue === value;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isDisabled && e.target.checked) {
        onValueChange?.(value);
      }
      props.onChange?.(e);
    };

    const renderRadio = () => (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="radio"
          id={radioId}
          name={name}
          value={value}
          checked={isChecked}
          onChange={handleChange}
          disabled={isDisabled}
          required={required}
          className={cn(
            radioVariants({ variant: error ? 'destructive' : variant, size }),
            'appearance-none',
            className
          )}
          data-state={isChecked ? 'checked' : 'unchecked'}
          {...props}
        />
        
        {/* Custom radio indicator */}
        {isChecked && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center pointer-events-none',
            size === 'sm' && 'p-0.5',
            size === 'default' && 'p-1',
            size === 'lg' && 'p-1.5'
          )}>
            <div className={cn(
              'rounded-full bg-white',
              size === 'sm' && 'h-1.5 w-1.5',
              size === 'default' && 'h-2 w-2',
              size === 'lg' && 'h-2.5 w-2.5'
            )} />
          </div>
        )}
      </div>
    );

    if (!label && !description) {
      return renderRadio();
    }

    return (
      <div className="flex items-start space-x-3">
        {renderRadio()}
        
        <div className="flex-1 min-w-0">
          {label && (
            <label
              htmlFor={radioId}
              className={cn(
                'text-sm font-medium leading-none cursor-pointer',
                error ? 'text-red-600' : 'text-gray-700',
                isDisabled && 'opacity-50 cursor-not-allowed'
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

RadioGroupItem.displayName = 'RadioGroupItem';

// Convenience component for creating radio options
export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupWithOptionsProps extends Omit<RadioGroupProps, 'children'> {
  options: RadioOption[];
  variant?: VariantProps<typeof radioVariants>['variant'];
  size?: VariantProps<typeof radioVariants>['size'];
  error?: boolean;
}

export const RadioGroupWithOptions: React.FC<RadioGroupWithOptionsProps> = ({
  options,
  variant,
  size,
  error = false,
  ...props
}) => {
  return (
    <RadioGroup {...props}>
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          variant={variant}
          size={size}
          error={error}
        />
      ))}
    </RadioGroup>
  );
};

export default RadioGroup;