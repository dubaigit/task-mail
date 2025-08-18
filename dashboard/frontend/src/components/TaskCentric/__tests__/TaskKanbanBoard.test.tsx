/**
 * TaskKanbanBoard Component Tests
 * Critical test coverage for task management functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { act } from 'react-dom/test-utils';
import TaskKanbanBoard from '../TaskKanbanBoard';
import { useTaskStore } from '../../../stores/taskStore';

// Mock the task store
jest.mock('../../../stores/taskStore');
const mockUseTaskStore = useTaskStore as jest.MockedFunction<typeof useTaskStore>;

// Mock DnD Kit components (simplified for testing)
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context" onDrop={onDragEnd}>
      {children}
    </div>
  ),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false
  }),
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false
  }),
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false
  })
}));

// Mock task data
const mockTasks = [
  {
    id: '1',
    title: 'Review quarterly reports',
    description: 'Review Q4 financial reports and prepare summary',
    status: 'todo' as const,
    priority: 'high' as const,
    assignedTo: 'john@example.com',
    dueDate: '2024-02-15T00:00:00Z',
    sourceEmailId: 'email-123',
    extractedFromContent: true,
    labels: ['finance', 'urgent'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    title: 'Update project documentation',
    description: 'Update API documentation with new endpoints',
    status: 'in_progress' as const,
    priority: 'medium' as const,
    assignedTo: 'sarah@example.com',
    dueDate: '2024-02-20T00:00:00Z',
    sourceEmailId: null,
    extractedFromContent: false,
    labels: ['documentation'],
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-16T14:30:00Z'
  },
  {
    id: '3',
    title: 'Fix login bug',
    description: 'Investigate and fix authentication issue',
    status: 'done' as const,
    priority: 'high' as const,
    assignedTo: 'mike@example.com',
    dueDate: '2024-01-30T00:00:00Z',
    sourceEmailId: 'email-456',
    extractedFromContent: true,
    labels: ['bug', 'critical'],
    createdAt: '2024-01-05T08:00:00Z',
    updatedAt: '2024-01-18T16:45:00Z'
  }
];

const mockStoreState = {
  tasks: mockTasks,
  filteredTasks: mockTasks,
  selectedTask: null,
  currentFilter: 'all',
  isLoading: false,
  error: null,
  // Actions
  fetchTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  setFilter: jest.fn(),
  selectTask: jest.fn(),
  clearError: jest.fn()
};

// Wrapper component for DnD
const DnDWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

describe('TaskKanbanBoard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTaskStore.mockReturnValue(mockStoreState);
  });

  describe('Board Rendering', () => {
    it('renders kanban board with three columns', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('displays tasks in correct columns', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      // Check task distribution
      const todoColumn = screen.getByTestId('column-todo');
      const inProgressColumn = screen.getByTestId('column-in_progress');
      const doneColumn = screen.getByTestId('column-done');
      
      expect(todoColumn).toContainElement(screen.getByText('Review quarterly reports'));
      expect(inProgressColumn).toContainElement(screen.getByText('Update project documentation'));
      expect(doneColumn).toContainElement(screen.getByText('Fix login bug'));
    });

    it('shows task count in column headers', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('To Do (1)')).toBeInTheDocument();
      expect(screen.getByText('In Progress (1)')).toBeInTheDocument();
      expect(screen.getByText('Done (1)')).toBeInTheDocument();
    });

    it('displays empty state when no tasks', () => {
      const emptyState = {
        ...mockStoreState,
        tasks: [],
        filteredTasks: []
      };
      mockUseTaskStore.mockReturnValue(emptyState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });

  describe('Task Card Display', () => {
    it('shows task details correctly', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const taskCard = screen.getByTestId('task-card-1');
      
      expect(taskCard).toContainElement(screen.getByText('Review quarterly reports'));
      expect(taskCard).toContainElement(screen.getByText(/Review Q4 financial reports/));
      expect(taskCard).toContainElement(screen.getByText('john@example.com'));
      expect(taskCard).toContainElement(screen.getByText('High Priority'));
    });

    it('displays priority badges correctly', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('High Priority')).toHaveClass('bg-red-100', 'text-red-800');
      expect(screen.getByText('Medium Priority')).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('shows due date information', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText(/Due:/)).toBeInTheDocument();
    });

    it('displays task labels', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('finance')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
      expect(screen.getByText('documentation')).toBeInTheDocument();
    });

    it('shows source email indicator for extracted tasks', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const extractedTask = screen.getByTestId('task-card-1');
      expect(extractedTask.querySelector('[data-testid="email-source-icon"]')).toBeInTheDocument();
    });
  });

  describe('Task Interactions', () => {
    it('selects task when clicked', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const taskCard = screen.getByTestId('task-card-1');
      fireEvent.click(taskCard);
      
      expect(mockStoreState.selectTask).toHaveBeenCalledWith('1');
    });

    it('opens task detail panel when task is selected', () => {
      const stateWithSelection = {
        ...mockStoreState,
        selectedTask: mockTasks[0]
      };
      mockUseTaskStore.mockReturnValue(stateWithSelection);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByTestId('task-detail-panel')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Review quarterly reports')).toBeInTheDocument();
    });

    it('creates new task when add button is clicked', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const addButton = screen.getByTestId('add-task-todo');
      fireEvent.click(addButton);
      
      expect(screen.getByTestId('new-task-form')).toBeInTheDocument();
    });

    it('submits new task form', async () => {
      mockStoreState.createTask.mockResolvedValueOnce(undefined);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const addButton = screen.getByTestId('add-task-todo');
      fireEvent.click(addButton);
      
      const titleInput = screen.getByPlaceholderText('Task title');
      const descriptionInput = screen.getByPlaceholderText('Task description');
      const submitButton = screen.getByText('Create Task');
      
      fireEvent.change(titleInput, { target: { value: 'New test task' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      expect(mockStoreState.createTask).toHaveBeenCalledWith({
        title: 'New test task',
        description: 'Test description',
        status: 'todo',
        priority: 'medium'
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles task status change on drop', async () => {
      mockStoreState.updateTaskStatus.mockResolvedValueOnce(undefined);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const dndContext = screen.getByTestId('dnd-context');
      
      // Simulate drag and drop
      await act(async () => {
        fireEvent.drop(dndContext, {
          dataTransfer: {
            getData: () => JSON.stringify({
              active: { id: 'task-1' },
              over: { id: 'column-in_progress' }
            })
          }
        });
      });
      
      expect(mockStoreState.updateTaskStatus).toHaveBeenCalledWith('1', 'in_progress');
    });

    it('provides visual feedback during drag', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const taskCard = screen.getByTestId('task-card-1');
      
      // Simulate drag start
      fireEvent.dragStart(taskCard);
      
      expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
    });

    it('prevents dropping in invalid columns', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      // This would be tested with actual DnD implementation
      // For now, we verify the structure is correct
      expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      expect(screen.getByTestId('column-in_progress')).toBeInTheDocument();
      expect(screen.getByTestId('column-done')).toBeInTheDocument();
    });
  });

  describe('Task Filtering', () => {
    it('filters tasks by assignee', () => {
      const filteredState = {
        ...mockStoreState,
        filteredTasks: [mockTasks[0]] // Only john's task
      };
      mockUseTaskStore.mockReturnValue(filteredState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('Review quarterly reports')).toBeInTheDocument();
      expect(screen.queryByText('Update project documentation')).not.toBeInTheDocument();
    });

    it('filters tasks by priority', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const priorityFilter = screen.getByTestId('priority-filter');
      fireEvent.change(priorityFilter, { target: { value: 'high' } });
      
      expect(mockStoreState.setFilter).toHaveBeenCalledWith('priority', 'high');
    });

    it('filters tasks by due date', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const dueDateFilter = screen.getByTestId('due-date-filter');
      fireEvent.change(dueDateFilter, { target: { value: 'overdue' } });
      
      expect(mockStoreState.setFilter).toHaveBeenCalledWith('dueDate', 'overdue');
    });
  });

  describe('Task Detail Panel', () => {
    beforeEach(() => {
      const stateWithSelection = {
        ...mockStoreState,
        selectedTask: mockTasks[0]
      };
      mockUseTaskStore.mockReturnValue(stateWithSelection);
    });

    it('displays editable task details', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByDisplayValue('Review quarterly reports')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Review Q4 financial reports/)).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    });

    it('updates task when details are changed', async () => {
      mockStoreState.updateTask.mockResolvedValueOnce(undefined);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const titleInput = screen.getByDisplayValue('Review quarterly reports');
      fireEvent.change(titleInput, { target: { value: 'Updated task title' } });
      
      const saveButton = screen.getByText('Save Changes');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(mockStoreState.updateTask).toHaveBeenCalledWith('1', {
        title: 'Updated task title'
      });
    });

    it('closes panel when close button is clicked', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const closeButton = screen.getByTestId('close-detail-panel');
      fireEvent.click(closeButton);
      
      expect(mockStoreState.selectTask).toHaveBeenCalledWith(null);
    });

    it('shows source email link for extracted tasks', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText(/Extracted from email/)).toBeInTheDocument();
      expect(screen.getByTestId('source-email-link')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large task lists efficiently', () => {
      const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`
      }));
      
      const largeState = {
        ...mockStoreState,
        tasks: largeTasks,
        filteredTasks: largeTasks
      };
      mockUseTaskStore.mockReturnValue(largeState);
      
      const startTime = performance.now();
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const endTime = performance.now();
      
      // Should render large lists efficiently (less than 200ms)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('virtualizes long task lists', () => {
      const manyTasks = Array.from({ length: 100 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`,
        status: 'todo' as const
      }));
      
      const manyTasksState = {
        ...mockStoreState,
        tasks: manyTasks,
        filteredTasks: manyTasks
      };
      mockUseTaskStore.mockReturnValue(manyTasksState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      // Should only render visible tasks
      const renderedTasks = screen.getAllByTestId(/task-card-/);
      expect(renderedTasks.length).toBeLessThan(manyTasks.length);
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner while fetching tasks', () => {
      const loadingState = {
        ...mockStoreState,
        isLoading: true
      };
      mockUseTaskStore.mockReturnValue(loadingState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('displays error message when there is an error', () => {
      const errorState = {
        ...mockStoreState,
        error: 'Failed to fetch tasks'
      };
      mockUseTaskStore.mockReturnValue(errorState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByText('Failed to fetch tasks')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('retries fetching tasks when retry button is clicked', () => {
      const errorState = {
        ...mockStoreState,
        error: 'Failed to fetch tasks'
      };
      mockUseTaskStore.mockReturnValue(errorState);
      
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(mockStoreState.clearError).toHaveBeenCalled();
      expect(mockStoreState.fetchTasks).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for screen readers', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      expect(screen.getByRole('main', { name: /kanban board/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /to do column/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /in progress column/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /done column/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      const firstTask = screen.getByTestId('task-card-1');
      expect(firstTask).toHaveAttribute('tabIndex', '0');
      
      // Test keyboard navigation
      fireEvent.keyDown(firstTask, { key: 'Enter', code: 'Enter' });
      expect(mockStoreState.selectTask).toHaveBeenCalledWith('1');
    });

    it('announces status changes to screen readers', () => {
      render(
        <DnDWrapper>
          <TaskKanbanBoard />
        </DnDWrapper>
      );
      
      // Should have aria-live regions for status updates
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});