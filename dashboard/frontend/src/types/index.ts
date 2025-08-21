/**
 * Comprehensive TypeScript type definitions for Apple Mail Dashboard
 * Following .roorules standards with explicit types and proper naming conventions
 */

// Core Email Intelligence Types
export interface EmailMessage {
  id: string;
  messageId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  recipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  date: string;
  content: string;
  preview: string;
  isRead: boolean;
  isStarred: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachmentCount?: number;
  threadId?: string;
  labels: string[];
  tags: string[];
  timestamp?: Date;
  metadata?: any;
}

// AI Classification System Types
export type EmailClassification = 
  | 'NEEDS_REPLY'
  | 'APPROVAL_REQUIRED' 
  | 'CREATE_TASK'
  | 'DELEGATE'
  | 'FYI_ONLY'
  | 'FOLLOW_UP';

export type EmailUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type EmailSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'FRUSTRATED';

export interface AIAnalysis {
  classification: EmailClassification;
  urgency: EmailUrgency;
  sentiment: EmailSentiment;
  confidence: number; // 0-1
  actionItems: ActionItem[];
  deadlines: Deadline[];
  keywords: string[];
  summary: string;
  suggestedActions: SuggestedAction[];
}

export interface ActionItem {
  id: string;
  text: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedDuration?: number; // minutes
  assignedTo?: string;
  deadline?: string;
  completed: boolean;
}

export interface Deadline {
  id: string;
  text: string;
  date: string;
  priority: EmailUrgency;
  source: 'EXPLICIT' | 'INFERRED';
}

export interface SuggestedAction {
  id: string;
  type: 'REPLY' | 'FORWARD' | 'CREATE_TASK' | 'SCHEDULE_MEETING' | 'ARCHIVE';
  label: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// Enhanced Email with AI Intelligence
export interface IntelligentEmail extends EmailMessage {
  aiAnalysis: AIAnalysis;
  hasThread: boolean;
  threadCount?: number;
  relatedEmails: string[];
  processingStatus: 'PENDING' | 'ANALYZED' | 'PROCESSED' | 'ERROR';
  lastProcessed?: string;
}

// Task Management Types
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assignedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  completedAt?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  tags: string[];
  emailId?: string; // Reference to source email
  subtasks: SubTask[];
  dependencies: string[]; // Task IDs
  progress: number; // 0-100
  comments: TaskComment[];
}

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
}

export interface TaskComment {
  id: string;
  userId: string;
  userDisplayName: string;
  content: string;
  timestamp: string;
  mentions: string[];
}

// Draft Management Types
export interface EmailDraft {
  id: string;
  emailId: string; // Reference to original email
  subject: string;
  content: string;
  recipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  attachments: DraftAttachment[];
  status: DraftStatus;
  version: number;
  confidence: number;
  generatedAt: string;
  lastModified: string;
  modifiedBy?: string;
  tone: DraftTone;
  template?: string;
  aiSuggestions: AISuggestion[];
}

export type DraftStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SENT' | 'SCHEDULED';

export type DraftTone = 'PROFESSIONAL' | 'FRIENDLY' | 'FORMAL' | 'CASUAL' | 'URGENT';

export interface DraftAttachment {
  id: string;
  filename: string;
  size: number;
  type: string;
  url?: string;
}

export interface AISuggestion {
  id: string;
  type: 'TONE_ADJUSTMENT' | 'CONTENT_IMPROVEMENT' | 'GRAMMAR_FIX' | 'CLARITY_ENHANCEMENT';
  suggestion: string;
  originalText: string;
  suggestedText: string;
  confidence: number;
  applied: boolean;
}

// Analytics and Performance Types
export interface AnalyticsDashboard {
  timeRange: TimeRange;
  emailMetrics: EmailMetrics;
  taskMetrics: TaskMetrics;
  productivityMetrics: ProductivityMetrics;
  colleagueMetrics: ColleagueMetrics;
  trends: AnalyticsTrend[];
  insights: AnalyticsInsight[];
}

export interface TimeRange {
  start: string;
  end: string;
  preset?: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
}

export interface EmailMetrics {
  totalEmails: number;
  emailsProcessed: number;
  emailsByClassification: Record<EmailClassification, number>;
  emailsByUrgency: Record<EmailUrgency, number>;
  averageResponseTime: number; // hours
  responseRate: number; // 0-1
  processedVsPending: {
    processed: number;
    pending: number;
  };
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  averageCompletionTime: number; // hours
  overdueTasksCount: number;
  productivityScore: number; // 0-100
}

export interface ProductivityMetrics {
  dailyEmailsProcessed: number[];
  dailyTasksCompleted: number[];
  peakProductivityHours: number[];
  efficiencyScore: number; // 0-100
  focusTimePercentage: number; // 0-100
  interruptionCount: number;
}

export interface ColleagueMetrics {
  responseTimeByColleague: Record<string, number>;
  taskCompletionByColleague: Record<string, number>;
  collaborationFrequency: Record<string, number>;
  delegatedTasksSuccess: Record<string, number>;
}

export interface AnalyticsTrend {
  id: string;
  type: 'EMAIL_VOLUME' | 'TASK_COMPLETION' | 'RESPONSE_TIME' | 'PRODUCTIVITY';
  direction: 'UP' | 'DOWN' | 'STABLE';
  percentage: number;
  period: string;
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AnalyticsInsight {
  id: string;
  type: 'RECOMMENDATION' | 'ALERT' | 'PATTERN' | 'OPPORTUNITY';
  title: string;
  description: string;
  actionable: boolean;
  suggestedActions: string[];
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
}

// User Interface and Customization Types
export interface DashboardLayout {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  gridLayout: GridLayout;
  customizations: LayoutCustomization[];
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  visible: boolean;
  refreshInterval?: number; // seconds
}

export type WidgetType = 
  | 'EMAIL_SUMMARY'
  | 'TASK_KANBAN'
  | 'ANALYTICS_CHART'
  | 'COLLEAGUE_TRACKING'
  | 'AI_INSIGHTS'
  | 'RECENT_ACTIVITY'
  | 'DRAFT_QUEUE'
  | 'DEADLINE_CALENDAR'
  | 'PERFORMANCE_METRICS'
  | 'CUSTOM_REPORT';

export interface WidgetPosition {
  x: number;
  y: number;
  row: number;
  column: number;
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetConfig {
  dataSource?: string;
  filters?: Record<string, unknown>;
  displayOptions?: Record<string, unknown>;
  refreshRate?: number;
  customSettings?: Record<string, unknown>;
}

export interface GridLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: ResponsiveBreakpoints;
}

export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

export interface LayoutCustomization {
  property: string;
  value: unknown;
  scope: 'GLOBAL' | 'WIDGET' | 'SECTION';
  targetId?: string;
}

// Theme and Appearance Types
export interface ThemeConfig {
  id: string;
  name: string;
  mode: 'LIGHT' | 'DARK' | 'AUTO';
  colors: ColorPalette;
  typography: TypographyConfig;
  spacing: SpacingConfig;
  borderRadius: BorderRadiusConfig;
  shadows: ShadowConfig;
  animations: AnimationConfig;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
  };
  border: string;
  divider: string;
  overlay: string;
}

export interface TypographyConfig {
  fontFamily: {
    primary: string;
    mono: string;
  };
  fontSize: Record<string, string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, string>;
}

export interface SpacingConfig {
  unit: number; // base unit in px
  scale: number[]; // multipliers
}

export interface BorderRadiusConfig {
  none: string;
  small: string;
  medium: string;
  large: string;
  full: string;
}

export interface ShadowConfig {
  none: string;
  small: string;
  medium: string;
  large: string;
  extraLarge: string;
}

export interface AnimationConfig {
  duration: {
    fast: string;
    normal: string;
    slow: string;
  };
  easing: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

// User Preferences and Settings Types
export interface UserPreferences {
  userId: string;
  displaySettings: DisplaySettings;
  notificationSettings: NotificationSettings;
  workflowSettings: WorkflowSettings;
  privacySettings: PrivacySettings;
  integrationSettings: IntegrationSettings;
  accessibilitySettings: AccessibilitySettings;
}

export interface DisplaySettings {
  theme: string;
  layout: string;
  density: 'COMPACT' | 'COMFORTABLE' | 'SPACIOUS';
  animations: boolean;
  showPreviewPanes: boolean;
  emailGrouping: 'NONE' | 'SENDER' | 'SUBJECT' | 'DATE' | 'CLASSIFICATION';
  defaultView: 'LIST' | 'CARDS' | 'TABLE' | 'KANBAN';
}

export interface NotificationSettings {
  emailNotifications: boolean;
  taskNotifications: boolean;
  deadlineAlerts: boolean;
  collaborationNotifications: boolean;
  systemNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  channels: {
    browser: boolean;
    email: boolean;
    mobile: boolean;
  };
}

export interface WorkflowSettings {
  autoClassification: boolean;
  autoDraftGeneration: boolean;
  smartFilters: boolean;
  batchProcessing: boolean;
  delegationRules: DelegationRule[];
  workingHours: {
    start: string;
    end: string;
    days: string[];
    timezone: string;
  };
}

export interface DelegationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  assignTo: string;
  active: boolean;
}

export interface PrivacySettings {
  dataRetention: number; // days
  logLevel: 'MINIMAL' | 'STANDARD' | 'DETAILED';
  shareAnalytics: boolean;
  allowTelemetry: boolean;
  encryptSensitiveData: boolean;
}

export interface IntegrationSettings {
  emailProviders: EmailProviderConfig[];
  calendarIntegration: CalendarIntegrationConfig;
  taskManagementTools: TaskToolConfig[];
  communicationTools: CommunicationToolConfig[];
}

export interface EmailProviderConfig {
  provider: 'GMAIL' | 'OUTLOOK' | 'APPLE_MAIL' | 'EXCHANGE' | 'IMAP';
  accountId: string;
  isActive: boolean;
  syncFrequency: number; // minutes
  folders: string[];
  filters: EmailFilter[];
}

export interface EmailFilter {
  id: string;
  name: string;
  criteria: FilterCriteria;
  action: FilterAction;
  active: boolean;
}

export interface FilterCriteria {
  sender?: string;
  subject?: string;
  keywords?: string[];
  hasAttachments?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface FilterAction {
  type: 'CLASSIFY' | 'PRIORITIZE' | 'ASSIGN' | 'TAG' | 'ARCHIVE';
  value: string;
}

export interface CalendarIntegrationConfig {
  provider: 'GOOGLE' | 'OUTLOOK' | 'APPLE' | 'CALDAV';
  isActive: boolean;
  syncDeadlines: boolean;
  createMeetings: boolean;
  calendars: string[];
}

export interface TaskToolConfig {
  tool: 'JIRA' | 'ASANA' | 'TRELLO' | 'TODOIST' | 'LINEAR';
  isActive: boolean;
  projectMappings: Record<string, string>;
  syncBidirectional: boolean;
}

export interface CommunicationToolConfig {
  tool: 'SLACK' | 'TEAMS' | 'DISCORD' | 'TELEGRAM';
  isActive: boolean;
  notifications: boolean;
  channels: string[];
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  fontSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
  focusIndicators: boolean;
  soundEnabled: boolean;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
  pagination?: PaginationInfo;
  metadata?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Search and Filtering Types
export interface SearchQuery {
  query: string;
  filters: SearchFilter[];
  sort: SortConfig;
  pagination: PaginationConfig;
  facets?: string[];
}

export interface SearchFilter {
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GT' | 'LT' | 'BETWEEN';
  value: unknown;
  values?: unknown[]; // for BETWEEN operator
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  secondary?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface PaginationConfig {
  page: number;
  size: number;
  offset?: number;
}

export interface SearchResult<T> {
  items: T[];
  totalCount: number;
  facets: SearchFacet[];
  suggestions: string[];
  took: number; // search time in ms
}

export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// Event and Activity Types
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  userId: string;
  userDisplayName: string;
  timestamp: string;
  description: string;
  metadata: Record<string, unknown>;
  entityType: 'EMAIL' | 'TASK' | 'DRAFT' | 'USER' | 'SYSTEM';
  entityId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export type ActivityType = 
  | 'EMAIL_RECEIVED'
  | 'EMAIL_PROCESSED' 
  | 'EMAIL_REPLIED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'DRAFT_GENERATED'
  | 'DRAFT_SENT'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SETTINGS_CHANGED'
  | 'INTEGRATION_CONNECTED'
  | 'SYSTEM_ERROR';

// Search Types (additional)
export interface SearchOptions {
  query?: string;
  filters?: SearchFilter[];
  sortBy?: SearchSortField;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  includeArchived?: boolean;
  includeSpam?: boolean;
  maxResults?: number;
  searchFields?: SearchField[];
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'suggested' | 'saved';
  count?: number;
  metadata?: Record<string, any>;
}

export type SearchField = 'all' | 'subject' | 'content' | 'from' | 'to' | 'cc' | 'bcc' | 'attachments' | 'date' | 'size' | 'priority' | 'category' | 'tags';
export type SearchSortField = 'date' | 'relevance' | 'sender' | 'subject';

// Cache Types
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, any>;
}

export type CacheKey = string | { toString(): string };

export interface CacheConfig {
  maxSize?: number;
  ttl?: number;
  strategy?: 'LRU' | 'LFU' | 'FIFO';
}

export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge' | 'ask' | 'server-wins' | 'client-wins' | 'manual';

// Sort Types
export interface SortCriteria {
  field: string;
  direction: 'asc' | 'desc';
}

// Export utility types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;