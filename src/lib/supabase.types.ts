/**
 * TypeScript type definitions for Supabase database schema
 * Auto-generated and maintained for type safety
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          preferences: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      emails: {
        Row: {
          id: string;
          user_id: string;
          apple_mail_id: string | null;
          subject: string | null;
          sender: string | null;
          recipient: string | null;
          content: string | null;
          html_content: string | null;
          date_received: string | null;
          date_sent: string | null;
          is_read: boolean;
          is_flagged: boolean;
          folder: string;
          labels: string[];
          attachments: EmailAttachment[];
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['emails']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['emails']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          email_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string | null;
          completed_at: string | null;
          tags: string[];
          assignee: string | null;
          category_id: string | null;
          estimated_hours: number | null;
          actual_hours: number | null;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      drafts: {
        Row: {
          id: string;
          user_id: string;
          email_id: string | null;
          subject: string | null;
          recipient: string | null;
          cc: string | null;
          bcc: string | null;
          content: string | null;
          html_content: string | null;
          attachments: EmailAttachment[];
          is_reply: boolean;
          reply_to_id: string | null;
          scheduled_at: string | null;
          template_id: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['drafts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['drafts']['Insert']>;
      };
      ai_interactions: {
        Row: {
          id: string;
          user_id: string;
          email_id: string | null;
          task_id: string | null;
          interaction_type: AIInteractionType;
          prompt: string | null;
          response: string | null;
          model: string | null;
          tokens_used: number | null;
          cost: number | null;
          duration_ms: number | null;
          success: boolean;
          error_message: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_interactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_interactions']['Insert']>;
      };
      email_rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          conditions: EmailRuleCondition[];
          actions: EmailRuleAction[];
          is_active: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_rules']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['email_rules']['Insert']>;
      };
      templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          type: TemplateType;
          subject_template: string | null;
          content_template: string;
          html_template: string | null;
          variables: string[];
          is_shared: boolean;
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['templates']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['templates']['Insert']>;
      };
    };
    Views: {
      task_summary: {
        Row: {
          user_id: string;
          total_tasks: number;
          completed_tasks: number;
          pending_tasks: number;
          overdue_tasks: number;
        };
      };
      email_stats: {
        Row: {
          user_id: string;
          total_emails: number;
          unread_emails: number;
          flagged_emails: number;
          recent_emails: number;
        };
      };
    };
    Functions: {
      get_user_analytics: {
        Args: {
          user_id: string;
          start_date?: string;
          end_date?: string;
        };
        Returns: UserAnalytics;
      };
      search_emails: {
        Args: {
          user_id: string;
          search_term: string;
          limit?: number;
        };
        Returns: Database['public']['Tables']['emails']['Row'][];
      };
      bulk_email_actions: {
        Args: {
          user_id: string;
          email_ids: string[];
          action: 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'archive';
        };
        Returns: void;
      };
    };
  };
}

// ===================
// ENUM TYPES
// ===================

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Archived = 'archived',
  Cancelled = 'cancelled',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export type AIInteractionType = 
  | 'email_summary'
  | 'task_creation'
  | 'draft_generation'
  | 'response_suggestion'
  | 'content_analysis'
  | 'spam_detection'
  | 'sentiment_analysis'
  | 'action_extraction'
  | 'priority_assessment'
  | 'category_suggestion';

export type TemplateType = 'email' | 'task' | 'response' | 'signature';

// ===================
// COMPLEX TYPES
// ===================

export interface EmailAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url?: string;
  data?: string; // base64 encoded for small attachments
}

export interface EmailRuleCondition {
  field: 'sender' | 'recipient' | 'subject' | 'content' | 'has_attachment';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
  case_sensitive?: boolean;
}

export interface EmailRuleAction {
  type: 'move_to_folder' | 'add_label' | 'mark_read' | 'flag' | 'forward' | 'delete' | 'create_task';
  value?: string;
  task_template?: {
    title: string;
    description?: string;
    priority: TaskPriority;
    due_date_offset_days?: number;
  };
}

export interface UserAnalytics {
  user_id: string;
  date_range: {
    start: string;
    end: string;
  };
  email_stats: {
    total_received: number;
    total_sent: number;
    avg_response_time_hours: number;
    top_senders: Array<{ sender: string; count: number }>;
    folder_distribution: Record<string, number>;
  };
  task_stats: {
    total_created: number;
    total_completed: number;
    completion_rate: number;
    avg_completion_time_hours: number;
    priority_distribution: Record<TaskPriority, number>;
    status_distribution: Record<TaskStatus, number>;
  };
  ai_usage: {
    total_interactions: number;
    total_tokens: number;
    total_cost: number;
    most_used_features: Array<{ type: AIInteractionType; count: number }>;
  };
  productivity_metrics: {
    emails_processed_per_day: number;
    tasks_completed_per_day: number;
    peak_activity_hours: number[];
    efficiency_score: number; // 0-100
  };
}

// ===================
// API RESPONSE TYPES
// ===================

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  count?: number;
  status?: number;
  statusText?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// ===================
// FILTER & QUERY TYPES
// ===================

export interface EmailFilters {
  folder?: string;
  isRead?: boolean;
  isFlagged?: boolean;
  sender?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  labels?: string[];
  limit?: number;
  offset?: number;
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignee?: string;
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  tags?: string[];
  hasEmail?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchOptions {
  table: keyof Database['public']['Tables'];
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ===================
// REALTIME TYPES
// ===================

export interface RealtimePayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
  errors?: any;
}

export type SubscriptionCallback<T = any> = (payload: RealtimePayload<T>) => void;

// ===================
// UTILITY TYPES
// ===================

export type DatabaseTables = keyof Database['public']['Tables'];
export type DatabaseRow<T extends DatabaseTables> = Database['public']['Tables'][T]['Row'];
export type DatabaseInsert<T extends DatabaseTables> = Database['public']['Tables'][T]['Insert'];
export type DatabaseUpdate<T extends DatabaseTables> = Database['public']['Tables'][T]['Update'];

// ===================
// CLIENT CONFIGURATION
// ===================

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
  schema?: string;
  headers?: Record<string, string>;
  autoRefreshToken?: boolean;
  persistSession?: boolean;
  detectSessionInUrl?: boolean;
}

export interface DatabaseOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
}