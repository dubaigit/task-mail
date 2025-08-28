-- Scalable Database Schema Design
-- Optimized for high-performance with proper normalization, indexes, and partitioning
-- Supports horizontal scaling and sharding strategies

-- Enable UUID extension for distributed primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- USER MANAGEMENT TABLES
-- ============================================================================

-- Users table with optimized indexing
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for user table
CREATE INDEX CONCURRENTLY idx_users_email_hash ON users USING HASH(email);
CREATE INDEX CONCURRENTLY idx_users_active ON users (is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_users_created_at ON users (created_at);
CREATE INDEX CONCURRENTLY idx_users_preferences ON users USING GIN(preferences);

-- User sessions for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX CONCURRENTLY idx_user_sessions_token ON user_sessions (refresh_token);
CREATE INDEX CONCURRENTLY idx_user_sessions_expires_at ON user_sessions (expires_at);

-- Roles and permissions (RBAC)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- EMAIL MANAGEMENT TABLES (Partitioned for scale)
-- ============================================================================

-- Main emails table (partitioned by date for better performance)
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apple_mail_id VARCHAR(255), -- Original Apple Mail message ID
    thread_id UUID, -- For email threading
    subject TEXT NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipient_emails JSONB NOT NULL, -- Array of recipients
    cc_emails JSONB DEFAULT '[]',
    bcc_emails JSONB DEFAULT '[]',
    body_text TEXT,
    body_html TEXT,
    has_attachments BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    email_date TIMESTAMP WITH TIME ZONE NOT NULL,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (email_date);

-- Create monthly partitions for emails (better query performance)
CREATE TABLE emails_y2024m01 PARTITION OF emails FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE emails_y2024m02 PARTITION OF emails FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE emails_y2024m03 PARTITION OF emails FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE emails_y2024m04 PARTITION OF emails FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE emails_y2024m05 PARTITION OF emails FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE emails_y2024m06 PARTITION OF emails FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE emails_y2024m07 PARTITION OF emails FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE emails_y2024m08 PARTITION OF emails FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE emails_y2024m09 PARTITION OF emails FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE emails_y2024m10 PARTITION OF emails FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE emails_y2024m11 PARTITION OF emails FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE emails_y2024m12 PARTITION OF emails FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Create 2025 partitions
CREATE TABLE emails_y2025m01 PARTITION OF emails FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE emails_y2025m02 PARTITION OF emails FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE emails_y2025m03 PARTITION OF emails FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE emails_y2025m04 PARTITION OF emails FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE emails_y2025m05 PARTITION OF emails FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE emails_y2025m06 PARTITION OF emails FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE emails_y2025m07 PARTITION OF emails FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE emails_y2025m08 PARTITION OF emails FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE emails_y2025m09 PARTITION OF emails FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE emails_y2025m10 PARTITION OF emails FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE emails_y2025m11 PARTITION OF emails FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE emails_y2025m12 PARTITION OF emails FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Indexes for email table (applied to all partitions)
CREATE INDEX CONCURRENTLY idx_emails_user_id ON emails (user_id, email_date DESC);
CREATE INDEX CONCURRENTLY idx_emails_thread_id ON emails (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_emails_sender ON emails (sender_email);
CREATE INDEX CONCURRENTLY idx_emails_read_status ON emails (user_id, is_read, email_date DESC);
CREATE INDEX CONCURRENTLY idx_emails_starred ON emails (user_id, is_starred) WHERE is_starred = true;
CREATE INDEX CONCURRENTLY idx_emails_apple_mail_id ON emails (apple_mail_id) WHERE apple_mail_id IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_emails_full_text ON emails USING GIN(to_tsvector('english', subject || ' ' || COALESCE(body_text, '')));
CREATE INDEX CONCURRENTLY idx_emails_recipients ON emails USING GIN(recipient_emails);

-- Email attachments (separate table for better normalization)
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size BIGINT,
    file_path TEXT, -- Path to stored file
    checksum VARCHAR(64), -- For deduplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_attachments_email_id ON email_attachments (email_id);
CREATE INDEX CONCURRENTLY idx_attachments_checksum ON email_attachments (checksum);

-- Email categories and tags
CREATE TABLE email_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7), -- Hex color code
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE email_category_assignments (
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    category_id UUID REFERENCES email_categories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence_score DECIMAL(5,4), -- For AI categorization
    PRIMARY KEY (email_id, category_id)
);

-- ============================================================================
-- TASK MANAGEMENT TABLES
-- ============================================================================

-- Main tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    email_id UUID REFERENCES emails(id), -- Link to originating email
    parent_task_id UUID REFERENCES tasks(id), -- For subtasks
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tasks
CREATE INDEX CONCURRENTLY idx_tasks_user_id ON tasks (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_tasks_assigned_to ON tasks (assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks (status, due_date);
CREATE INDEX CONCURRENTLY idx_tasks_priority ON tasks (priority, created_at DESC);
CREATE INDEX CONCURRENTLY idx_tasks_due_date ON tasks (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_tasks_email_id ON tasks (email_id) WHERE email_id IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_tasks_parent_task ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_tasks_tags ON tasks USING GIN(tags);

-- Task dependencies
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'relates_to')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, depends_on_task_id)
);

-- Task history for audit trail
CREATE TABLE task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_task_history_task_id ON task_history (task_id, created_at DESC);

-- ============================================================================
-- AI AND ANALYTICS TABLES
-- ============================================================================

-- AI models and training data
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'classification', 'sentiment', 'priority'
    config JSONB NOT NULL DEFAULT '{}',
    training_data_count INTEGER DEFAULT 0,
    accuracy_score DECIMAL(5,4),
    is_active BOOLEAN DEFAULT TRUE,
    trained_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI predictions and analysis results
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    entity_type VARCHAR(50) NOT NULL, -- 'email', 'task'
    entity_id UUID NOT NULL,
    prediction_type VARCHAR(50) NOT NULL, -- 'sentiment', 'priority', 'category'
    prediction_value TEXT NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_ai_predictions_entity ON ai_predictions (entity_type, entity_id);
CREATE INDEX CONCURRENTLY idx_ai_predictions_model ON ai_predictions (model_id, created_at DESC);

-- Analytics events for tracking user behavior
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for analytics (for data retention)
CREATE TABLE analytics_events_y2024m12 PARTITION OF analytics_events FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE analytics_events_y2025m01 PARTITION OF analytics_events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE analytics_events_y2025m02 PARTITION OF analytics_events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE analytics_events_y2025m03 PARTITION OF analytics_events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE analytics_events_y2025m04 PARTITION OF analytics_events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE analytics_events_y2025m05 PARTITION OF analytics_events FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE analytics_events_y2025m06 PARTITION OF analytics_events FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE analytics_events_y2025m07 PARTITION OF analytics_events FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_events_y2025m08 PARTITION OF analytics_events FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE analytics_events_y2025m09 PARTITION OF analytics_events FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE analytics_events_y2025m10 PARTITION OF analytics_events FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE analytics_events_y2025m11 PARTITION OF analytics_events FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE analytics_events_y2025m12 PARTITION OF analytics_events FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE INDEX CONCURRENTLY idx_analytics_user_id ON analytics_events (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_analytics_event_type ON analytics_events (event_type, created_at DESC);
CREATE INDEX CONCURRENTLY idx_analytics_session ON analytics_events (session_id);

-- ============================================================================
-- NOTIFICATIONS TABLES
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'email', 'task', 'system', 'ai'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}', -- Additional notification data
    is_read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    delivery_method VARCHAR(20) DEFAULT 'app' CHECK (delivery_method IN ('app', 'email', 'push')),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_notifications_user_id ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX CONCURRENTLY idx_notifications_scheduled ON notifications (scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_notifications_type ON notifications (type, created_at DESC);

-- Notification preferences
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    task_reminders BOOLEAN DEFAULT TRUE,
    email_digest BOOLEAN DEFAULT TRUE,
    ai_insights BOOLEAN DEFAULT TRUE,
    digest_frequency VARCHAR(20) DEFAULT 'daily' CHECK (digest_frequency IN ('never', 'daily', 'weekly')),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SYNCHRONIZATION TABLES
-- ============================================================================

-- Email sync state tracking
CREATE TABLE email_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apple_mail_db_path TEXT NOT NULL,
    last_sync_timestamp TIMESTAMP WITH TIME ZONE,
    last_processed_rowid BIGINT DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'running', 'error', 'paused')),
    error_message TEXT,
    total_emails_processed INTEGER DEFAULT 0,
    emails_added INTEGER DEFAULT 0,
    emails_updated INTEGER DEFAULT 0,
    last_error_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apple_mail_db_path)
);

CREATE INDEX CONCURRENTLY idx_sync_state_user_id ON email_sync_state (user_id);
CREATE INDEX CONCURRENTLY idx_sync_state_status ON email_sync_state (sync_status, updated_at);

-- ============================================================================
-- PERFORMANCE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Materialized view for email statistics
CREATE MATERIALIZED VIEW email_stats AS
SELECT 
    user_id,
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
    COUNT(*) FILTER (WHERE is_starred = true) as starred_count,
    COUNT(*) FILTER (WHERE has_attachments = true) as emails_with_attachments,
    MAX(email_date) as latest_email_date,
    DATE_TRUNC('day', NOW()) as computed_date
FROM emails 
GROUP BY user_id;

CREATE UNIQUE INDEX ON email_stats (user_id);

-- Refresh email stats daily
CREATE OR REPLACE FUNCTION refresh_email_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY email_stats;
END;
$$ LANGUAGE plpgsql;

-- Task statistics view
CREATE MATERIALIZED VIEW task_stats AS
SELECT 
    user_id,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
    COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue_tasks,
    AVG(actual_hours) FILTER (WHERE actual_hours IS NOT NULL) as avg_completion_hours,
    DATE_TRUNC('day', NOW()) as computed_date
FROM tasks 
GROUP BY user_id;

CREATE UNIQUE INDEX ON task_stats (user_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATED MAINTENANCE
-- ============================================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sync_state_updated_at BEFORE UPDATE ON email_sync_state FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Task history trigger for audit trail
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO task_history (task_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'status', OLD.status, NEW.status);
    END IF;
    
    -- Log priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO task_history (task_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'priority', OLD.priority, NEW.priority);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply task history trigger (need to add updated_by column first)
ALTER TABLE tasks ADD COLUMN updated_by UUID REFERENCES users(id);
CREATE TRIGGER log_task_changes_trigger AFTER UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE log_task_changes();

-- ============================================================================
-- DATA RETENTION AND CLEANUP
-- ============================================================================

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analytics_events 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old user sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_own_data ON users FOR ALL TO authenticated USING (id = auth.uid());
CREATE POLICY emails_own_data ON emails FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY tasks_own_data ON tasks FOR ALL TO authenticated USING (user_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY notifications_own_data ON notifications FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY sessions_own_data ON user_sessions FOR ALL TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- PERFORMANCE OPTIMIZATION HINTS
-- ============================================================================

-- Set appropriate PostgreSQL parameters for performance
-- These should be set in postgresql.conf:

/*
Recommended PostgreSQL configuration for this schema:

# Memory settings (adjust based on available RAM)
shared_buffers = 256MB                # 25% of RAM for dedicated DB server
effective_cache_size = 1GB             # 75% of RAM
work_mem = 4MB                         # Per-connection working memory
maintenance_work_mem = 64MB            # For maintenance operations

# WAL settings for better write performance
wal_buffers = 16MB
wal_writer_delay = 200ms
commit_delay = 0
commit_siblings = 5

# Checkpoint settings
checkpoint_segments = 32               # Older versions
max_wal_size = 1GB                     # PostgreSQL 9.5+
min_wal_size = 80MB
checkpoint_completion_target = 0.7
checkpoint_warning = 30s

# Connection settings
max_connections = 200

# Logging for performance monitoring
log_min_duration_statement = 1000      # Log slow queries
log_line_prefix = '%t [%p-%l] %q%u@%d '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Performance monitoring
shared_preload_libraries = 'pg_stat_statements'
track_activity_query_size = 2048
track_counts = on
track_functions = pl
*/

-- Create indexes for foreign key constraints not automatically indexed
CREATE INDEX CONCURRENTLY idx_user_roles_role_id ON user_roles (role_id);
CREATE INDEX CONCURRENTLY idx_email_category_assignments_category_id ON email_category_assignments (category_id);
CREATE INDEX CONCURRENTLY idx_task_dependencies_depends_on ON task_dependencies (depends_on_task_id);

-- Analyze all tables to update statistics
ANALYZE;

COMMIT;