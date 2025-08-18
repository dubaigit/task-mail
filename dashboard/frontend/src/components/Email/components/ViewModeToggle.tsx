import React from 'react';
import {
  EnvelopeIcon,
  PaperAirplaneIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export type ViewMode = 'email' | 'task' | 'draft' | 'info' | 'colleagues';

export interface ViewModeAnalysis {
  suggestedView: ViewMode;
  confidence: number;
  reasoning: string;
  taskCount?: number;
  draftCount?: number;
  actionableItemCount?: number;
}

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  autoSwitchEnabled: boolean;
  onAutoSwitchToggle: (enabled: boolean) => void;
  viewModeAnalysis?: ViewModeAnalysis | null;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  colleagueNotificationCount?: number;
}

const VIEW_MODE_CONFIG: Record<ViewMode, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  email: { icon: EnvelopeIcon, label: 'Email' },
  task: { icon: CalendarDaysIcon, label: 'Task' },
  draft: { icon: PaperAirplaneIcon, label: 'Draft' },
  info: { icon: InformationCircleIcon, label: 'Info' },
  colleagues: { icon: UsersIcon, label: 'Colleagues' },
};

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  currentMode,
  onModeChange,
  autoSwitchEnabled,
  onAutoSwitchToggle,
  viewModeAnalysis,
  onShowToast,
  colleagueNotificationCount = 0,
}) => {
  const handleModeChange = (mode: ViewMode) => {
    onModeChange(mode);
    if (onShowToast) {
      onShowToast(`Switched to ${mode} view`, 'info');
    }
  };

  return (
    <div className="mb-4 p-3 bg-secondary/30 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">View Mode:</span>
          <div className="flex items-center bg-background border border-border rounded-lg p-1 shadow-sm">
            {(Object.keys(VIEW_MODE_CONFIG) as ViewMode[]).map((mode) => {
              const config = VIEW_MODE_CONFIG[mode];
              const Icon = config.icon;
              const isActive = currentMode === mode;
              
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 relative ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  data-testid={`view-toggle-${mode}`}
                  title={`Switch to ${mode} view`}
                  aria-pressed={isActive}
                  aria-label={`${config.label} view`}
                >
                  <Icon className="w-4 h-4 mr-2 inline" />
                  {mode === 'colleagues' && colleagueNotificationCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                      aria-label={`${colleagueNotificationCount} pending colleague responses`}
                    >
                      {colleagueNotificationCount}
                    </span>
                  )}
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-switch"
            checked={autoSwitchEnabled}
            onChange={(e) => onAutoSwitchToggle(e.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary"
            aria-describedby="auto-switch-description"
          />
          <label htmlFor="auto-switch" className="text-xs text-muted-foreground cursor-pointer">
            Auto-switch
          </label>
        </div>
      </div>
      
      {/* View Mode Analysis Indicator */}
      {viewModeAnalysis && viewModeAnalysis.confidence >= 0.8 && (
        <div className="flex items-center gap-2 text-xs mt-2 p-2 bg-background rounded-md">
          <div 
            className={`w-2 h-2 rounded-full ${
              viewModeAnalysis.suggestedView === currentMode 
                ? 'bg-green-500' 
                : 'bg-amber-500'
            }`}
            aria-hidden="true"
          />
          <span 
            className="text-muted-foreground" 
            title={viewModeAnalysis.reasoning}
            id="auto-switch-description"
          >
            AI suggests: {viewModeAnalysis.suggestedView} view ({Math.round(viewModeAnalysis.confidence * 100)}% confidence)
          </span>
        </div>
      )}
    </div>
  );
};