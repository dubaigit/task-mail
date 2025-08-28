export type DateFilterType = 'today' | 'week' | 'month' | 'all';

/**
 * Get the start and end dates for a given filter type
 */
export function getDateRange(filterType: DateFilterType): { start: Date | null; end: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filterType) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
      
    case 'week':
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return {
        start: startOfWeek,
        end: endOfWeek
      };
      
    case 'month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return {
        start: startOfMonth,
        end: endOfMonth
      };
      
    case 'all':
    default:
      return {
        start: null,
        end: null
      };
  }
}

/**
 * Check if a date falls within the specified filter range
 */
export function isDateInRange(date: Date | string, filterType: DateFilterType): boolean {
  if (filterType === 'all') return true;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  
  const { start, end } = getDateRange(filterType);
  if (!start || !end) return true;
  
  return dateObj >= start && dateObj <= end;
}

/**
 * Filter tasks by date range
 */
export function filterTasksByDate<T extends { createdAt?: Date; date?: string }>(
  tasks: T[], 
  filterType: DateFilterType
): T[] {
  if (filterType === 'all') return tasks;
  
  return tasks.filter(task => {
    const taskDate = task.createdAt || (task.date ? new Date(task.date) : null);
    if (!taskDate) return false;
    
    return isDateInRange(taskDate, filterType);
  });
}

/**
 * Get count of tasks for each date filter
 */
export function getTaskCountsByDateFilter<T extends { createdAt?: Date; date?: string }>(
  tasks: T[]
): Record<DateFilterType, number> {
  return {
    today: filterTasksByDate(tasks, 'today').length,
    week: filterTasksByDate(tasks, 'week').length,
    month: filterTasksByDate(tasks, 'month').length,
    all: tasks.length
  };
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  const dateToCheck = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  if (dateToCheck.getTime() === today.getTime()) {
    return 'Today';
  } else if (dateToCheck.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (dateObj.getFullYear() === now.getFullYear()) {
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Unknown';
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * Get the label for a date filter
 */
export function getDateFilterLabel(filterType: DateFilterType, count?: number): string {
  const baseLabels = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time'
  };
  
  const label = baseLabels[filterType];
  return count !== undefined ? `${label} (${count})` : label;
}

/**
 * Check if a date is overdue (for tasks with due dates)
 */
export function isOverdue(dueDate: Date | string): boolean {
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(dueDateObj.getTime())) return false;
  
  const now = new Date();
  return dueDateObj < now;
}

/**
 * Get priority based on how close a task is to its due date
 */
export function getDateBasedPriority(dueDate: Date | string): 'low' | 'medium' | 'high' | 'urgent' {
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(dueDateObj.getTime())) return 'low';
  
  const now = new Date();
  const diffMs = dueDateObj.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 0) {
    return 'urgent';
  } else if (diffHours < 24) {
    return 'high';
  } else if (diffHours < 72) {
    return 'medium';
  } else {
    return 'low';
  }
}
