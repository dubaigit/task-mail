# Automation Workflow System Diagrams

## System Architecture Overview (C4 Level 1)

```mermaid
graph TB
    User[Email User] --> WebUI[Web Dashboard]
    Admin[System Admin] --> WebUI
    
    WebUI --> APIGateway[API Gateway/Express Server]
    
    APIGateway --> WorkflowEngine[Workflow Engine]
    APIGateway --> AIService[AI Processing Service]
    APIGateway --> EmailService[Email Service]
    
    WorkflowEngine --> Database[(PostgreSQL Database)]
    AIService --> Database
    EmailService --> Database
    
    WorkflowEngine --> Queue[Automation Queue]
    Queue --> ActionExecutor[Action Executor]
    
    ActionExecutor --> ExternalSMTP[SMTP Server]
    ActionExecutor --> NotificationService[Notification Service]
    ActionExecutor --> CalendarAPI[Calendar API]
    
    AIService --> OpenAI[OpenAI API]
    AIService --> Cache[(Redis Cache)]
    
    Database --> AppleMailDB[Apple Mail SQLite]
    
    classDef userClass fill:#e1f5fe
    classDef serviceClass fill:#f3e5f5
    classDef dataClass fill:#e8f5e8
    classDef externalClass fill:#fff3e0
    
    class User,Admin userClass
    class WorkflowEngine,AIService,EmailService,ActionExecutor serviceClass
    class Database,Cache,Queue dataClass
    class OpenAI,ExternalSMTP,NotificationService,CalendarAPI,AppleMailDB externalClass
```

## Container Architecture (C4 Level 2)

```mermaid
graph TB
    subgraph "Client Layer"
        WebBrowser[Web Browser]
        MobileApp[Mobile App]
    end
    
    subgraph "Presentation Layer"
        ReactApp[React Dashboard]
        WorkflowBuilder[Visual Workflow Builder]
        MonitoringUI[Execution Monitoring]
    end
    
    subgraph "API Layer"
        ExpressServer[Express.js Server]
        AuthMiddleware[Authentication Middleware]
        RateLimiter[Rate Limiting]
        ValidationLayer[Request Validation]
    end
    
    subgraph "Business Logic Layer"
        WorkflowManager[Workflow Manager]
        RuleEngine[Rule Engine]
        ActionOrchestrator[Action Orchestrator]
        AIProcessor[AI Processor]
    end
    
    subgraph "Data Access Layer"
        DatabaseManager[Database Manager]
        CacheManager[Cache Manager]
        QueueManager[Queue Manager]
    end
    
    subgraph "External Integrations"
        EmailGateway[Email Gateway]
        AIGateway[AI Gateway]
        NotificationGateway[Notification Gateway]
    end
    
    subgraph "Infrastructure"
        PostgreSQLDB[(PostgreSQL)]
        RedisCache[(Redis)]
        MessageQueue[(Message Queue)]
    end
    
    WebBrowser --> ReactApp
    MobileApp --> ReactApp
    ReactApp --> ExpressServer
    
    ExpressServer --> AuthMiddleware
    AuthMiddleware --> RateLimiter
    RateLimiter --> ValidationLayer
    ValidationLayer --> WorkflowManager
    
    WorkflowManager --> RuleEngine
    RuleEngine --> ActionOrchestrator
    ActionOrchestrator --> AIProcessor
    
    WorkflowManager --> DatabaseManager
    AIProcessor --> CacheManager
    ActionOrchestrator --> QueueManager
    
    DatabaseManager --> PostgreSQLDB
    CacheManager --> RedisCache
    QueueManager --> MessageQueue
    
    ActionOrchestrator --> EmailGateway
    AIProcessor --> AIGateway
    ActionOrchestrator --> NotificationGateway
```

## Component Architecture (C4 Level 3)

### Workflow Builder Components

```mermaid
graph TB
    subgraph "Workflow Builder UI"
        Canvas[Workflow Canvas]
        NodePalette[Node Palette]
        PropertyPanel[Property Panel]
        ToolbarActions[Toolbar Actions]
    end
    
    subgraph "Canvas Components"
        NodeRenderer[Node Renderer]
        ConnectionRenderer[Connection Renderer]
        SelectionManager[Selection Manager]
        ViewportManager[Viewport Manager]
    end
    
    subgraph "Node Types"
        TriggerNodes[Trigger Nodes]
        ConditionNodes[Condition Nodes]
        ActionNodes[Action Nodes]
        LogicNodes[Logic Nodes]
    end
    
    subgraph "Validation System"
        SchemaValidator[Schema Validator]
        CircularDetector[Circular Dependency Detector]
        ConnectivityChecker[Connectivity Checker]
        ExecutionPathValidator[Execution Path Validator]
    end
    
    Canvas --> NodeRenderer
    Canvas --> ConnectionRenderer
    Canvas --> SelectionManager
    Canvas --> ViewportManager
    
    NodePalette --> TriggerNodes
    NodePalette --> ConditionNodes
    NodePalette --> ActionNodes
    NodePalette --> LogicNodes
    
    PropertyPanel --> SchemaValidator
    ToolbarActions --> CircularDetector
    ToolbarActions --> ConnectivityChecker
    ToolbarActions --> ExecutionPathValidator
```

### Rule Engine Architecture

```mermaid
graph TB
    subgraph "Rule Engine Core"
        WorkflowCompiler[Workflow Compiler]
        ExecutionEngine[Execution Engine]
        ContextManager[Context Manager]
        ResultProcessor[Result Processor]
    end
    
    subgraph "Condition Evaluators"
        EmailContentEvaluator[Email Content Evaluator]
        SenderEvaluator[Sender Evaluator]
        TimeEvaluator[Time Evaluator]
        AIEvaluator[AI Evaluator]
    end
    
    subgraph "Execution Strategy"
        SequentialExecutor[Sequential Executor]
        ParallelExecutor[Parallel Executor]
        ConditionalExecutor[Conditional Executor]
    end
    
    subgraph "Caching Layer"
        WorkflowCache[Workflow Cache]
        ResultCache[Result Cache]
        ContextCache[Context Cache]
    end
    
    WorkflowCompiler --> ExecutionEngine
    ExecutionEngine --> ContextManager
    ContextManager --> ResultProcessor
    
    ExecutionEngine --> EmailContentEvaluator
    ExecutionEngine --> SenderEvaluator
    ExecutionEngine --> TimeEvaluator
    ExecutionEngine --> AIEvaluator
    
    ExecutionEngine --> SequentialExecutor
    ExecutionEngine --> ParallelExecutor
    ExecutionEngine --> ConditionalExecutor
    
    WorkflowCompiler --> WorkflowCache
    ExecutionEngine --> ResultCache
    ContextManager --> ContextCache
```

## Data Flow Diagrams

### Email Processing Flow

```mermaid
sequenceDiagram
    participant AppleMail as Apple Mail
    participant PostgreSQL as PostgreSQL DB
    participant Trigger as Workflow Trigger
    participant Engine as Rule Engine
    participant AI as AI Service
    participant Executor as Action Executor
    participant User as Email User
    
    AppleMail->>PostgreSQL: New Email Insert
    PostgreSQL->>Trigger: DB Trigger Fired
    Trigger->>Engine: Queue Workflow Execution
    
    Engine->>Engine: Load Active Workflows
    Engine->>Engine: Filter by Trigger Conditions
    
    loop For Each Matching Workflow
        Engine->>Engine: Load Workflow Definition
        Engine->>Engine: Create Execution Context
        
        loop For Each Workflow Node
            alt Condition Node
                Engine->>AI: Evaluate AI Condition
                AI-->>Engine: Condition Result
            else Action Node
                Engine->>Executor: Execute Action
                Executor->>User: Send Email/Notification
                Executor-->>Engine: Action Result
            end
        end
        
        Engine->>PostgreSQL: Log Execution Result
    end
```

### Workflow Creation Flow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Workflow Builder UI
    participant API as Express API
    participant Validator as Workflow Validator
    participant Compiler as Workflow Compiler
    participant DB as PostgreSQL
    
    User->>UI: Drag & Drop Nodes
    UI->>UI: Update Canvas State
    User->>UI: Configure Node Properties
    UI->>UI: Validate Node Configuration
    
    User->>UI: Save Workflow
    UI->>API: POST /api/automation/workflows
    API->>Validator: Validate Workflow Schema
    
    alt Validation Successful
        Validator-->>API: Validation Success
        API->>Compiler: Compile Workflow
        Compiler-->>API: Compiled Workflow
        API->>DB: Save Workflow Definition
        DB-->>API: Workflow ID
        API-->>UI: Success Response
        UI-->>User: Workflow Saved
    else Validation Failed
        Validator-->>API: Validation Errors
        API-->>UI: Error Response
        UI-->>User: Show Validation Errors
    end
```

### Action Execution Flow

```mermaid
graph TD
    ActionTrigger[Action Triggered] --> QueueAction[Queue Action]
    QueueAction --> ValidateAction[Validate Action Config]
    
    ValidateAction --> PrepareContext[Prepare Execution Context]
    PrepareContext --> ExecuteAction{Execute Action Type}
    
    ExecuteAction -->|Email Reply| GenerateReply[Generate Reply Content]
    ExecuteAction -->|Create Task| CreateTask[Create Task Entry]
    ExecuteAction -->|Forward Email| ForwardEmail[Forward to Recipients]
    ExecuteAction -->|Send Notification| SendNotification[Send Notification]
    
    GenerateReply --> AIGeneration{Use AI Generation?}
    AIGeneration -->|Yes| CallAI[Call AI Service]
    AIGeneration -->|No| UseTemplate[Use Template]
    
    CallAI --> PersonalizeContent[Personalize Content]
    UseTemplate --> PersonalizeContent
    PersonalizeContent --> SendEmail[Send Email]
    
    CreateTask --> SetTaskProperties[Set Task Properties]
    SetTaskProperties --> SaveTask[Save to Database]
    
    ForwardEmail --> PrepareForward[Prepare Forward Content]
    PrepareForward --> SendForward[Send to Recipients]
    
    SendNotification --> PrepareNotification[Prepare Notification]
    PrepareNotification --> DeliverNotification[Deliver via Channel]
    
    SendEmail --> LogSuccess[Log Action Success]
    SaveTask --> LogSuccess
    SendForward --> LogSuccess
    DeliverNotification --> LogSuccess
    
    LogSuccess --> CompleteAction[Complete Action]
    
    style ActionTrigger fill:#e3f2fd
    style CompleteAction fill:#e8f5e8
    style CallAI fill:#fff3e0
```

## Database Schema Diagram

```mermaid
erDiagram
    automation_workflows ||--o{ workflow_executions : "has"
    workflow_executions ||--o{ action_executions : "contains"
    automation_workflows ||--o{ workflow_permissions : "has"
    automation_workflows ||--o{ workflow_audit_log : "tracked_by"
    
    users ||--o{ automation_workflows : "creates"
    users ||--o{ workflow_permissions : "granted_to"
    users ||--o{ workflow_audit_log : "performs"
    
    messages ||--o{ workflow_executions : "triggers"
    messages ||--o{ automation_queue : "queued_for"
    
    automation_workflows {
        int id PK
        string name
        text description
        int user_id FK
        boolean is_active
        jsonb workflow_data
        int version
        timestamp created_at
        timestamp updated_at
        timestamp last_executed
        int execution_count
    }
    
    workflow_executions {
        int id PK
        int workflow_id FK
        bigint email_id FK
        string execution_status
        jsonb execution_data
        text error_message
        int execution_time_ms
        jsonb actions_performed
        timestamp started_at
        timestamp completed_at
    }
    
    action_executions {
        int id PK
        int workflow_execution_id FK
        string action_type
        jsonb action_config
        string execution_status
        jsonb result_data
        text error_message
        int retry_count
        timestamp executed_at
    }
    
    automation_queue {
        int id PK
        bigint email_id FK
        string event_type
        string priority
        timestamp scheduled_at
        timestamp processing_started_at
        timestamp processing_completed_at
        string status
        int retry_count
        int max_retries
        text error_message
        timestamp created_at
    }
    
    workflow_permissions {
        int id PK
        int workflow_id FK
        int user_id FK
        string permission_type
        int granted_by FK
        timestamp granted_at
    }
    
    workflow_audit_log {
        int id PK
        int workflow_id FK
        int user_id FK
        string action
        jsonb old_data
        jsonb new_data
        inet ip_address
        text user_agent
        timestamp timestamp
    }
```

## Technology Stack Architecture

```mermaid
graph TB
    subgraph "Frontend Technologies"
        React[React 18]
        TypeScript[TypeScript]
        Tailwind[Tailwind CSS]
        ReactFlow[React Flow - Visual Editor]
        Zustand[Zustand - State Management]
    end
    
    subgraph "Backend Technologies"
        NodeJS[Node.js]
        Express[Express.js]
        JWT[JWT Authentication]
        Helmet[Security Middleware]
        Winston[Logging]
    end
    
    subgraph "Database Technologies"
        PostgreSQL[PostgreSQL 14+]
        Redis[Redis Cache]
        Triggers[Database Triggers]
        JSONB[JSONB for Workflow Data]
    end
    
    subgraph "AI/ML Technologies"
        OpenAI[OpenAI GPT-5]
        Embedding[Text Embeddings]
        Sentiment[Sentiment Analysis]
        Classification[Email Classification]
    end
    
    subgraph "Infrastructure"
        Docker[Docker Containers]
        Nginx[Nginx Reverse Proxy]
        PM2[PM2 Process Manager]
        LogRotation[Log Rotation]
    end
    
    subgraph "External Integrations"
        SMTP[SMTP/IMAP Servers]
        AppleMail[Apple Mail Integration]
        WebHooks[Webhook Endpoints]
        Calendar[Calendar APIs]
    end
    
    React --> TypeScript
    React --> Tailwind
    React --> ReactFlow
    React --> Zustand
    
    NodeJS --> Express
    Express --> JWT
    Express --> Helmet
    Express --> Winston
    
    PostgreSQL --> Triggers
    PostgreSQL --> JSONB
    Redis --> PostgreSQL
    
    OpenAI --> Embedding
    OpenAI --> Sentiment
    OpenAI --> Classification
    
    Docker --> Nginx
    Docker --> PM2
    Docker --> LogRotation
    
    SMTP --> AppleMail
    WebHooks --> Calendar
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer Layer"
        ALB[Application Load Balancer]
        SSL[SSL Termination]
    end
    
    subgraph "Application Layer"
        WebServer1[Web Server 1]
        WebServer2[Web Server 2]
        WebServer3[Web Server 3]
    end
    
    subgraph "Processing Layer"
        WorkerPool[Worker Pool]
        QueueProcessor1[Queue Processor 1]
        QueueProcessor2[Queue Processor 2]
    end
    
    subgraph "Data Layer"
        PrimaryDB[(Primary PostgreSQL)]
        ReadReplica[(Read Replica)]
        RedisCluster[(Redis Cluster)]
    end
    
    subgraph "External Services"
        OpenAIAPI[OpenAI API]
        EmailProviders[Email Providers]
        MonitoringServices[Monitoring Services]
    end
    
    subgraph "Backup & Recovery"
        DatabaseBackup[(Database Backup)]
        FileBackup[(File Backup)]
        DisasterRecovery[Disaster Recovery]
    end
    
    ALB --> SSL
    SSL --> WebServer1
    SSL --> WebServer2
    SSL --> WebServer3
    
    WebServer1 --> WorkerPool
    WebServer2 --> WorkerPool
    WebServer3 --> WorkerPool
    
    WorkerPool --> QueueProcessor1
    WorkerPool --> QueueProcessor2
    
    WebServer1 --> PrimaryDB
    WebServer2 --> ReadReplica
    WebServer3 --> ReadReplica
    
    QueueProcessor1 --> PrimaryDB
    QueueProcessor2 --> PrimaryDB
    
    WebServer1 --> RedisCluster
    WebServer2 --> RedisCluster
    WebServer3 --> RedisCluster
    
    QueueProcessor1 --> OpenAIAPI
    QueueProcessor2 --> OpenAIAPI
    QueueProcessor1 --> EmailProviders
    QueueProcessor2 --> EmailProviders
    
    PrimaryDB --> DatabaseBackup
    WebServer1 --> FileBackup
    DatabaseBackup --> DisasterRecovery
    FileBackup --> DisasterRecovery
    
    WebServer1 --> MonitoringServices
    PrimaryDB --> MonitoringServices
    RedisCluster --> MonitoringServices
```

## Security Architecture

```mermaid
graph TB
    subgraph "Authentication Layer"
        JWTAuth[JWT Authentication]
        OAuth[OAuth Integration]
        MFA[Multi-Factor Auth]
        SessionMgmt[Session Management]
    end
    
    subgraph "Authorization Layer"
        RBAC[Role-Based Access Control]
        WorkflowPermissions[Workflow Permissions]
        APIPermissions[API Permissions]
        ResourceGuards[Resource Guards]
    end
    
    subgraph "Data Security"
        Encryption[Data Encryption at Rest]
        TLS[TLS in Transit]
        KeyManagement[Key Management]
        DataMasking[Sensitive Data Masking]
    end
    
    subgraph "Input Validation"
        SchemaValidation[Schema Validation]
        SQLInjectionPrevention[SQL Injection Prevention]
        XSSProtection[XSS Protection]
        CSRFProtection[CSRF Protection]
    end
    
    subgraph "Monitoring & Audit"
        AuditLogging[Audit Logging]
        SecurityMonitoring[Security Monitoring]
        IntrusionDetection[Intrusion Detection]
        AlertSystem[Security Alert System]
    end
    
    JWTAuth --> RBAC
    OAuth --> RBAC
    MFA --> SessionMgmt
    
    RBAC --> WorkflowPermissions
    RBAC --> APIPermissions
    RBAC --> ResourceGuards
    
    Encryption --> KeyManagement
    TLS --> Encryption
    DataMasking --> Encryption
    
    SchemaValidation --> SQLInjectionPrevention
    XSSProtection --> CSRFProtection
    CSRFProtection --> SchemaValidation
    
    AuditLogging --> SecurityMonitoring
    SecurityMonitoring --> IntrusionDetection
    IntrusionDetection --> AlertSystem
```

This comprehensive set of diagrams provides multiple perspectives on the automation workflow system architecture, from high-level system context down to detailed component interactions and deployment considerations. Each diagram serves a specific purpose in understanding and communicating the system design to different stakeholders.