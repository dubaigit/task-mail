// Date formatting utilities for TaskCard components

export const formatDueDate = (dueDate: Date | string | undefined, urgencyColor: string) => {
  if (!dueDate) return null;
  
  const dueDateObj = new Date(dueDate);
  const now = new Date();
  const diffTime = dueDateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`,
      isOverdue: true,
      color: urgencyColor
    };
  } else if (diffDays === 0) {
    return {
      text: 'Due today',
      isToday: true,
      color: '#EA580C' // orange-600
    };
  } else if (diffDays === 1) {
    return {
      text: 'Due tomorrow',
      isUpcoming: true,
      color: '#D97706' // amber-600
    };
  } else {
    return {
      text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
      isUpcoming: true,
      color: '#6B7280' // gray-500
    };
  }
};

export const formatRelativeTime = (date: Date | string): string => {
  const dateObj = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - dateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return dateObj < now ? 'Yesterday' : 'Tomorrow';
  } else if (diffDays < 7) {
    return `${diffDays} days ${dateObj < now ? 'ago' : 'from now'}`;
  } else {
    return dateObj.toLocaleDateString();
  }
};

export const formatShortDate = (date: Date | string): string => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

export const isOverdue = (task: { dueDate?: Date | string; status: string }): boolean => {
  return Boolean(task.dueDate && 
         new Date(task.dueDate) < new Date() && 
         task.status !== 'completed' && 
         task.status !== 'cancelled');
};