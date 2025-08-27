import React from 'react';
import type { SeparatorProps } from '../types';

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  decorative = true,
  className = '',
}) => {
  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
      className={`
        ${orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]'}
        bg-gray-200
        ${className}
      `}
    />
  );
};