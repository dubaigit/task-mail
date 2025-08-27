import React, { useState } from 'react';
import type { TabsProps } from '../types';

const variantClasses = {
  line: {
    list: 'border-b border-gray-200',
    trigger: 'px-4 py-2 -mb-px border-b-2 border-transparent hover:text-gray-700',
    activeTrigger: 'border-blue-500 text-blue-600',
  },
  enclosed: {
    list: 'border-b border-gray-200',
    trigger: 'px-4 py-2 -mb-px border border-transparent rounded-t-md hover:text-gray-700',
    activeTrigger: 'border-gray-200 border-b-white bg-white',
  },
  'soft-rounded': {
    list: 'bg-gray-100 p-1 rounded-lg',
    trigger: 'px-4 py-2 rounded-md hover:bg-gray-200',
    activeTrigger: 'bg-white shadow',
  },
};

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  orientation = 'horizontal',
  variant = 'line',
  className = '',
  children,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const variantClass = variantClasses[variant];

  return (
    <div
      className={`
        ${orientation === 'vertical' ? 'flex' : ''}
        ${className}
      `}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            value,
            onValueChange: handleValueChange,
            orientation,
            variantClass,
          });
        }
        return child;
      })}
    </div>
  );
};