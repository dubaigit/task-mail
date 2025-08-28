import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ModernButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  ariaLabel,
  ariaDescribedBy,
  type = 'button',
  className = ''
}) => {
  // Base classes for all buttons
  const baseClasses = [
    'relative inline-flex items-center justify-center',
    'font-medium text-center transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    'animate-button-hover animate-button-press',
    fullWidth ? 'w-full' : 'w-auto'
  ].join(' ');

  // Size variants
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded-md gap-1',
    sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
    md: 'px-4 py-2 text-sm rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
    xl: 'px-6 py-3 text-lg rounded-xl gap-3'
  };

  // Color variants with proper accessibility contrast
  const variantClasses = {
    primary: [
      'bg-gradient-to-r from-blue-600 to-blue-700 text-white',
      'hover:from-blue-500 hover:to-blue-600',
      'focus:ring-blue-500',
      'shadow-lg hover:shadow-xl',
      'border border-blue-500/20'
    ].join(' '),
    
    secondary: [
      'bg-gradient-to-r from-slate-700 to-slate-800 text-slate-100',
      'hover:from-slate-600 hover:to-slate-700',
      'focus:ring-slate-500',
      'shadow-lg hover:shadow-xl',
      'border border-slate-600/20'
    ].join(' '),
    
    success: [
      'bg-gradient-to-r from-green-600 to-green-700 text-white',
      'hover:from-green-500 hover:to-green-600',
      'focus:ring-green-500',
      'shadow-lg hover:shadow-xl',
      'border border-green-500/20'
    ].join(' '),
    
    warning: [
      'bg-gradient-to-r from-yellow-600 to-orange-600 text-white',
      'hover:from-yellow-500 hover:to-orange-500',
      'focus:ring-yellow-500',
      'shadow-lg hover:shadow-xl',
      'border border-yellow-500/20'
    ].join(' '),
    
    danger: [
      'bg-gradient-to-r from-red-600 to-red-700 text-white',
      'hover:from-red-500 hover:to-red-600',
      'focus:ring-red-500',
      'shadow-lg hover:shadow-xl',
      'border border-red-500/20'
    ].join(' '),
    
    ghost: [
      'text-slate-300 hover:text-white',
      'hover:bg-slate-800/50',
      'focus:ring-slate-500',
      'border border-transparent hover:border-slate-700/50'
    ].join(' '),
    
    outline: [
      'text-slate-300 hover:text-white',
      'border border-slate-600/50 hover:border-slate-500',
      'hover:bg-slate-800/30',
      'focus:ring-slate-500'
    ].join(' ')
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <svg
      className="animate-spin-slow h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  // Combine all classes
  const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
    >
      {loading && <LoadingSpinner />}
      
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
      
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
};

export default ModernButton;