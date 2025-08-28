import React from 'react';
import { Icons } from '../../ui/icons';

interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail?: string;
  recipient?: string;
  date: string;
  urgency: string;
  classification: string;
  confidence: number;
  estimatedResponseTime?: string;
  has_draft?: boolean;
  preview?: string;
  isRead?: boolean;
  isStarred?: boolean;
  tags?: string[];
}

interface ViewModeAnalysis {
  confidence: number;
  reasoning: string;
}

interface EmailHeaderProps {
  selectedEmail: Email;
  currentViewMode: string;
  viewModeAnalysis: ViewModeAnalysis | null;
  actionLoading: string | null;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onStar?: () => void;
}

export const EmailHeader: React.FC<EmailHeaderProps> = ({
  selectedEmail,
  currentViewMode,
  viewModeAnalysis,
  actionLoading,
  onMarkRead,
  onArchive,
  onDelete,
  onStar
}) => {
  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return <Icons.fire className="w-5 h-5 text-red-500" />;
      case 'normal':
        return <Icons.warning className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <Icons.info className="w-5 h-5 text-blue-500" />;
      default:
        return <Icons.minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getClassificationColor = (classification: string) => {
    const colorMap: Record<string, string> = {
      'customer_inquiry': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'support_request': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'urgent_issue': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'feedback': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'newsletter': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      'personal': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'other': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    };
    return colorMap[classification] || colorMap['other'];
  };

  return (
    <div className="email-detail-header p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getUrgencyIcon(selectedEmail.urgency)}
          <div>
            <h1 className="text-xl font-semibold mb-1">{selectedEmail.subject}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{selectedEmail.sender}</span>
              <span>•</span>
              <span>{selectedEmail.senderEmail}</span>
              <span>•</span>
              <span>{new Date(selectedEmail.date).toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onMarkRead}
            disabled={actionLoading === 'markRead'}
            className="action-button p-2 rounded-lg disabled:opacity-50"
            title="Mark as read"
          >
            {actionLoading === 'markRead' ? (
              <Icons.refresh className="w-4 h-4 animate-spin" />
            ) : (
              <Icons.eye className="w-4 h-4" />
            )}
          </button>
          <button 
            onClick={onStar}
            className="action-button p-2 rounded-lg"
            title="Star email"
          >
            <Icons.star className="w-4 h-4" />
          </button>
          <button 
            onClick={onArchive}
            disabled={actionLoading === 'archive'}
            className="action-button p-2 rounded-lg disabled:opacity-50"
            title="Archive email"
          >
            {actionLoading === 'archive' ? (
              <Icons.refresh className="w-4 h-4 animate-spin" />
            ) : (
              <Icons.archive className="w-4 h-4" />
            )}
          </button>
          <button 
            onClick={onDelete}
            disabled={actionLoading === 'delete'}
            className="action-button p-2 rounded-lg disabled:opacity-50"
            title="Delete email"
          >
            {actionLoading === 'delete' ? (
              <Icons.refresh className="w-4 h-4 animate-spin" />
            ) : (
              <Icons.trash className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Email Metadata */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className={`classification-badge inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full ${getClassificationColor(selectedEmail.classification)}`}>
          {selectedEmail.classification.replace('_', ' ')}
        </span>
        <span className="text-sm bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
          {Math.round(selectedEmail.confidence * 100)}% confidence
        </span>
        {selectedEmail.estimatedResponseTime && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Icons.clock className="w-4 h-4" />
            Est. {selectedEmail.estimatedResponseTime} to read
          </span>
        )}
        {selectedEmail.has_draft && (
          <span className="text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-1.5 rounded-full">
            Draft Ready
          </span>
        )}
      </div>

      {/* Current View Mode Indicator */}
      <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full" />
          <span className="text-sm font-medium text-primary">
            Current View: {currentViewMode.charAt(0).toUpperCase() + currentViewMode.slice(1)}
          </span>
          {viewModeAnalysis && viewModeAnalysis.confidence >= 0.8 && (
            <span className="text-xs text-muted-foreground ml-auto" title={viewModeAnalysis.reasoning}>
              AI confidence: {Math.round(viewModeAnalysis.confidence * 100)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Use the view toggle buttons at the top to switch modes
        </p>
      </div>
    </div>
  );
};