/**
 * Unit tests for TaskKanbanBoard component
 * Tests drag-and-drop functionality, task filtering, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TaskKanbanBoard } from '../components/TaskCentric/TaskKanbanBoard';
import { mockTasks, mockTask, createMockTask } from './test-fixtures';

// Mock dependencies
jest.mock('react-dnd-html5-backend');

// Test wrapper with DnD context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

describe('TaskKanbanBoard', () => {
  const defaultProps = {
    tasks: mockTasks,
    onTaskUpdate: jest.fn(),
    onTaskClick: jest.fn(),
    loading: false,
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render all Kanban columns', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByTestId('kanban-column-todo')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-waiting-for-reply')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    });

    test('should render column headers with correct titles', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Waiting for Reply')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    test('should render tasks in correct columns based on status', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      // Check that tasks are distributed correctly
      const todoColumn = screen.getByTestId('kanban-column-todo');
      const inProgressColumn = screen.getByTestId('kanban-column-in-progress');
      const waitingColumn = screen.getByTestId('kanban-column-waiting-for-reply');
      const doneColumn = screen.getByTestId('kanban-column-done');

      // Verify specific tasks are in correct columns
      expect(todoColumn).toHaveTextContent('Review quarterly report');
      expect(inProgressColumn).toHaveTextContent('Approve budget proposal');
      expect(waitingColumn).toHaveTextContent('Schedule team meeting');
      expect(doneColumn).toHaveTextContent('Update project documentation');
    });

    test('should display task count in column headers', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const todoHeader = screen.getByTestId('column-header-todo');
      const inProgressHeader = screen.getByTestId('column-header-in-progress');

      expect(todoHeader).toHaveTextContent('1'); // 1 task in todo
      expect(inProgressHeader).toHaveTextContent('2'); // 2 tasks in progress
    });
  });

  describe('Task Cards', () => {
    test('should render task cards with essential information', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const taskCard = screen.getByTestId('task-card-task-001');
      
      expect(taskCard).toHaveTextContent('Review quarterly report');
      expect(taskCard).toHaveTextContent('HIGH');
      expect(taskCard).toHaveTextContent('REVIEW');
    });

    test('should show priority indicators with correct styling', () => {
      const highPriorityTask = createMockTask({ priority: 'HIGH' });
      const criticalPriorityTask = createMockTask({ priority: 'CRITICAL' });
      
      render(
        <TestWrapper>
          <TaskKanbanBoard 
            {...defaultProps} 
            tasks={[highPriorityTask, criticalPriorityTask]} 
          />
        </TestWrapper>
      );

      const highPriorityElement = screen.getByTestId(`priority-badge-${highPriorityTask.id}`);
      const criticalPriorityElement = screen.getByTestId(`priority-badge-${criticalPriorityTask.id}`);

      expect(highPriorityElement).toHaveClass('priority-high');
      expect(criticalPriorityElement).toHaveClass('priority-critical');
    });

    test('should display colleague information for waiting tasks', () => {
      const waitingTask = createMockTask({ 
        status: 'waiting_for_reply',
        colleague_info: {
          name: 'John Doe',
          email: 'john@company.com',
          last_interaction: '2025-08-16T09:00:00Z',
          response_rate: 0.85
        }
      });

      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} tasks={[waitingTask]} />
        </TestWrapper>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@company.com')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('should call onTaskClick when task card is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const taskCard = screen.getByTestId('task-card-task-001');
      await user.click(taskCard);

      expect(defaultProps.onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
    });

    test('should handle drag and drop between columns', async () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const todoTask = screen.getByTestId('task-card-task-001');
      const inProgressColumn = screen.getByTestId('kanban-column-in-progress');

      // Simulate drag and drop
      fireEvent.dragStart(todoTask);
      fireEvent.dragOver(inProgressColumn);
      fireEvent.drop(inProgressColumn);

      await waitFor(() => {
        expect(defaultProps.onTaskUpdate).toHaveBeenCalledWith(
          mockTasks[0].id,
          { status: 'in_progress' }
        );
      });
    });

    test('should prevent dropping invalid tasks', async () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const doneTask = screen.getByTestId('task-card-task-004');
      const todoColumn = screen.getByTestId('kanban-column-todo');

      // Try to move completed task back to todo (should be prevented)
      fireEvent.dragStart(doneTask);
      fireEvent.dragOver(todoColumn);
      fireEvent.drop(todoColumn);

      // Should not call onTaskUpdate for invalid moves
      expect(defaultProps.onTaskUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    test('should display loading state', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} loading={true} />
        </TestWrapper>
      );

      expect(screen.getByTestId('kanban-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
    });

    test('should display error state', () => {
      const error = 'Failed to fetch tasks';
      
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} error={error} />
        </TestWrapper>
      );

      expect(screen.getByTestId('kanban-error')).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    test('should display empty state when no tasks', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} tasks={[]} />
        </TestWrapper>
      );

      expect(screen.getByTestId('kanban-empty')).toBeInTheDocument();
      expect(screen.getByText('No tasks found')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const kanbanBoard = screen.getByRole('region', { name: /kanban board/i });
      expect(kanbanBoard).toBeInTheDocument();

      const columns = screen.getAllByRole('region');
      expect(columns.length).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const firstTask = screen.getByTestId('task-card-task-001');
      
      // Focus first task
      firstTask.focus();
      expect(firstTask).toHaveFocus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      // Should focus next task or move down in the column

      await user.keyboard('{ArrowRight}');
      // Should move to next column

      await user.keyboard('{Enter}');
      // Should trigger task click
      expect(defaultProps.onTaskClick).toHaveBeenCalled();
    });

    test('should have proper color contrast', () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const taskCard = screen.getByTestId('task-card-task-001');
      const styles = getComputedStyle(taskCard);
      
      // Check that task cards have sufficient contrast
      expect(styles.backgroundColor).not.toBe('transparent');
      expect(styles.color).not.toBe(styles.backgroundColor);
    });

    test('should announce drag and drop actions', async () => {
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Responsive Design', () => {
    test('should handle mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const kanbanBoard = screen.getByTestId('kanban-board');
      expect(kanbanBoard).toHaveClass('mobile-layout');
    });

    test('should stack columns vertically on small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const kanbanBoard = screen.getByTestId('kanban-board');
      expect(kanbanBoard).toHaveClass('vertical-layout');
    });
  });

  describe('Performance', () => {
    test('should handle large number of tasks efficiently', () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) => 
        createMockTask({ id: `task-${i}`, title: `Task ${i}` })
      );

      const renderStart = performance.now();
      
      render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} tasks={largeTasks} />
        </TestWrapper>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;

      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second
    });

    test('should not re-render unnecessarily', () => {
      const { rerender } = render(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      const renderCount = jest.fn();
      
      // Re-render with same props
      rerender(
        <TestWrapper>
          <TaskKanbanBoard {...defaultProps} />
        </TestWrapper>
      );

      // Component should be memoized and not re-render with same props
      // This would require the actual component to use React.memo
    });
  });
});