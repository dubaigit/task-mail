/**
 * Application Constants
 * Centralized configuration for API endpoints, error messages, and timeouts
 */

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// API Endpoints
export const API_ENDPOINTS = {
  // Email endpoints
  EMAILS: '/api/emails/',
  ARCHIVE_EMAIL: '/api/emails/:id/archive',
  DELETE_EMAIL: '/api/emails/:id',
  MARK_READ: '/api/emails/:id/mark-read',
  SEARCH: '/api/emails/search',
  
  // AI endpoints
  GENERATE_TASKS: '/api/ai/generate-tasks',
  GENERATE_DRAFT: '/api/ai/generate-draft',
  REFINE_DRAFT: '/api/ai/refine-draft',
  SEND_DRAFT: '/api/ai/send-draft',
  
  // Sync endpoints
  SYNC_OPERATIONS: '/api/sync/operations',
  SYNC_STATISTICS: '/api/sync/statistics',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
  
  // API errors
  UNAUTHORIZED: 'Authentication required. Please log in.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
  
  // Validation errors
  VALIDATION_ERROR: 'Please check your input and try again.',
  REQUIRED_FIELD: 'This field is required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_FORMAT: 'Invalid data format provided.',
  
  // Application-specific errors
  EMAIL_FETCH_FAILED: 'Failed to fetch emails. Please refresh the page.',
  DRAFT_GENERATION_FAILED: 'Failed to generate draft. Please try again.',
  TASK_GENERATION_FAILED: 'Failed to generate tasks. Please try again.',
  EMAIL_SEND_FAILED: 'Failed to send email. Please try again.',
  SEARCH_FAILED: 'Search operation failed. Please try again.',
} as const;

// Timeout Configuration (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  SEARCH_REQUEST: 15000, // 15 seconds
  UPLOAD_REQUEST: 60000, // 60 seconds
  BACKGROUND_SYNC: 5000, // 5 seconds
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Application Configuration
export const APP_CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  SUPPORTED_FILE_TYPES: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif'],
  PAGINATION_SIZE: 50,
  SEARCH_DEBOUNCE_MS: 300,
  AUTO_SAVE_INTERVAL_MS: 30000, // 30 seconds
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_REAL_TIME_SYNC: process.env.REACT_APP_ENABLE_REAL_TIME_SYNC === 'true',
  ENABLE_ADVANCED_SEARCH: process.env.REACT_APP_ENABLE_ADVANCED_SEARCH === 'true',
  ENABLE_AI_FEATURES: process.env.REACT_APP_ENABLE_AI_FEATURES !== 'false', // Default enabled
  ENABLE_PERFORMANCE_MONITORING: process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true',
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SPACE: ' ',
  TAB: 'Tab',
  SHIFT_TAB: 'Tab', // Used with shiftKey
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  H: 'h',
  I: 'i',
  J: 'j',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  O: 'o',
  P: 'p',
  Q: 'q',
  R: 'r',
  S: 's',
  T: 't',
  U: 'u',
  V: 'v',
  W: 'w',
  X: 'x',
  Y: 'y',
  Z: 'z',
  SLASH: '/',
  QUESTION_MARK: '?',
} as const;