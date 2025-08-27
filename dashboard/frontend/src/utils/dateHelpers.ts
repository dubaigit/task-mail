export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatRelativeTime = (date: Date | string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffInMs = now.getTime() - d.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return formatDate(d);
  }
};