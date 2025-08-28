import React, { useEffect, useRef } from 'react';

interface DarkModeSystemProps {
  children: React.ReactNode;
  enableAnimations?: boolean;
}

export const DarkModeSystem: React.FC<DarkModeSystemProps> = ({ 
  children, 
  enableAnimations = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enableAnimations || !containerRef.current) return;

    const elements = containerRef.current.querySelectorAll('.animate-entrance');
    
    if (elements.length > 0) {
      elements.forEach((element, index) => {
        (element as HTMLElement).style.opacity = '1';
        (element as HTMLElement).style.transform = 'translateY(0)';
        (element as HTMLElement).style.transition = `opacity 0.3s ease ${index * 0.1}s, transform 0.3s ease ${index * 0.1}s`;
      });
    }
  }, [enableAnimations]);

  return (
    <div ref={containerRef} className="dark-mode-system">
      {children}
    </div>
  );
};

// Glass Card Component
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'large' | 'wide' | 'tall';
  hoverable?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  variant = 'default',
  hoverable: _hoverable = true
}) => {
  const cardRef = useRef<HTMLDivElement>(null);


  const variantClasses = {
    default: '',
    large: 'bento-large',
    wide: 'bento-wide',
    tall: 'bento-tall'
  };

  return (
    <div
      ref={cardRef}
      className={`glass-card bento-item ${variantClasses[variant]} ${className} animate-entrance`}
      onClick={onClick}

      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
};

// Modern Button Component
interface ModernButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'glass' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  icon,
  className = ''
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (!buttonRef.current || disabled) return;
    onClick?.();
  };

  const variantClasses = {
    primary: 'btn-primary-2025',
    glass: 'btn-glass-2025',
    ghost: 'btn-ghost-2025'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <button
      ref={buttonRef}
      className={`btn-2025 ${variantClasses[variant]} ${sizeClasses[size]} ${className} focusable`}
      onClick={handleClick}
      disabled={disabled}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  children: React.ReactNode;
  status: 'success' | 'warning' | 'danger' | 'info';
  pulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  status,
  pulse = false,
  className = ''
}) => {
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pulse || !badgeRef.current) return;
    
    const element = badgeRef.current;
    element.style.animation = 'pulse 2s infinite';
  }, [pulse]);

  const statusClasses = {
    success: 'status-success',
    warning: 'status-warning',
    danger: 'status-danger',
    info: 'status-info'
  };

  return (
    <span
      ref={badgeRef}
      className={`status-badge ${statusClasses[status]} ${className}`}
    >
      {children}
    </span>
  );
};

// Modern Input Component
interface ModernInputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  className?: string;
  error?: string;
  label?: string;
}

export const ModernInput: React.FC<ModernInputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  className = '',
  error,
  label
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    if (!inputRef.current) return;
    
    const element = inputRef.current;
    element.style.transform = 'scale(1.02)';
    element.style.transition = 'transform 0.2s ease';
    
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 200);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-200">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          className={`input-2025 w-full focusable ${icon ? 'pl-10' : ''} ${
            error ? 'border-red-500' : ''
          }`}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};

// Loading Skeleton Component
interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  animate?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = '20px',
  className = '',
  animate = true
}) => {
  return (
    <div
      className={`${animate ? 'loading-shimmer' : 'bg-slate-700'} rounded ${className}`}
      style={{ width, height }}
    />
  );
};

// Bento Grid Layout Component
interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  gap?: number;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  children,
  className = '',
  gap = 24
}) => {
  return (
    <div 
      className={`bento-grid ${className}`}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
};

export default DarkModeSystem;
