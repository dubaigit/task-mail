/**
 * Email Store Tests
 * Critical test coverage for email state management
 */

import { act, renderHook } from '@testing-library/react';
import { useEmailStore } from '../emailStore';

// Mock API client
jest.mock('../../utils/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

import { get, post, put } from '../../utils/apiClient';
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockPut = put as jest.MockedFunction<typeof put>;

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
  },
  {
    id: '3',
    subject: 'Urgent Email',
    sender: 'urgent@example.com',
    senderName: 'Urgent Sender',
    receivedAt: '2024-01-16T09:00:00Z',
    isRead: false,
    isStarred: false,
    textContent: 'This is urgent',
    urgency: 'high' as const,
    classification: 'urgent' as const,
    labels: ['work'],
    hasAttachments: false
  }
];

describe('Email Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useEmailStore.setState({
      emails: [],
      selectedEmail: null,
      currentFilter: 'all',
      searchQuery: '',
      isLoading: false,
      error: null
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.emails).toEqual([]);
      expect(result.current.selectedEmail).toBeNull();
      expect(result.current.currentFilter).toBe('all');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('calculates computed values correctly on empty state', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.filteredEmails).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.starredCount).toBe(0);
      expect(result.current.totalCount).toBe(0);
    });
  });

  describe('Email Fetching', () => {
    it('fetches emails successfully', async () => {
      mockGet.mockResolvedValueOnce({ data: mockEmails });
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.fetchEmails();
      });
      
      expect(mockGet).toHaveBeenCalledWith('/api/emails');
      expect(result.current.emails).toEqual(mockEmails);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch errors gracefully', async () => {
      const errorMessage = 'Failed to fetch emails';
      mockGet.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.fetchEmails();
      });
      
      expect(result.current.emails).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockGet.mockReturnValueOnce(fetchPromise);
      
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.fetchEmails();
      });
      
      expect(result.current.isLoading).toBe(true);
      
      await act(async () => {
        resolvePromise({ data: mockEmails });
        await fetchPromise;
      });
      
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches emails with search query', async () => {
      mockGet.mockResolvedValueOnce({ data: [mockEmails[0]] });
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.fetchEmails('test query');
      });
      
      expect(mockGet).toHaveBeenCalledWith('/api/emails', {
        params: { search: 'test query' }
      });
    });
  });

  describe('Email Actions', () => {
    beforeEach(() => {
      useEmailStore.setState({ emails: mockEmails });
    });

    it('marks email as read', async () => {
      mockPut.mockResolvedValueOnce({ data: { ...mockEmails[0], isRead: true } });
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.markAsRead('1');
      });
      
      expect(mockPut).toHaveBeenCalledWith('/api/emails/1/read');
      
      const updatedEmail = result.current.emails.find(e => e.id === '1');
      expect(updatedEmail?.isRead).toBe(true);
    });

    it('toggles star status', async () => {
      mockPut.mockResolvedValueOnce({ data: { ...mockEmails[0], isStarred: true } });
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.toggleStar('1');
      });
      
      expect(mockPut).toHaveBeenCalledWith('/api/emails/1/star');
      
      const updatedEmail = result.current.emails.find(e => e.id === '1');
      expect(updatedEmail?.isStarred).toBe(true);
    });

    it('selects email', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.selectEmail('1');
      });
      
      expect(result.current.selectedEmail).toEqual(mockEmails[0]);
    });

    it('handles selection of non-existent email', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.selectEmail('non-existent');
      });
      
      expect(result.current.selectedEmail).toBeNull();
    });

    it('updates email classification', async () => {
      const updatedEmail = { ...mockEmails[0], classification: 'task' as const };
      mockPut.mockResolvedValueOnce({ data: updatedEmail });
      
      const { result } = renderHook(() => useEmailStore());
      
      await act(async () => {
        await result.current.updateClassification('1', 'task');
      });
      
      expect(mockPut).toHaveBeenCalledWith('/api/emails/1/classification', {
        classification: 'task'
      });
      
      const email = result.current.emails.find(e => e.id === '1');
      expect(email?.classification).toBe('task');
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      useEmailStore.setState({ emails: mockEmails });
    });

    it('filters by all emails', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('all');
      });
      
      expect(result.current.filteredEmails).toHaveLength(3);
    });

    it('filters by unread emails', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('unread');
      });
      
      const unreadEmails = result.current.filteredEmails;
      expect(unreadEmails).toHaveLength(2);
      expect(unreadEmails.every(email => !email.isRead)).toBe(true);
    });

    it('filters by starred emails', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('starred');
      });
      
      const starredEmails = result.current.filteredEmails;
      expect(starredEmails).toHaveLength(1);
      expect(starredEmails[0].isStarred).toBe(true);
    });

    it('filters by high urgency emails', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('urgent');
      });
      
      const urgentEmails = result.current.filteredEmails;
      expect(urgentEmails).toHaveLength(2);
      expect(urgentEmails.every(email => email.urgency === 'high')).toBe(true);
    });

    it('filters by classification', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('task');
      });
      
      const taskEmails = result.current.filteredEmails;
      expect(taskEmails).toHaveLength(1);
      expect(taskEmails[0].classification).toBe('task');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      useEmailStore.setState({ emails: mockEmails });
    });

    it('searches by subject', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setSearchQuery('Test Email 1');
      });
      
      const searchResults = result.current.filteredEmails;
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].subject).toBe('Test Email 1');
    });

    it('searches by sender', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setSearchQuery('test@example.com');
      });
      
      const searchResults = result.current.filteredEmails;
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].sender).toBe('test@example.com');
    });

    it('searches by content', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setSearchQuery('urgent');
      });
      
      const searchResults = result.current.filteredEmails;
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].textContent).toContain('urgent');
    });

    it('is case insensitive', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setSearchQuery('URGENT');
      });
      
      const searchResults = result.current.filteredEmails;
      expect(searchResults).toHaveLength(1);
    });

    it('combines search with filters', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('unread');
        result.current.setSearchQuery('Test Email');
      });
      
      const searchResults = result.current.filteredEmails;
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].subject).toBe('Test Email 1');
      expect(searchResults[0].isRead).toBe(false);
    });
  });

  describe('Computed Values', () => {
    beforeEach(() => {
      useEmailStore.setState({ emails: mockEmails });
    });

    it('calculates unread count correctly', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.unreadCount).toBe(2);
    });

    it('calculates starred count correctly', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.starredCount).toBe(1);
    });

    it('calculates total count correctly', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.totalCount).toBe(3);
    });

    it('calculates urgent count correctly', () => {
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.urgentCount).toBe(2);
    });

    it('updates computed values when emails change', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.markAsRead('1');
      });
      
      // Should update unread count after marking as read
      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('clears error state', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        useEmailStore.setState({ error: 'Test error' });
      });
      
      expect(result.current.error).toBe('Test error');
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });

    it('handles network errors in markAsRead', async () => {
      mockPut.mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useEmailStore());
      useEmailStore.setState({ emails: mockEmails });
      
      await act(async () => {
        await result.current.markAsRead('1');
      });
      
      expect(result.current.error).toBe('Network error');
      
      // Email should not be updated on error
      const email = result.current.emails.find(e => e.id === '1');
      expect(email?.isRead).toBe(false);
    });

    it('handles network errors in toggleStar', async () => {
      mockPut.mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useEmailStore());
      useEmailStore.setState({ emails: mockEmails });
      
      await act(async () => {
        await result.current.toggleStar('1');
      });
      
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('Performance', () => {
    it('handles large email lists efficiently', () => {
      const largeEmailList = Array.from({ length: 10000 }, (_, i) => ({
        ...mockEmails[0],
        id: `email-${i}`,
        subject: `Email ${i}`
      }));
      
      const { result } = renderHook(() => useEmailStore());
      
      const startTime = performance.now();
      
      act(() => {
        useEmailStore.setState({ emails: largeEmailList });
      });
      
      const endTime = performance.now();
      
      // Should handle large lists efficiently (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);
      expect(result.current.emails).toHaveLength(10000);
    });

    it('debounces search queries', () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useEmailStore());
      useEmailStore.setState({ emails: mockEmails });
      
      act(() => {
        result.current.setSearchQuery('t');
        result.current.setSearchQuery('te');
        result.current.setSearchQuery('tes');
        result.current.setSearchQuery('test');
      });
      
      // Only the final search should be applied
      expect(result.current.searchQuery).toBe('test');
      
      jest.useRealTimers();
    });
  });

  describe('Persistence', () => {
    it('persists state to localStorage', () => {
      const { result } = renderHook(() => useEmailStore());
      
      act(() => {
        result.current.setFilter('unread');
        result.current.setSearchQuery('test');
      });
      
      // Should persist filter and search preferences
      const persistedState = JSON.parse(localStorage.getItem('email-store') || '{}');
      expect(persistedState.state.currentFilter).toBe('unread');
      expect(persistedState.state.searchQuery).toBe('test');
    });

    it('restores state from localStorage', () => {
      // Set up localStorage with saved state
      localStorage.setItem('email-store', JSON.stringify({
        state: {
          currentFilter: 'starred',
          searchQuery: 'restored'
        }
      }));
      
      const { result } = renderHook(() => useEmailStore());
      
      expect(result.current.currentFilter).toBe('starred');
      expect(result.current.searchQuery).toBe('restored');
    });
  });
});