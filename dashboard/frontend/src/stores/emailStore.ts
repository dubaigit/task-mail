import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { emailApi } from '../utils/apiClient';
import { createStoreErrorHandler } from '../utils/errorHandler';

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

interface EmailState {
  // State
  emails: Email[];
  selectedEmail: Email | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterBy: 'all' | 'unread' | 'starred' | 'urgent';
  selectedCategory: string;
  
  // Computed values
  filteredEmails: Email[];
  
  // Actions
  setEmails: (emails: Email[]) => void;
  selectEmail: (email: Email | null) => void;
  updateEmail: (id: number, updates: Partial<Email>) => void;
  deleteEmail: (id: number) => void;
  setSearchQuery: (query: string) => void;
  setFilterBy: (filter: EmailState['filterBy']) => void;
  setSelectedCategory: (category: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Async actions
  fetchEmails: () => Promise<void>;
  archiveEmail: (id: number) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  toggleStar: (id: number) => void;
  searchEmails: (query: string) => Promise<void>;
}

const filterEmails = (
  emails: Email[],
  searchQuery: string,
  filterBy: EmailState['filterBy'],
  selectedCategory: string
): Email[] => {
  let filtered = [...emails];
  
  // Apply category filter
  if (selectedCategory !== 'inbox') {
    // This would need more sophisticated filtering based on category
    // For now, we'll keep all emails for non-inbox categories
  }
  
  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(email =>
      email.subject.toLowerCase().includes(query) ||
      email.sender.toLowerCase().includes(query) ||
      email.preview?.toLowerCase().includes(query) ||
      email.content?.toLowerCase().includes(query)
    );
  }
  
  // Apply status filter
  switch (filterBy) {
    case 'unread':
      filtered = filtered.filter(email => !email.isRead);
      break;
    case 'starred':
      filtered = filtered.filter(email => email.isStarred);
      break;
    case 'urgent':
      filtered = filtered.filter(email => 
        email.urgency === 'CRITICAL' || email.urgency === 'HIGH'
      );
      break;
    case 'all':
    default:
      // No additional filtering
      break;
  }
  
  return filtered;
};

const handleError = createStoreErrorHandler('emailStore');

export const useEmailStore = create<EmailState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        emails: [],
        selectedEmail: null,
        loading: false,
        error: null,
        searchQuery: '',
        filterBy: 'all',
        selectedCategory: 'inbox',
        
        // Computed values
        get filteredEmails() {
          const { emails, searchQuery, filterBy, selectedCategory } = get();
          return filterEmails(emails, searchQuery, filterBy, selectedCategory);
        },
        
        // Actions
        setEmails: (emails) => set({ emails }),
        
        selectEmail: (email) => set({ selectedEmail: email }),
        
        updateEmail: (id, updates) => set((state) => ({
          emails: state.emails.map(email =>
            email.id === id ? { ...email, ...updates } : email
          ),
          selectedEmail: state.selectedEmail?.id === id
            ? { ...state.selectedEmail, ...updates }
            : state.selectedEmail,
        })),
        
        deleteEmail: (id) => set((state) => ({
          emails: state.emails.filter(email => email.id !== id),
          selectedEmail: state.selectedEmail?.id === id ? null : state.selectedEmail,
        })),
        
        setSearchQuery: (query) => set({ searchQuery: query }),
        
        setFilterBy: (filter) => set({ filterBy: filter }),
        
        setSelectedCategory: (category) => set({ selectedCategory: category }),
        
        setLoading: (loading) => set({ loading }),
        
        setError: (error) => set({ error }),
        
        // Async actions
        fetchEmails: async () => {
          const { setLoading, setError, setEmails } = get();
          setLoading(true);
          setError(null);
          
          try {
            const response = await emailApi.getEmails();
            if (response.error) {
              throw new Error(response.error);
            }
            
            if (Array.isArray(response.data)) {
              const processedEmails = response.data.map((email: any, index: number) => ({
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
            }
          } catch (error) {
            setError(handleError(error, 'fetchEmails'));
          } finally {
            setLoading(false);
          }
        },
        
        archiveEmail: async (id) => {
          const { updateEmail, setError } = get();
          
          try {
            const response = await emailApi.archiveEmail(id);
            if (response.error) {
              throw new Error(response.error);
            }
            
            // Remove from current view (or mark as archived)
            updateEmail(id, { tags: ['archived'] });
          } catch (error) {
            setError(handleError(error, 'archiveEmail'));
          }
        },
        
        markAsRead: async (id) => {
          const { updateEmail, setError } = get();
          
          try {
            const response = await emailApi.markEmailAsRead(id);
            if (response.error) {
              throw new Error(response.error);
            }
            
            updateEmail(id, { isRead: true });
          } catch (error) {
            setError(handleError(error, 'markAsRead'));
          }
        },
        
        toggleStar: (id) => {
          const { emails, updateEmail } = get();
          const email = emails.find(e => e.id === id);
          if (email) {
            updateEmail(id, { isStarred: !email.isStarred });
          }
        },
        
        searchEmails: async (query) => {
          const { setLoading, setError, setEmails, setSearchQuery } = get();
          setSearchQuery(query);
          
          if (!query) {
            // If query is empty, fetch all emails
            await get().fetchEmails();
            return;
          }
          
          setLoading(true);
          setError(null);
          
          try {
            const response = await emailApi.searchEmails(query);
            if (response.error) {
              throw new Error(response.error);
            }
            
            if (Array.isArray(response.data)) {
              setEmails(response.data);
            }
          } catch (error) {
            setError(handleError(error, 'searchEmails'));
          } finally {
            setLoading(false);
          }
        },
      }),
      {
        name: 'email-store',
        partialize: (state) => ({
          selectedCategory: state.selectedCategory,
          filterBy: state.filterBy,
        }),
      }
    )
  )
);