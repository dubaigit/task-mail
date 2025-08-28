export interface Email {
  id: number;
  subject: string;
  sender: string;
  classification: string;
  urgency: string;
}

export interface Draft {
  id: number;
  content: string;
  confidence: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: 'response' | 'follow-up' | 'approval' | 'delegation' | 'meeting' | 'custom';
  tags: string[];
  isStarred: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  author: string;
  is_public: boolean;
  suggested_for: string[];
}

export interface TemplateFilters {
  category: string;
  search: string;
  starred: boolean;
  recentlyUsed: boolean;
}

export interface TemplateManagerProps {
  selectedEmail: Email | null;
  currentDraft: Draft | null;
  onTemplateApply: (template: EmailTemplate) => void;
  onTemplateCreate: (content: string, metadata: Partial<EmailTemplate>) => void;
  className?: string;
}