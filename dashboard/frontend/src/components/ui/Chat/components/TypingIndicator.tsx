import React from 'react';
import { Icons } from '../../icons';

interface TypingIndicatorProps {
  isVisible: boolean;
  variant?: 'light' | 'dark';
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isVisible,
  variant = 'light',
  className = ''
}) => {
  if (!isVisible) return null;

  const isDark = variant === 'dark';

  return (
    <div className={`flex items-center gap-3 px-4 py-2 ${className}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isDark ? 'bg-purple-500/20' : 'bg-purple-100'
      }`}>
        <Icons.sparkles className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      </div>
      
      <div className={`flex items-center space-x-1 ${
        isDark ? 'text-slate-400' : 'text-gray-600'
      }`}>
        <span className="text-sm">AI is typing</span>
        <div className="flex space-x-1">
          <div className={`w-1 h-1 rounded-full animate-bounce ${
            isDark ? 'bg-slate-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '0ms' }}></div>
          <div className={`w-1 h-1 rounded-full animate-bounce ${
            isDark ? 'bg-slate-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '150ms' }}></div>
          <div className={`w-1 h-1 rounded-full animate-bounce ${
            isDark ? 'bg-slate-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};