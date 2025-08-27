import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants: {
      variant: {
        default: 'text-gray-700',
        secondary: 'text-gray-500',
        destructive: 'text-red-600',
        success: 'text-green-600',
        warning: 'text-yellow-600',
      },
      size: {
        sm: 'text-xs',
        default: 'text-sm',
        lg: 'text-base',
      },
      required: {
        true: "after:content-['*'] after:ml-0.5 after:text-red-500",
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      required: false,
    },
  }
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  asChild?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, size, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ variant, size, required }), className)}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';

// Form label with better accessibility
export interface FormLabelProps extends LabelProps {
  htmlFor: string;
  optional?: boolean;
  description?: string;
  error?: string;
}

export const FormLabel: React.FC<FormLabelProps> = ({
  htmlFor,
  children,
  optional = false,
  required = false,
  description,
  error,
  className,
  variant = error ? 'destructive' : 'default',
  ...props
}) => {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={htmlFor}
        className={cn('block', className)}
        variant={variant}
        required={required && !optional}
        {...props}
      >
        {children}
        {optional && (
          <span className="ml-1 text-xs text-gray-400 font-normal">
            (optional)
          </span>
        )}
      </Label>
      
      {description && !error && (
        <p className="text-xs text-gray-500" id={`${htmlFor}-description`}>
          {description}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-red-600" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// Field set label for grouped form controls
export interface FieldsetLabelProps extends React.HTMLAttributes<HTMLLegendElement> {
  variant?: 'default' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  required?: boolean;
}

export const FieldsetLabel = React.forwardRef<HTMLLegendElement, FieldsetLabelProps>(
  ({ className, variant = 'default', size = 'default', required = false, ...props }, ref) => {
    return (
      <legend
        ref={ref}
        className={cn(
          labelVariants({ variant, size, required }),
          'mb-3',
          className
        )}
        {...props}
      />
    );
  }
);

FieldsetLabel.displayName = 'FieldsetLabel';

export default Label;