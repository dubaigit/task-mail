-- Missing Tables Setup for Email Processing System
-- Creates all tables identified as missing in the diagnostic report

-- Email Processing Queue (CRITICAL)
CREATE TABLE IF NOT EXISTS email_processing_queue (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    UNIQUE(email_id, operation_type)
);

-- Tasks Table (CRITICAL)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES messages(ROWID) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to VARCHAR(255),
    due_date TIMESTAMP,
    estimated_time INTEGER, -- minutes
    actual_time INTEGER, -- minutes
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    email_subject TEXT,
    sender TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- AI Analysis Table (rename from existing email_ai_analysis for compatibility)
CREATE TABLE IF NOT EXISTS ai_analysis (
    id SERIAL PRIMARY KEY,
    email_id INTEGER NOT NULL,
    classification VARCHAR(50) DEFAULT 'FYI_ONLY',
    urgency VARCHAR(20) DEFAULT 'MEDIUM',
    confidence DECIMAL(5,2) DEFAULT 0.50,
    task_title TEXT,
    task_description TEXT,
    estimated_time VARCHAR(50),
    suggested_action TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    draft_reply TEXT,
    model_used VARCHAR(50),
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_id)
);

-- Email Classifications Table (for compatibility with EmailAgent.js)
CREATE TABLE IF NOT EXISTS email_classifications (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) NOT NULL,
    classification VARCHAR(50) NOT NULL,
    urgency VARCHAR(20) DEFAULT 'MEDIUM',
    confidence DECIMAL(5,2) DEFAULT 0.50,
    suggested_action TEXT,
    task_title TEXT,
    task_description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_id)
);

-- Email Drafts Table (for AI-generated drafts)
CREATE TABLE IF NOT EXISTS email_drafts (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    tone VARCHAR(20) DEFAULT 'PROFESSIONAL',
    confidence DECIMAL(5,2) DEFAULT 0.50,
    suggestions JSONB DEFAULT '[]'::jsonb,
    model_used VARCHAR(50),
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_queue_status ON email_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_email_operation ON email_processing_queue(email_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_queue_priority_created ON email_processing_queue(priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tasks_email_id ON tasks(email_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_email ON ai_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_classification ON ai_analysis(classification);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_urgency ON ai_analysis(urgency);

CREATE INDEX IF NOT EXISTS idx_email_classifications_email ON email_classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_email_classifications_classification ON email_classifications(classification);

CREATE INDEX IF NOT EXISTS idx_email_drafts_email ON email_drafts(email_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created ON email_drafts(created_at DESC);

-- Attempt to add missing indexes on existing tables (may fail if insufficient permissions)
DO $$ 
BEGIN
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to create index idx_emails_message_id';
    END;
    
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_emails_processed_at ON emails(processed_at);
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to create index idx_emails_processed_at';
    WHEN undefined_column THEN
        RAISE NOTICE 'Column processed_at does not exist on emails table';
    END;
END $$;