-- Email Intelligence System - Production Database Schema
-- PostgreSQL 15+ optimized for high-performance email processing
-- Supports 8k-20k emails with <10s response times

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ==================== CORE EMAIL TABLES ====================

-- Emails table - mirrors Apple Mail data with application state
CREATE TABLE emails (
    id BIGSERIAL PRIMARY KEY,
    apple_mail_id VARCHAR(255) UNIQUE NOT NULL, -- Apple Mail message_id
    document_id VARCHAR(255), -- Apple Mail document_id for content retrieval
    subject_text TEXT NOT NULL DEFAULT '',
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipient_emails TEXT[], -- Array of recipient emails
    date_received TIMESTAMP WITH TIME ZONE NOT NULL,
    date_sent TIMESTAMP WITH TIME ZONE,
    content_hash VARCHAR(64), -- SHA256 of email content for change detection
    snippet TEXT, -- First 200 chars for quick preview
    word_count INTEGER DEFAULT 0,
    attachment_count INTEGER DEFAULT 0,
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    apple_mailbox_path TEXT, -- Apple Mail mailbox location
    
    -- Application metadata
    processed_at TIMESTAMP WITH TIME ZONE,
    last_analysis_at TIMESTAMP WITH TIME ZONE,
    analysis_version VARCHAR(20) DEFAULT '1.0',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email analysis results with confidence scoring
CREATE TABLE email_analysis (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Classification results
    classification VARCHAR(50) NOT NULL, -- NEEDS_REPLY, APPROVAL_REQUIRED, etc.
    urgency VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    sentiment VARCHAR(20) NOT NULL, -- POSITIVE, NEUTRAL, NEGATIVE, FRUSTRATED
    confidence DECIMAL(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Analysis details
    intent VARCHAR(100), -- request_information, schedule_meeting, etc.
    language_detected VARCHAR(10) DEFAULT 'en',
    
    -- Performance metrics
    processing_time_ms INTEGER NOT NULL,
    model_version VARCHAR(50), -- GPT model used or 'pattern-based'
    
    -- Confidence breakdown
    classification_confidence DECIMAL(4,3),
    urgency_confidence DECIMAL(4,3),
    sentiment_confidence DECIMAL(4,3),
    
    -- Analysis metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(email_id) -- One analysis per email (latest)
);

-- ==================== TASK MANAGEMENT TABLES ====================

-- Tasks generated from emails
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- REPLY, APPROVAL, ACTION_ITEM, DELEGATE, FOLLOW_UP
    priority VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    
    -- Assignment and delegation
    created_by_user_id UUID, -- User who created the task
    assignee_user_id UUID, -- Current assignee
    delegation_chain JSONB DEFAULT '[]', -- History of task delegation
    
    -- Timing
    due_date TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,
    
    -- Task completion
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    
    -- Undo functionality (30-second window)
    undo_data JSONB, -- Stores previous state for undo
    undo_expires_at TIMESTAMP WITH TIME ZONE, -- 30 seconds from creation
    is_undoable BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task actions and status updates
CREATE TABLE task_history (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- created, assigned, delegated, completed, undone
    performed_by_user_id UUID,
    old_values JSONB,
    new_values JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== AI DRAFT GENERATION ====================

-- AI-generated draft responses
CREATE TABLE ai_drafts (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Draft content
    subject VARCHAR(255),
    body_content TEXT NOT NULL,
    draft_type VARCHAR(50) NOT NULL, -- reply, forward, new
    
    -- Generation metadata
    model_used VARCHAR(50) NOT NULL, -- gpt-5-mini, template-based
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    generation_time_ms INTEGER NOT NULL,
    confidence_score DECIMAL(4,3),
    
    -- User interaction
    user_feedback_rating INTEGER CHECK (user_feedback_rating BETWEEN 1 AND 5),
    user_feedback_comments TEXT,
    was_used BOOLEAN DEFAULT FALSE,
    was_modified BOOLEAN DEFAULT FALSE,
    final_version TEXT, -- If user modified the draft
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, discarded
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps  
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ACTION ITEMS AND DEADLINES ====================

-- Extracted action items from emails
CREATE TABLE action_items (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- Action details
    text TEXT NOT NULL,
    assignee_mentioned VARCHAR(255), -- Extracted from text
    deadline_mentioned TIMESTAMP WITH TIME ZONE,
    confidence DECIMAL(4,3) NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'identified', -- identified, converted_to_task, ignored
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extracted deadlines from emails
CREATE TABLE deadlines (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Deadline information
    deadline_date TIMESTAMP WITH TIME ZONE NOT NULL,
    context_text TEXT NOT NULL, -- Original text that mentioned the deadline
    confidence DECIMAL(4,3) NOT NULL,
    
    -- Classification
    deadline_type VARCHAR(50), -- explicit, implicit, estimated
    urgency_level VARCHAR(20), -- based on how soon the deadline is
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PERFORMANCE AND CACHING ====================

-- Email analysis cache for frequently accessed results
CREATE TABLE email_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    email_id BIGINT REFERENCES emails(id) ON DELETE CASCADE,
    cache_data JSONB NOT NULL,
    cache_type VARCHAR(50) NOT NULL, -- analysis, content, metadata
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Background job processing queue
CREATE TABLE processing_queue (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Job details
    job_type VARCHAR(50) NOT NULL, -- analyze_email, generate_draft, sync_mailbox
    job_data JSONB, -- Additional parameters for the job
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, retrying
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Error handling
    error_message TEXT,
    error_data JSONB,
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System analytics and performance metrics
CREATE TABLE analytics_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(12,4) NOT NULL,
    dimensions JSONB, -- Additional categorization data
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partitioning helper
    date_partition DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED
);

-- User feedback for system improvement
CREATE TABLE feedback (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT REFERENCES emails(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
    draft_id BIGINT REFERENCES ai_drafts(id) ON DELETE CASCADE,
    
    -- Feedback details
    feedback_type VARCHAR(50) NOT NULL, -- classification, urgency, draft_quality, task_accuracy
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    
    -- User context
    user_id UUID,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES FOR PERFORMANCE ====================

-- Primary email queries (most frequent)
CREATE INDEX idx_emails_date_received_desc ON emails (date_received DESC);
CREATE INDEX idx_emails_sender_email ON emails (sender_email);
CREATE INDEX idx_emails_processed_at ON emails (processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX idx_emails_is_read_date ON emails (is_read, date_received DESC);
CREATE INDEX idx_emails_apple_mail_id ON emails (apple_mail_id);

-- Email content search (using trigram extension)
CREATE INDEX idx_emails_subject_gin ON emails USING gin(subject_text gin_trgm_ops);
CREATE INDEX idx_emails_snippet_gin ON emails USING gin(snippet gin_trgm_ops);

-- Analysis queries
CREATE INDEX idx_email_analysis_email_id ON email_analysis (email_id);
CREATE INDEX idx_email_analysis_classification ON email_analysis (classification);
CREATE INDEX idx_email_analysis_urgency ON email_analysis (urgency);
CREATE INDEX idx_email_analysis_confidence ON email_analysis (confidence DESC);
CREATE INDEX idx_email_analysis_created_at ON email_analysis (created_at DESC);

-- Task management indexes
CREATE INDEX idx_tasks_email_id ON tasks (email_id);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_assignee ON tasks (assignee_user_id) WHERE assignee_user_id IS NOT NULL;
CREATE INDEX idx_tasks_due_date ON tasks (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_priority_created ON tasks (priority, created_at DESC);
CREATE INDEX idx_tasks_undo_expires ON tasks (undo_expires_at) WHERE is_undoable = TRUE;

-- Draft indexes
CREATE INDEX idx_ai_drafts_email_id ON ai_drafts (email_id);
CREATE INDEX idx_ai_drafts_status ON ai_drafts (status);
CREATE INDEX idx_ai_drafts_created_at ON ai_drafts (created_at DESC);
CREATE INDEX idx_ai_drafts_model_used ON ai_drafts (model_used);

-- Performance indexes
CREATE INDEX idx_email_cache_expires ON email_cache (expires_at);
CREATE INDEX idx_email_cache_type_key ON email_cache (cache_type, cache_key);

CREATE INDEX idx_processing_queue_status ON processing_queue (status);
CREATE INDEX idx_processing_queue_scheduled ON processing_queue (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_processing_queue_priority ON processing_queue (priority, scheduled_at) WHERE status = 'pending';

-- Analytics indexes
CREATE INDEX idx_analytics_metrics_name_timestamp ON analytics_metrics (metric_name, timestamp DESC);
CREATE INDEX idx_analytics_metrics_date_partition ON analytics_metrics (date_partition);

-- ==================== MATERIALIZED VIEWS FOR ANALYTICS ====================

-- Email classification distribution (refreshed every 15 minutes)
CREATE MATERIALIZED VIEW email_classification_stats AS
SELECT 
    ea.classification,
    ea.urgency,
    COUNT(*) as email_count,
    AVG(ea.confidence) as avg_confidence,
    COUNT(CASE WHEN e.date_received >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count,
    COUNT(CASE WHEN e.date_received >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d_count
FROM email_analysis ea
JOIN emails e ON ea.email_id = e.id
WHERE e.is_deleted = FALSE
GROUP BY ea.classification, ea.urgency;

CREATE UNIQUE INDEX idx_email_classification_stats ON email_classification_stats (classification, urgency);

-- Task completion metrics (refreshed every hour)
CREATE MATERIALIZED VIEW task_completion_stats AS
SELECT 
    task_type,
    priority,
    status,
    COUNT(*) as task_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_hours,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count
FROM tasks
GROUP BY task_type, priority, status;

CREATE UNIQUE INDEX idx_task_completion_stats ON task_completion_stats (task_type, priority, status);

-- ==================== TRIGGERS FOR DATA CONSISTENCY ====================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_analysis_updated_at BEFORE UPDATE ON email_analysis 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_drafts_updated_at BEFORE UPDATE ON ai_drafts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM email_cache WHERE expires_at < NOW();
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Schedule cache cleanup every hour
CREATE OR REPLACE FUNCTION schedule_cache_cleanup()
RETURNS void AS $$
BEGIN
    -- This would typically be called by a cron job or background worker
    DELETE FROM email_cache WHERE expires_at < NOW();
    
    -- Update access statistics
    UPDATE email_cache 
    SET access_count = access_count + 1, last_accessed_at = NOW() 
    WHERE last_accessed_at < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- ==================== PARTITIONING FOR SCALABILITY ====================

-- Partition analytics table by date for better performance
CREATE TABLE analytics_metrics_template (LIKE analytics_metrics INCLUDING ALL);

-- This would be automated with pg_partman or similar
-- CREATE TABLE analytics_metrics_y2025m08 PARTITION OF analytics_metrics 
-- FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- ==================== PERFORMANCE OPTIMIZATION QUERIES ====================

-- Query plan analysis examples (run with EXPLAIN ANALYZE)
/*
-- Email list query (most common)
EXPLAIN ANALYZE
SELECT e.id, e.subject_text, e.sender_email, e.date_received, ea.classification, ea.urgency
FROM emails e 
JOIN email_analysis ea ON e.id = ea.email_id
WHERE e.is_deleted = FALSE 
ORDER BY e.date_received DESC 
LIMIT 50;

-- Task dashboard query
EXPLAIN ANALYZE  
SELECT t.id, t.title, t.priority, t.status, e.subject_text, e.sender_email
FROM tasks t
JOIN emails e ON t.email_id = e.id
WHERE t.status IN ('pending', 'in_progress')
ORDER BY t.priority, t.created_at DESC
LIMIT 20;

-- Analytics aggregation query
EXPLAIN ANALYZE
SELECT classification, COUNT(*), AVG(confidence)
FROM email_analysis ea
JOIN emails e ON ea.email_id = e.id
WHERE e.date_received >= NOW() - INTERVAL '7 days'
GROUP BY classification;
*/

-- ==================== SAMPLE DATA FOR TESTING ====================

-- Insert sample data for testing (would be removed in production)
/*
INSERT INTO emails (apple_mail_id, subject_text, sender_email, date_received, snippet, processed_at) VALUES
('test-001', 'Project Update Required', 'john.doe@company.com', NOW() - INTERVAL '1 hour', 'Please provide an update on the Q4 project status...', NOW()),
('test-002', 'Meeting Confirmation', 'sarah.wilson@client.com', NOW() - INTERVAL '2 hours', 'Can you confirm your availability for tomorrow meeting?', NOW()),
('test-003', 'FYI: Server Maintenance', 'admin@company.com', NOW() - INTERVAL '3 hours', 'Scheduled maintenance will occur this weekend...', NOW());

INSERT INTO email_analysis (email_id, classification, urgency, sentiment, confidence, processing_time_ms, model_version) VALUES
(1, 'NEEDS_REPLY', 'HIGH', 'NEUTRAL', 0.89, 150, 'pattern-based'),
(2, 'NEEDS_REPLY', 'MEDIUM', 'NEUTRAL', 0.85, 120, 'pattern-based'), 
(3, 'FYI_ONLY', 'LOW', 'NEUTRAL', 0.95, 80, 'pattern-based');
*/

-- ==================== BACKUP AND MAINTENANCE ====================

-- Automated backup configuration (would be set up separately)
/*
-- Daily full backup
pg_dump -h localhost -U postgres -d email_intelligence > backup_$(date +%Y%m%d).sql

-- Point-in-time recovery setup
wal_level = replica
archive_mode = on  
archive_command = 'test ! -f /backup/archive/%f && cp %p /backup/archive/%f'
*/

COMMENT ON DATABASE email_intelligence IS 'Email Intelligence System - Production Database Schema v1.0';