import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import Button from '../ui/ModernButton';
import { Input } from '../ui/input';
import { StatusBadge as Badge } from '../ui/TaskCard/components/StatusBadge';
import SwipeableTaskCard from './SwipeableTaskCard';
import {
  Filter,
  SortAsc,
  SortDesc,
  Plus,
  Search,
  X,
  CheckSquare,
  Clock,
  AlertTriangle,
  Archive,
  List,
  Grid3x3
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Task, TaskStatus, TaskPriority } from '../../types';

interface MobileTaskListProps {
  tasks: Task[];
  onTaskUpdate: (id: string, updates: Partial<Task>) => void;
  onTaskDelete: (id: string) => void;
  onTaskAdd: (task: Partial<Task>) => void;
  searchQuery?: string;
  isOffline?: boolean;
}

type SortOption = 'priority' | 'dueDate' | 'title' | 'status' | 'createdAt';
type ViewMode = 'list' | 'grid';

const MobileTaskList: React.FC<MobileTaskListProps> = ({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onTaskAdd,
  searchQuery = '',
  isOffline = false
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Combine external and local search
  const effectiveSearch = searchQuery || localSearch;

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks;

    // Apply search filter
    if (effectiveSearch) {
      const query = effectiveSearch.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.tags.some(tag => tag.toLowerCase().includes(query)) ||
        task.sender?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Sort tasks
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'priority':
          const priorityOrder: Record<TaskPriority, number> = { 
            [TaskPriority.CRITICAL]: 4, 
            [TaskPriority.URGENT]: 4, 
            [TaskPriority.HIGH]: 3, 
            [TaskPriority.MEDIUM]: 2, 
            [TaskPriority.LOW]: 1 
          };
          comparison = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
          break;
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [tasks, effectiveSearch, statusFilter, priorityFilter, sortBy, sortOrder]);

  // Task statistics
  const taskStats = useMemo(() => {
    const total = filteredAndSortedTasks.length;
    const completed = filteredAndSortedTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgress = filteredAndSortedTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const overdue = filteredAndSortedTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.COMPLETED
    ).length;

    return { total, completed, inProgress, overdue };
  }, [filteredAndSortedTasks]);

  // Handle quick task creation
  const handleQuickAdd = useCallback(() => {
    if (newTaskTitle.trim()) {
      onTaskAdd({
        title: newTaskTitle.trim(),
        description: '',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setNewTaskTitle('');
      setShowAddTask(false);
    }
  }, [newTaskTitle, onTaskAdd]);

  // Handle filter reset
  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setLocalSearch('');
    setSortBy('priority');
    setSortOrder('desc');
  }, []);

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || effectiveSearch;

  return (
    <div className="mobile-task-list h-full flex flex-col">
      {/* Header Section */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        {/* Stats Bar */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="font-medium text-foreground">{taskStats.total}</span>
                <span className="text-muted-foreground">tasks</span>
              </div>
              {taskStats.completed > 0 && (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckSquare className="w-3 h-3" />
                  <span>{taskStats.completed}</span>
                </div>
              )}
              {taskStats.inProgress > 0 && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <Clock className="w-3 h-3" />
                  <span>{taskStats.inProgress}</span>
                </div>
              )}
              {taskStats.overdue > 0 && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{taskStats.overdue}</span>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded touch-feedback",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded touch-feedback",
                  viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        {!searchQuery && (
          <div className="p-4 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tasks..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant={hasActiveFilters ? "primary" : "outline"}
                  
                  className="text-xs"
                >
                  <Filter className="w-3 h-3 mr-1" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0.5">!</Badge>
                  )}
                </Button>

                {/* Sort Button */}
                <Button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  variant="outline"
                  
                  className="text-xs"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-3 h-3 mr-1" /> : <SortDesc className="w-3 h-3 mr-1" />}
                  Sort
                </Button>

                {hasActiveFilters && (
                  <Button
                    onClick={resetFilters}
                    variant="secondary"
                    
                    className="text-xs text-muted-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Add Task Button */}
              <Button
                onClick={() => setShowAddTask(!showAddTask)}
                
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Task
              </Button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="space-y-3 pt-2 border-t slide-in-down">
                <div className="grid grid-cols-2 gap-3">
                  {/* Status Filter */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    >
                      <option value="all">All Status</option>
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as any)}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                  >
                    <option value="priority">Priority</option>
                    <option value="dueDate">Due Date</option>
                    <option value="title">Title</option>
                    <option value="status">Status</option>
                    <option value="createdAt">Created Date</option>
                  </select>
                </div>
              </div>
            )}

            {/* Quick Add Task */}
            {showAddTask && (
              <div className="pt-2 border-t slide-in-down">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter task title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQuickAdd()}
                    className="flex-1 text-sm"
                    autoFocus
                  />
                  <Button
                    onClick={handleQuickAdd}
                    disabled={!newTaskTitle.trim()}
                    
                  >
                    Add
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddTask(false);
                      setNewTaskTitle('');
                    }}
                    variant="outline"
                    
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <Archive className="w-12 h-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {effectiveSearch ? 'No tasks match your search' : 'No tasks yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {effectiveSearch
                ? 'Try adjusting your search terms or filters'
                : 'Create your first task to get started'
              }
            </p>
            {!effectiveSearch && (
              <Button
                onClick={() => setShowAddTask(true)}
                className="text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Task
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(
            "p-4",
            viewMode === 'grid' && "grid grid-cols-1 gap-3"
          )}>
            {filteredAndSortedTasks.map((task) => (
              <SwipeableTaskCard
                key={task.id}
                task={task}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={onTaskDelete}
                onTaskEdit={(task) => setSelectedTask(task.id)}
                isSelected={selectedTask === task.id}
                compact={viewMode === 'grid'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (if no header actions) */}
      {searchQuery && (
        <button
          onClick={() => setShowAddTask(true)}
          className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center touch-feedback hover:scale-105 transition-transform z-30"
          aria-label="Add new task"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div className="sticky bottom-0 bg-orange-100 border-t border-orange-200 p-3 text-center">
          <p className="text-sm text-orange-700">
            You're offline. Changes will sync when you reconnect.
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileTaskList;