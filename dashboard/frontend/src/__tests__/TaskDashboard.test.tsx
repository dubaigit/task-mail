import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TaskDashboard from '../components/TaskCentric/TaskDashboard';

// Mock API calls
jest.mock('../services/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('TaskDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: 'task-1',
                taskTitle: 'Review quarterly report',
                taskDescription: 'Review and provide feedback on Q4 report',
                priority: 'high',
                status: 'pending',
                confidence: 85,
                draftGenerated: false,
                sender: 'manager@company.com',
                senderEmail: 'manager@company.com',
                estimatedTime: '60 min',
                tags: ['review', 'quarterly'],
                relatedEmails: 1,
                date_received: '2024-01-15T10:00:00Z'
              },
              {
                id: 'task-2',
                taskTitle: 'Schedule team meeting',
                taskDescription: 'Schedule follow-up meeting with the team',
                priority: 'medium',
                status: 'completed',
                confidence: 92,
                draftGenerated: true,
                sender: 'colleague@company.com',
                senderEmail: 'colleague@company.com',
                estimatedTime: '15 min',
                tags: ['meeting'],
                relatedEmails: 2,
                date_received: '2024-01-14T14:30:00Z'
              }
            ],
            hasMore: false
          })
        });
      }
      
      if (url.includes('/api/sync-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            emailsInPostgres: 850,
            emailsInAppleMail: 1000,
            percentComplete: 85,
            isSynced: false,
            emailBreakdown: {
              total: 1000,
              tasks: { count: 300, percentage: 30 },
              fyi: { count: 700, percentage: 70 },
              today: 50,
              week: 200,
              month: 500
            },
            syncState: {
              isInitialSyncComplete: true,
              isSyncing: false
            }
          })
        });
      }
      
      if (url.includes('/api/tasks/category-counts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            urgent: 5,
            today: 12,
            pending: 25,
            completed: 18
          })
        });
      }
      
      if (url.includes('/api/user/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: 'Test User',
            email: 'test@example.com',
            displayName: 'Test User'
          })
        });
      }
      
      // Default fallback
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' })
      });
    });
  });

  it('renders dashboard with task columns', async () => {
    renderWithRouter(<TaskDashboard />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
      expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
    });
    
    // Check for task filter buttons
    expect(screen.getByText(/Tasks \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText(/All \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText(/Info \(\d+\)/)).toBeInTheDocument();
  });

  it('displays tasks in correct columns', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      // Should show pending task
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
      
      // Should show completed task
      expect(screen.getByText('Schedule team meeting')).toBeInTheDocument();
    });
  });

  it('handles task status updates', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
    });

    // Mock the status update API call
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );

    // Find and click a task status button (this would depend on your UI implementation)
    const taskCard = screen.getByText('Review quarterly report').closest('[data-testid="task-card"]');
    if (taskCard) {
      const statusButton = taskCard.querySelector('[data-testid="status-button"]');
      if (statusButton) {
        fireEvent.click(statusButton);
      }
    }

    // Verify API call was made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/task-1/status'),
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  it('filters tasks by type', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
    });

    // Click on "All" filter
    const allButton = screen.getByText(/All \(\d+\)/);
    fireEvent.click(allButton);

    // Should still show tasks (since we're showing all)
    expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
  });

  it('filters tasks by date range', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
    });

    // Click on "Today" filter
    const todayButton = screen.getByText(/Today \(\d+\)/);
    fireEvent.click(todayButton);

    // Should trigger a new API call with date filter
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dateRange=today'),
        expect.any(Object)
      );
    });
  });

  it('handles search functionality', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search emails, tasks, or...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search emails, tasks, or...');
    
    // Type in search query
    fireEvent.change(searchInput, { target: { value: 'quarterly report' } });
    
    // Should trigger search after typing
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=quarterly%20report'),
        expect.any(Object)
      );
    });
  });

  it('displays sync status correctly', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('All systems operational')).toBeInTheDocument();
    });

    // Should show email counts
    expect(screen.getByText(/850.*emails/)).toBeInTheDocument();
  });

  it('handles AI operations', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Manual Sync')).toBeInTheDocument();
    });

    // Mock AI sync API call
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );

    // Click manual sync button
    const syncButton = screen.getByText('Manual Sync');
    fireEvent.click(syncButton);

    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/sync',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  it('opens AI chat modal', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Open AI Chat')).toBeInTheDocument();
    });

    // Click AI chat button
    const aiChatButton = screen.getByLabelText('Open AI Chat');
    fireEvent.click(aiChatButton);

    // Should open AI chat modal
    await waitFor(() => {
      expect(screen.getByText('AI Email Assistant')).toBeInTheDocument();
    });
  });

  it('handles keyboard shortcuts', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search emails, tasks, or...')).toBeInTheDocument();
    });

    // Test search shortcut (/)
    fireEvent.keyDown(document, { key: '/', code: 'Slash' });
    
    const searchInput = screen.getByPlaceholderText('Search emails, tasks, or...');
    expect(searchInput).toHaveFocus();

    // Test filter shortcuts (Ctrl+1, Ctrl+2, etc.)
    fireEvent.keyDown(document, { key: '1', code: 'Digit1', ctrlKey: true });
    
    // Should activate tasks filter
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=tasks'),
        expect.any(Object)
      );
    });
  });

  it('handles error states gracefully', async () => {
    // Mock API error
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })
    );

    renderWithRouter(<TaskDashboard />);
    
    // Should show fallback state
    await waitFor(() => {
      expect(screen.getByText('No pending tasks')).toBeInTheDocument();
      expect(screen.getByText('AI will create tasks from emails when enabled')).toBeInTheDocument();
    });
  });

  it('handles loading states', async () => {
    // Mock slow API response
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], hasMore: false })
        }), 100)
      )
    );

    renderWithRouter(<TaskDashboard />);
    
    // Should show loading indicator
    expect(screen.getByText('Loading more tasks...')).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading more tasks...')).not.toBeInTheDocument();
    });
  });

  it('supports infinite scroll', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
    });

    // Mock intersection observer
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null
    });
    window.IntersectionObserver = mockIntersectionObserver;

    // Simulate scrolling to bottom
    const loadMoreButton = screen.queryByText(/Load more tasks/);
    if (loadMoreButton) {
      fireEvent.click(loadMoreButton);
      
      // Should trigger additional API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=50'),
          expect.any(Object)
        );
      });
    }
  });

  it('displays analytics and insights', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('TaskFlow Insights')).toBeInTheDocument();
      expect(screen.getByText('AI Performance')).toBeInTheDocument();
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Should show performance metrics
    expect(screen.getByText('95%')).toBeInTheDocument(); // Processing Speed
    expect(screen.getByText('92%')).toBeInTheDocument(); // AI Accuracy
    expect(screen.getByText('3.2h')).toBeInTheDocument(); // Time Saved
  });

  it('handles task interaction and email popup', async () => {
    renderWithRouter(<TaskDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Review quarterly report')).toBeInTheDocument();
    });

    // Click on a task to open email popup
    const taskTitle = screen.getByText('Review quarterly report');
    fireEvent.click(taskTitle);

    // Should open email popup (this would depend on your implementation)
    // You might need to add data-testid attributes to make this more testable
  });
});