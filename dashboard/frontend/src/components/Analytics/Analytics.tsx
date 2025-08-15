import React, { useState, useEffect, useCallback } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarDaysIcon,
  FunnelIcon,
  ArrowPathIcon,
  EyeIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Card, Button, Select, Badge, Skeleton, Alert } from '../ui';
import { DateRangePicker } from '../DateRangePicker';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface AnalyticsData {
  totalEmails: number;
  unreadEmails: number;
  responseRate: number;
  avgResponseTime: string;
  emailsByUrgency: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  emailsByClassification: {
    needsReply: number;
    approvalRequired: number;
    createTask: number;
    delegate: number;
    fyiOnly: number;
  };
  weeklyTrends: {
    date: string;
    received: number;
    sent: number;
    processed: number;
  }[];
  topSenders: {
    email: string;
    count: number;
    avgUrgency: string;
  }[];
  productivityMetrics: {
    emailsProcessedToday: number;
    draftsCreated: number;
    tasksGenerated: number;
    avgProcessingTime: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'volume' | 'response' | 'productivity'>('volume');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [lastFetchParams, setLastFetchParams] = useState<string>('');

  useEffect(() => {
    if (!isCustomRange) {
      fetchAnalytics();
    }
  }, [timeRange, isCustomRange]);

  useEffect(() => {
    if (isCustomRange && dateRange.start && dateRange.end) {
      const params = `custom_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
      if (params !== lastFetchParams) {
        setLastFetchParams(params);
        fetchAnalytics();
      }
    }
  }, [dateRange, isCustomRange, lastFetchParams]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate date range for mock data
      const endDate = new Date();
      let startDate: Date;
      
      if (isCustomRange && dateRange.start && dateRange.end) {
        startDate = new Date(dateRange.start);
        endDate.setHours(23, 59, 59, 999);
      } else {
        const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysMap[timeRange]);
      }

      // Generate dynamic data based on date range
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Mock data for demonstration with dynamic date range
      const mockData: AnalyticsData = {
        totalEmails: Math.floor(1200 * (daysDiff / 30)),
        unreadEmails: Math.floor(85 * (daysDiff / 30)),
        responseRate: 87.3 + (Math.random() - 0.5) * 5,
        avgResponseTime: `${(2.4 + (Math.random() - 0.5) * 0.8).toFixed(1)} hours`,
        emailsByUrgency: {
          critical: Math.floor(20 * (daysDiff / 30)),
          high: Math.floor(150 * (daysDiff / 30)),
          medium: Math.floor(750 * (daysDiff / 30)),
          low: Math.floor(280 * (daysDiff / 30))
        },
        emailsByClassification: {
          needsReply: Math.floor(230 * (daysDiff / 30)),
          approvalRequired: Math.floor(45 * (daysDiff / 30)),
          createTask: Math.floor(120 * (daysDiff / 30)),
          delegate: Math.floor(75 * (daysDiff / 30)),
          fyiOnly: Math.floor(760 * (daysDiff / 30))
        },
        weeklyTrends: Array.from({ length: Math.min(daysDiff, 30) }, (_, i) => {
          const date = new Date(endDate);
          date.setDate(date.getDate() - (Math.min(daysDiff, 30) - 1 - i));
          return {
            date: date.toISOString().split('T')[0],
            received: Math.floor(50 + Math.random() * 30),
            sent: Math.floor(20 + Math.random() * 25),
            processed: Math.floor(40 + Math.random() * 30)
          };
        }),
        topSenders: [
          { email: 'sarah.johnson@company.com', count: Math.floor(45 * (daysDiff / 30)), avgUrgency: 'HIGH' },
          { email: 'mike.chen@partner.com', count: Math.floor(38 * (daysDiff / 30)), avgUrgency: 'MEDIUM' },
          { email: 'emily.davis@client.com', count: Math.floor(32 * (daysDiff / 30)), avgUrgency: 'CRITICAL' },
          { email: 'alex.wilson@vendor.com', count: Math.floor(29 * (daysDiff / 30)), avgUrgency: 'MEDIUM' },
          { email: 'lisa.brown@team.com', count: Math.floor(26 * (daysDiff / 30)), avgUrgency: 'LOW' }
        ],
        productivityMetrics: {
          emailsProcessedToday: Math.floor(47 * (daysDiff / 30)),
          draftsCreated: Math.floor(12 * (daysDiff / 30)),
          tasksGenerated: Math.floor(8 * (daysDiff / 30)),
          avgProcessingTime: `${(3.2 + (Math.random() - 0.5) * 0.8).toFixed(1)} min`
        },
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      };

      setData(mockData);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange, dateRange, isCustomRange]);

  const handleTimeRangeChange = (newTimeRange: string) => {
    setTimeRange(newTimeRange as any);
    setIsCustomRange(false);
  };

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange);
    setIsCustomRange(true);
  };

  const handleQuickDateRange = (preset: string) => {
    const daysMap: { [key: string]: number } = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    if (daysMap[preset]) {
      setTimeRange(preset as any);
      setIsCustomRange(false);
    }
  };

  const formatDateRangeDisplay = () => {
    if (!data?.dateRange) return '';
    const start = new Date(data.dateRange.start);
    const end = new Date(data.dateRange.end);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getClassificationIcon = (type: string) => {
    switch (type) {
      case 'needsReply': return <PaperAirplaneIcon className="w-5 h-5" />;
      case 'approvalRequired': return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'createTask': return <CalendarDaysIcon className="w-5 h-5" />;
      case 'delegate': return <UserGroupIcon className="w-5 h-5" />;
      default: return <EyeIcon className="w-5 h-5" />;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const calculateTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change > 0,
      isNeutral: Math.abs(change) < 1
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton height="2.5rem" width="12rem" />
          <Skeleton height="2.25rem" width="8rem" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} padding="lg">
              <div className="space-y-3">
                <Skeleton height="1.5rem" width="70%" />
                <Skeleton height="2rem" width="50%" />
                <Skeleton height="1rem" width="80%" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="lg">
            <Skeleton height="20rem" width="100%" />
          </Card>
          <Card padding="lg">
            <Skeleton height="20rem" width="100%" />
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title="Error loading analytics" dismissible>
        <p className="mb-3">{error}</p>
        <Button onClick={fetchAnalytics} variant="danger" size="sm">
          Try Again
        </Button>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        {/* Title and Description */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Email intelligence insights and performance metrics
            </p>
            {data && (
              <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <CalendarDaysIcon className="w-4 h-4" />
                <span>Showing data for: {formatDateRangeDisplay()}</span>
              </div>
            )}
          </div>
          
          <Button 
            onClick={fetchAnalytics} 
            variant="outline" 
            leftIcon={<ArrowPathIcon className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>

        {/* Enhanced Date Range Controls */}
        <Card padding="lg" variant="elevated" className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Date Range Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a time period to analyze your email data
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Quick Preset Buttons */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: '7d', label: '7D', desc: 'Last 7 days' },
                  { value: '30d', label: '30D', desc: 'Last 30 days' },
                  { value: '90d', label: '90D', desc: 'Last 90 days' },
                  { value: '1y', label: '1Y', desc: 'Last year' }
                ].map(preset => (
                  <Button
                    key={preset.value}
                    variant={!isCustomRange && timeRange === preset.value ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleQuickDateRange(preset.value)}
                    title={preset.desc}
                    className="min-w-[50px]"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              
              {/* Custom Date Range Picker */}
              <div className="border-l border-border pl-3 ml-3">
                <DateRangePicker
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  placeholder="Select custom range..."
                  className="min-w-[280px]"
                  maxDate={new Date()}
                />
              </div>
            </div>
          </div>
          
          {/* Range Navigation Arrows */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
              onClick={() => {
                if (isCustomRange && dateRange.start && dateRange.end) {
                  const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
                  const newStart = new Date(dateRange.start);
                  const newEnd = new Date(dateRange.end);
                  newStart.setDate(newStart.getDate() - rangeDays);
                  newEnd.setDate(newEnd.getDate() - rangeDays);
                  setDateRange({ start: newStart, end: newEnd });
                } else {
                  // Navigate to previous period for preset ranges
                  const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
                  const days = daysMap[timeRange];
                  const newEnd = new Date();
                  newEnd.setDate(newEnd.getDate() - days);
                  const newStart = new Date(newEnd);
                  newStart.setDate(newStart.getDate() - days);
                  setDateRange({ start: newStart, end: newEnd });
                  setIsCustomRange(true);
                }
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Previous Period
            </Button>
            
            <div className="text-xs text-muted-foreground px-4 py-2 bg-secondary/50 rounded-lg">
              {isCustomRange ? 'Custom Range' : `Preset: ${timeRange.toUpperCase()}`}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronRightIcon className="w-4 h-4" />}
              onClick={() => {
                if (isCustomRange && dateRange.start && dateRange.end) {
                  const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
                  const newStart = new Date(dateRange.start);
                  const newEnd = new Date(dateRange.end);
                  newStart.setDate(newStart.getDate() + rangeDays);
                  newEnd.setDate(newEnd.getDate() + rangeDays);
                  
                  // Don't go into the future
                  if (newEnd <= new Date()) {
                    setDateRange({ start: newStart, end: newEnd });
                  }
                } else {
                  // For preset ranges, just reset to current period
                  setIsCustomRange(false);
                  fetchAnalytics();
                }
              }}
              disabled={!isCustomRange && new Date() <= new Date()}
              className="text-muted-foreground hover:text-foreground"
            >
              Next Period
            </Button>
          </div>
        </Card>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card padding="lg" variant="elevated" hover>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Emails</p>
              <p className="text-2xl font-bold text-foreground">{formatNumber(data.totalEmails)}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowTrendingUpIcon className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600">+12% from last period</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <EnvelopeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card padding="lg" variant="elevated" hover>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unread</p>
              <p className="text-2xl font-bold text-foreground">{formatNumber(data.unreadEmails)}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowTrendingDownIcon className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-600">-5% from yesterday</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card padding="lg" variant="elevated" hover>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
              <p className="text-2xl font-bold text-foreground">{data.responseRate}%</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowTrendingUpIcon className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600">+3.2% this week</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="lg" variant="elevated" hover>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold text-foreground">{data.avgResponseTime}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowTrendingDownIcon className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600">18% faster</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Volume by Urgency */}
        <Card padding="lg" variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Emails by Urgency</h3>
            <ChartBarIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(data.emailsByUrgency).map(([urgency, count]) => {
              const total = Object.values(data.emailsByUrgency).reduce((a, b) => a + b, 0);
              const percentage = (count / total) * 100;
              
              return (
                <div key={urgency} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-foreground">
                      {urgency}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        urgency === 'critical' ? 'bg-red-500' :
                        urgency === 'high' ? 'bg-amber-500' :
                        urgency === 'medium' ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Email Classification */}
        <Card padding="lg" variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Email Classification</h3>
            <FunnelIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(data.emailsByClassification).map(([type, count]) => {
              const total = Object.values(data.emailsByClassification).reduce((a, b) => a + b, 0);
              const percentage = (count / total) * 100;
              const label = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              
              return (
                <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">
                      {getClassificationIcon(type)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Weekly Trends */}
      <Card padding="lg" variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Weekly Email Trends</h3>
          <div className="flex gap-2">
            <Badge variant={selectedMetric === 'volume' ? 'primary' : 'outline'} className="cursor-pointer">
              Volume
            </Badge>
            <Badge variant={selectedMetric === 'response' ? 'primary' : 'outline'} className="cursor-pointer">
              Response
            </Badge>
            <Badge variant={selectedMetric === 'productivity' ? 'primary' : 'outline'} className="cursor-pointer">
              Productivity
            </Badge>
          </div>
        </div>
        
        <div className="space-y-4">
          {data.weeklyTrends.map((day, index) => {
            const maxValue = Math.max(...data.weeklyTrends.map(d => Math.max(d.received, d.sent, d.processed)));
            
            return (
              <div key={day.date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Received: {day.received}</span>
                    <span>Sent: {day.sent}</span>
                    <span>Processed: {day.processed}</span>
                  </div>
                </div>
                
                <div className="flex gap-1 h-8">
                  <div className="flex-1 relative bg-secondary rounded">
                    <div 
                      className="absolute inset-0 bg-blue-500 rounded transition-all duration-300"
                      style={{ width: `${(day.received / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="flex-1 relative bg-secondary rounded">
                    <div 
                      className="absolute inset-0 bg-green-500 rounded transition-all duration-300"
                      style={{ width: `${(day.sent / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="flex-1 relative bg-secondary rounded">
                    <div 
                      className="absolute inset-0 bg-purple-500 rounded transition-all duration-300"
                      style={{ width: `${(day.processed / maxValue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-xs text-muted-foreground">Received</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-xs text-muted-foreground">Sent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-xs text-muted-foreground">Processed</span>
          </div>
        </div>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Senders */}
        <Card padding="lg" variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Top Email Senders</h3>
            <UserGroupIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="space-y-3">
            {data.topSenders.map((sender, index) => (
              <div key={sender.email} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{sender.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {sender.count} emails
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={
                    sender.avgUrgency === 'CRITICAL' ? 'danger' :
                    sender.avgUrgency === 'HIGH' ? 'warning' :
                    sender.avgUrgency === 'MEDIUM' ? 'info' : 'success'
                  }
                  size="sm"
                >
                  {sender.avgUrgency}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Productivity Metrics */}
        <Card padding="lg" variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Today's Productivity</h3>
            <ArrowTrendingUpIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-600">{data.productivityMetrics.emailsProcessedToday}</div>
              <div className="text-sm text-blue-600/80">Emails Processed</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="text-2xl font-bold text-green-600">{data.productivityMetrics.draftsCreated}</div>
              <div className="text-sm text-green-600/80">Drafts Created</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <div className="text-2xl font-bold text-purple-600">{data.productivityMetrics.tasksGenerated}</div>
              <div className="text-sm text-purple-600/80">Tasks Generated</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="text-2xl font-bold text-amber-600">{data.productivityMetrics.avgProcessingTime}</div>
              <div className="text-sm text-amber-600/80">Avg Processing</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
