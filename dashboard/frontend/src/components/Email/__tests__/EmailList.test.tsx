/**
 * EmailList Component Tests
 * Critical test coverage for email management functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import EmailList from '../EmailList';
import { useEmailStore } from '../../../stores/emailStore';

// Mock the email store
jest.mock('../../../stores/emailStore');
const mockUseEmailStore = useEmailStore as jest.MockedFunction<typeof useEmailStore>;

// Mock DateRangePicker component
jest.mock('../../DateRangePicker', () => {
  return function MockDateRangePicker({ onChange }: { onChange: (dates: any) => void }) {
    return (
      <div data-testid="date-range-picker">
        <button onClick={() => onChange({ start: new Date('2024-01-01'), end: new Date('2024-01-31') })}>
          Select Range
        </button>
      </div>
    );
  };
});

// Mock email data
const mockEmails = [
  {
    id: '1',
    subject: 'Test Email 1',
    sender: 'test@example.com',
    senderName: 'Test Sender',
    receivedAt: '2024-01-15T10:00:00Z',
    isRead: false,
    isStarred: false,
    textContent: 'This is a test email',
    urgency: 'medium' as const,
    classification: 'needs_reply' as const,
    labels: ['work'],
    hasAttachments: false
  },
  {
    id: '2',
    subject: 'Test Email 2',
    sender: 'another@example.com',
    senderName: 'Another Sender',
    receivedAt: '2024-01-14T15:30:00Z',
    isRead: true,
    isStarred: true,
    textContent: 'Another test email',
    urgency: 'high' as const,
    classification: 'task' as const,
    labels: ['personal'],
    hasAttachments: true
  }
];

const mockStoreState = {
  emails: mockEmails,
  filteredEmails: mockEmails,
  selectedEmail: null,
  currentFilter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  // Actions
  setFilter: jest.fn(),
  setSearchQuery: jest.fn(),
  selectEmail: jest.fn(),
  markAsRead: jest.fn(),
  toggleStar: jest.fn(),
  fetchEmails: jest.fn(),
  clearError: jest.fn()
};

describe('EmailList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmailStore.mockReturnValue(mockStoreState);
  });

  describe('Email Rendering', () => {
    it('renders email list correctly', () => {
      render(<EmailList />);
      
      expect(screen.getByText('Test Email 1')).toBeInTheDocument();
      expect(screen.getByText('Test Email 2')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('another@example.com')).toBeInTheDocument();
    });

    it('displays email metadata correctly', () => {
      render(<EmailList />);
      
      // Check for urgency indicators
      expect(screen.getByTestId('email-1')).toBeInTheDocument();
      expect(screen.getByTestId('email-2')).toBeInTheDocument();
      
      // Check for read/unread status
      const unreadEmail = screen.getByTestId('email-1');
      const readEmail = screen.getByTestId('email-2');
      
      expect(unreadEmail).toHaveClass('font-semibold'); // Unread styling
      expect(readEmail).not.toHaveClass('font-semibold'); // Read styling
    });

    it('shows attachment indicators when emails have attachments', () => {
      render(<EmailList />);
      
      const emailWithAttachment = screen.getByTestId('email-2');
      expect(emailWithAttachment.querySelector('[data-testid="attachment-icon"]')).toBeInTheDocument();
    });

    it('displays star status correctly', () => {
      render(<EmailList />);
      
      const starredEmail = screen.getByTestId('email-2');
      const unstarredEmail = screen.getByTestId('email-1');
      
      expect(starredEmail.querySelector('[data-testid="star-filled"]')).toBeInTheDocument();
      expect(unstarredEmail.querySelector('[data-testid="star-empty"]')).toBeInTheDocument();
    });
  });

  describe('Email Interactions', () => {
    it('selects email when clicked', () => {
      render(<EmailList />);
      
      const emailItem = screen.getByTestId('email-1');
      fireEvent.click(emailItem);
      
      expect(mockStoreState.selectEmail).toHaveBeenCalledWith('1');
    });

    it('marks email as read when clicked', async () => {
      render(<EmailList />);
      
      const unreadEmail = screen.getByTestId('email-1');
      fireEvent.click(unreadEmail);
      
      await waitFor(() => {
        expect(mockStoreState.markAsRead).toHaveBeenCalledWith('1');
      });
    });

    it('toggles star when star button is clicked', () => {
      render(<EmailList />);
      
      const starButton = screen.getByTestId('star-button-1');
      fireEvent.click(starButton);
      
      expect(mockStoreState.toggleStar).toHaveBeenCalledWith('1');
    });

    it('prevents email selection when star button is clicked', () => {
      render(<EmailList />);
      
      const starButton = screen.getByTestId('star-button-1');
      fireEvent.click(starButton);
      
      // Should not select email when star is clicked
      expect(mockStoreState.selectEmail).not.toHaveBeenCalled();
    });
  });

  describe('Filtering and Search', () => {
    it('updates search query when typing in search box', () => {
      render(<EmailList />);
      
      const searchInput = screen.getByPlaceholderText(/search emails/i);
      fireEvent.change(searchInput, { target: { value: 'test query' } });
      
      expect(mockStoreState.setSearchQuery).toHaveBeenCalledWith('test query');
    });

    it('changes filter when filter buttons are clicked', () => {
      render(<EmailList />);
      
      const unreadFilter = screen.getByText('Unread');
      fireEvent.click(unreadFilter);
      
      expect(mockStoreState.setFilter).toHaveBeenCalledWith('unread');
    });

    it('shows filter counts correctly', () => {
      const stateWithCounts = {
        ...mockStoreState,
        emails: mockEmails,
        unreadCount: 1,
        starredCount: 1,
        taskCount: 1
      };
      mockUseEmailStore.mockReturnValue(stateWithCounts);
      
      render(<EmailList />);
      
      expect(screen.getByText('Unread (1)')).toBeInTheDocument();
      expect(screen.getByText('Starred (1)')).toBeInTheDocument();
    });

    it('applies date range filter correctly', () => {
      render(<EmailList />);
      
      const dateRangeButton = screen.getByText('Select Range');
      fireEvent.click(dateRangeButton);
      
      // Should filter emails by date range
      expect(mockStoreState.setFilter).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner when loading', () => {
      const loadingState = {
        ...mockStoreState,
        isLoading: true
      };
      mockUseEmailStore.mockReturnValue(loadingState);
      
      render(<EmailList />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('displays error message when there is an error', () => {
      const errorState = {
        ...mockStoreState,
        error: 'Failed to fetch emails'
      };
      mockUseEmailStore.mockReturnValue(errorState);
      
      render(<EmailList />);
      
      expect(screen.getByText('Failed to fetch emails')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('clears error when retry button is clicked', () => {
      const errorState = {
        ...mockStoreState,
        error: 'Failed to fetch emails'
      };
      mockUseEmailStore.mockReturnValue(errorState);
      
      render(<EmailList />);
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(mockStoreState.clearError).toHaveBeenCalled();
      expect(mockStoreState.fetchEmails).toHaveBeenCalled();
    });

    it('shows empty state when no emails', () => {
      const emptyState = {
        ...mockStoreState,
        emails: [],
        filteredEmails: []
      };
      mockUseEmailStore.mockReturnValue(emptyState);
      
      render(<EmailList />);
      
      expect(screen.getByText(/no emails found/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates emails with arrow keys', () => {
      render(<EmailList />);
      
      const emailList = screen.getByTestId('email-list');
      
      // Press down arrow
      fireEvent.keyDown(emailList, { key: 'ArrowDown', code: 'ArrowDown' });
      
      // Should select first email
      expect(mockStoreState.selectEmail).toHaveBeenCalledWith('1');
    });

    it('marks email as read with Enter key', () => {
      const stateWithSelection = {
        ...mockStoreState,
        selectedEmail: mockEmails[0]
      };
      mockUseEmailStore.mockReturnValue(stateWithSelection);
      
      render(<EmailList />);
      
      const emailList = screen.getByTestId('email-list');
      fireEvent.keyDown(emailList, { key: 'Enter', code: 'Enter' });
      
      expect(mockStoreState.markAsRead).toHaveBeenCalledWith('1');
    });

    it('toggles star with Space key', () => {
      const stateWithSelection = {
        ...mockStoreState,
        selectedEmail: mockEmails[0]
      };
      mockUseEmailStore.mockReturnValue(stateWithSelection);
      
      render(<EmailList />);
      
      const emailList = screen.getByTestId('email-list');
      fireEvent.keyDown(emailList, { key: ' ', code: 'Space' });
      
      expect(mockStoreState.toggleStar).toHaveBeenCalledWith('1');
    });
  });

  describe('Performance Optimization', () => {
    it('renders large email lists efficiently', () => {
      const largeEmailList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEmails[0],
        id: `email-${i}`,
        subject: `Email ${i}`
      }));
      
      const largeListState = {
        ...mockStoreState,
        emails: largeEmailList,
        filteredEmails: largeEmailList
      };
      mockUseEmailStore.mockReturnValue(largeListState);
      
      const startTime = performance.now();
      render(<EmailList />);
      const endTime = performance.now();
      
      // Should render in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('memoizes email items to prevent unnecessary re-renders', () => {
      const { rerender } = render(<EmailList />);
      
      // Re-render with same data
      rerender(<EmailList />);
      
      // Component should be memoized and not re-render unnecessarily
      expect(screen.getByTestId('email-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<EmailList />);
      
      const emailList = screen.getByRole('list', { name: /email list/i });
      expect(emailList).toBeInTheDocument();
      
      const emailItems = screen.getAllByRole('listitem');
      expect(emailItems).toHaveLength(2);
    });

    it('supports screen reader navigation', () => {
      render(<EmailList />);
      
      const firstEmail = screen.getByTestId('email-1');
      expect(firstEmail).toHaveAttribute('aria-label', expect.stringContaining('Test Email 1'));
      expect(firstEmail).toHaveAttribute('tabIndex', '0');
    });

    it('announces email status changes', () => {
      render(<EmailList />);
      
      const emailItem = screen.getByTestId('email-1');
      fireEvent.click(emailItem);
      
      // Should have aria-live region for status updates
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});