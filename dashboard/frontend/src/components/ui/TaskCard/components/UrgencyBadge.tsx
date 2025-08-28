import React from 'react';
import { TaskPriority } from '../../../../types/Task';
import { UrgencyConfig } from '../types';

interface UrgencyBadgeProps {
  urgencyConfig: UrgencyConfig;
  priority: TaskPriority | string;
  urgencySystem: 'four-tier' | 'three-tier';
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({
  urgencyConfig,
  priority,
  urgencySystem
}) => {
  const IconComponent = urgencyConfig.icon;
  
  return (
    <div 
      className="urgency-badge"
      style={{
        backgroundColor: urgencyConfig.bgColor,
        color: urgencyConfig.color
      }}
    >
      <IconComponent className="w-3 h-3" />
      <span>{urgencyConfig.label}</span>
    </div>
  );
};

UrgencyBadge.displayName = 'UrgencyBadge';