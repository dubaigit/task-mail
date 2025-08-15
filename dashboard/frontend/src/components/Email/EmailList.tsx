import React, { useState, useEffect, useCallback } from 'react';
import { 
  ExclamationTriangleIcon,
  StarIcon,
  ClockIcon,
  CheckCircleIcon,
  EyeIcon,
  PaperAirplaneIcon,
  ArchiveBoxIcon,
  TrashIcon,
  TagIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Badge, Button, Card, Input, Select, Skeleton, Alert, Tooltip } from '../ui';
import { DateRangePicker, DateRange } from '../DateRangePicker';

interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail?: string;
  recipient?: string;
  date: string;
  classification: string;
  urgency: string;
  confidence: number;
  has_draft: boolean;
  preview?: string;
  isRead?: boolean;
  isStarred?: boolean;
  tags?: string[];
  estimatedResponseTime?: string;
}

const EmailList: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'urgency' | 'classification'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'unread' | 'urgent' | 'needs_reply'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8002/emails/');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        throw new Error('Invalid API response format');
      }
      
      // Enhance emails with additional properties
      const enhancedEmails = data.map(email => ({
        ...email,
        isRead: Math.random() > 0.3,
        isStarred: Math.random() > 0.8,
        preview: `This is a preview of the email content from ${email.sender}...`,
        tags: ['work', 'important'].slice(0, Math.floor(Math.random() * 3)),
        estimatedResponseTime: ['2 min', '5 min', '15 min', '1 hour'][Math.floor(Math.random() * 4)],
        senderEmail: email.sender.toLowerCase().replace(' ', '.') + '@company.com'
      }));
      
      setEmails(enhancedEmails);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'NEEDS_REPLY':
        return 'info';
      case 'APPROVAL_REQUIRED':
        return 'danger';
      case 'CREATE_TASK':
        return 'warning';
      case 'DELEGATE':
        return 'warning';
      case 'FYI_ONLY':
        return 'success';
      default:
        return 'default';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'HIGH':
        return <StarIcon className="w-5 h-5 text-amber-500" />;
      case 'MEDIUM':
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'NEEDS_REPLY':
        return <PaperAirplaneIcon className="w-4 h-4" />;
      case 'APPROVAL_REQUIRED':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'CREATE_TASK':
        return <CalendarDaysIcon className="w-4 h-4" />;
      case 'DELEGATE':
        return <UserIcon className="w-4 h-4" />;
      default:
        return <EyeIcon className="w-4 h-4" />;
    }
  };

  const handleEmailAction = (emailId: number, action: string) => {
    console.log(`Action ${action} on email ${emailId}`);
    // Implement email actions
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action ${action} on emails:`, selectedEmails);
    // Implement bulk actions
  };

  const toggleEmailSelection = (emailId: number) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const clearSelection = () => {
    setSelectedEmails([]);
  };

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
    setIsCustomRange(true);
  }, []);

  const handleQuickDateRange = (preset: string) => {
    const today = new Date();
    let startDate: Date;
    
    switch (preset) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7d':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date('2020-01-01'); // Far back date
        break;
      default:
        return;
    }
    
    setDateRange({ start: startDate, end: today });
    setTimeRange(preset as any);
    setIsCustomRange(false);
  };

  const isEmailInDateRange = (emailDate: string) => {
    if (!dateRange.start || !dateRange.end) return true;
    
    const emailDateObj = new Date(emailDate);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    // Set hours for proper comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return emailDateObj >= startDate && emailDateObj <= endDate;
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = (() => {
      switch (filterBy) {
        case 'unread':
          return !email.isRead;
        case 'urgent':
          return email.urgency === 'CRITICAL' || email.urgency === 'HIGH';
        case 'needs_reply':
          return email.classification === 'NEEDS_REPLY';
        default:
          return true;
      }
    })();

    const matchesDateRange = isEmailInDateRange(email.date);

    return matchesSearch && matchesFilter && matchesDateRange;
  });

  const sortedEmails = [...filteredEmails].sort((a, b) => {
    switch (sortBy) {
      case 'urgency':
        const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return urgencyOrder[b.urgency as keyof typeof urgencyOrder] - urgencyOrder[a.urgency as keyof typeof urgencyOrder];
      case 'classification':
        return a.classification.localeCompare(b.classification);
      default:
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton height="2rem" width="8rem" />
          <Skeleton height="2.25rem" width="6rem" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} padding="lg">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton height="1.5rem" width="60%" />
                  <Skeleton height="1rem" width="5rem" />
                </div>
                <Skeleton height="1rem" width="40%" />
                <div className="flex gap-2">
                  <Skeleton height="1.5rem" width="4rem" />
                  <Skeleton height="1.5rem" width="5rem" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title="Error loading emails" dismissible>
        <p className="mb-3">{error}</p>
        <Button onClick={fetchEmails} variant="danger" size="sm">
          Try Again
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
          <p className="text-muted-foreground mt-1">
            {filteredEmails.length} emails • {filteredEmails.filter(e => !e.isRead).length} unread
          </p>
          {dateRange.start && dateRange.end && (
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" />
              <span>
                {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
        <Button onClick={fetchEmails} variant="outline" leftIcon={<ArrowPathIcon className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

      {/* Enhanced Date Range Controls */}
      <Card padding="lg" variant="elevated" className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
              <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email Date Range</h3>
              <p className="text-sm text-muted-foreground">
                Filter emails by date to focus on specific periods
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Quick Preset Buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'today', label: 'Today', desc: 'Today only' },
                { value: '7d', label: '7D', desc: 'Last 7 days' },
                { value: '30d', label: '30D', desc: 'Last 30 days' },
                { value: '90d', label: '90D', desc: 'Last 90 days' },
                { value: 'all', label: 'All', desc: 'All emails' }
              ].map(preset => (
                <Button
                  key={preset.value}
                  variant={!isCustomRange && timeRange === preset.value ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickDateRange(preset.value)}
                  title={preset.desc}
                  className="min-w-[55px]"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Custom Date Range Picker */}
            <div className="border-l border-border pl-3 ml-3">
              <div className="min-w-[260px]">
                <DateRangePicker
                  initialRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                  placeholder="Custom range..."
                  maxDate={new Date()}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Search Controls */}
      <Card padding="lg" variant="elevated">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <Input
            type="search"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
          />
          
          <Select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            options={[
              { value: 'all', label: 'All emails' },
              { value: 'unread', label: 'Unread only' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'needs_reply', label: 'Needs reply' }
            ]}
            placeholder="Filter by..."
          />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            options={[
              { value: 'date', label: 'Sort by date' },
              { value: 'urgency', label: 'Sort by urgency' },
              { value: 'classification', label: 'Sort by type' }
            ]}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'list' ? 'compact' : 'list')}
            >
              {viewMode === 'list' ? 'Compact' : 'Detailed'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedEmails.length > 0 && (
        <Card padding="md" variant="outlined" className="bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedEmails.length} email{selectedEmails.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction('archive')}>
                <ArchiveBoxIcon className="w-4 h-4" />
                Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction('delete')}>
                <TrashIcon className="w-4 h-4" />
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Email List */}
      <div className="space-y-4">
        {sortedEmails.length > 0 ? (
          sortedEmails.map((email) => (
            <Card 
              key={email.id} 
              padding="none" 
              hover 
              interactive
              className={`transition-all duration-200 group ${
                selectedEmails.includes(email.id) ? 'ring-2 ring-primary/50 bg-primary/5' : ''
              } ${!email.isRead ? 'border-l-4 border-l-primary' : ''}`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Selection Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                          {getUrgencyIcon(email.urgency)}
                          <h3 className={`font-semibold text-foreground truncate ${!email.isRead ? 'font-bold' : ''}`}>
                            {email.subject}
                          </h3>
                          {email.isStarred && (
                            <StarIcon className="w-4 h-4 text-amber-500 fill-current" />
                          )}
                        </div>

                        {/* Sender Info */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">{email.sender}</span>
                          {email.senderEmail && (
                            <>
                              <span>•</span>
                              <span>{email.senderEmail}</span>
                            </>
                          )}
                          {email.recipient && (
                            <>
                              <span>→</span>
                              <span>{email.recipient}</span>
                            </>
                          )}
                        </div>

                        {/* Preview */}
                        {viewMode === 'list' && email.preview && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {email.preview}
                          </p>
                        )}

                        {/* Badges and Metadata */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge 
                            variant={getClassificationColor(email.classification)}
                            size="sm"
                          >
                            <span className="flex items-center gap-1">
                              {getClassificationIcon(email.classification)}
                              {email.classification.replace('_', ' ')}
                            </span>
                          </Badge>
                          
                          <Badge variant="default" size="sm">
                            {Math.round(email.confidence * 100)}% confidence
                          </Badge>

                          {email.has_draft && (
                            <Badge variant="success" size="sm" dot>
                              Draft Ready
                            </Badge>
                          )}

                          {email.estimatedResponseTime && (
                            <Badge variant="outline" size="sm">
                              <ClockIcon className="w-3 h-3 mr-1" />
                              {email.estimatedResponseTime}
                            </Badge>
                          )}

                          {email.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" size="sm">
                              <TagIcon className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Time and Actions */}
                      <div className="flex flex-col items-end gap-3">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(email.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>

                        {/* Quick Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip content="View email">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleEmailAction(email.id, 'view')}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                          
                          <Tooltip content="Quick reply">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleEmailAction(email.id, 'reply')}
                            >
                              <PaperAirplaneIcon className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                          
                          <Tooltip content="Archive">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleEmailAction(email.id, 'archive')}
                            >
                              <ArchiveBoxIcon className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card padding="xl" className="text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-secondary rounded-full flex items-center justify-center">
                <EnvelopeIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">No emails found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || filterBy !== 'all' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Your inbox is empty. New emails will appear here.'}
                </p>
              </div>
              {(searchQuery || filterBy !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterBy('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmailList;
