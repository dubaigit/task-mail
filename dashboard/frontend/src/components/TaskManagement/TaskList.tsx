import React from 'react';
import { 
  CheckCircle,
  Filter,
  RefreshCw,
  Mail
} from 'lucide-react';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import type { Task } from '../../types/index';

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  showFilters: boolean;
  statusFilter: string;
  priorityFilter: string;
  senderFilter: string;
  allTasksCount: number;
  onToggleFilters: () => void;
  onStatusFilterChange: (status: string) => void;
  onPriorityFilterChange: (priority: string) => void;
  onSenderFilterChange: (sender: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onPriorityChange?: (taskId: string, priority: Task['priority']) => void;
}

const TaskList: React.FC<TaskListProps> = React.memo(({
  tasks,
  loading,
  showFilters,
  statusFilter,
  priorityFilter,
  senderFilter,
  allTasksCount,
  onToggleFilters,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSenderFilterChange,
  onRefresh,
  onClearFilters,
  onTaskClick,
  onStatusChange,
  onPriorityChange
}) => {
  return (
    <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Tasks ({tasks.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFilters}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showFilters 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-800/50 border-b border-slate-700/50 p-3">
          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <select 
              value={statusFilter} 
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs border border-slate-600"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            {/* Priority Filter */}
            <select 
              value={priorityFilter} 
              onChange={(e) => onPriorityFilterChange(e.target.value)}
              className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs border border-slate-600"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Sender Filter */}
            <input
              type="text"
              placeholder="Filter by sender..."
              value={senderFilter}
              onChange={(e) => onSenderFilterChange(e.target.value)}
              className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs border border-slate-600 flex-1 min-w-[120px]"
            />
          </div>
        </div>
      )}

      {/* Task List Container */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span className="ml-2 text-slate-400">Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Mail className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-center text-sm">
              {allTasksCount === 0 ? 'No tasks found' : 'No tasks match your current filters'}
            </p>
            {allTasksCount > 0 && (
              <button
                onClick={onClearFilters}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-3 space-y-3">
            {tasks.map((task) => (
              <UnifiedTaskCard
                key={task.id}
                task={task}
                onSelect={onTaskClick}
                onStatusChange={onStatusChange}
                onPriorityChange={onPriorityChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

TaskList.displayName = 'TaskList';

export { TaskList };
export type { TaskListProps };