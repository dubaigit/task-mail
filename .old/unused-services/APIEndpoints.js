/**
 * API Endpoints - RESTful API design with proper versioning and error handling
 * Contract-first API design with OpenAPI 3.0 compliance
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

/**
 * API Versioning Strategy
 * - URL versioning: /api/v1/, /api/v2/
 * - Header versioning: Accept: application/vnd.api+json;version=1
 * - Semantic versioning for breaking changes
 */
const API_VERSIONS = {
  V1: {
    version: '1.0.0',
    status: 'stable',
    deprecationDate: null,
    sunsetDate: null
  },
  V2: {
    version: '2.0.0', 
    status: 'beta',
    deprecationDate: null,
    sunsetDate: null
  }
};

/**
 * Standard HTTP Response Format
 */
const RESPONSE_FORMAT = {
  success: {
    status: 'success',
    data: {},
    meta: {
      timestamp: '',
      version: '',
      requestId: '',
      pagination: {}
    }
  },
  error: {
    status: 'error',
    error: {
      code: '',
      message: '',
      details: {},
      timestamp: '',
      requestId: ''
    }
  }
};

/**
 * Rate Limiting Configuration
 */
const RATE_LIMITS = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Authentication endpoints (stricter)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // AI processing endpoints (resource intensive)
  ai: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per minute
    message: 'AI processing rate limit exceeded, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  })
};

/**
 * API Endpoint Definitions
 */
const API_ENDPOINTS = {
  // Authentication & User Management
  AUTH: {
    prefix: '/api/v1/auth',
    endpoints: {
      // POST /api/v1/auth/login
      login: {
        method: 'POST',
        path: '/login',
        middleware: [RATE_LIMITS.auth],
        description: 'User authentication with email/password',
        requestBody: {
          email: { type: 'string', required: true, format: 'email' },
          password: { type: 'string', required: true, minLength: 8 },
          rememberMe: { type: 'boolean', default: false }
        },
        responses: {
          200: {
            description: 'Authentication successful',
            body: {
              token: 'string',
              refreshToken: 'string',
              user: 'User',
              expiresIn: 'number'
            }
          },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limit exceeded' }
        }
      },

      // POST /api/v1/auth/register
      register: {
        method: 'POST',
        path: '/register',
        middleware: [RATE_LIMITS.auth],
        description: 'User registration',
        requestBody: {
          email: { type: 'string', required: true, format: 'email' },
          password: { type: 'string', required: true, minLength: 8 },
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true }
        },
        responses: {
          201: { description: 'User created successfully' },
          400: { description: 'Validation error' },
          409: { description: 'User already exists' }
        }
      },

      // POST /api/v1/auth/refresh
      refresh: {
        method: 'POST',
        path: '/refresh',
        description: 'Refresh JWT token',
        requestBody: {
          refreshToken: { type: 'string', required: true }
        },
        responses: {
          200: { description: 'Token refreshed' },
          401: { description: 'Invalid refresh token' }
        }
      },

      // POST /api/v1/auth/logout
      logout: {
        method: 'POST',
        path: '/logout',
        middleware: ['auth'],
        description: 'User logout',
        responses: {
          204: { description: 'Logout successful' }
        }
      }
    }
  },

  // User Profile Management
  USERS: {
    prefix: '/api/v1/users',
    middleware: ['auth'], // All user endpoints require authentication
    endpoints: {
      // GET /api/v1/users/profile
      getProfile: {
        method: 'GET',
        path: '/profile',
        description: 'Get current user profile',
        responses: {
          200: {
            description: 'User profile',
            body: {
              id: 'string',
              email: 'string',
              firstName: 'string',
              lastName: 'string',
              preferences: 'object',
              createdAt: 'string',
              updatedAt: 'string'
            }
          }
        }
      },

      // PUT /api/v1/users/profile
      updateProfile: {
        method: 'PUT',
        path: '/profile',
        description: 'Update user profile',
        requestBody: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          preferences: { type: 'object' }
        },
        responses: {
          200: { description: 'Profile updated' },
          400: { description: 'Validation error' }
        }
      }
    }
  },

  // Email Management
  EMAILS: {
    prefix: '/api/v1/emails',
    middleware: ['auth'],
    endpoints: {
      // GET /api/v1/emails
      getEmails: {
        method: 'GET',
        path: '/',
        description: 'Get user emails with pagination and filtering',
        queryParams: {
          page: { type: 'number', default: 1, min: 1 },
          limit: { type: 'number', default: 25, min: 1, max: 100 },
          category: { type: 'string' },
          status: { type: 'string', enum: ['read', 'unread', 'archived'] },
          search: { type: 'string', maxLength: 255 },
          sortBy: { type: 'string', enum: ['date', 'subject', 'sender'], default: 'date' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        },
        responses: {
          200: {
            description: 'List of emails',
            body: {
              emails: 'Email[]',
              pagination: {
                page: 'number',
                limit: 'number',
                total: 'number',
                totalPages: 'number'
              }
            }
          }
        }
      },

      // GET /api/v1/emails/:id
      getEmail: {
        method: 'GET', 
        path: '/:id',
        description: 'Get specific email by ID',
        pathParams: {
          id: { type: 'string', required: true, format: 'uuid' }
        },
        responses: {
          200: { description: 'Email details', body: 'Email' },
          404: { description: 'Email not found' },
          403: { description: 'Access denied' }
        }
      },

      // GET /api/v1/emails/search
      searchEmails: {
        method: 'GET',
        path: '/search',
        description: 'Advanced email search',
        queryParams: {
          q: { type: 'string', required: true, minLength: 3 },
          from: { type: 'string' },
          to: { type: 'string' },
          subject: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          hasAttachment: { type: 'boolean' }
        },
        responses: {
          200: { description: 'Search results', body: 'SearchResults' }
        }
      },

      // POST /api/v1/emails/:id/categorize
      categorizeEmail: {
        method: 'POST',
        path: '/:id/categorize',
        description: 'Categorize email (manual or AI-assisted)',
        pathParams: {
          id: { type: 'string', required: true, format: 'uuid' }
        },
        requestBody: {
          category: { type: 'string', required: true },
          aiAssisted: { type: 'boolean', default: false }
        },
        responses: {
          200: { description: 'Email categorized' },
          404: { description: 'Email not found' }
        }
      }
    }
  },

  // Task Management
  TASKS: {
    prefix: '/api/v1/tasks',
    middleware: ['auth'],
    endpoints: {
      // GET /api/v1/tasks
      getTasks: {
        method: 'GET',
        path: '/',
        description: 'Get user tasks with filtering and pagination',
        queryParams: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 25, max: 100 },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          assignedTo: { type: 'string' },
          dueDate: { type: 'string', format: 'date' },
          sortBy: { type: 'string', default: 'createdAt' }
        },
        responses: {
          200: { description: 'List of tasks', body: 'TaskList' }
        }
      },

      // POST /api/v1/tasks
      createTask: {
        method: 'POST',
        path: '/',
        description: 'Create new task',
        requestBody: {
          title: { type: 'string', required: true, maxLength: 255 },
          description: { type: 'string', maxLength: 2000 },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          dueDate: { type: 'string', format: 'date-time' },
          assignedTo: { type: 'string', format: 'uuid' },
          tags: { type: 'array', items: { type: 'string' } },
          emailId: { type: 'string', format: 'uuid' } // Link to email if task created from email
        },
        responses: {
          201: { description: 'Task created', body: 'Task' },
          400: { description: 'Validation error' }
        }
      },

      // PUT /api/v1/tasks/:id
      updateTask: {
        method: 'PUT',
        path: '/:id',
        description: 'Update existing task',
        pathParams: {
          id: { type: 'string', required: true, format: 'uuid' }
        },
        requestBody: {
          title: { type: 'string', maxLength: 255 },
          description: { type: 'string', maxLength: 2000 },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', format: 'date-time' },
          assignedTo: { type: 'string', format: 'uuid' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        responses: {
          200: { description: 'Task updated', body: 'Task' },
          404: { description: 'Task not found' },
          403: { description: 'Access denied' }
        }
      },

      // DELETE /api/v1/tasks/:id
      deleteTask: {
        method: 'DELETE',
        path: '/:id',
        description: 'Delete task',
        pathParams: {
          id: { type: 'string', required: true, format: 'uuid' }
        },
        responses: {
          204: { description: 'Task deleted' },
          404: { description: 'Task not found' },
          403: { description: 'Access denied' }
        }
      }
    }
  },

  // AI Processing
  AI: {
    prefix: '/api/v1/ai',
    middleware: ['auth', RATE_LIMITS.ai],
    endpoints: {
      // GET /api/v1/ai/insights
      getInsights: {
        method: 'GET',
        path: '/insights',
        description: 'Get AI-powered insights and analytics',
        queryParams: {
          type: { type: 'string', enum: ['email', 'task', 'productivity', 'trends'] },
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'week' }
        },
        responses: {
          200: { description: 'AI insights', body: 'Insights' }
        }
      },

      // POST /api/v1/ai/analyze-email
      analyzeEmail: {
        method: 'POST',
        path: '/analyze-email',
        description: 'AI analysis of email content',
        requestBody: {
          emailId: { type: 'string', required: true, format: 'uuid' },
          analysisType: { type: 'array', items: { type: 'string', enum: ['sentiment', 'priority', 'category', 'summary'] } }
        },
        responses: {
          200: { description: 'Email analysis results', body: 'EmailAnalysis' },
          404: { description: 'Email not found' }
        }
      },

      // POST /api/v1/ai/generate-response
      generateResponse: {
        method: 'POST',
        path: '/generate-response',
        description: 'Generate AI-powered email response',
        requestBody: {
          emailId: { type: 'string', required: true, format: 'uuid' },
          tone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'formal'], default: 'professional' },
          length: { type: 'string', enum: ['short', 'medium', 'long'], default: 'medium' },
          context: { type: 'string', maxLength: 500 }
        },
        responses: {
          200: { description: 'Generated response', body: 'GeneratedResponse' }
        }
      }
    }
  },

  // Notifications
  NOTIFICATIONS: {
    prefix: '/api/v1/notifications',
    middleware: ['auth'],
    endpoints: {
      // GET /api/v1/notifications
      getNotifications: {
        method: 'GET',
        path: '/',
        description: 'Get user notifications',
        queryParams: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20, max: 50 },
          read: { type: 'boolean' },
          type: { type: 'string', enum: ['email', 'task', 'system', 'ai'] }
        },
        responses: {
          200: { description: 'List of notifications', body: 'NotificationList' }
        }
      },

      // PUT /api/v1/notifications/:id/read
      markAsRead: {
        method: 'PUT',
        path: '/:id/read',
        description: 'Mark notification as read',
        pathParams: {
          id: { type: 'string', required: true, format: 'uuid' }
        },
        responses: {
          200: { description: 'Notification marked as read' },
          404: { description: 'Notification not found' }
        }
      }
    }
  },

  // Analytics & Reporting
  ANALYTICS: {
    prefix: '/api/v1/analytics',
    middleware: ['auth'],
    endpoints: {
      // GET /api/v1/analytics/dashboard
      getDashboard: {
        method: 'GET',
        path: '/dashboard',
        description: 'Get analytics dashboard data',
        queryParams: {
          period: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'], default: 'week' },
          metrics: { type: 'array', items: { type: 'string' } }
        },
        responses: {
          200: { description: 'Dashboard data', body: 'DashboardData' }
        }
      }
    }
  },

  // Health & System Status
  SYSTEM: {
    prefix: '/api/v1/system',
    endpoints: {
      // GET /api/v1/system/health
      health: {
        method: 'GET',
        path: '/health',
        description: 'System health check',
        public: true, // No authentication required
        responses: {
          200: { description: 'System healthy' },
          503: { description: 'System unhealthy' }
        }
      },

      // GET /api/v1/system/status
      status: {
        method: 'GET',
        path: '/status',
        description: 'Detailed system status',
        middleware: ['admin'], // Admin only
        responses: {
          200: { description: 'System status details', body: 'SystemStatus' }
        }
      }
    }
  }
};

module.exports = {
  API_VERSIONS,
  RESPONSE_FORMAT,
  RATE_LIMITS,
  API_ENDPOINTS
};