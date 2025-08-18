import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { emailApi } from '../utils/apiClient';
import { createStoreErrorHandler } from '../utils/errorHandler';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'WAITING_FOR_REPLY' | 'DONE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  due_date?: string;
  email_id?: number;
  created_at?: string;
  updated_at?: string;
  assigned_to?: string;
  tags?: string[];
}

interface TaskState {
  // State
  tasks: Task[];
  isGenerating: boolean;
  error: string | null;
  
  // Computed values
  tasksByStatus: {
    TODO: Task[];
    IN_PROGRESS: Task[];
    WAITING_FOR_REPLY: Task[];
    DONE: Task[];
  };
  
  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  deleteTask: (id: number) => void;
  moveTask: (taskId: number, newStatus: Task['status']) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  
  // Async actions
  generateTasks: (emailId: number) => Promise<void>;
  createTask: (task: Omit<Task, 'id'>) => Promise<void>;
}

const handleError = createStoreErrorHandler('taskStore');

export const useTaskStore = create<TaskState>()(
  devtools(
    (set, get) => ({
      // Initial state
      tasks: [],
      isGenerating: false,
      error: null,
      
      // Computed values
      get tasksByStatus() {
        const { tasks } = get();
        return {
          TODO: tasks.filter(t => t.status === 'TODO'),
          IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
          WAITING_FOR_REPLY: tasks.filter(t => t.status === 'WAITING_FOR_REPLY'),
          DONE: tasks.filter(t => t.status === 'DONE'),
        };
      },
      
      // Actions
      setTasks: (tasks) => set({ tasks }),
      
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task],
      })),
      
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === id ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
        ),
      })),
      
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(task => task.id !== id),
      })),
      
      moveTask: (taskId, newStatus) => {
        const { updateTask } = get();
        updateTask(taskId, { status: newStatus });
      },
      
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      
      setError: (error) => set({ error }),
      
      // Async actions
      generateTasks: async (emailId) => {
        const { setIsGenerating, setError, addTask } = get();
        setIsGenerating(true);
        setError(null);
        
        try {
          const response = await emailApi.generateTasks(emailId);
          if (response.error) {
            throw new Error(response.error);
          }
          
          if (Array.isArray(response.data)) {
            response.data.forEach((task: any) => {
              addTask({
                id: task.id || Date.now() + Math.random(),
                title: task.title || 'Untitled Task',
                description: task.description || '',
                status: task.status || 'TODO',
                priority: task.priority || 'MEDIUM',
                due_date: task.due_date,
                email_id: emailId,
                created_at: new Date().toISOString(),
                tags: task.tags || [],
              });
            });
          }
        } catch (error) {
          setError(handleError(error, 'generateTasks'));
        } finally {
          setIsGenerating(false);
        }
      },
      
      createTask: async (taskData) => {
        const { addTask, setError } = get();
        
        try {
          // In a real app, this would make an API call
          // For now, we'll create it locally
          const newTask: Task = {
            ...taskData,
            id: Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          addTask(newTask);
        } catch (error) {
          setError(handleError(error, 'createTask'));
        }
      },
    })
  )
);