# Automation Workflow API Contracts

## Overview
This document defines the API contracts for the automation workflow system, including request/response schemas, error handling, and integration patterns.

## Authentication & Authorization

All API endpoints require JWT authentication:
```
Authorization: Bearer <jwt_token>
```

Role-based permissions:
- `automation:read` - View workflows and executions
- `automation:write` - Create and modify workflows
- `automation:execute` - Trigger workflow executions
- `automation:admin` - Full workflow management access

## Core API Endpoints

### Workflow Management

#### Create Workflow
```
POST /api/automation/workflows
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```typescript
interface CreateWorkflowRequest {
  name: string;                          // Max 200 chars
  description?: string;                  // Max 1000 chars
  workflowData: WorkflowDefinition;      // Complete workflow graph
  isActive?: boolean;                    // Default: false
  category?: string;                     // Default: 'custom'
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  metadata: {
    version: string;
    createdWith: string;                 // UI version
    lastModified: string;
  };
}

interface WorkflowNode {
  id: string;                            // UUID
  type: NodeType;
  position: { x: number; y: number };
  properties: Record<string, any>;       // Node-specific config
  inputs: NodePort[];
  outputs: NodePort[];
}

interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  conditions?: ConnectionCondition[];     // Optional path conditions
}

type NodeType = 
  | 'EMAIL_TRIGGER'                      // Email received/sent triggers
  | 'TIME_TRIGGER'                       // Scheduled triggers
  | 'CONDITION_CONTENT'                  // Email content conditions
  | 'CONDITION_SENDER'                   // Sender-based conditions
  | 'CONDITION_AI'                       // AI-powered conditions
  | 'ACTION_REPLY'                       // Send email reply
  | 'ACTION_TASK'                        // Create task
  | 'ACTION_FORWARD'                     // Forward email
  | 'ACTION_NOTIFY'                      // Send notification
  | 'LOGIC_AND'                          // Logical AND
  | 'LOGIC_OR'                           // Logical OR
  | 'LOGIC_NOT';                         // Logical NOT
```

**Response:**
```typescript
interface CreateWorkflowResponse {
  success: boolean;
  workflowId: string;
  version: number;
  validationResult: {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
  createdAt: string;                     // ISO 8601
}

interface ValidationError {
  nodeId?: string;
  connectionId?: string;
  errorType: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
```

#### List Workflows
```
GET /api/automation/workflows
```

**Query Parameters:**
```typescript
interface ListWorkflowsQuery {
  page?: number;                         // Default: 1
  limit?: number;                        // Default: 20, Max: 100
  category?: string;                     // Filter by category
  isActive?: boolean;                    // Filter by active status
  search?: string;                       // Search in name/description
  sortBy?: 'name' | 'created' | 'modified' | 'executions';
  sortOrder?: 'asc' | 'desc';            // Default: desc
}
```

**Response:**
```typescript
interface ListWorkflowsResponse {
  success: boolean;
  workflows: WorkflowSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  version: number;
  executionCount: number;
  lastExecuted?: string;                 // ISO 8601
  successRate: number;                   // 0-100
  createdAt: string;
  updatedAt: string;
}
```

#### Get Workflow Details
```
GET /api/automation/workflows/{workflowId}
```

**Response:**
```typescript
interface GetWorkflowResponse {
  success: boolean;
  workflow: {
    id: string;
    name: string;
    description: string;
    workflowData: WorkflowDefinition;
    isActive: boolean;
    category: string;
    version: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    statistics: {
      totalExecutions: number;
      successfulExecutions: number;
      failedExecutions: number;
      averageExecutionTime: number;      // milliseconds
      lastExecution?: ExecutionSummary;
    };
  };
}
```

### Workflow Testing

#### Test Workflow
```
POST /api/automation/workflows/{workflowId}/test
```

**Request Body:**
```typescript
interface TestWorkflowRequest {
  testData: {
    emailData: {
      id: string;                        // Test email ID or mock data
      subject: string;
      sender: string;
      content: string;
      receivedAt: string;               // ISO 8601
      metadata?: Record<string, any>;
    };
    triggerType: string;                // 'EMAIL_RECEIVED' | 'EMAIL_SENT'
  };
  dryRun: boolean;                      // Default: true (don't execute actions)
}
```

**Response:**
```typescript
interface TestWorkflowResponse {
  success: boolean;
  testExecutionId: string;
  results: {
    triggered: boolean;
    executionPath: ExecutionStep[];
    finalResult: 'success' | 'failed' | 'partial';
    executionTime: number;              // milliseconds
    actionsExecuted: ActionResult[];
    errors: ExecutionError[];
  };
}

interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  result: any;
  executionTime: number;
  status: 'success' | 'failed' | 'skipped';
}

interface ActionResult {
  actionType: string;
  executed: boolean;
  result: any;
  dryRun: boolean;
  error?: string;
}
```

### Execution Monitoring

#### List Executions
```
GET /api/automation/executions
```

**Query Parameters:**
```typescript
interface ListExecutionsQuery {
  workflowId?: string;                  // Filter by workflow
  status?: 'success' | 'failed' | 'partial';
  dateFrom?: string;                    // ISO 8601
  dateTo?: string;                      // ISO 8601
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
interface ListExecutionsResponse {
  success: boolean;
  executions: ExecutionSummary[];
  pagination: PaginationInfo;
}

interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  emailId: string;
  status: 'success' | 'failed' | 'partial';
  executionTime: number;                // milliseconds
  actionsPerformed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}
```

#### Get Execution Details
```
GET /api/automation/executions/{executionId}
```

**Response:**
```typescript
interface GetExecutionResponse {
  success: boolean;
  execution: {
    id: string;
    workflowId: string;
    emailData: EmailData;
    executionData: {
      nodeResults: Record<string, any>;
      actionResults: ActionExecutionResult[];
      errorTrace?: ExecutionError[];
    };
    performance: {
      totalTime: number;
      nodeExecutionTimes: Record<string, number>;
      actionExecutionTimes: Record<string, number>;
    };
    status: ExecutionStatus;
    startedAt: string;
    completedAt?: string;
  };
}

interface ActionExecutionResult {
  id: string;
  actionType: string;
  actionConfig: Record<string, any>;
  result: any;
  status: 'success' | 'failed' | 'skipped' | 'retry';
  executionTime: number;
  retryCount: number;
  errorMessage?: string;
  executedAt: string;
}
```

## AI Integration Endpoints

### Condition Evaluation
```
POST /api/ai/evaluate-condition
```

**Request Body:**
```typescript
interface EvaluateConditionRequest {
  conditionType: 'CONTENT_ANALYSIS' | 'SENTIMENT' | 'CLASSIFICATION' | 'ENTITY_EXTRACTION';
  emailContent: string;
  conditionConfig: {
    operator: string;
    value: any;
    confidenceThreshold?: number;        // 0-100
    model?: string;                      // AI model to use
  };
  context?: {
    senderEmail: string;
    subject: string;
    timestamp: string;
  };
}
```

**Response:**
```typescript
interface EvaluateConditionResponse {
  success: boolean;
  result: {
    conditionMet: boolean;
    confidence: number;                  // 0-100
    aiAnalysis: {
      reasoning: string;
      extractedData: Record<string, any>;
      alternativeClassifications?: any[];
    };
  };
  performance: {
    evaluationTime: number;
    tokensUsed: number;
    cost: number;                        // USD
  };
}
```

### Action Content Generation
```
POST /api/ai/generate-action-content
```

**Request Body:**
```typescript
interface GenerateActionContentRequest {
  actionType: 'EMAIL_REPLY' | 'TASK_DESCRIPTION' | 'NOTIFICATION_TEXT';
  sourceEmail: {
    subject: string;
    content: string;
    sender: string;
  };
  template?: {
    style: 'formal' | 'casual' | 'friendly' | 'professional';
    tone: 'neutral' | 'positive' | 'apologetic' | 'urgent';
    length: 'brief' | 'moderate' | 'detailed';
    includeOriginal?: boolean;
  };
  personalization?: {
    senderHistory: ContactHistorySummary;
    userPreferences: UserPreferences;
  };
}

interface ContactHistorySummary {
  emailCount: number;
  lastInteraction: string;
  relationshipType: 'internal' | 'client' | 'vendor' | 'unknown';
  communicationStyle: string;
}
```

**Response:**
```typescript
interface GenerateActionContentResponse {
  success: boolean;
  content: {
    subject?: string;                    // For email replies
    body: string;
    confidence: number;
    alternatives?: string[];             // Alternative content options
  };
  generation: {
    model: string;
    tokensUsed: number;
    generationTime: number;
    cost: number;
  };
}
```

## Workflow Templates

### Get Templates
```
GET /api/automation/templates
```

**Query Parameters:**
```typescript
interface GetTemplatesQuery {
  category?: 'autoresponder' | 'task_creation' | 'email_routing' | 'meeting_management';
  complexity?: 'simple' | 'intermediate' | 'advanced';
  industry?: string;
  limit?: number;
}
```

**Response:**
```typescript
interface GetTemplatesResponse {
  success: boolean;
  templates: WorkflowTemplate[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: 'simple' | 'intermediate' | 'advanced';
  industry?: string;
  usageCount: number;
  rating: number;                        // 1-5
  templateData: WorkflowDefinition;
  preview: {
    nodeCount: number;
    triggerTypes: string[];
    actionTypes: string[];
    estimatedSetupTime: number;          // minutes
  };
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
}
```

### Create Template from Workflow
```
POST /api/automation/templates
```

**Request Body:**
```typescript
interface CreateTemplateRequest {
  workflowId: string;
  name: string;
  description: string;
  category: string;
  industry?: string;
  isPublic: boolean;                     // Default: false
  complexity: 'simple' | 'intermediate' | 'advanced';
}
```

## Real-time Updates

### WebSocket Events

**Connection:**
```
ws://localhost:3001/automation/events
Authorization: Bearer <token>
```

**Event Types:**
```typescript
interface AutomationEvent {
  type: 'workflow_execution' | 'workflow_created' | 'workflow_updated' | 'system_status';
  timestamp: string;
  data: any;
}

// Workflow execution event
interface WorkflowExecutionEvent extends AutomationEvent {
  type: 'workflow_execution';
  data: {
    executionId: string;
    workflowId: string;
    workflowName: string;
    status: 'started' | 'completed' | 'failed';
    emailId: string;
    progress?: {
      currentNode: string;
      completedNodes: number;
      totalNodes: number;
    };
  };
}

// System status event
interface SystemStatusEvent extends AutomationEvent {
  type: 'system_status';
  data: {
    queueSize: number;
    activeExecutions: number;
    systemLoad: number;
    errorRate: number;
  };
}
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;                        // Machine-readable error code
    message: string;                     // Human-readable error message
    details?: any;                       // Additional error context
    field?: string;                      // For validation errors
    stack?: string;                      // Stack trace (dev only)
  };
  requestId: string;                     // For debugging
  timestamp: string;                     // ISO 8601
}
```

### Error Codes
```typescript
enum ErrorCodes {
  // Authentication & Authorization
  UNAUTHORIZED = 'AUTH_001',
  FORBIDDEN = 'AUTH_002',
  INVALID_TOKEN = 'AUTH_003',
  
  // Validation
  INVALID_REQUEST = 'VAL_001',
  MISSING_FIELD = 'VAL_002',
  INVALID_FORMAT = 'VAL_003',
  WORKFLOW_INVALID = 'VAL_004',
  
  // Workflow
  WORKFLOW_NOT_FOUND = 'WF_001',
  WORKFLOW_COMPILATION_FAILED = 'WF_002',
  EXECUTION_FAILED = 'WF_003',
  CIRCULAR_DEPENDENCY = 'WF_004',
  
  // System
  INTERNAL_ERROR = 'SYS_001',
  SERVICE_UNAVAILABLE = 'SYS_002',
  RATE_LIMIT_EXCEEDED = 'SYS_003',
  AI_SERVICE_ERROR = 'SYS_004'
}
```

## Rate Limiting

### Rate Limit Headers
```
X-RateLimit-Limit: 1000          // Requests per hour
X-RateLimit-Remaining: 999       // Remaining requests
X-RateLimit-Reset: 1609459200    // Reset timestamp
```

### Rate Limits by Endpoint
- Workflow CRUD: 100 requests/hour
- Workflow Testing: 50 requests/hour  
- AI Evaluation: 200 requests/hour
- Executions: 500 requests/hour

## Data Models Reference

### Complete NodeType Definitions
```typescript
interface EmailTriggerNode {
  type: 'EMAIL_TRIGGER';
  properties: {
    eventType: 'received' | 'sent' | 'replied';
    mailboxFilter?: string[];           // Specific mailboxes
    senderFilter?: string[];            // Email addresses or domains
    subjectPattern?: string;            // Regex pattern
    contentPattern?: string;            // Text or regex
    timeWindow?: {
      start: string;                    // HH:MM
      end: string;                      // HH:MM
      timezone: string;
      daysOfWeek: number[];             // 0-6 (Sunday-Saturday)
    };
    frequency?: {
      limit: number;                    // Max executions
      period: 'hour' | 'day' | 'week';
    };
  };
}

interface ContentConditionNode {
  type: 'CONDITION_CONTENT';
  properties: {
    operator: 'contains' | 'not_contains' | 'regex' | 'ai_analysis';
    value: string;
    caseSensitive?: boolean;
    aiConfig?: {
      model: string;
      analysisType: 'sentiment' | 'classification' | 'entity_extraction';
      confidenceThreshold: number;
    };
  };
}

interface EmailReplyAction {
  type: 'ACTION_REPLY';
  properties: {
    template: {
      subject?: string;                 // Reply subject template
      body: string;                     // Reply body template
      useAI: boolean;                   // Generate with AI
      style?: 'formal' | 'casual' | 'friendly';
      includeOriginal?: boolean;
    };
    attachments?: string[];             // File paths or IDs
    delay?: number;                     // Delay in minutes
    conditions?: {                      // Additional send conditions
      businessHoursOnly?: boolean;
      excludeWeekends?: boolean;
    };
  };
}
```

This comprehensive API specification provides the foundation for implementing the automation workflow system with clear contracts for all interactions between the frontend, backend, and AI services.