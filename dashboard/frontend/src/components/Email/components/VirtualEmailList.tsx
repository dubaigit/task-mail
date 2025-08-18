import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

export interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail: string;
  recipient?: string;
  date: string;
  classification: string;
  urgency: string;
  confidence: number;
  has_draft: boolean;
  preview?: string;
  content?: string;
  isRead?: boolean;
  isStarred?: boolean;
  tags?: string[];
  estimatedResponseTime?: string;
}

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  visibleItems: number;
  totalItems: number;
}

interface VirtualEmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onEmailSelect: (email: Email) => void;
  getUrgencyIcon: (urgency: string) => React.ReactNode;
  getClassificationColor: (classification: string) => string;
  formatTime: (date: string) => string;
  focusedIndex?: number;
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
}

export const VirtualEmailList: React.FC<VirtualEmailListProps> = ({
  emails,
  selectedEmail,
  onEmailSelect,
  getUrgencyIcon,
  getClassificationColor,
  formatTime,
  focusedIndex = 0,
  onPerformanceUpdate
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated height per email item
    overscan: 5, // Render 5 extra items above/below visible area for smooth scrolling
  });

  // Performance monitoring
  useEffect(() => {
    if (onPerformanceUpdate) {
      const startTime = performance.now();
      
      // Estimate memory usage (rough calculation)
      const visibleItems = virtualizer.getVirtualItems().length;
      const memoryUsage = visibleItems * 0.01; // ~10KB per virtual item vs ~1MB per DOM item
      
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        onPerformanceUpdate({
          memoryUsage,
          renderTime,
          visibleItems,
          totalItems: emails.length
        });
      });
    }
  }, [emails.length, virtualizer, onPerformanceUpdate]);

  if (emails.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-custom" role="status" aria-live="polite">
        <div className="p-8 text-center">
          <EnvelopeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground">No emails found</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={parentRef}
      className="flex-1 overflow-y-auto scrollbar-custom"
      style={{ height: '100%' }}
      role="listbox"
      aria-label="Email list"
      aria-multiselectable="false"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const email = emails[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                onClick={() => onEmailSelect(email)}
                className={`email-item p-4 border-b border-border cursor-pointer h-full ${
                  selectedEmail?.id === email.id ? 'selected' : ''
                } ${!email.isRead ? 'unread' : ''} ${
                  virtualItem.index === focusedIndex ? 'focused' : ''
                }`}
                role="option"
                aria-selected={selectedEmail?.id === email.id}
                aria-label={`Email from ${email.sender}: ${email.subject}. ${email.isRead ? 'Read' : 'Unread'}. ${email.urgency} urgency.`}
                tabIndex={virtualItem.index === focusedIndex ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEmailSelect(email);
                  }
                }}
              >
                {/* Email Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getUrgencyIcon(email.urgency)}
                    <span className={`font-medium truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                      {email.sender}
                    </span>
                    {email.isStarred && <StarSolidIcon className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="Starred email" />}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(email.date)}
                  </span>
                </div>

                {/* Subject */}
                <h3 className={`text-sm mb-1 truncate ${!email.isRead ? 'font-semibold' : 'font-medium'}`}>
                  {email.subject}
                </h3>

                {/* Preview */}
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {email.preview}
                </p>

                {/* Tags and Classification */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`classification-badge inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getClassificationColor(email.classification)}`}>
                    {email.classification.replace('_', ' ')}
                  </span>
                  {email.tags?.slice(0, 2).map(tag => (
                    <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};