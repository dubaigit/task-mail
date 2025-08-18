/**
 * Analytics Component Tests
 * Critical test coverage for analytics and metrics functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import Analytics from '../Analytics';

// Mock chart library
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  )
}));

// Mock API client
jest.mock('../../utils/apiClient', () => ({
  get: jest.fn()
}));

import { get } from '../../utils/apiClient';
const mockGet = get as jest.MockedFunction<typeof get>;

// Mock analytics data
const mockAnalyticsData = {
  emailMetrics: {
    totalEmails: 1247,
    unreadEmails: 89,
    processedToday: 34,
    avgResponseTime: 2.5,
    urgentEmails: 12,
    taskExtracted: 23
  },
  taskMetrics: {
    totalTasks: 156,
    completedTasks: 98,
    overdueTasks: 8,
    avgCompletionTime: 3.2,
    tasksCreatedToday: 7,
    tasksCompletedToday: 12
  },
  productivityMetrics: {
    emailsPerHour: 8.3,
    tasksPerDay: 4.7,
    responseRate: 0.87,
    automationSavings: 2.4,
    focusTime: 6.2,
    interruptionCount: 14
  },
  timeSeriesData: {
    emailVolume: [
      { date: '2024-01-10', emails: 45, tasks: 8 },
      { date: '2024-01-11', emails: 52, tasks: 12 },
      { date: '2024-01-12', emails: 38, tasks: 6 },
      { date: '2024-01-13', emails: 67, tasks: 15 },
      { date: '2024-01-14', emails: 41, tasks: 9 },
      { date: '2024-01-15', emails: 34, tasks: 7 }
    ],
    responseTime: [
      { date: '2024-01-10', avgTime: 2.8 },
      { date: '2024-01-11', avgTime: 2.1 },
      { date: '2024-01-12', avgTime: 3.2 },
      { date: '2024-01-13', avgTime: 1.9 },
      { date: '2024-01-14', avgTime: 2.6 },
      { date: '2024-01-15', avgTime: 2.5 }
    ]
  },
  distributionData: {
    emailsByCategory: [
      { name: 'Work', value: 756, percentage: 60.6 },
      { name: 'Personal', value: 312, percentage: 25.0 },
      { name: 'Automated', value: 179, percentage: 14.4 }
    ],
    tasksByPriority: [
      { name: 'High', value: 34, percentage: 21.8 },
      { name: 'Medium', value: 89, percentage: 57.1 },
      { name: 'Low', value: 33, percentage: 21.1 }
    ],
    emailsByUrgency: [
      { name: 'Urgent', value: 87, percentage: 7.0 },
      { name: 'High', value: 234, percentage: 18.8 },
      { name: 'Medium', value: 645, percentage: 51.7 },
      { name: 'Low', value: 281, percentage: 22.5 }
    ]
  }
};

describe('Analytics Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockAnalyticsData });
  });

  describe('Component Rendering', () => {
    it('renders analytics dashboard correctly', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
      expect(screen.getByTestId('metrics-summary')).toBeInTheDocument();
      expect(screen.getByTestId('charts-section')).toBeInTheDocument();
    });

    it('displays key metrics cards', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('metric-total-emails')).toBeInTheDocument();
      });
      
      expect(screen.getByText('1,247')).toBeInTheDocument(); // Total emails
      expect(screen.getByText('89')).toBeInTheDocument(); // Unread emails
      expect(screen.getByText('156')).toBeInTheDocument(); // Total tasks
      expect(screen.getByText('2.5h')).toBeInTheDocument(); // Avg response time
    });

    it('shows productivity metrics', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('productivity-metrics')).toBeInTheDocument();
      });
      
      expect(screen.getByText('8.3')).toBeInTheDocument(); // Emails per hour
      expect(screen.getByText('4.7')).toBeInTheDocument(); // Tasks per day
      expect(screen.getByText('87%')).toBeInTheDocument(); // Response rate
      expect(screen.getByText('2.4h')).toBeInTheDocument(); // Automation savings
    });

    it('renders time series charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('time-series-section')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('email-volume-chart')).toBeInTheDocument();
      expect(screen.getByTestId('response-time-chart')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('displays distribution charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('distribution-section')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('emails-by-category-chart')).toBeInTheDocument();
      expect(screen.getByTestId('tasks-by-priority-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('fetches analytics data on mount', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/analytics');
      });
    });

    it('shows loading state while fetching data', () => {
      // Mock delayed response
      mockGet.mockImplementation(() => new Promise(() => {}));
      
      render(<Analytics />);
      
      expect(screen.getByTestId('analytics-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
    });

    it('handles data loading errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Failed to fetch analytics'));
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-error')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('retries data loading when retry button clicked', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      mockGet.mockResolvedValueOnce({ data: mockAnalyticsData });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('retry-button'));
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Time Range Filtering', () => {
    it('provides time range selector', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    });

    it('updates data when time range changes', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
      
      const thirtyDaysOption = screen.getByText('Last 30 days');
      fireEvent.click(thirtyDaysOption);
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/analytics', {
          params: { timeRange: '30d' }
        });
      });
    });

    it('supports custom date range selection', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('custom-date-range')).toBeInTheDocument();
      });
      
      const startDate = screen.getByTestId('start-date-input');
      const endDate = screen.getByTestId('end-date-input');
      
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });
      fireEvent.change(endDate, { target: { value: '2024-01-15' } });
      
      const applyButton = screen.getByTestId('apply-date-range');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/analytics', {
          params: { 
            startDate: '2024-01-01',
            endDate: '2024-01-15'
          }
        });
      });
    });
  });

  describe('Chart Interactions', () => {
    it('allows toggling chart types', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-type-toggle')).toBeInTheDocument();
      });
      
      const barChartOption = screen.getByTestId('chart-type-bar');
      fireEvent.click(barChartOption);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });

    it('shows detailed tooltips on chart hover', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('email-volume-chart')).toBeInTheDocument();
      });
      
      const chartArea = screen.getByTestId('email-volume-chart');
      fireEvent.mouseEnter(chartArea);
      
      expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
    });

    it('provides chart data export functionality', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('export-button')).toBeInTheDocument();
      });
      
      const exportButton = screen.getByTestId('export-button');
      fireEvent.click(exportButton);
      
      expect(screen.getByTestId('export-menu')).toBeInTheDocument();
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as PNG')).toBeInTheDocument();
    });
  });

  describe('Metric Calculations', () => {
    it('calculates percentage changes correctly', async () => {
      const dataWithTrends = {
        ...mockAnalyticsData,
        trends: {
          emailsChange: 12.5,
          tasksChange: -3.2,
          responseTimeChange: 8.7
        }
      };
      
      mockGet.mockResolvedValueOnce({ data: dataWithTrends });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('+12.5%')).toBeInTheDocument();
        expect(screen.getByText('-3.2%')).toBeInTheDocument();
        expect(screen.getByText('+8.7%')).toBeInTheDocument();
      });
    });

    it('shows trend indicators correctly', async () => {
      const dataWithTrends = {
        ...mockAnalyticsData,
        trends: {
          emailsChange: 12.5,
          tasksChange: -3.2,
          responseTimeChange: 0
        }
      };
      
      mockGet.mockResolvedValueOnce({ data: dataWithTrends });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('trend-up')).toBeInTheDocument();
        expect(screen.getByTestId('trend-down')).toBeInTheDocument();
        expect(screen.getByTestId('trend-neutral')).toBeInTheDocument();
      });
    });

    it('formats large numbers correctly', async () => {
      const dataWithLargeNumbers = {
        ...mockAnalyticsData,
        emailMetrics: {
          ...mockAnalyticsData.emailMetrics,
          totalEmails: 12473
        }
      };
      
      mockGet.mockResolvedValueOnce({ data: dataWithLargeNumbers });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText('12.5K')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Insights', () => {
    it('displays performance recommendations', async () => {
      const dataWithInsights = {
        ...mockAnalyticsData,
        insights: [
          {
            type: 'recommendation',
            title: 'High email volume detected',
            description: 'Consider setting up email filters to reduce manual processing',
            priority: 'high'
          },
          {
            type: 'achievement',
            title: 'Great response time!',
            description: 'Your average response time is 40% better than last month',
            priority: 'medium'
          }
        ]
      };
      
      mockGet.mockResolvedValueOnce({ data: dataWithInsights });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('insights-section')).toBeInTheDocument();
      });
      
      expect(screen.getByText('High email volume detected')).toBeInTheDocument();
      expect(screen.getByText('Great response time!')).toBeInTheDocument();
    });

    it('categorizes insights by priority', async () => {
      const dataWithInsights = {
        ...mockAnalyticsData,
        insights: [
          { type: 'recommendation', priority: 'high', title: 'High priority insight' },
          { type: 'recommendation', priority: 'medium', title: 'Medium priority insight' },
          { type: 'recommendation', priority: 'low', title: 'Low priority insight' }
        ]
      };
      
      mockGet.mockResolvedValueOnce({ data: dataWithInsights });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('high-priority-insights')).toBeInTheDocument();
        expect(screen.getByTestId('medium-priority-insights')).toBeInTheDocument();
        expect(screen.getByTestId('low-priority-insights')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('sets up real-time data polling', async () => {
      jest.useFakeTimers();
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });
      
      // Fast-forward time to trigger polling
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
      });
      
      jest.useRealTimers();
    });

    it('stops polling when component unmounts', async () => {
      jest.useFakeTimers();
      
      const { unmount } = render(<Analytics />);
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });
      
      unmount();
      
      // Fast-forward time after unmount
      act(() => {
        jest.advanceTimersByTime(60000);
      });
      
      // Should not make additional calls
      expect(mockGet).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('shows real-time update indicator', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('last-updated')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for charts', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('email-volume-chart')).toBeInTheDocument();
      });
      
      const emailChart = screen.getByTestId('email-volume-chart');
      expect(emailChart).toHaveAttribute('aria-label', expect.stringContaining('Email volume'));
      
      const taskChart = screen.getByTestId('tasks-by-priority-chart');
      expect(taskChart).toHaveAttribute('aria-label', expect.stringContaining('Tasks by priority'));
    });

    it('provides screen reader friendly data tables', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('data-table-toggle')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('data-table-toggle'));
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /emails/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
      
      const selector = screen.getByTestId('time-range-selector');
      
      // Test tab navigation
      fireEvent.keyDown(selector, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByText('Last 30 days'));
      
      // Test enter key
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
      expect(mockGet).toHaveBeenCalledWith('/api/analytics', {
        params: { timeRange: '30d' }
      });
    });
  });

  describe('Error Handling', () => {
    it('handles partial data loading gracefully', async () => {
      const partialData = {
        emailMetrics: mockAnalyticsData.emailMetrics,
        // Missing other metrics
      };
      
      mockGet.mockResolvedValueOnce({ data: partialData });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('metrics-summary')).toBeInTheDocument();
      });
      
      // Should show available data
      expect(screen.getByText('1,247')).toBeInTheDocument();
      
      // Should handle missing data gracefully
      expect(screen.getByText(/some data unavailable/i)).toBeInTheDocument();
    });

    it('displays appropriate error messages for different error types', async () => {
      mockGet.mockRejectedValueOnce({
        response: { status: 403, statusText: 'Forbidden' }
      });
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
    });

    it('falls back to cached data when available', async () => {
      // Set up cached data
      localStorage.setItem('analytics-cache', JSON.stringify({
        data: mockAnalyticsData,
        timestamp: Date.now() - 30000 // 30 seconds ago
      }));
      
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      
      render(<Analytics />);
      
      await waitFor(() => {
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/using cached data/i)).toBeInTheDocument();
    });
  });
});