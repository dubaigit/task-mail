/**
 * Test fixtures and mock data for frontend testing
 */

import { TaskCentricEmail, TaskItem, TaskStatus, TaskCategory, TaskPriority } from '../components/TaskCentric/types';

// ==============================================================================
// EMAIL FIXTURES
// ==============================================================================

export const mockEmail: TaskCentricEmail = {
  id: 'test-email-001',
  subject: 'Test Email Subject',
  sender: 'sender@example.com',
  recipient: 'recipient@example.com',
  cc_addresses: ['cc1@example.com', 'cc2@example.com'],
  bcc_addresses: [],
  content: 'This is a test email content with some important information.',
  received_date: '2025-08-16T10:00:00Z',
  is_read: false,
  is_flagged: false,
  folder: 'INBOX',
  message_id: '<test-message-001@example.com>',
  thread_id: 'thread-001',
  importance: 'Normal',
  has_attachments: false,
  raw_headers: '{"Content-Type": "text/plain"}',
  body_preview: 'This is a test email content with...',
  to_addresses: ['recipient@example.com'],
  from_address: 'sender@example.com',
  // Task-centric fields
  ai_category: 'FYI_ONLY',
  ai_priority: 'MEDIUM',
  ai_confidence: 0.85,
  action_items: [],
  requires_response: false,
  estimated_read_time: 2,
  colleague_mentions: [],
  deadline_detected: null,
  task_indicators: {
    has_question: false,
    has_request: false,
    has_deadline: false,
    urgency_keywords: []
  }
};

export const mockTaskEmail: TaskCentricEmail = {
  ...mockEmail,
  id: 'task-email-001',
  subject: 'Action Required: Please review the quarterly report',
  sender: 'manager@company.com',
  content: 'Hi team,\n\nCould you please review the attached quarterly report and provide your feedback by Friday?\n\nThanks,\nManager',
  is_flagged: true,
  importance: 'High',
  has_attachments: true,
  ai_category: 'NEEDS_REPLY',
  ai_priority: 'HIGH',
  ai_confidence: 0.95,
  action_items: ['Review quarterly report', 'Provide feedback'],
  requires_response: true,
  estimated_read_time: 5,
  colleague_mentions: ['team@company.com'],
  deadline_detected: '2025-08-18T17:00:00Z',
  task_indicators: {
    has_question: false,
    has_request: true,
    has_deadline: true,
    urgency_keywords: ['Action Required', 'by Friday']
  }
};

export const mockEmails: TaskCentricEmail[] = Array.from({ length: 10 }, (_, i) => ({
  ...mockEmail,
  id: `email-${(i + 1).toString().padStart(3, '0')}`,
  subject: `Test Email ${i + 1}`,
  sender: `sender${i + 1}@example.com`,
  received_date: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(), // Each email 1 hour older
  is_read: i % 2 === 0,
  is_flagged: i % 3 === 0,
  ai_category: i % 4 === 0 ? 'NEEDS_REPLY' : 'FYI_ONLY',
  ai_priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4] as TaskPriority,
  ai_confidence: 0.7 + (i * 0.03),
}));

// ==============================================================================
// TASK FIXTURES
// ==============================================================================

export const mockTask: TaskItem = {
  id: 'task-001',
  title: 'Review quarterly report',
  description: 'Please review the attached quarterly report and provide feedback',
  category: 'REVIEW' as TaskCategory,
  priority: 'HIGH' as TaskPriority,
  status: 'todo' as TaskStatus,
  assignee: 'employee@company.com',
  due_date: '2025-08-18T17:00:00Z',
  estimated_duration: 60,
  dependencies: [],
  confidence_score: 0.95,
  created_date: '2025-08-16T10:00:00Z',
  updated_date: '2025-08-16T10:00:00Z',
  email_id: 'test-email-001',
  source_email: mockTaskEmail,
  colleague_info: {
    name: 'Manager',
    email: 'manager@company.com',
    last_interaction: '2025-08-16T09:00:00Z',
    response_rate: 0.85
  }
};

export const mockTasks: TaskItem[] = [
  {
    ...mockTask,
    id: 'task-001',
    title: 'Review quarterly report',
    category: 'REVIEW',
    priority: 'HIGH',
    status: 'todo'
  },
  {
    ...mockTask,
    id: 'task-002',
    title: 'Approve budget proposal',
    category: 'APPROVAL',
    priority: 'CRITICAL',
    status: 'in_progress',
    assignee: 'finance@company.com'
  },
  {
    ...mockTask,
    id: 'task-003',
    title: 'Schedule team meeting',
    category: 'MEETING',
    priority: 'MEDIUM',
    status: 'waiting_for_reply',
    assignee: 'team-lead@company.com'
  },
  {
    ...mockTask,
    id: 'task-004',
    title: 'Update project documentation',
    category: 'ADMINISTRATIVE',
    priority: 'LOW',
    status: 'done',
    assignee: 'developer@company.com'
  },
  {
    ...mockTask,
    id: 'task-005',
    title: 'Code review for feature X',
    category: 'DEVELOPMENT',
    priority: 'HIGH',
    status: 'in_progress',
    assignee: 'senior-dev@company.com'
  }
];

// ==============================================================================
// API MOCK RESPONSES
// ==============================================================================

export const mockApiResponses = {
  emails: {
    success: {
      data: mockEmails,
      total: mockEmails.length,
      page: 1,
      per_page: 50
    },
    empty: {
      data: [],
      total: 0,
      page: 1,
      per_page: 50
    },
    error: {
      error: 'Internal Server Error',
      message: 'Failed to fetch emails'
    }
  },
  tasks: {
    success: {
      data: mockTasks,
      total: mockTasks.length,
      page: 1,
      per_page: 50
    },
    empty: {
      data: [],
      total: 0,
      page: 1,
      per_page: 50
    },
    error: {
      error: 'Internal Server Error',
      message: 'Failed to fetch tasks'
    }
  },
  health: {
    success: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2025-08-16T10:00:00Z'
    },
    error: {
      status: 'unhealthy',
      error: 'Database connection failed'
    }
  }
};

// ==============================================================================
// THEME AND UI FIXTURES
// ==============================================================================

export const mockThemeContext = {
  isDark: false,
  toggleTheme: jest.fn(),
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a'
  }
};

export const mockDarkThemeContext = {
  ...mockThemeContext,
  isDark: true,
  colors: {
    primary: '#60a5fa',
    secondary: '#94a3b8',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc'
  }
};

// ==============================================================================
// PERFORMANCE FIXTURES
// ==============================================================================

export const mockPerformanceMetrics = {
  loadTime: 1.2,
  renderTime: 0.3,
  memoryUsage: 45.6,
  bundleSize: 2.1,
  firstContentfulPaint: 0.8,
  largestContentfulPaint: 1.5,
  cumulativeLayoutShift: 0.02,
  firstInputDelay: 0.1
};

// ==============================================================================
// USER INTERACTION FIXTURES
// ==============================================================================

export const mockUserInteractions = {
  click: {
    task: {
      target: 'task-card',
      action: 'click',
      timestamp: Date.now(),
      metadata: { taskId: 'task-001' }
    }
  },
  dragDrop: {
    task: {
      type: 'dragstart',
      source: 'kanban-column-todo',
      target: 'kanban-column-in-progress',
      taskId: 'task-001'
    }
  },
  search: {
    query: 'quarterly report',
    filters: {
      category: 'REVIEW',
      priority: 'HIGH',
      status: 'todo'
    },
    results: 3
  }
};

// ==============================================================================
// ERROR FIXTURES
// ==============================================================================

export const mockErrors = {
  network: new Error('Network error: Failed to fetch'),
  validation: new Error('Validation error: Invalid email format'),
  permission: new Error('Permission denied: Insufficient privileges'),
  notFound: new Error('Not found: Task not found'),
  server: new Error('Server error: Internal server error')
};

// ==============================================================================
// ACCESSIBILITY FIXTURES
// ==============================================================================

export const mockA11yAttributes = {
  button: {
    'aria-label': 'Save task',
    'aria-describedby': 'save-help-text',
    'role': 'button',
    'tabIndex': 0
  },
  input: {
    'aria-label': 'Task title',
    'aria-required': 'true',
    'aria-invalid': 'false',
    'role': 'textbox'
  },
  region: {
    'aria-label': 'Task list',
    'role': 'region',
    'aria-live': 'polite'
  }
};

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

export const createMockEmail = (overrides: Partial<TaskCentricEmail> = {}): TaskCentricEmail => ({
  ...mockEmail,
  ...overrides
});

export const createMockTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  ...mockTask,
  ...overrides
});

export const createMockTasks = (count: number, baseTask: Partial<TaskItem> = {}): TaskItem[] => 
  Array.from({ length: count }, (_, i) => createMockTask({
    ...baseTask,
    id: `task-${(i + 1).toString().padStart(3, '0')}`,
    title: `Task ${i + 1}`,
    created_date: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
  }));

export const waitForComponent = (timeout = 1000): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, timeout));

export const mockLocalStorage = () => {
  const store: { [key: string]: string } = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    }
  };
};