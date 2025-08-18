import {
  DocumentTextIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BookmarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { EmailTemplate } from './types';

export const getCategoryIcon = (category: EmailTemplate['category']) => {
  switch (category) {
    case 'response': return DocumentTextIcon;
    case 'follow-up': return ClockIcon;
    case 'approval': return BuildingOfficeIcon;
    case 'delegation': return UserGroupIcon;
    case 'meeting': return BookmarkIcon;
    case 'custom': return PencilIcon;
    default: return DocumentTextIcon;
  }
};

export const getCategoryColor = (category: EmailTemplate['category']) => {
  switch (category) {
    case 'response': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'follow-up': return 'bg-green-50 text-green-700 border-green-200';
    case 'approval': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'delegation': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'meeting': return 'bg-pink-50 text-pink-700 border-pink-200';
    case 'custom': return 'bg-gray-50 text-gray-700 border-gray-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};