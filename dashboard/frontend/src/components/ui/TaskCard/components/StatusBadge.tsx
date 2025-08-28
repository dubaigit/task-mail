import React from 'react';
import { Badge } from '../../SimpleComponents';

export interface StatusBadgeProps {
  text?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  children?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  text, 
  variant = 'default', 
  className = '', 
  children 
}) => {
  const displayText = text || children || 'Status';
  
  return (
    <Badge variant={variant} className={className}>
      {displayText}
    </Badge>
  );
};
