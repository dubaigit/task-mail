-- Apple Mail Database Replica Schema for PostgreSQL
-- This replicates the exact structure from SQLite Envelope Index

-- Drop existing tables if they exist
DROP TABLE IF EXISTS message_references CASCADE;
DROP TABLE IF EXISTS rich_links CASCADE;
DROP TABLE IF EXISTS local_message_actions CASCADE;
DROP TABLE IF EXISTS message_rich_links CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS message_metadata CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS mailboxes CASCADE;

-- Addresses table (stores email addresses and display names)
CREATE TABLE addresses (
    ROWID BIGINT PRIMARY KEY,
    address TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    UNIQUE(address, comment)
);

-- Subjects table (stores email subjects)
CREATE TABLE subjects (
    ROWID BIGINT PRIMARY KEY,
    subject TEXT NOT NULL,
    UNIQUE(subject)
);

-- Mailboxes table (stores folder/mailbox information)
CREATE TABLE mailboxes (
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
    UNIQUE(url)
);

-- Rich Links table (for embedded links)
CREATE TABLE rich_links (
    ROWID SERIAL PRIMARY KEY,
    title TEXT,
    url TEXT NOT NULL,
    hash TEXT NOT NULL,
    UNIQUE(hash)
);

-- Messages table (main email data) - Using BIGINT for large Apple Mail values
CREATE TABLE messages (
    ROWID BIGINT PRIMARY KEY,
    message_id BIGINT NOT NULL DEFAULT 0,
    global_message_id BIGINT NOT NULL,
    remote_id BIGINT,
    document_id TEXT,
    sender INTEGER REFERENCES addresses(ROWID),
    subject_prefix TEXT,
    subject INTEGER NOT NULL REFERENCES subjects(ROWID),
    summary INTEGER,
    date_sent BIGINT,
    date_received BIGINT,
    mailbox INTEGER NOT NULL REFERENCES mailboxes(ROWID),
    remote_mailbox INTEGER,
    flags BIGINT NOT NULL DEFAULT 0,
    read INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    size BIGINT NOT NULL DEFAULT 0,
    conversation_id BIGINT NOT NULL DEFAULT 0,
    date_last_viewed BIGINT,
    list_id_hash BIGINT,
    unsubscribe_type INTEGER,
    searchable_message INTEGER,
    brand_indicator INTEGER,
    display_date BIGINT,
    color TEXT,
    type INTEGER,
    fuzzy_ancestor INTEGER,
    automated_conversation INTEGER DEFAULT 0,
    root_status INTEGER DEFAULT -1,
    flag_color INTEGER
);

-- Message References table (for threading/replies)
CREATE TABLE message_references (
    ROWID SERIAL PRIMARY KEY,
    message INTEGER NOT NULL REFERENCES messages(ROWID) ON DELETE CASCADE,
    reference INTEGER NOT NULL DEFAULT 0,
    is_originator INTEGER NOT NULL DEFAULT 0
);

-- Local Message Actions table (for sync actions)
CREATE TABLE local_message_actions (
    ROWID SERIAL PRIMARY KEY,
    mailbox INTEGER REFERENCES mailboxes(ROWID) ON DELETE CASCADE,
    source_mailbox INTEGER REFERENCES mailboxes(ROWID) ON DELETE CASCADE,
    destination_mailbox INTEGER REFERENCES mailboxes(ROWID) ON DELETE CASCADE,
    action_type INTEGER,
    user_initiated INTEGER
);

-- Message Rich Links junction table
CREATE TABLE message_rich_links (
    global_message_id INTEGER NOT NULL,
    rich_link INTEGER NOT NULL REFERENCES rich_links(ROWID) ON DELETE CASCADE,
    PRIMARY KEY(global_message_id, rich_link)
);

-- Message Metadata table
CREATE TABLE message_metadata (
    message_id INTEGER PRIMARY KEY
    -- Additional metadata fields can be added here
);

-- Add indexes for performance
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_subject ON messages(subject);
CREATE INDEX idx_messages_date_received ON messages(date_received);
CREATE INDEX idx_messages_mailbox ON messages(mailbox);
CREATE INDEX idx_messages_read ON messages(read);
CREATE INDEX idx_messages_flagged ON messages(flagged);
CREATE INDEX idx_messages_deleted ON messages(deleted);
CREATE INDEX idx_addresses_address ON addresses(address);
CREATE INDEX idx_subjects_subject ON subjects(subject);
CREATE INDEX idx_mailboxes_source ON mailboxes(source);

-- AI Enhancement tables (our additions for task management)
CREATE TABLE email_ai_analysis (
    id SERIAL PRIMARY KEY,
    message_rowid INTEGER NOT NULL REFERENCES messages(ROWID) ON DELETE CASCADE,
    classification VARCHAR(20) DEFAULT 'FYI_ONLY' CHECK (classification IN ('CREATE_TASK', 'FYI_ONLY')),
    urgency VARCHAR(10) DEFAULT 'MEDIUM' CHECK (urgency IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    confidence DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
    task_title TEXT,
    task_description TEXT,
    estimated_time VARCHAR(20),
    suggested_action TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    draft_reply TEXT,
    processed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_rowid)
);

CREATE INDEX idx_ai_analysis_classification ON email_ai_analysis(classification);
CREATE INDEX idx_ai_analysis_urgency ON email_ai_analysis(urgency);
CREATE INDEX idx_ai_analysis_confidence ON email_ai_analysis(confidence);
