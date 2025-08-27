import React from 'react';
import { TaskPriority } from '../../../../types/Task';
import { TaskCardConfig } from '../types';
import { getUrgencyConfig } from '../utils/styling';

interface ProgressBarProps {
  progress: number;
  priority: TaskPriority;
  config: TaskCardConfig;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  priority,
  config
}) => {
  const urgencyConfig = getUrgencyConfig(priority, config.visual);
  const progressPercentage = Math.min(100, Math.max(0, progress));

  return (
    <div className="progress-container">
      <div 
        className="progress-bar"
        style={{
          width: `${progressPercentage}%`,
          backgroundColor: urgencyConfig.color
        }}
      />
      <span className="progress-text">{Math.round(progressPercentage)}%</span>
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';