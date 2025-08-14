-- Production Email Intelligence Database Schema
-- Optimized for processing 10K+ emails with 2+ months default timeframe

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS email_tasks CASCADE;
DROP TABLE IF EXISTS email_intelligence CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS email_batches CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;

-- Main emails table - stores core email data
CREATE TABLE emails (
    id SERIAL PRIMARY KEY,
    message_id BIGINT UNIQUE NOT NULL,  -- Apple Mail message ID
    apple_document_id TEXT,             -- Apple Mail document ID
    
    -- Core email fields
    subject_text TEXT NOT NULL DEFAULT '',
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) DEFAULT '',
    
    -- Timestamps - indexed for performance
    date_sent TIMESTAMP,
    date_received TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status flags
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Email metadata
    mailbox_path TEXT,
    size_bytes INTEGER DEFAULT 0,
    thread_id TEXT,
    
    -- Content fields (for snippet/preview)
    snippet TEXT,
    full_content TEXT,
    
    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    processed_at TIMESTAMP,
    
    -- Partitioning key
    date_partition DATE GENERATED ALWAYS AS (DATE(date_received)) STORED
);

-- Email intelligence analysis results
CREATE TABLE email_intelligence (
    id SERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- AI Analysis Results
    classification VARCHAR(50) NOT NULL, -- NEEDS_REPLY, APPROVAL_REQUIRED, etc.
    urgency VARCHAR(20) NOT NULL,        -- CRITICAL, HIGH, MEDIUM, LOW
    sentiment VARCHAR(20) NOT NULL,       -- POSITIVE, NEUTRAL, NEGATIVE, FRUSTRATED
    intent TEXT,
    
    -- Confidence scores
    classification_confidence DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    urgency_confidence DECIMAL(5,4) DEFAULT 0.5,
    sentiment_confidence DECIMAL(5,4) DEFAULT 0.5,
    overall_confidence DECIMAL(5,4) DEFAULT 0.5,
    
    -- Processing metadata
    processing_time_ms INTEGER DEFAULT 0,
    ai_model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- JSON fields for complex data
    action_items JSONB DEFAULT '[]',     -- Array of extracted action items
    deadlines JSONB DEFAULT '[]',       -- Array of deadlines with context
    confidence_scores JSONB DEFAULT '{}', -- Detailed confidence breakdown
    
    -- Draft reply (if generated)
    draft_reply TEXT,
    draft_generated_at TIMESTAMP,
    
    CONSTRAINT unique_email_intelligence UNIQUE(email_id)
);

-- Tasks extracted from emails
CREATE TABLE email_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(100) UNIQUE NOT NULL, -- email_id + task_index format
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    -- Task details
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- reply, approval, development, delegation, follow-up
    priority VARCHAR(20) NOT NULL,  -- CRITICAL, HIGH, MEDIUM, LOW
    
    -- Assignment and scheduling
    assignee VARCHAR(255),
    due_date TIMESTAMP,
    estimated_hours INTEGER,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, in-progress, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Task metadata
    confidence DECIMAL(5,4) DEFAULT 0.5,
    extracted_from_action_item INTEGER, -- Index in action_items array
    dependencies JSONB DEFAULT '[]'
);

-- Batch processing tracking
CREATE TABLE email_batches (
    id SERIAL PRIMARY KEY,
    batch_name VARCHAR(100) NOT NULL,
    
    -- Batch scope
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    
    -- Processing metrics
    total_emails INTEGER DEFAULT 0,
    processed_emails INTEGER DEFAULT 0,
    failed_emails INTEGER DEFAULT 0,
    
    -- Status and timing
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_seconds INTEGER,
    
    -- Error tracking
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Configuration used
    config JSONB DEFAULT '{}'
);

-- Performance monitoring
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_hour INTEGER NOT NULL, -- 0-23 for hourly granularity
    
    -- Processing metrics
    emails_processed INTEGER DEFAULT 0,
    average_processing_time_ms DECIMAL(8,2) DEFAULT 0,
    classification_accuracy DECIMAL(5,4),
    
    -- System metrics
    memory_usage_mb INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    
    -- Business metrics
    urgent_emails_detected INTEGER DEFAULT 0,
    tasks_generated INTEGER DEFAULT 0,
    drafts_generated INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_metric_time UNIQUE(metric_date, metric_hour)
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Primary time-based queries (most important)
CREATE INDEX idx_emails_date_received_desc ON emails(date_received DESC);
CREATE INDEX idx_emails_date_partition ON emails(date_partition);

-- Status and filtering indexes
CREATE INDEX idx_emails_processing_status ON emails(processing_status) WHERE processing_status != 'completed';
CREATE INDEX idx_emails_unread ON emails(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_emails_flagged ON emails(is_flagged) WHERE is_flagged = TRUE;

-- Sender analysis
CREATE INDEX idx_emails_sender_email ON emails(sender_email);
CREATE INDEX idx_emails_sender_date ON emails(sender_email, date_received DESC);

-- Full-text search on subjects
CREATE INDEX idx_emails_subject_gin ON emails USING GIN(to_tsvector('english', subject_text));

-- Intelligence table indexes
CREATE INDEX idx_intelligence_classification ON email_intelligence(classification);
CREATE INDEX idx_intelligence_urgency ON email_intelligence(urgency);
CREATE INDEX idx_intelligence_confidence ON email_intelligence(overall_confidence DESC);
CREATE INDEX idx_intelligence_created_at ON email_intelligence(created_at DESC);

-- Task management indexes
CREATE INDEX idx_tasks_status ON email_tasks(status) WHERE status IN ('pending', 'in-progress');
CREATE INDEX idx_tasks_priority_due ON email_tasks(priority, due_date) WHERE status != 'completed';
CREATE INDEX idx_tasks_assignee ON email_tasks(assignee) WHERE assignee IS NOT NULL;
CREATE INDEX idx_tasks_email_id ON email_tasks(email_id);

-- Batch processing indexes
CREATE INDEX idx_batches_status ON email_batches(status, started_at);
CREATE INDEX idx_batches_date_range ON email_batches(start_date, end_date);

-- Performance metrics indexes
CREATE INDEX idx_metrics_date_hour ON performance_metrics(metric_date DESC, metric_hour DESC);

-- ===== PARTITIONING SETUP =====

-- Partition emails table by month for better performance with large datasets
-- This will be implemented via application logic for SQLite compatibility

-- ===== VIEWS FOR COMMON QUERIES =====

-- Recent emails with intelligence
CREATE VIEW recent_emails_with_intelligence AS
SELECT 
    e.*,
    ei.classification,
    ei.urgency,
    ei.sentiment,
    ei.classification_confidence,
    ei.action_items,
    ei.deadlines,
    ei.draft_reply
FROM emails e
LEFT JOIN email_intelligence ei ON e.id = ei.email_id
WHERE e.is_deleted = FALSE
ORDER BY e.date_received DESC;

-- Urgent actionable emails
CREATE VIEW urgent_actionable_emails AS
SELECT 
    e.*,
    ei.classification,
    ei.urgency,
    ei.action_items,
    ei.draft_reply
FROM emails e
JOIN email_intelligence ei ON e.id = ei.email_id
WHERE e.is_deleted = FALSE
  AND ei.urgency IN ('CRITICAL', 'HIGH')
  AND ei.classification IN ('NEEDS_REPLY', 'APPROVAL_REQUIRED', 'CREATE_TASK')
ORDER BY 
    CASE ei.urgency 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        ELSE 3 
    END,
    e.date_received DESC;

-- Task summary view
CREATE VIEW task_summary AS
SELECT 
    et.*,
    e.subject_text as email_subject,
    e.sender_name,
    e.date_received as email_date
FROM email_tasks et
JOIN emails e ON et.email_id = e.id
WHERE et.status IN ('pending', 'in-progress')
ORDER BY 
    CASE et.priority 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END,
    et.due_date ASC NULLS LAST,
    et.created_at DESC;

-- Daily processing stats
CREATE VIEW daily_processing_stats AS
SELECT 
    DATE(created_at) as processing_date,
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE processing_status = 'completed') as processed_count,
    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_count,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000)::INTEGER as avg_processing_time_ms
FROM emails
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY processing_date DESC;

-- ===== STORED PROCEDURES/FUNCTIONS =====

-- Function to get emails in date range with pagination
CREATE OR REPLACE FUNCTION get_emails_in_range(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id BIGINT,
    message_id BIGINT,
    subject_text TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    date_received TIMESTAMP,
    is_read BOOLEAN,
    is_flagged BOOLEAN,
    classification VARCHAR(50),
    urgency VARCHAR(20),
    confidence DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.message_id,
        e.subject_text,
        e.sender_email,
        e.sender_name,
        e.date_received,
        e.is_read,
        e.is_flagged,
        COALESCE(ei.classification, 'UNKNOWN') as classification,
        COALESCE(ei.urgency, 'MEDIUM') as urgency,
        COALESCE(ei.overall_confidence, 0.0) as confidence
    FROM emails e
    LEFT JOIN email_intelligence ei ON e.id = ei.email_id
    WHERE e.is_deleted = FALSE
      AND e.date_received >= p_start_date
      AND e.date_received <= p_end_date
    ORDER BY e.date_received DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to update processing metrics
CREATE OR REPLACE FUNCTION update_processing_metrics(
    p_emails_count INTEGER,
    p_avg_time_ms DECIMAL,
    p_urgent_count INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    current_hour INTEGER := EXTRACT(HOUR FROM CURRENT_TIMESTAMP);
    current_date DATE := CURRENT_DATE;
BEGIN
    INSERT INTO performance_metrics (
        metric_date, 
        metric_hour, 
        emails_processed, 
        average_processing_time_ms,
        urgent_emails_detected
    ) VALUES (
        current_date,
        current_hour,
        p_emails_count,
        p_avg_time_ms,
        p_urgent_count
    )
    ON CONFLICT (metric_date, metric_hour) 
    DO UPDATE SET
        emails_processed = performance_metrics.emails_processed + p_emails_count,
        average_processing_time_ms = (
            performance_metrics.average_processing_time_ms + p_avg_time_ms
        ) / 2,
        urgent_emails_detected = performance_metrics.urgent_emails_detected + p_urgent_count;
END;
$$ LANGUAGE plpgsql;

-- ===== TRIGGERS =====

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_emails_updated_at
    BEFORE UPDATE ON emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON email_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===== SAMPLE DATA FOR TESTING =====

-- Insert sample configuration
INSERT INTO email_batches (batch_name, start_date, end_date, status) VALUES
('initial_2_months', CURRENT_TIMESTAMP - INTERVAL '2 months', CURRENT_TIMESTAMP, 'completed');

-- Sample performance baseline
INSERT INTO performance_metrics (metric_date, metric_hour, emails_processed, average_processing_time_ms) VALUES
(CURRENT_DATE, EXTRACT(HOUR FROM CURRENT_TIMESTAMP), 0, 0);

-- ===== MAINTENANCE QUERIES =====

-- Clean up old processing metrics (keep 90 days)
-- DELETE FROM performance_metrics WHERE metric_date < CURRENT_DATE - INTERVAL '90 days';

-- Archive completed tasks older than 30 days
-- UPDATE email_tasks SET status = 'archived' 
-- WHERE status = 'completed' AND completed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

COMMIT;