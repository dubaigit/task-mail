/**
 * Unified Task Store with Type Safety
 * Uses the unified core types with runtime validation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskCategory,
  TaskFilters,
  TaskStats,
  DEFAULT_TASK_VALUES,
  PRIORITY_ORDER 
} from '../types/core';
import { 
  migrateTaskObject, 
  migrateTasks
} from '../types/core/migrations';
import { 
  ValidationResult, 
  validateTask,
  validateTasks 
} from '../types/core/validation';

// ==========================================
// STORE STATE INTERFACE
// ==========================================

interface TaskStoreState {
  // Core data
  tasks: Task[];
  selectedTask: Task | null;
  
  // UI state
  filters: TaskFilters;
  loading: boolean;
  error: string | null;
  
  // Statistics
  stats: TaskStats;
  
  // Actions
  setTasks: (tasks: Task[] | any[]) => void;
  addTask: (task: Task | any) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setSelectedTask: (task: Task | null) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Advanced operations
  bulkUpdateTasks: (updates: Array<{ id: string; changes: Partial<Task> }>) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  completeTask: (taskId: string) => void;
  duplicateTask: (taskId: string) => void;
  
  // Filtering and search
  getFilteredTasks: () => Task[];
  searchTasks: (query: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksByPriority: (priority: TaskPriority) => Task[];
  getTasksByCategory: (category: TaskCategory) => Task[];
  
  // Statistics
  calculateStats: () => void;
  getProductivityMetrics: () => {
    completionRate: number;
    averageCompletionTime: number;
    tasksCompletedToday: number;
    overdueTasks: number;
  };
  
  // Data management
  importTasks: (tasks: any[]) => { successful: number; failed: number; errors: ValidationResult[] };
  exportTasks: () => Task[];
  clearAllTasks: () => void;
  resetStore: () => void;
}

// ==========================================
// STORE IMPLEMENTATION
// ==========================================

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      tasks: [],
      selectedTask: null,
      filters: {
        status: 'all' as TaskStatus | TaskStatus[] | 'all',
        priority: 'all' as TaskPriority | TaskPriority[] | 'all',
        search: '',
        tags: [],
        sortBy: 'priority' as 'priority' | 'dueDate' | 'createdAt' | 'urgency',
        sortOrder: 'desc' as 'asc' | 'desc',
        showCompleted: true
      },
      loading: false,
      error: null,
      stats: {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        blocked: 0,
        overdue: 0,
        byStatus: {} as Record<TaskStatus, number>,
        byPriority: {} as Record<TaskPriority, number>,
        byCategory: {} as Record<TaskCategory | string, number>,
        lastUpdated: new Date().toISOString(),
        completedThisWeek: 0,
        completedThisMonth: 0,
        averageCompletionTime: 0,
        productivityScore: 0
      },

      // ==========================================
      // BASIC CRUD OPERATIONS
      // ==========================================

      setTasks: (tasks: Task[] | any[]) => {
        try {
          const validatedTasks = validateTasks(tasks);
          
          if (!validatedTasks.valid && validatedTasks.errors.length > 0) {
            // Some tasks failed validation: ${validatedTasks.errors}
          }
          
          set({ 
            tasks: tasks as Task[],
            error: null 
          });
          get().calculateStats();
        } catch (error) {
          // Failed to set tasks: ${error}
          set({ error: 'Failed to load tasks' });
        }
      },

      addTask: (task: Task | any) => {
        try {
          let validatedTask: Task;
          
          // If it's not a valid Task, try to migrate it
          if (!task.status || !task.priority || !task.category) {
            validatedTask = migrateTaskObject(task);
          } else {
            validatedTask = task as Task;
          }
          
          // Validate the task
          const validation = validateTask(validatedTask);
          if (!validation.valid) {
            throw new Error(`Invalid task: ${validation.errors.length > 0 ? validation.errors.join(', ') : 'Unknown validation error'}`);
          }
          
          // Ensure unique ID
          validatedTask.id = validatedTask.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          validatedTask.updatedAt = new Date().toISOString();
          
          set(state => ({
            tasks: [...state.tasks, validatedTask],
            error: null
          }));
          
          get().calculateStats();
        } catch (error) {
          // Failed to add task: ${error}
          set({ error: `Failed to add task: ${error instanceof Error ? error.message : String(error)}` });
        }
      },

      updateTask: (id: string, updates: Partial<Task>) => {
        try {
          const now = new Date().toISOString();
          
          set(state => ({
            tasks: state.tasks.map(task => {
              if (task.id === id) {
                const updatedTask = {
                  ...task,
                  ...updates,
                  updatedAt: now,
                  // Handle completion
                  completedAt: updates.status === TaskStatus.COMPLETED && !task.completedAt 
                    ? now 
                    : task.completedAt
                };
                
                // Validate updated task
                const validation = validateTask(updatedTask);
                if (!validation.valid) {
                  // Task validation warnings: ${validation.errors}
                }
                
                return updatedTask;
              }
              return task;
            }),
            error: null
          }));
          
          // Update selected task if it's the one being updated
          const state = get();
          if (state.selectedTask?.id === id) {
            const updatedTask = state.tasks.find(t => t.id === id);
            if (updatedTask) {
              set({ selectedTask: updatedTask });
            }
          }
          
          get().calculateStats();
        } catch (error) {
          // Failed to update task: ${error}
          set({ error: `Failed to update task: ${error instanceof Error ? error.message : String(error)}` });
        }
      },

      deleteTask: (id: string) => {
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
          selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
          error: null
        }));
        get().calculateStats();
      },

      setSelectedTask: (task: Task | null) => {
        set({ selectedTask: task });
      },

      setFilters: (filters: Partial<TaskFilters>) => {
        set(state => ({
          filters: { ...state.filters, ...filters }
        }));
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      // ==========================================
      // ADVANCED OPERATIONS
      // ==========================================

      bulkUpdateTasks: (updates: Array<{ id: string; changes: Partial<Task> }>) => {
        const now = new Date().toISOString();
        
        set(state => ({
          tasks: state.tasks.map(task => {
            const update = updates.find(u => u.id === task.id);
            if (update) {
              return {
                ...task,
                ...update.changes,
                updatedAt: now
              };
            }
            return task;
          }),
          error: null
        }));
        
        get().calculateStats();
      },

      moveTask: (taskId: string, newStatus: TaskStatus) => {
        get().updateTask(taskId, { status: newStatus });
      },

      completeTask: (taskId: string) => {
        get().updateTask(taskId, { 
          status: TaskStatus.COMPLETED,
          progress: 100 
        });
      },

      duplicateTask: (taskId: string) => {
        const task = get().tasks.find(t => t.id === taskId);
        if (task) {
          const duplicatedTask: Task = {
            ...task,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `${task.title} (Copy)`,
            status: TaskStatus.TODO,
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: undefined
          };
          
          get().addTask(duplicatedTask);
        }
      },

      // ==========================================
      // FILTERING AND SEARCH
      // ==========================================

      getFilteredTasks: () => {
        const { tasks, filters } = get();
        
        let filteredTasks = [...tasks];
        
        // Filter by status
        if (filters.status && filters.status !== 'all') {
          if (Array.isArray(filters.status)) {
            filteredTasks = filteredTasks.filter(task => 
              filters.status?.includes(task.status)
            );
          } else {
            filteredTasks = filteredTasks.filter(task => task.status === filters.status);
          }
        }
        
        // Filter by priority
        if (filters.priority && filters.priority !== 'all') {
          if (Array.isArray(filters.priority)) {
            filteredTasks = filteredTasks.filter(task => 
              filters.priority?.includes(task.priority)
            );
          } else {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
          }
        }
        
        // Filter by category
        if (filters.category) {
          if (Array.isArray(filters.category)) {
            filteredTasks = filteredTasks.filter(task => 
              task.category && filters.category?.includes(task.category)
            );
          } else {
            filteredTasks = filteredTasks.filter(task => task.category && task.category === filters.category);
          }
        }
        
        // Search filter
        if (filters.search) {
          const query = filters.search.toLowerCase();
          filteredTasks = filteredTasks.filter(task =>
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query) ||
            task.tags.some(tag => tag.toLowerCase().includes(query))
          );
        }
        
        // Tag filter
        if (filters.tags && filters.tags.length > 0) {
          const tagsArray = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
          filteredTasks = filteredTasks.filter(task =>
            tagsArray.some(tag => task.tags.includes(tag))
          );
        }
        
        // Show completed filter
        if (!filters.showCompleted) {
          filteredTasks = filteredTasks.filter(task => 
            task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.DONE
          );
        }
        
        // Sort tasks
        if (filters.sortBy) {
          filteredTasks.sort((a, b) => {
            let comparison = 0;
            
            switch (filters.sortBy) {
              case 'priority':
                comparison = PRIORITY_ORDER.indexOf(b.priority) - PRIORITY_ORDER.indexOf(a.priority);
                break;
              case 'dueDate':
                if (!a.dueDate && !b.dueDate) comparison = 0;
                else if (!a.dueDate) comparison = 1;
                else if (!b.dueDate) comparison = -1;
                else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                break;
              case 'createdAt':
                comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                break;
              case 'title':
                comparison = a.title.localeCompare(b.title);
                break;
              case 'status':
                comparison = a.status.localeCompare(b.status);
                break;
              default:
                comparison = 0;
            }
            
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          });
        }
        
        return filteredTasks;
      },

      searchTasks: (query: string) => {
        const { tasks } = get();
        const searchQuery = query.toLowerCase();
        
        return tasks.filter(task =>
          task.title.toLowerCase().includes(searchQuery) ||
          task.description?.toLowerCase().includes(searchQuery) ||
          task.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
          task.sender?.toLowerCase().includes(searchQuery)
        );
      },

      getTasksByStatus: (status: TaskStatus) => {
        return get().tasks.filter(task => task.status === status);
      },

      getTasksByPriority: (priority: TaskPriority) => {
        return get().tasks.filter(task => task.priority === priority);
      },

      getTasksByCategory: (category: TaskCategory) => {
        return get().tasks.filter(task => task.category === category);
      },

      // ==========================================
      // STATISTICS
      // ==========================================

      calculateStats: () => {
        const { tasks } = get();
        const now = new Date();
        
        // Calculate completion metrics
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.DONE);
        
        const completedThisWeek = completedTasks.filter(t => 
          t.completedAt && new Date(t.completedAt) >= oneWeekAgo
        ).length;
        
        const completedThisMonth = completedTasks.filter(t => 
          t.completedAt && new Date(t.completedAt) >= oneMonthAgo
        ).length;
        
        // Calculate average completion time (in days) for tasks with both created and completed dates
        const tasksWithCompletionTime = completedTasks.filter(t => t.createdAt && t.completedAt);
        const averageCompletionTime = tasksWithCompletionTime.length > 0 
          ? tasksWithCompletionTime.reduce((sum, task) => {
              const created = new Date(task.createdAt!);
              const completed = new Date(task.completedAt!);
              return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / tasksWithCompletionTime.length
          : 0;
        
        // Simple productivity score (0-100) based on completion rate and timeliness
        const totalTasksThisMonth = tasks.filter(t => 
          t.createdAt && new Date(t.createdAt) >= oneMonthAgo
        ).length;
        const completionRate = totalTasksThisMonth > 0 ? completedThisMonth / totalTasksThisMonth : 0;
        const productivityScore = Math.round(completionRate * 100);
        
        const stats: TaskStats = {
          total: tasks.length,
          completed: completedTasks.length,
          pending: tasks.filter(t => t.status === TaskStatus.TODO).length,
          inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
          blocked: tasks.filter(t => t.status === TaskStatus.BLOCKED).length,
          overdue: tasks.filter(t => 
            t.dueDate && new Date(t.dueDate) < now && 
            t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.DONE
          ).length,
          
          // Count by status
          byStatus: Object.values(TaskStatus).reduce((acc, status) => {
            acc[status] = tasks.filter(t => t.status === status).length;
            return acc;
          }, {} as Record<TaskStatus, number>),
          
          // Count by priority
          byPriority: Object.values(TaskPriority).reduce((acc, priority) => {
            acc[priority] = tasks.filter(t => t.priority === priority).length;
            return acc;
          }, {} as Record<TaskPriority, number>),
          
          // Count by category
          byCategory: Object.values(TaskCategory).reduce((acc, category) => {
            acc[category] = tasks.filter(t => t.category === category).length;
            return acc;
          }, {} as Record<TaskCategory, number>),
          
          // New required properties
          completedThisWeek,
          completedThisMonth,
          averageCompletionTime,
          productivityScore,
          
          lastUpdated: new Date().toISOString()
        };
        
        set({ stats });
      },

      getProductivityMetrics: () => {
        const { tasks } = get();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const completedTasks = tasks.filter(t => 
          t.status === TaskStatus.COMPLETED || t.status === TaskStatus.DONE
        );
        
        const tasksCompletedToday = completedTasks.filter(t =>
          t.completedAt && new Date(t.completedAt) >= today
        ).length;
        
        const overdueTasks = tasks.filter(t =>
          t.dueDate && new Date(t.dueDate) < now &&
          t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.DONE
        ).length;
        
        const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
        
        // Calculate average completion time (in hours)
        const tasksWithCompletionTime = completedTasks.filter(t => 
          t.completedAt && t.createdAt
        );
        
        const averageCompletionTime = tasksWithCompletionTime.length > 0
          ? tasksWithCompletionTime.reduce((acc, task) => {
              const created = new Date(task.createdAt).getTime();
              const completed = new Date(task.completedAt!).getTime();
              return acc + (completed - created);
            }, 0) / tasksWithCompletionTime.length / (1000 * 60 * 60) // Convert to hours
          : 0;
        
        return {
          completionRate: Math.round(completionRate * 100) / 100,
          averageCompletionTime: Math.round(averageCompletionTime * 100) / 100,
          tasksCompletedToday,
          overdueTasks
        };
      },

      // ==========================================
      // DATA MANAGEMENT
      // ==========================================

      importTasks: (tasks: any[]) => {
        try {
          const migrated = migrateTasks(tasks);
          const validation = validateTasks(migrated);
          
          if (validation.valid && migrated.length > 0) {
            set(state => ({
              tasks: [...state.tasks, ...migrated as Task[]],
              error: null
            }));
            get().calculateStats();
          }
          
          return {
            successful: validation.valid ? migrated.length : 0,
            failed: validation.valid ? 0 : tasks.length,
            errors: validation.errors || []
          };
        } catch (error) {
          // Failed to import tasks: ${error}
          set({ error: 'Failed to import tasks' });
          return {
            successful: 0,
            failed: tasks.length,
            errors: []
          };
        }
      },

      exportTasks: () => {
        return get().tasks;
      },

      clearAllTasks: () => {
        set({ 
          tasks: [], 
          selectedTask: null,
          error: null
        });
        get().calculateStats();
      },

      resetStore: () => {
        set({
          tasks: [],
          selectedTask: null,
          filters: {
            status: 'all' as TaskStatus | TaskStatus[] | 'all',
            priority: 'all' as TaskPriority | TaskPriority[] | 'all',
            search: '',
            tags: [],
            sortBy: 'priority' as 'priority' | 'dueDate' | 'createdAt' | 'urgency',
            sortOrder: 'desc' as 'asc' | 'desc',
            showCompleted: true
          },
          loading: false,
          error: null,
          stats: {
            total: 0,
            completed: 0,
            pending: 0,
            inProgress: 0,
            blocked: 0,
            overdue: 0,
            byStatus: {} as Record<TaskStatus, number>,
            byPriority: {} as Record<TaskPriority, number>,
            byCategory: {} as Record<TaskCategory, number>,
            lastUpdated: new Date().toISOString(),
            completedThisWeek: 0,
            completedThisMonth: 0,
            averageCompletionTime: 0,
            productivityScore: 0
          }
        });
      }
    }),
    {
      name: 'task-store',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migrations if needed
        if (version === 0) {
          // Migrate from v0 to v1
          if (persistedState.tasks) {
            persistedState.tasks = migrateTasks(persistedState.tasks);
          }
        }
        return persistedState;
      }
    }
  )
);

// ==========================================
// SELECTOR HOOKS
// ==========================================

// Convenient selectors for common use cases
export const useTaskSelectors = () => {
  const store = useTaskStore();
  
  return {
    // Core selectors
    allTasks: store.tasks,
    filteredTasks: store.getFilteredTasks(),
    selectedTask: store.selectedTask,
    
    // Status-based selectors
    todoTasks: store.getTasksByStatus(TaskStatus.TODO),
    inProgressTasks: store.getTasksByStatus(TaskStatus.IN_PROGRESS),
    completedTasks: store.getTasksByStatus(TaskStatus.COMPLETED),
    blockedTasks: store.getTasksByStatus(TaskStatus.BLOCKED),
    
    // Priority-based selectors
    criticalTasks: store.getTasksByPriority(TaskPriority.CRITICAL),
    highPriorityTasks: store.getTasksByPriority(TaskPriority.HIGH),
    
    // Statistics
    stats: store.stats,
    productivity: store.getProductivityMetrics(),
    
    // UI state
    loading: store.loading,
    error: store.error,
    filters: store.filters
  };
};