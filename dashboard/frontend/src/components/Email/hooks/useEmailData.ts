import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '../../../utils/constants';
import { createHookErrorHandler } from '../../../utils/errorHandler';

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

export interface UseEmailDataReturn {
  emails: Email[];
  loading: boolean;
  error: string | null;
  fetchEmails: () => Promise<void>;
  refetch: () => Promise<void>;
  updateEmail: (id: number, updates: Partial<Email>) => void;
  deleteEmail: (id: number) => void;
}

/**
 * Custom hook for managing email data fetching and state
 */
export const useEmailData = (): UseEmailDataReturn => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleError = createHookErrorHandler('useEmailData');

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.EMAILS}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid API response format');
      }
      
      const processedEmails = data.map((email: any, index: number) => ({
        id: email.id || index,
        subject: email.subject || 'No Subject',
        sender: email.sender || 'Unknown Sender',
        senderEmail: email.senderEmail || email.sender_email || '',
        date: email.date || new Date().toISOString(),
        classification: email.classification || 'UNCLASSIFIED',
        urgency: email.urgency || 'LOW',
        confidence: email.confidence || 0,
        has_draft: email.has_draft || false,
        preview: email.preview || email.content?.substring(0, 150) + '...' || '',
        content: email.content || '',
        isRead: email.isRead ?? email.is_read ?? false,
        isStarred: email.isStarred ?? email.is_starred ?? false,
        tags: email.tags || []
      }));
      
      setEmails(processedEmails);
    } catch (error) {
      setError(handleError(error, 'fetchEmails'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchEmails();
  }, [fetchEmails]);

  const updateEmail = useCallback((id: number, updates: Partial<Email>) => {
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === id ? { ...email, ...updates } : email
      )
    );
  }, []);

  const deleteEmail = useCallback((id: number) => {
    setEmails(prevEmails => prevEmails.filter(email => email.id !== id));
  }, []);

  // Fetch emails on mount
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return {
    emails,
    loading,
    error,
    fetchEmails,
    refetch,
    updateEmail,
    deleteEmail,
  };
};
