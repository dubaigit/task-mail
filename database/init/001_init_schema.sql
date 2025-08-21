-- Initialize Email Management Database
-- Enhanced schema with proper indexes and constraints

BEGIN;

-- Create database and user if not exists (for PostgreSQL)
-- This file will be executed by Docker on first startup

-- Addresses table (stores email addresses and display names)
CREATE TABLE IF NOT EXISTS addresses (
    ROWID BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, comment)
);

-- Subjects table (stores email subjects)
CREATE TABLE IF NOT EXISTS subjects (
    ROWID BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject)
);

-- Mailboxes table (stores folder/mailbox information)
CREATE TABLE IF NOT EXISTS mailboxes (
    ROWID SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    unseen_count INTEGER NOT NULL DEFAULT 0,
    unread_count_adjusted_for_duplicates INTEGER NOT NULL DEFAULT 0,
    change_identifier TEXT,
    source INTEGER,
    alleged_change_identifier TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(url)
);

-- Messages table (core email messages)
CREATE TABLE IF NOT EXISTS messages (
    ROWID BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    document_id TEXT,
    in_reply_to TEXT,
    remote_id TEXT,
    sender_address_id BIGINT REFERENCES addresses(ROWID),
    subject_id BIGINT REFERENCES subjects(ROWID),
    date_sent TIMESTAMP,
    date_received TIMESTAMP,
    display_date TIMESTAMP,
    mailbox_id INTEGER REFERENCES mailboxes(ROWID),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message content table (for full text search)
CREATE TABLE IF NOT EXISTS message_content (
    message_id BIGINT PRIMARY KEY REFERENCES messages(ROWID) ON DELETE CASCADE,
    content_text TEXT,
    content_html TEXT,
    content_preview TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table (AI-generated tasks from emails)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
    estimated_time TEXT,
    actual_time TEXT,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_from_message_id BIGINT REFERENCES messages(ROWID),
    assigned_to TEXT,
    tags TEXT[],
    ai_confidence INTEGER CHECK (ai_confidence BETWEEN 0 AND 100),
    classification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Analysis table (store AI processing results)
CREATE TABLE IF NOT EXISTS ai_analysis (
    id SERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES messages(ROWID) ON DELETE CASCADE,
    classification TEXT,
    urgency TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    suggested_action TEXT,
    task_title TEXT,
    task_description TEXT,
    tags TEXT[],
    model_used TEXT,
    processing_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email drafts table
CREATE TABLE IF NOT EXISTS drafts (
    id SERIAL PRIMARY KEY,
    subject TEXT,
    recipient TEXT,
    cc TEXT,
    bcc TEXT,
    content TEXT,
    reply_to_message_id BIGINT REFERENCES messages(ROWID),
    ai_generated BOOLEAN DEFAULT FALSE,
    model_used TEXT,
    confidence INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_date_received ON messages(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_address_id);
CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages(subject_id);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox ON messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_flags ON messages(flags);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_message ON tasks(created_from_message_id);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_message ON ai_analysis(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_classification ON ai_analysis(classification);

-- Full text search index on message content
CREATE INDEX IF NOT EXISTS idx_message_content_fts ON message_content USING gin(to_tsvector('english', content_text));

-- Insert default mailbox
INSERT INTO mailboxes (url, total_count, unread_count) 
VALUES ('INBOX', 0, 0) ON CONFLICT (url) DO NOTHING;

COMMIT;