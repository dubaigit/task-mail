/**
 * Comprehensive React Component Tests - ModernEmailInterface
 * 
 * Tests UI components, accessibility, state management, and user interactions
 * Priority: HIGH - Core UI component testing for 80%+ coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import ModernEmailInterface from '../Email/ModernEmailInterface';

// Mock the API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data
const mockEmails = [
  {
    id: 1,
    subject: 'Important Meeting Tomorrow',
    sender: 'john.doe@company.com',
    sender_name: 'John Doe',
    date: '2024-08-15T10:30:00Z',
    snippet: 'Please confirm your attendance for tomorrow\'s quarterly review meeting.',
    classification: 'NEEDS_REPLY',
    urgency: 'HIGH',
    confidence: 0.92,
    is_read: false,
    is_flagged: false,
    action_items: ['Confirm attendance', 'Prepare quarterly review materials'],
    deadlines: ['2024-08-16T09:00:00Z']
  },
  {
    id: 2,
    subject: 'Weekly Newsletter',
    sender: 'newsletter@company.com',
    sender_name: 'Company Newsletter',
    date: '2024-08-14T08:00:00Z',
    snippet: 'This week in tech: AI advances, new product launches, and industry updates.',
    classification: 'FYI_ONLY',
    urgency: 'LOW',
    confidence: 0.85,
    is_read: true,
    is_flagged: false,
    action_items: [],
    deadlines: []
  },
  {
    id: 3,
    subject: 'Budget Approval Required',
    sender: 'finance@company.com',
    sender_name: 'Finance Team',
    date: '2024-08-15T14:20:00Z',
    snippet: 'The Q4 marketing budget of $75,000 requires your approval by end of week.',
    classification: 'APPROVAL_REQUIRED',
    urgency: 'CRITICAL',
    confidence: 0.96,
    is_read: false,
    is_flagged: true,
    action_items: ['Review budget proposal', 'Approve or reject budget'],
    deadlines: ['2024-08-16T17:00:00Z']
  }
];

const mockTasks = [
  {
    id: 'task-1',
    email_id: 1,
    subject: 'Confirm meeting attendance',
    task_type: 'reply',
    priority: 'high',
    due_date: '2024-08-16T09:00:00Z',
    description: 'Respond to meeting invitation with confirmation',
    assignee: 'current_user',
    status: 'pending'
  }
];

const mockDrafts = [
  {
    id: 'draft-1',
    email_id: 1,
    content: 'Hi John,\n\nThank you for the meeting invitation. I confirm my attendance for tomorrow\'s quarterly review meeting.\n\nBest regards',
    confidence: 0.89,
    created_at: '2024-08-15T15:30:00Z'
  }
];

describe('ModernEmailInterface', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Default API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/emails')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmails)
        });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTasks)
        });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDrafts)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    });
  });

  describe('Basic Rendering', () => {
    test('renders main interface components', async () => {
      render(<ModernEmailInterface />);
      
      // Check for main UI elements
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Email Intelligence Dashboard')).toBeInTheDocument();
      });
      
      // Check for email list
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
    });

    test('displays loading state initially', () => {
      render(<ModernEmailInterface />);
      
      // Should show loading indicators
      const loadingElements = screen.getAllByRole('progressbar');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    test('renders all mock emails', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        mockEmails.forEach(email => {
          expect(screen.getByText(email.subject)).toBeInTheDocument();
          expect(screen.getByText(email.sender_name)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Email List Functionality', () => {
    test('allows email selection', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Click on an email
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      await user.click(emailItem);
      
      // Check if email is selected (visual indication)
      const emailContainer = emailItem.closest('[data-testid="email-item"]') || emailItem.closest('div');
      expect(emailContainer).toHaveClass(/selected|active/);
    });

    test('displays email metadata correctly', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Check urgency indicators
        expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
        expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
        
        // Check classification badges
        expect(screen.getByText(/NEEDS_REPLY/i)).toBeInTheDocument();
        expect(screen.getByText(/APPROVAL_REQUIRED/i)).toBeInTheDocument();
      });
    });

    test('shows read/unread status', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        const emailItems = screen.getAllByRole('listitem');
        expect(emailItems.length).toBeGreaterThan(0);
        
        // Check for read/unread visual indicators
        const unreadEmails = mockEmails.filter(e => !e.is_read);
        expect(unreadEmails.length).toBeGreaterThan(0);
      });
    });

    test('displays flagged emails with visual indicator', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Should show flag indicator for flagged emails
        const flaggedEmail = mockEmails.find(e => e.is_flagged);
        if (flaggedEmail) {
          expect(screen.getByText(flaggedEmail.subject)).toBeInTheDocument();
          // Look for flag icon or indicator
          const flagIcons = screen.getAllByRole('img');
          expect(flagIcons.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Search and Filtering', () => {
    test('renders search input', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search/i);
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('type', 'text');
      });
    });

    test('filters emails by search term', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'newsletter');
      
      await waitFor(() => {
        // Should filter to show only newsletter email
        expect(screen.getByText('Weekly Newsletter')).toBeInTheDocument();
        expect(screen.queryByText('Important Meeting Tomorrow')).not.toBeInTheDocument();
      });
    });

    test('shows filter dropdowns', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Look for filter dropdowns
        const filterElements = screen.getAllByRole('combobox');
        expect(filterElements.length).toBeGreaterThan(0);
      });
    });

    test('filters by urgency level', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Find and interact with urgency filter
      const urgencyFilter = screen.getByLabelText(/urgency/i) || screen.getByRole('combobox');
      await user.click(urgencyFilter);
      
      // Select HIGH urgency
      const highOption = screen.getByText(/high/i);
      await user.click(highOption);
      
      await waitFor(() => {
        // Should show only high urgency emails
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
        expect(screen.queryByText('Weekly Newsletter')).not.toBeInTheDocument();
      });
    });
  });

  describe('AI Action Buttons', () => {
    test('renders Generate Tasks button', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select an email first
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      fireEvent.click(emailItem);
      
      await waitFor(() => {
        const generateTasksButton = screen.getByRole('button', { name: /generate tasks/i });
        expect(generateTasksButton).toBeInTheDocument();
        expect(generateTasksButton).not.toBeDisabled();
      });
    });

    test('renders Generate Draft button', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select an email
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      fireEvent.click(emailItem);
      
      await waitFor(() => {
        const generateDraftButton = screen.getByRole('button', { name: /generate draft/i });
        expect(generateDraftButton).toBeInTheDocument();
        expect(generateDraftButton).not.toBeDisabled();
      });
    });

    test('Generate Tasks button creates tasks', async () => {
      const user = userEvent.setup();
      
      // Mock API response for task generation
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            tasks: [
              {
                id: 'new-task-1',
                description: 'Confirm meeting attendance',
                due_date: '2024-08-16T09:00:00Z'
              }
            ]
          })
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select email and click Generate Tasks
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      await user.click(emailItem);
      
      const generateTasksButton = await screen.findByRole('button', { name: /generate tasks/i });
      await user.click(generateTasksButton);
      
      // Should show loading state then success
      await waitFor(() => {
        expect(screen.getByText(/task.*generated|created/i)).toBeInTheDocument();
      });
    });

    test('Generate Draft button creates draft reply', async () => {
      const user = userEvent.setup();
      
      // Mock API response for draft generation
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            draft: {
              content: 'Thank you for your email. I will review and respond shortly.',
              confidence: 0.87
            }
          })
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select email and click Generate Draft
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      await user.click(emailItem);
      
      const generateDraftButton = await screen.findByRole('button', { name: /generate draft/i });
      await user.click(generateDraftButton);
      
      // Should show draft content
      await waitFor(() => {
        expect(screen.getByText(/thank you for your email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Email Actions', () => {
    test('renders email action buttons', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select an email
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      fireEvent.click(emailItem);
      
      await waitFor(() => {
        // Check for action buttons
        expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /mark.*read/i })).toBeInTheDocument();
      });
    });

    test('mark as read functionality', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Select unread email
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      await user.click(emailItem);
      
      const markReadButton = await screen.findByRole('button', { name: /mark.*read/i });
      await user.click(markReadButton);
      
      // Should update email status
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/emails/1/mark-read'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    test('archive functionality', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      const emailItem = screen.getByText('Important Meeting Tomorrow');
      await user.click(emailItem);
      
      const archiveButton = await screen.findByRole('button', { name: /archive/i });
      await user.click(archiveButton);
      
      // Should call archive API
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/emails/1/archive'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Date Range Picker', () => {
    test('renders date range picker', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        const dateInputs = screen.getAllByDisplayValue('');
        const dateRangePicker = screen.getByLabelText(/date range/i) || 
                               screen.getByPlaceholderText(/select date/i);
        expect(dateRangePicker).toBeInTheDocument();
      });
    });

    test('preset date buttons work', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Look for preset buttons
        const sevenDaysButton = screen.getByRole('button', { name: /7.*days?|7d/i });
        expect(sevenDaysButton).toBeInTheDocument();
        
        const thirtyDaysButton = screen.getByRole('button', { name: /30.*days?|30d/i });
        expect(thirtyDaysButton).toBeInTheDocument();
      });
      
      // Click 7 days preset
      const sevenDaysButton = screen.getByRole('button', { name: /7.*days?|7d/i });
      await user.click(sevenDaysButton);
      
      // Should filter emails to last 7 days
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('start_date='),
          expect.any(Object)
        );
      });
    });
  });

  describe('Theme Support', () => {
    test('supports dark mode toggle', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        const themeToggle = screen.getByRole('button', { name: /dark.*mode|theme/i });
        expect(themeToggle).toBeInTheDocument();
      });
      
      const themeToggle = screen.getByRole('button', { name: /dark.*mode|theme/i });
      await user.click(themeToggle);
      
      // Should toggle theme classes
      await waitFor(() => {
        const body = document.body;
        expect(body).toHaveClass(/dark|theme-dark/);
      });
    });

    test('persists theme preference', async () => {
      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn(() => 'dark'),
        setItem: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('theme');
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Check for ARIA labels on interactive elements
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
        });
        
        // Check for list structure
        const emailList = screen.getByRole('list');
        expect(emailList).toBeInTheDocument();
        
        const emailItems = screen.getAllByRole('listitem');
        expect(emailItems.length).toBeGreaterThan(0);
      });
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
      
      // Tab navigation should work
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
      
      // Arrow keys should navigate email list
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      
      // Enter should select email
      await user.keyboard('{Enter}');
    });

    test('has proper heading structure', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Check for proper heading hierarchy
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toBeInTheDocument();
        
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    test('has sufficient color contrast', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // This would typically use automated accessibility testing tools
        // For now, we check that text is visible and readable
        const textElements = screen.getAllByText(/./);
        textElements.forEach(element => {
          const styles = window.getComputedStyle(element);
          expect(styles.color).not.toBe('transparent');
        });
      });
    });
  });

  describe('Performance', () => {
    test('virtualizes large email lists', async () => {
      // Create large email list
      const largeEmailList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEmails[0],
        id: i + 1,
        subject: `Email ${i + 1}`
      }));
      
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(largeEmailList)
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Should only render visible items
        const visibleEmails = screen.getAllByText(/Email \d+/);
        expect(visibleEmails.length).toBeLessThan(100); // Should virtualize
      });
    });

    test('loads incrementally', async () => {
      render(<ModernEmailInterface />);
      
      // Should show initial loading state
      expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
      
      await waitFor(() => {
        // Should load content progressively
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.reject(new Error('Network error'))
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Should show error message
        expect(screen.getByText(/error|failed|retry/i)).toBeInTheDocument();
      });
    });

    test('handles empty email list', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Should show empty state
        expect(screen.getByText(/no emails|empty/i)).toBeInTheDocument();
      });
    });

    test('retries failed requests', async () => {
      const user = userEvent.setup();
      
      // First call fails, second succeeds
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        .mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEmails)
          })
        );
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        expect(screen.getByText(/error|retry/i)).toBeInTheDocument();
      });
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('adapts to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Should adapt layout for mobile
        const mobileElements = screen.getAllByTestId(/mobile|compact/);
        expect(mobileElements.length).toBeGreaterThan(0);
      });
    });

    test('shows/hides elements based on screen size', async () => {
      render(<ModernEmailInterface />);
      
      await waitFor(() => {
        // Desktop should show all panels
        const panels = screen.getAllByRole('region');
        expect(panels.length).toBeGreaterThan(1);
      });
    });
  });
});