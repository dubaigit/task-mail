import { TaskStatus } from '../../types/core';

import React, { memo } from 'react';
import { User, Settings } from 'lucide-react';

// TypeScript interfaces
interface Task {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  description?: string;
  taskDescription?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | TaskStatus.COMPLETED;
  aiConfidence?: number;
  confidence?: number;
  draftGenerated: boolean;
  emailSubject?: string;
  sender: string;
  senderEmail: string;
  estimatedTime: string;
  tags: string[];
  relatedEmails: number;
  createdAt?: Date;
  date?: string;
  isTask?: boolean;
  snippet?: string;
  suggestedAction?: string;
  classification?: string;
}

interface SyncStatus {
  emailsInPostgres: number;
  emailsInAppleMail: number;
  percentComplete: number;
  isSynced: boolean;
  emailBreakdown: {
    total: number;
    tasks: {
      count: number;
      percentage: number;
    };
    fyi: {
      count: number;
      percentage: number;
    };
    today?: number;
    week?: number;
    month?: number;
  };
  aiProcessing?: {
    totalProcessed: number;
    analyzed: number;
    completed: number;
    pending: number;
    failed: number;
    processingRate: number;
  };
}

interface UserProfile {
  displayName?: string;
  email?: string;
}

interface CategoryCounts {
  NEEDS_REPLY?: number;
  APPROVAL_REQUIRED?: number;
  DELEGATE?: number;
  FOLLOW_UP?: number;
  MEETING_REQUEST?: number;
  MEETING_CANCELLED?: number;
  FYI_ONLY?: number;
}

interface TaskDetailsStatsProps {
  userProfile: UserProfile | null;
  syncStatus: SyncStatus | null;
  tasks: Task[];
  categoryFilter: string;
  categoryCounts: CategoryCounts;
  onSettingsClick: () => void;
  onCategoryFilterChange: (filter: string) => void;
}

const TaskDetailsStats: React.FC<TaskDetailsStatsProps> = memo(({
  userProfile,
  syncStatus,
  tasks,
  categoryFilter,
  categoryCounts,
  onSettingsClick,
  onCategoryFilterChange
}) => {
  // Calculate task statistics
  const completedTasks = tasks.filter(task => task.status === TaskStatus.COMPLETED);
  const totalTaskCount = syncStatus?.emailBreakdown?.tasks?.count ?? tasks.length;
  const completedCount = completedTasks.length;
  const pendingCount = totalTaskCount - completedCount;

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-200">
            {userProfile?.displayName || 'Your Account'}
          </span>
        </div>
        <p className="text-xs text-slate-400">{userProfile?.email || 'Loading...'}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-green-400">● Online</span>
          <button 
            onClick={onSettingsClick}
            aria-label="Open user settings and preferences"
            className="text-xs text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-1"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Task Overview Stats */}
      <div className="mb-4">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Overview</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-800/40 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{totalTaskCount}</div>
            <div className="text-xs text-slate-400">Total Tasks</div>
          </div>
          <div className="bg-amber-500/15 rounded-lg p-3 text-center border border-amber-400/30">
            <div className="text-xl font-bold text-amber-300">{pendingCount}</div>
            <div className="text-xs text-amber-200/70">Pending</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div className="bg-emerald-500/15 rounded-lg p-3 text-center border border-emerald-400/30">
            <div className="text-xl font-bold text-emerald-300">{completedCount}</div>
            <div className="text-xs text-emerald-200/70">Completed</div>
          </div>
        </div>
      </div>

      {/* Task Categories */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
        <div className="space-y-1">
          <button 
            onClick={() => onCategoryFilterChange('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'all' 
                ? 'bg-blue-500/20 border border-blue-400/50 text-blue-200' 
                : 'hover:bg-blue-500/10 text-blue-200'
            }`}
          >
            <div className="w-3 h-3 bg-blue-400 rounded-full shadow-sm"></div>
            <span>All Categories</span>
            <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">{totalTaskCount}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('NEEDS_REPLY')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'NEEDS_REPLY' 
                ? 'bg-red-500/20 border border-red-400/50 text-red-200' 
                : 'hover:bg-red-500/10 text-red-200'
            }`}
          >
            <div className="w-3 h-3 bg-red-400 rounded-full shadow-sm"></div>
            <span>Needs Reply</span>
            <span className="ml-auto text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{categoryCounts.NEEDS_REPLY || 0}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('APPROVAL_REQUIRED')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'APPROVAL_REQUIRED' 
                ? 'bg-purple-500/20 border border-purple-400/50 text-purple-200' 
                : 'hover:bg-purple-500/10 text-purple-200'
            }`}
          >
            <div className="w-3 h-3 bg-purple-400 rounded-full shadow-sm"></div>
            <span>Approval Required</span>
            <span className="ml-auto text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{categoryCounts.APPROVAL_REQUIRED || 0}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('DELEGATE')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'DELEGATE' 
                ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-200' 
                : 'hover:bg-indigo-500/10 text-indigo-200'
            }`}
          >
            <div className="w-3 h-3 bg-indigo-400 rounded-full shadow-sm"></div>
            <span>Delegate</span>
            <span className="ml-auto text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{categoryCounts.DELEGATE || 0}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('FOLLOW_UP')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'FOLLOW_UP' 
                ? 'bg-teal-500/20 border border-teal-400/50 text-teal-200' 
                : 'hover:bg-teal-500/10 text-teal-200'
            }`}
          >
            <div className="w-3 h-3 bg-teal-400 rounded-full shadow-sm"></div>
            <span>Follow Up</span>
            <span className="ml-auto text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{categoryCounts.FOLLOW_UP || 0}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('MEETING_REQUEST')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'MEETING_REQUEST' 
                ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200' 
                : 'hover:bg-cyan-500/10 text-cyan-200'
            }`}
          >
            <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-sm"></div>
            <span>Meetings</span>
            <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{(categoryCounts.MEETING_REQUEST || 0) + (categoryCounts.MEETING_CANCELLED || 0)}</span>
          </button>
          <button 
            onClick={() => onCategoryFilterChange('FYI_ONLY')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
              categoryFilter === 'FYI_ONLY' 
                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200' 
                : 'hover:bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-sm"></div>
            <span>FYI Only</span>
            <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{syncStatus?.emailBreakdown?.fyi?.count || 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

TaskDetailsStats.displayName = 'TaskDetailsStats';

export { TaskDetailsStats };