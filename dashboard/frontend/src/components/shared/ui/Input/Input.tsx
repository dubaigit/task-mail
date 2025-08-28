import React, { forwardRef } from 'react';
import type { InputProps } from '../types';

const sizeClasses = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-2.5 text-lg',
  xl: 'px-4 py-3 text-xl',
};

const variantClasses = {
  outline: 'border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
  filled: 'bg-gray-100 border border-transparent rounded-md focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
  flushed: 'border-b border-gray-300 px-0 focus:border-blue-500',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      variant = 'outline',
      isInvalid = false,
      isRequired = false,
      leftElement,
      rightElement,
      helperText,
      errorMessage,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeClass = sizeClasses[size];
    const variantClass = variantClasses[variant];

    return (
      <div className="w-full">
        <div className="relative">
          {leftElement && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            className={`
              block w-full
              ${sizeClass}
              ${variantClass}
              ${leftElement ? 'pl-10' : ''}
              ${rightElement ? 'pr-10' : ''}
              ${isInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
              transition-colors
              outline-none
              ${className}
            `}
            required={isRequired}
            aria-invalid={isInvalid}
            aria-describedby={errorMessage ? 'error-message' : helperText ? 'helper-text' : undefined}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {rightElement}
            </div>
          )}
        </div>
        {errorMessage && isInvalid && (
          <p id="error-message" className="mt-1 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        {helperText && !isInvalid && (
          <p id="helper-text" className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';