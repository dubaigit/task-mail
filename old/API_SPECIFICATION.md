# Email Intelligence System - API Specification

## Overview

RESTful API with WebSocket real-time updates for the email intelligence system. Designed for <10s response times with support for 1k concurrent users and 500 WebSocket connections.

## Base Configuration

```
Base URL: https://api.emailintelligence.com/v1
WebSocket: wss://api.emailintelligence.com/ws
Authentication: Bearer JWT tokens
Rate Limiting: 100 requests/minute per user
```

## Authentication

### JWT Token Structure
```json
{
  "user_id": "uuid-string",
  "email": "user@domain.com",
  "roles": ["user", "admin"],
  "exp": 1693440000,
  "iat": 1693436400
}
```

### Authentication Endpoints

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@domain.com",
  "password": "secure_password"
}

Response:
{
  "access_token": "jwt-token",
  "refresh_token": "refresh-token",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@domain.com",
    "name": "John Doe"
  }
}
```

```http
POST /auth/refresh
Authorization: Bearer <refresh_token>

Response:
{
  "access_token": "new-jwt-token",
  "expires_in": 3600
}
```

## Email Management API

### List Emails
```http
GET /emails?limit=50&offset=0&unread_only=false&search=query&classification=NEEDS_REPLY&urgency=HIGH

Response:
{
  "emails": [
    {
      "id": 12345,
      "apple_mail_id": "message-id-123",
      "subject": "Project Update Required",
      "sender": {
        "email": "john@company.com",
        "name": "John Doe"
      },
      "date_received": "2025-08-14T10:30:00Z",
      "snippet": "Please provide status update...",
      "analysis": {
        "classification": "NEEDS_REPLY",
        "urgency": "HIGH", 
        "sentiment": "NEUTRAL",
        "confidence": 0.89,
        "intent": "request_information"
      },
      "is_read": false,
      "is_flagged": false,
      "word_count": 150,
      "processing_time_ms": 120
    }
  ],
  "pagination": {
    "total": 8500,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### Get Single Email
```http
GET /emails/{email_id}

Response:
{
  "id": 12345,
  "apple_mail_id": "message-id-123", 
  "subject": "Project Update Required",
  "sender": {
    "email": "john@company.com",
    "name": "John Doe"
  },
  "recipients": ["user@company.com"],
  "date_received": "2025-08-14T10:30:00Z",
  "date_sent": "2025-08-14T10:25:00Z",
  "content": {
    "snippet": "Please provide status update...",
    "full_text": "Full email content here...",
    "word_count": 150,
    "attachment_count": 2
  },
  "analysis": {
    "classification": "NEEDS_REPLY",
    "urgency": "HIGH",
    "sentiment": "NEUTRAL", 
    "confidence": 0.89,
    "intent": "request_information",
    "action_items": [
      {
        "text": "provide project status update",
        "confidence": 0.85,
        "assignee": null,
        "deadline": "2025-08-15T17:00:00Z"
      }
    ],
    "deadlines": [
      {
        "date": "2025-08-15T17:00:00Z",
        "context": "by end of business tomorrow",
        "confidence": 0.80
      }
    ]
  },
  "is_read": false,
  "is_flagged": false,
  "processing_time_ms": 120,
  "processed_at": "2025-08-14T10:31:00Z"
}
```

### Batch Email Operations
```http
POST /emails/batch
Content-Type: application/json

{
  "operation": "mark_read", // mark_read, flag, analyze, delete
  "email_ids": [123, 124, 125],
  "options": {}
}

Response:
{
  "success": true,
  "results": {
    "processed": 3,
    "failed": 0,
    "errors": []
  },
  "job_id": "batch-job-uuid" // For tracking async operations
}
```

### Trigger Email Analysis
```http
POST /emails/{email_id}/analyze
Content-Type: application/json

{
  "force_refresh": false, // Skip cache if true
  "analysis_type": "full" // full, classification_only, quick
}

Response:
{
  "analysis_id": "uuid",
  "status": "processing", // processing, completed, failed
  "estimated_completion": "2025-08-14T10:32:00Z"
}
```

## Task Management API

### List Tasks
```http
GET /tasks?status=pending&assignee=me&priority=HIGH&due_soon=true&limit=20

Response:
{
  "tasks": [
    {
      "id": 456,
      "email_id": 12345,
      "title": "Reply to project update request",
      "description": "Respond to John's request for project status",
      "task_type": "NEEDS_REPLY",
      "priority": "HIGH",
      "status": "pending",
      "assignee": {
        "id": "user-uuid",
        "name": "Current User",
        "email": "user@company.com"
      },
      "due_date": "2025-08-15T17:00:00Z",
      "estimated_duration_minutes": 15,
      "email_summary": {
        "subject": "Project Update Required",
        "sender": "john@company.com"
      },
      "is_undoable": true,
      "undo_expires_at": "2025-08-14T11:00:00Z",
      "created_at": "2025-08-14T10:30:00Z"
    }
  ],
  "summary": {
    "total_pending": 15,
    "overdue_count": 2,
    "due_today": 5
  }
}
```

### Create Task
```http
POST /tasks
Content-Type: application/json

{
  "email_id": 12345,
  "title": "Review contract proposal", 
  "description": "Review and approve the Q4 contract terms",
  "task_type": "APPROVAL_REQUIRED",
  "priority": "HIGH",
  "assignee_id": "user-uuid", // Optional, defaults to current user
  "due_date": "2025-08-16T17:00:00Z", // Optional
  "estimated_duration_minutes": 30
}

Response:
{
  "id": 457,
  "status": "created",
  "is_undoable": true,
  "undo_expires_at": "2025-08-14T11:00:30Z",
  "message": "Task created successfully"
}
```

### Update Task
```http
PUT /tasks/{task_id}
Content-Type: application/json

{
  "status": "in_progress",
  "assignee_id": "other-user-uuid",
  "notes": "Starting work on this now",
  "estimated_completion": "2025-08-15T16:00:00Z"
}

Response:
{
  "success": true,
  "updated_fields": ["status", "assignee_id"],
  "previous_state": {...} // For audit trail
}
```

### Delegate Task
```http
POST /tasks/{task_id}/delegate
Content-Type: application/json

{
  "assignee_id": "delegate-user-uuid",
  "delegation_reason": "Subject matter expert",
  "add_context": "Please handle this client request by COB",
  "notify_assignee": true
}

Response:
{
  "success": true,
  "delegation_id": "delegation-uuid",
  "previous_assignee": "original-user-uuid",
  "notification_sent": true
}
```

### Undo Task Creation (30-second window)
```http
POST /tasks/{task_id}/undo

Response:
{
  "success": true,
  "message": "Task creation undone successfully",
  "restored_state": "no_task" // The state before task creation
}
```

## AI Draft Generation API

### List Generated Drafts
```http
GET /drafts?email_id=123&status=draft&limit=10

Response:
{
  "drafts": [
    {
      "id": 789,
      "email_id": 12345,
      "subject": "Re: Project Update Required",
      "body_content": "Hi John,\n\nThanks for reaching out...",
      "draft_type": "reply",
      "model_used": "gpt-5-mini",
      "confidence_score": 0.87,
      "generation_time_ms": 2150,
      "status": "draft",
      "created_at": "2025-08-14T10:32:00Z",
      "token_usage": {
        "prompt_tokens": 250,
        "completion_tokens": 180,
        "total_tokens": 430
      }
    }
  ]
}
```

### Generate Draft
```http
POST /drafts/generate
Content-Type: application/json

{
  "email_id": 12345,
  "draft_type": "reply", // reply, forward, new
  "tone": "professional", // professional, casual, formal
  "length": "medium", // short, medium, long
  "include_context": true,
  "custom_instructions": "Mention the deadline and ask for clarification"
}

Response:
{
  "draft_id": 790,
  "status": "generating", // generating, completed, failed
  "estimated_completion": "2025-08-14T10:32:10Z",
  "job_id": "draft-generation-uuid"
}
```

### Update Draft
```http
PUT /drafts/{draft_id}
Content-Type: application/json

{
  "body_content": "Updated draft content...",
  "user_modifications": true
}

Response:
{
  "success": true,
  "version": 2,
  "auto_saved": true
}
```

### Send Draft
```http
POST /drafts/{draft_id}/send
Content-Type: application/json

{
  "schedule_send": "2025-08-14T15:00:00Z", // Optional, immediate if not provided
  "add_signature": true,
  "mark_original_read": true
}

Response:
{
  "success": true,
  "message": "Email sent successfully",
  "sent_at": "2025-08-14T11:00:00Z",
  "apple_mail_message_id": "sent-message-123"
}
```

## Analytics and Insights API

### Dashboard Metrics
```http
GET /analytics/dashboard?period=7d

Response:
{
  "summary": {
    "total_emails": 1250,
    "unread_count": 45,
    "tasks_created": 89,
    "tasks_completed": 67,
    "drafts_generated": 34,
    "avg_response_time_hours": 4.2
  },
  "classification_breakdown": {
    "NEEDS_REPLY": 25,
    "APPROVAL_REQUIRED": 12,
    "CREATE_TASK": 15,
    "DELEGATE": 8,
    "FYI_ONLY": 180,
    "FOLLOW_UP": 22
  },
  "urgency_distribution": {
    "CRITICAL": 5,
    "HIGH": 28,
    "MEDIUM": 89,
    "LOW": 140
  },
  "productivity_metrics": {
    "avg_task_completion_time_hours": 6.5,
    "tasks_overdue": 3,
    "delegation_rate": 0.15,
    "ai_draft_usage_rate": 0.68
  },
  "performance_metrics": {
    "avg_analysis_time_ms": 180,
    "avg_draft_generation_time_ms": 2800,
    "cache_hit_rate": 0.85,
    "api_response_time_p95_ms": 250
  }
}
```

### Performance Metrics
```http
GET /analytics/performance?start_time=2025-08-13T00:00:00Z&end_time=2025-08-14T23:59:59Z

Response:
{
  "system_performance": {
    "api_response_times": {
      "p50": 120,
      "p90": 280,
      "p95": 450,
      "p99": 1200
    },
    "throughput": {
      "requests_per_minute": 850,
      "emails_processed_per_hour": 1200,
      "tasks_created_per_hour": 45
    },
    "error_rates": {
      "api_error_rate": 0.002,
      "ai_service_error_rate": 0.015,
      "database_error_rate": 0.001
    }
  },
  "resource_usage": {
    "database_connections": 45,
    "redis_memory_usage_mb": 512,
    "worker_queue_depth": 23,
    "cache_hit_rates": {
      "email_analysis": 0.89,
      "draft_templates": 0.76,
      "user_preferences": 0.95
    }
  }
}
```

## WebSocket Real-time Updates

### Connection Establishment
```javascript
const ws = new WebSocket('wss://api.emailintelligence.com/ws');
ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'jwt-bearer-token'
  }));
};
```

### Subscription Management
```javascript
// Subscribe to email updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'emails.new',
    'emails.analyzed', 
    'tasks.created',
    'tasks.updated',
    'drafts.generated'
  ],
  filters: {
    unread_only: true,
    high_priority: true
  }
}));

// Unsubscribe
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channels: ['emails.new']
}));
```

### Event Types

#### New Email Notification
```json
{
  "type": "email.new",
  "timestamp": "2025-08-14T11:00:00Z",
  "data": {
    "email_id": 12346,
    "subject": "Urgent: System Alert",
    "sender": "alerts@system.com",
    "urgency_predicted": "CRITICAL",
    "confidence": 0.92,
    "requires_immediate_attention": true
  }
}
```

#### Analysis Complete
```json
{
  "type": "email.analyzed",
  "timestamp": "2025-08-14T11:00:05Z", 
  "data": {
    "email_id": 12346,
    "analysis": {
      "classification": "NEEDS_REPLY",
      "urgency": "CRITICAL",
      "confidence": 0.92,
      "processing_time_ms": 1250
    },
    "suggested_actions": [
      {
        "action": "create_task",
        "priority": "HIGH",
        "estimated_duration": 15
      }
    ]
  }
}
```

#### Task Created
```json
{
  "type": "task.created",
  "timestamp": "2025-08-14T11:00:10Z",
  "data": {
    "task_id": 458,
    "email_id": 12346,
    "title": "Address system alert",
    "priority": "CRITICAL",
    "assignee_id": "current-user-uuid",
    "due_date": "2025-08-14T13:00:00Z",
    "undo_expires_at": "2025-08-14T11:00:40Z"
  }
}
```

#### Draft Generated
```json
{
  "type": "draft.generated", 
  "timestamp": "2025-08-14T11:01:00Z",
  "data": {
    "draft_id": 791,
    "email_id": 12346,
    "preview": "Thank you for the alert. I'm investigating...",
    "confidence_score": 0.85,
    "generation_time_ms": 2100,
    "actions": ["review", "edit", "send"]
  }
}
```

#### System Status Updates
```json
{
  "type": "system.status",
  "timestamp": "2025-08-14T11:05:00Z",
  "data": {
    "status": "degraded", // healthy, degraded, outage
    "affected_services": ["ai_classification"],
    "message": "GPT-5 API experiencing higher latency",
    "estimated_resolution": "2025-08-14T11:15:00Z",
    "fallback_active": true
  }
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email ID provided",
    "details": {
      "field": "email_id",
      "constraint": "must_exist"
    },
    "timestamp": "2025-08-14T11:00:00Z",
    "request_id": "req-uuid-123"
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| AI_SERVICE_ERROR | 503 | AI service unavailable |
| PROCESSING_ERROR | 500 | Internal processing error |
| MAINTENANCE_MODE | 503 | System under maintenance |

## Rate Limiting

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693440000
X-RateLimit-Window: 60
```

### Rate Limiting Policies
- **Standard API**: 100 requests/minute per user
- **Batch Operations**: 10 requests/minute per user
- **AI Generation**: 20 requests/minute per user
- **WebSocket Messages**: 200 messages/minute per connection

## Response Time SLAs

| Endpoint Category | Target Response Time | P95 Limit |
|------------------|---------------------|-----------|
| Email List | <200ms | 500ms |
| Single Email | <300ms | 800ms |
| Task Creation | <10s | 15s |
| Draft Generation | <10s | 20s |
| Batch Operations | Async (job status) | N/A |
| Analytics | <500ms | 1000ms |
| WebSocket Delivery | <100ms | 200ms |

---

**API Version**: v1.0  
**Last Updated**: 2025-08-14  
**Status**: Production Ready ✅