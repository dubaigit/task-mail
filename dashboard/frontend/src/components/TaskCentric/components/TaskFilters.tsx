import React from 'react';
import { Search } from 'lucide-react';

interface TaskFiltersProps {
  filter: 'all' | 'tasks' | 'non-tasks';
  setFilter: (filter: 'all' | 'tasks' | 'non-tasks') => void;
  dateFilter: 'today' | 'week' | 'month' | 'all';
  setDateFilter: (filter: 'today' | 'week' | 'month' | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  categoryCounts: Record<string, number>;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  filter,
  setFilter,
  dateFilter,
  setDateFilter,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  categoryCounts
}) => {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'all'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setFilter('tasks')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'tasks'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Tasks Only
          </button>
          <button
            onClick={() => setFilter('non-tasks')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === 'non-tasks'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Non-Tasks
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              dateFilter === 'today'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              dateFilter === 'week'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              dateFilter === 'month'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              dateFilter === 'all'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
            categoryFilter === 'all'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          All ({Object.values(categoryCounts).reduce((a, b) => a + b, 0)})
        </button>
        {Object.entries(categoryCounts).map(([category, count]) => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
              categoryFilter === category
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            {category} ({count})
          </button>
        ))}
      </div>
    </div>
  );
};