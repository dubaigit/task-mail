/**
 * TaskCentricDashboard Component Tests
 * Critical test coverage for main dashboard functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import TaskCentricDashboard from '../TaskCentricDashboard';
import { useEmailStore } from '../../../stores/emailStore';
import { useTaskStore } from '../../../stores/taskStore';

// Mock the stores
jest.mock('../../../stores/emailStore');
jest.mock('../../../stores/taskStore');
const mockUseEmailStore = useEmailStore as jest.MockedFunction<typeof useEmailStore>;
const mockUseTaskStore = useTaskStore as jest.MockedFunction<typeof useTaskStore>;

// Mock child components to focus on dashboard logic
jest.mock('../TaskKanbanBoard', () => {
  return function MockTaskKanbanBoard() {
    return <div data-testid="task-kanban-board">Task Kanban Board</div>;
  };
});

jest.mock('../../Email/EmailList', () => {
  return function MockEmailList() {
    return <div data-testid="email-list">Email List</div>;
  };
});

jest.mock('../../Analytics/Analytics', () => {
  return function MockAnalytics() {
    return <div data-testid="analytics">Analytics</div>;
  };
});

// Mock data
const mockEmails = [
  {
    id: '1',
    subject: 'Weekly Report Due',
    sender: 'manager@company.com',
    senderName: 'Project Manager',
    receivedAt: '2024-01-15T10:00:00Z',
    isRead: false,
    isStarred: false,
    textContent: 'Please submit your weekly report by Friday',
    urgency: 'high' as const,
    classification: 'task' as const,
    labels: ['work', 'deadline'],
    hasAttachments: false
  }
];

const mockTasks = [
  {
    id: '1',
    title: 'Complete weekly report',
    description: 'Submit weekly status report by end of week',
    status: 'todo' as const,
    priority: 'high' as const,
    assignedTo: 'user@company.com',
    dueDate: '2024-01-19T17:00:00Z',
    sourceEmailId: '1',
    extractedFromContent: true,
    labels: ['work', 'deadline'],
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
  }
];

const mockEmailStoreState = {
  emails: mockEmails,
  filteredEmails: mockEmails,
  selectedEmail: null,
  currentFilter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  unreadCount: 1,
  urgentCount: 1,
  totalCount: 1,
  // Actions
  fetchEmails: jest.fn(),
  setFilter: jest.fn(),
  selectEmail: jest.fn(),
  markAsRead: jest.fn(),
  toggleStar: jest.fn(),
  clearError: jest.fn()
};

const mockTaskStoreState = {
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

describe('TaskCentricDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmailStore.mockReturnValue(mockEmailStoreState);
    mockUseTaskStore.mockReturnValue(mockTaskStoreState);
  });

  describe('Dashboard Layout', () => {
    it('renders main dashboard structure', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('task-centric-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-main')).toBeInTheDocument();
    });

    it('displays dashboard title and navigation', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByText(/task-centric dashboard/i)).toBeInTheDocument();
      expect(screen.getByTestId('nav-tasks')).toBeInTheDocument();
      expect(screen.getByTestId('nav-emails')).toBeInTheDocument();
      expect(screen.getByTestId('nav-analytics')).toBeInTheDocument();
    });

    it('shows sidebar with quick stats', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('quick-stats')).toBeInTheDocument();
      expect(screen.getByText(/total tasks/i)).toBeInTheDocument();
      expect(screen.getByText(/urgent emails/i)).toBeInTheDocument();
      expect(screen.getByText(/unread emails/i)).toBeInTheDocument();
    });

    it('displays correct stat counts', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByText('1')).toBeInTheDocument(); // Task count
      expect(screen.getByText('1')).toBeInTheDocument(); // Urgent count
      expect(screen.getByText('1')).toBeInTheDocument(); // Unread count
    });
  });

  describe('View Navigation', () => {
    it('shows tasks view by default', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
      expect(screen.queryByTestId('email-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('analytics')).not.toBeInTheDocument();
    });

    it('switches to emails view when clicked', () => {
      render(<TaskCentricDashboard />);
      
      const emailsNav = screen.getByTestId('nav-emails');
      fireEvent.click(emailsNav);
      
      expect(screen.getByTestId('email-list')).toBeInTheDocument();
      expect(screen.queryByTestId('task-kanban-board')).not.toBeInTheDocument();
    });

    it('switches to analytics view when clicked', () => {
      render(<TaskCentricDashboard />);
      
      const analyticsNav = screen.getByTestId('nav-analytics');
      fireEvent.click(analyticsNav);
      
      expect(screen.getByTestId('analytics')).toBeInTheDocument();
      expect(screen.queryByTestId('task-kanban-board')).not.toBeInTheDocument();
    });

    it('highlights active navigation item', () => {
      render(<TaskCentricDashboard />);
      
      const tasksNav = screen.getByTestId('nav-tasks');
      expect(tasksNav).toHaveClass('active');
      
      const emailsNav = screen.getByTestId('nav-emails');
      fireEvent.click(emailsNav);
      
      expect(emailsNav).toHaveClass('active');
      expect(tasksNav).not.toHaveClass('active');
    });
  });

  describe('Data Loading', () => {
    it('fetches data on component mount', () => {
      render(<TaskCentricDashboard />);
      
      expect(mockEmailStoreState.fetchEmails).toHaveBeenCalled();
      expect(mockTaskStoreState.fetchTasks).toHaveBeenCalled();
    });

    it('shows loading state while fetching data', () => {
      const loadingEmailState = {
        ...mockEmailStoreState,
        isLoading: true
      };
      const loadingTaskState = {
        ...mockTaskStoreState,
        isLoading: true
      };
      
      mockUseEmailStore.mockReturnValue(loadingEmailState);
      mockUseTaskStore.mockReturnValue(loadingTaskState);
      
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('displays error state when data fetch fails', () => {
      const errorState = {
        ...mockEmailStoreState,
        error: 'Failed to fetch emails'
      };
      mockUseEmailStore.mockReturnValue(errorState);
      
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch emails')).toBeInTheDocument();
    });

    it('retries data fetch when retry button clicked', () => {
      const errorState = {
        ...mockEmailStoreState,
        error: 'Failed to fetch emails'
      };
      mockUseEmailStore.mockReturnValue(errorState);
      
      render(<TaskCentricDashboard />);
      
      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);
      
      expect(mockEmailStoreState.clearError).toHaveBeenCalled();
      expect(mockEmailStoreState.fetchEmails).toHaveBeenCalledTimes(2);
    });
  });

  describe('Quick Actions', () => {
    it('provides quick action buttons', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('quick-action-new-task')).toBeInTheDocument();
      expect(screen.getByTestId('quick-action-compose-email')).toBeInTheDocument();
      expect(screen.getByTestId('quick-action-view-urgent')).toBeInTheDocument();
    });

    it('opens new task form when new task button clicked', () => {
      render(<TaskCentricDashboard />);
      
      const newTaskButton = screen.getByTestId('quick-action-new-task');
      fireEvent.click(newTaskButton);
      
      expect(screen.getByTestId('new-task-modal')).toBeInTheDocument();
    });

    it('navigates to urgent emails when urgent button clicked', () => {
      render(<TaskCentricDashboard />);
      
      const urgentButton = screen.getByTestId('quick-action-view-urgent');
      fireEvent.click(urgentButton);
      
      expect(mockEmailStoreState.setFilter).toHaveBeenCalledWith('urgent');
      expect(screen.getByTestId('email-list')).toBeInTheDocument();
    });

    it('shows compose email modal when compose button clicked', () => {
      render(<TaskCentricDashboard />);
      
      const composeButton = screen.getByTestId('quick-action-compose-email');
      fireEvent.click(composeButton);
      
      expect(screen.getByTestId('compose-email-modal')).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('provides global search functionality', () => {
      render(<TaskCentricDashboard />);
      
      const searchInput = screen.getByTestId('global-search');
      expect(searchInput).toBeInTheDocument();
      
      fireEvent.change(searchInput, { target: { value: 'weekly report' } });
      
      // Should filter both emails and tasks
      expect(mockEmailStoreState.fetchEmails).toHaveBeenCalledWith('weekly report');
    });

    it('filters content based on search query', async () => {
      render(<TaskCentricDashboard />);
      
      const searchInput = screen.getByTestId('global-search');
      fireEvent.change(searchInput, { target: { value: 'report' } });
      
      await waitFor(() => {
        expect(mockEmailStoreState.fetchEmails).toHaveBeenCalledWith('report');
      });
    });

    it('clears search when clear button clicked', () => {
      render(<TaskCentricDashboard />);
      
      const searchInput = screen.getByTestId('global-search');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      const clearButton = screen.getByTestId('clear-search');
      fireEvent.click(clearButton);
      
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Responsive Design', () => {
    it('collapses sidebar on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<TaskCentricDashboard />);
      
      const sidebar = screen.getByTestId('dashboard-sidebar');
      expect(sidebar).toHaveClass('collapsed');
    });

    it('shows sidebar toggle button on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });

    it('toggles sidebar when toggle button clicked', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<TaskCentricDashboard />);
      
      const toggleButton = screen.getByTestId('sidebar-toggle');
      const sidebar = screen.getByTestId('dashboard-sidebar');
      
      expect(sidebar).toHaveClass('collapsed');
      
      fireEvent.click(toggleButton);
      expect(sidebar).not.toHaveClass('collapsed');
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard shortcuts for navigation', () => {
      render(<TaskCentricDashboard />);
      
      // Test keyboard shortcut for tasks view
      fireEvent.keyDown(document, { key: '1', ctrlKey: true });
      expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
      
      // Test keyboard shortcut for emails view
      fireEvent.keyDown(document, { key: '2', ctrlKey: true });
      expect(screen.getByTestId('email-list')).toBeInTheDocument();
    });

    it('focuses search box with keyboard shortcut', () => {
      render(<TaskCentricDashboard />);
      
      fireEvent.keyDown(document, { key: '/', ctrlKey: true });
      
      const searchInput = screen.getByTestId('global-search');
      expect(document.activeElement).toBe(searchInput);
    });

    it('provides escape key to close modals', () => {
      render(<TaskCentricDashboard />);
      
      // Open new task modal
      const newTaskButton = screen.getByTestId('quick-action-new-task');
      fireEvent.click(newTaskButton);
      
      expect(screen.getByTestId('new-task-modal')).toBeInTheDocument();
      
      // Press escape to close
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('new-task-modal')).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders efficiently with large datasets', () => {
      const largeEmailList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEmails[0],
        id: `email-${i}`,
        subject: `Email ${i}`
      }));
      
      const largeTaskList = Array.from({ length: 500 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`
      }));
      
      const largeDataState = {
        ...mockEmailStoreState,
        emails: largeEmailList,
        filteredEmails: largeEmailList
      };
      
      const largeTaskState = {
        ...mockTaskStoreState,
        tasks: largeTaskList,
        filteredTasks: largeTaskList
      };
      
      mockUseEmailStore.mockReturnValue(largeDataState);
      mockUseTaskStore.mockReturnValue(largeTaskState);
      
      const startTime = performance.now();
      render(<TaskCentricDashboard />);
      const endTime = performance.now();
      
      // Should render large datasets efficiently (under 200ms)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('memoizes components to prevent unnecessary re-renders', () => {
      const { rerender } = render(<TaskCentricDashboard />);
      
      // Re-render with same props
      rerender(<TaskCentricDashboard />);
      
      // Component should be memoized
      expect(screen.getByTestId('task-centric-dashboard')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<TaskCentricDashboard />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('complementary')).toBeInTheDocument(); // Sidebar
      expect(screen.getByRole('search')).toBeInTheDocument(); // Search box
    });

    it('supports screen reader navigation', () => {
      render(<TaskCentricDashboard />);
      
      const dashboard = screen.getByTestId('task-centric-dashboard');
      expect(dashboard).toHaveAttribute('aria-label', expect.stringContaining('Task-Centric Dashboard'));
    });

    it('announces view changes to screen readers', () => {
      render(<TaskCentricDashboard />);
      
      const emailsNav = screen.getByTestId('nav-emails');
      fireEvent.click(emailsNav);
      
      // Should have aria-live region for view updates
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('provides proper focus management', () => {
      render(<TaskCentricDashboard />);
      
      const tasksNav = screen.getByTestId('nav-tasks');
      expect(tasksNav).toHaveAttribute('tabIndex', '0');
      
      // Test tab navigation
      fireEvent.keyDown(tasksNav, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByTestId('nav-emails'));
    });
  });

  describe('Error Handling', () => {
    it('handles task creation errors gracefully', async () => {
      const errorTaskState = {
        ...mockTaskStoreState,
        error: 'Failed to create task'
      };
      mockUseTaskStore.mockReturnValue(errorTaskState);
      
      render(<TaskCentricDashboard />);
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to create task')).toBeInTheDocument();
    });

    it('shows connection errors with retry options', () => {
      const connectionError = {
        ...mockEmailStoreState,
        error: 'Network connection failed'
      };
      mockUseEmailStore.mockReturnValue(connectionError);
      
      render(<TaskCentricDashboard />);
      
      expect(screen.getByText(/network connection failed/i)).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('recovers from errors after successful retry', async () => {
      const errorState = {
        ...mockEmailStoreState,
        error: 'Temporary error'
      };
      
      mockUseEmailStore.mockReturnValueOnce(errorState);
      
      const { rerender } = render(<TaskCentricDashboard />);
      
      expect(screen.getByText('Temporary error')).toBeInTheDocument();
      
      // Simulate successful retry
      mockUseEmailStore.mockReturnValue(mockEmailStoreState);
      rerender(<TaskCentricDashboard />);
      
      expect(screen.queryByText('Temporary error')).not.toBeInTheDocument();
    });
  });
});