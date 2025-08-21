import { 
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export type EmailClassification = 
  | 'NEEDS_REPLY' 
  | 'APPROVAL_REQUIRED' 
  | 'CREATE_TASK' 
  | 'DELEGATE' 
  | 'FYI_ONLY' 
  | 'UNCLASSIFIED';

export type EmailUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Get the appropriate color classes for an email classification
 */
export const getClassificationColor = (classification: string): string => {
  switch (classification) {
    case 'NEEDS_REPLY': 
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'APPROVAL_REQUIRED': 
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'CREATE_TASK': 
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'DELEGATE': 
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'FYI_ONLY': 
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default: 
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

/**
 * Get the urgency icon component for an email
 */
export const getUrgencyIcon = (urgency: string) => {
  switch (urgency) {
    case 'CRITICAL':
      return { 
        icon: ExclamationTriangleIcon, 
        className: 'w-4 h-4 text-red-500',
        label: 'Critical urgency' 
      };
    case 'HIGH':
      return { 
        icon: ExclamationTriangleIcon, 
        className: 'w-4 h-4 text-amber-500',
        label: 'High urgency' 
      };
    case 'MEDIUM':
      return { 
        icon: CheckCircleIcon, 
        className: 'w-4 h-4 text-blue-500',
        label: 'Medium urgency' 
      };
    case 'LOW':
      return { 
        icon: CheckCircleIcon, 
        className: 'w-4 h-4 text-gray-500',
        label: 'Low urgency' 
      };
    default:
      return null;
  }
};

/**
 * Format classification label for display
 */
export const formatClassificationLabel = (classification: string): string => {
  switch (classification) {
    case 'NEEDS_REPLY': 
      return 'Needs Reply';
    case 'APPROVAL_REQUIRED': 
      return 'Approval Required';
    case 'CREATE_TASK': 
      return 'Create Task';
    case 'DELEGATE': 
      return 'Delegate';
    case 'FYI_ONLY': 
      return 'FYI Only';
    case 'UNCLASSIFIED':
      return 'Unclassified';
    default: 
      return classification;
  }
};

/**
 * Format urgency label for display
 */
export const formatUrgencyLabel = (urgency: string): string => {
  switch (urgency) {
    case 'CRITICAL': 
      return 'Critical';
    case 'HIGH': 
      return 'High';
    case 'MEDIUM': 
      return 'Medium';
    case 'LOW': 
      return 'Low';
    default: 
      return urgency;
  }
};

/**
 * Get priority score for sorting emails
 */
export const getEmailPriorityScore = (
  classification: EmailClassification, 
  urgency: EmailUrgency
): number => {
  const classificationScores: Record<EmailClassification, number> = {
    'APPROVAL_REQUIRED': 100,
    'NEEDS_REPLY': 80,
    'CREATE_TASK': 60,
    'DELEGATE': 40,
    'FYI_ONLY': 20,
    'UNCLASSIFIED': 10,
  };

  const urgencyScores: Record<EmailUrgency, number> = {
    'CRITICAL': 1000,
    'HIGH': 100,
    'MEDIUM': 10,
    'LOW': 1,
  };

  return (classificationScores[classification] || 0) + (urgencyScores[urgency] || 0);
};

/**
 * Sort emails by priority
 */
export const sortEmailsByPriority = <T extends { 
  classification: string; 
  urgency: string; 
}>(emails: T[]): T[] => {
  return [...emails].sort((a, b) => {
    const scoreA = getEmailPriorityScore(
      a.classification as EmailClassification,
      a.urgency as EmailUrgency
    );
    const scoreB = getEmailPriorityScore(
      b.classification as EmailClassification,
      b.urgency as EmailUrgency
    );
    return scoreB - scoreA;
  });
};