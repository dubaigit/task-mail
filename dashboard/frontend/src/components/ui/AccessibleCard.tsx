import React from 'react';

interface AccessibleCardProps {
  children: React.ReactNode;
  className?: string;
  clickable?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
  tabIndex?: number;
  animated?: boolean;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
}

export const AccessibleCard: React.FC<AccessibleCardProps> = ({
  children,
  className = '',
  clickable = false,
  onClick,
  ariaLabel,
  ariaDescribedBy,
  role,
  tabIndex,
  animated = true,
  variant = 'default'
}) => {
  // Base classes for proper accessibility and modern design
  const baseClasses = [
    'rounded-xl',
    'transition-all duration-300',
    'focus:outline-none',
    animated ? 'animate-card-hover' : '',
    clickable ? 'cursor-pointer focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900' : ''
  ].filter(Boolean).join(' ');

  // Variant styles based on Archon design standards
  const variantClasses = {
    default: [
      'bg-slate-800/50 border border-slate-700/50',
      clickable ? 'hover:bg-slate-800/70 hover:border-slate-600/50' : ''
    ].join(' '),
    
    elevated: [
      'bg-slate-800/60 border border-slate-700/30',
      'shadow-lg hover:shadow-xl',
      clickable ? 'hover:bg-slate-800/80' : ''
    ].join(' '),
    
    outlined: [
      'bg-transparent border-2 border-slate-600/50',
      clickable ? 'hover:border-slate-500/70 hover:bg-slate-800/20' : ''
    ].join(' '),
    
    glass: [
      'bg-slate-900/40 backdrop-blur-md border border-slate-700/50',
      'shadow-lg',
      clickable ? 'hover:bg-slate-900/60 hover:backdrop-blur-lg' : ''
    ].join(' ')
  };

  // Combine all classes
  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;

  // Common props for both div and button variants
  const commonProps = {
    className: combinedClasses,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    role: role || (clickable ? 'button' : undefined),
    tabIndex: clickable ? (tabIndex ?? 0) : tabIndex
  };

  if (clickable && onClick) {
    return (
      <div
        {...commonProps}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div {...commonProps}>
      {children}
    </div>
  );
};

export default AccessibleCard;