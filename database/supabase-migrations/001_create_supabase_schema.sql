-- Supabase Schema Migration - Enhanced PostgreSQL Schema
-- This migrates the SQLite schema to PostgreSQL with additional Supabase features

BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in-progress', 'completed', 'cancelled');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed', 'conflict');
CREATE TYPE conflict_resolution AS ENUM ('pending', 'resolved_sqlite', 'resolved_supabase', 'resolved_merge');

-- Addresses table with enhanced indexing
CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, comment)
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL UNIQUE,
    subject_hash TEXT GENERATED ALWAYS AS (encode(digest(subject, 'sha256'), 'hex')) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mailboxes table with enhanced metadata
CREATE TABLE IF NOT EXISTS mailboxes (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    total_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    unseen_count INTEGER NOT NULL DEFAULT 0,
    unread_count_adjusted_for_duplicates INTEGER NOT NULL DEFAULT 0,
    change_identifier TEXT,
    source INTEGER,
    alleged_change_identifier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table with full-text search support
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    document_id TEXT,
    in_reply_to TEXT,
    remote_id TEXT,
    sender_address_id BIGINT REFERENCES addresses(id),
    subject_id BIGINT REFERENCES subjects(id),
    date_sent TIMESTAMPTZ,
    date_received TIMESTAMPTZ,
    display_date TIMESTAMPTZ,
    mailbox_id INTEGER REFERENCES mailboxes(id),
    remote_mailbox_id INTEGER,
    original_mailbox_id INTEGER,
    flags INTEGER DEFAULT 0,
    read_flag BOOLEAN DEFAULT FALSE,
    flagged_flag BOOLEAN DEFAULT FALSE,
    size_total INTEGER DEFAULT 0,
    color TEXT,
    encoding TEXT,
    content_type TEXT,
    external_id TEXT,
    unique_id TEXT,
    conversation_id BIGINT,
    list_unsubscribe TEXT,
    -- Supabase specific fields
    sync_status sync_status DEFAULT 'pending',
    sync_hash TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message content with full-text search
CREATE TABLE IF NOT EXISTS message_content (
    message_id BIGINT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    content_text TEXT,
    content_html TEXT,
    content_preview TEXT,
    content_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(content_text, '') || ' ' || COALESCE(content_preview, ''))
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced tasks table with AI features
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'medium',
    status task_status DEFAULT 'pending',
    estimated_time INTERVAL,
    actual_time INTERVAL,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_from_message_id BIGINT REFERENCES messages(id),
    assigned_to UUID REFERENCES auth.users(id),
    tags TEXT[],
    ai_confidence INTEGER CHECK (ai_confidence BETWEEN 0 AND 100),
    classification TEXT,
    -- AI enhancement fields
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_model_used TEXT,
    ai_processing_metadata JSONB,
    -- Collaboration fields
    collaborators UUID[],
    watchers UUID[],
    -- Sync fields
    sync_status sync_status DEFAULT 'pending',
    sync_hash TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced AI analysis table
CREATE TABLE IF NOT EXISTS ai_analysis (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    classification TEXT,
    urgency TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    suggested_action TEXT,
    task_title TEXT,
    task_description TEXT,
    tags TEXT[],
    model_used TEXT,
    model_version TEXT,
    processing_time INTEGER, -- milliseconds
    processing_metadata JSONB,
    -- Vector embeddings for semantic search
    content_embedding VECTOR(1536), -- OpenAI embedding dimension
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email drafts with AI generation tracking
CREATE TABLE IF NOT EXISTS drafts (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    subject TEXT,
    recipient TEXT,
    cc TEXT,
    bcc TEXT,
    content TEXT,
    reply_to_message_id BIGINT REFERENCES messages(id),
    ai_generated BOOLEAN DEFAULT FALSE,
    model_used TEXT,
    confidence INTEGER,
    generation_metadata JSONB,
    -- User tracking
    created_by UUID REFERENCES auth.users(id),
    -- Sync fields
    sync_status sync_status DEFAULT 'pending',
    sync_hash TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings with JSONB for flexibility
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    setting_type TEXT DEFAULT 'user', -- user, system, sync
    -- Sync fields
    sync_status sync_status DEFAULT 'pending',
    sync_hash TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- Sync metadata table for dual database coordination
CREATE TABLE IF NOT EXISTS sync_metadata (
    id SERIAL PRIMARY KEY,
    sync_type TEXT NOT NULL, -- apple_mail, bidirectional, etc.
    last_rowid BIGINT DEFAULT 0,
    last_supabase_timestamp TIMESTAMPTZ DEFAULT NOW(),
    last_full_sync_at TIMESTAMPTZ,
    sync_direction TEXT DEFAULT 'bidirectional', -- up, down, bidirectional
    conflict_resolution_strategy TEXT DEFAULT 'timestamp',
    sync_statistics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sync_type)
);

-- Sync conflicts table for conflict resolution
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    sqlite_version JSONB,
    supabase_version JSONB,
    conflict_type TEXT, -- update_conflict, delete_conflict, constraint_violation
    resolution_status conflict_resolution DEFAULT 'pending',
    resolution_data JSONB,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_date_received ON messages(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_address_id);
CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages(subject_id);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox ON messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_flags ON messages(flags);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sync_status ON messages(sync_status);
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON messages(updated_at);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_message ON tasks(created_from_message_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(sync_status);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

-- AI Analysis indexes
CREATE INDEX IF NOT EXISTS idx_ai_analysis_message ON ai_analysis(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_classification ON ai_analysis(classification);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_confidence ON ai_analysis(confidence);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_message_content_fts ON message_content USING gin(content_vector);
CREATE INDEX IF NOT EXISTS idx_subjects_fts ON subjects USING gin(to_tsvector('english', subject));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_date ON messages(mailbox_id, date_received DESC);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(resolution_status, created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER set_updated_at_addresses BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_mailboxes BEFORE UPDATE ON mailboxes FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_messages BEFORE UPDATE ON messages FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_drafts BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_user_settings BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
CREATE TRIGGER set_updated_at_sync_metadata BEFORE UPDATE ON sync_metadata FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (assigned_to = auth.uid() OR created_from_message_id IN (
        SELECT id FROM messages WHERE sender_address_id IN (
            SELECT id FROM addresses WHERE address = auth.email()
        )
    ));

CREATE POLICY "Users can create tasks" ON tasks
    FOR INSERT WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- RLS Policies for drafts
CREATE POLICY "Users can manage their own drafts" ON drafts
    FOR ALL USING (created_by = auth.uid());

-- RLS Policies for user settings
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL USING (user_id = auth.uid());

-- Insert default data
INSERT INTO sync_metadata (sync_type, sync_direction) 
VALUES ('apple_mail', 'bidirectional') 
ON CONFLICT (sync_type) DO NOTHING;

INSERT INTO mailboxes (url, name, total_count, unread_count) 
VALUES ('INBOX', 'Inbox', 0, 0) 
ON CONFLICT (url) DO NOTHING;

-- Create materialized views for performance
CREATE MATERIALIZED VIEW task_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    status,
    priority,
    COUNT(*) as count,
    AVG(ai_confidence) as avg_confidence
FROM tasks
GROUP BY DATE_TRUNC('day', created_at), status, priority;

CREATE INDEX ON task_summary (date, status);

-- Refresh policy for materialized view
CREATE OR REPLACE FUNCTION refresh_task_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY task_summary;
END;
$$ LANGUAGE plpgsql;

COMMIT;