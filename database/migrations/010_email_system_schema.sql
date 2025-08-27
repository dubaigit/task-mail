-- Email System Schema Migration
-- Creates tables for emails, drafts, and email analysis

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Emails table - stores email metadata from Apple Mail
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    sender VARCHAR(500) NOT NULL,
    subject TEXT,
    snippet TEXT,
    date_received TIMESTAMP WITH TIME ZONE,
    date_sent TIMESTAMP WITH TIME ZONE,
    read_status BOOLEAN DEFAULT false,
    flag_status BOOLEAN DEFAULT false,
    mailbox_id VARCHAR(100),
    conversation_id VARCHAR(100),
    size BIGINT,
    has_attachments BOOLEAN DEFAULT false,
    source VARCHAR(50) DEFAULT 'apple_mail',
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email analysis table - stores AI-generated analysis
CREATE TABLE IF NOT EXISTS email_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255) NOT NULL REFERENCES emails(message_id) ON DELETE CASCADE,
    classification VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'low',
    sentiment VARCHAR(50) DEFAULT 'neutral',
    action_required BOOLEAN DEFAULT false,
    ai_confidence DECIMAL(4,3) DEFAULT 1.0,
    analysis_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drafts table - stores email drafts for Apple Mail sync
CREATE TABLE IF NOT EXISTS drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject VARCHAR(500) NOT NULL,
    content TEXT,
    recipients TEXT[] DEFAULT '{}',
    cc TEXT[] DEFAULT '{}',
    bcc TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    priority VARCHAR(50) DEFAULT 'medium',
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    synced_to_apple_mail BOOLEAN DEFAULT false,
    apple_mail_id VARCHAR(255),
    synced_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    last_sync_attempt TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIM_TIMESTAMP
);

-- Tasks table - stores tasks generated from emails
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending',
    email_id VARCHAR(255) REFERENCES emails(message_id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization

-- Emails indexes
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_emails_date_received ON emails(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_read_status ON emails(read_status);
CREATE INDEX IF NOT EXISTS idx_emails_flag_status ON emails(flag_status);
CREATE INDEX IF NOT EXISTS idx_emails_has_attachments ON emails(has_attachments);
CREATE INDEX IF NOT EXISTS idx_emails_source ON emails(source);

-- Email analysis indexes
CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analysis_classification ON email_analysis(classification);
CREATE INDEX IF NOT EXISTS idx_email_analysis_priority ON email_analysis(priority);
CREATE INDEX IF NOT EXISTS idx_email_analysis_action_required ON email_analysis(action_required);

-- Drafts indexes
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_priority ON drafts(priority);
CREATE INDEX IF NOT EXISTS idx_drafts_synced_to_apple_mail ON drafts(synced_to_apple_mail);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_email_id ON tasks(email_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
DROP TRIGGER IF EXISTS update_emails_updated_at ON emails;
CREATE TRIGGER update_emails_updated_at 
    BEFORE UPDATE ON emails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_analysis_updated_at ON email_analysis;
CREATE TRIGGER update_email_analysis_updated_at 
    BEFORE UPDATE ON email_analysis 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drafts_updated_at ON drafts;
CREATE TRIGGER update_drafts_updated_at 
    BEFORE UPDATE ON drafts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON emails TO email_admin;
GRANT ALL ON email_analysis TO email_admin;
GRANT ALL ON drafts TO email_admin;
GRANT ALL ON tasks TO email_admin;

-- Comments for documentation
COMMENT ON TABLE emails IS 'Email metadata from Apple Mail database';
COMMENT ON TABLE email_analysis IS 'AI-generated analysis and classification of emails';
COMMENT ON TABLE drafts IS 'Email drafts for synchronization with Apple Mail';
COMMENT ON TABLE tasks IS 'Tasks generated from emails and user input';

-- Insert sample data for testing
INSERT INTO emails (message_id, sender, subject, snippet, date_received, read_status, source)
VALUES 
    ('sample-1', 'sender1@example.com', 'Welcome to Apple MCP', 'Thank you for joining our platform...', NOW(), false, 'apple_mail'),
    ('sample-2', 'sender2@example.com', 'Meeting Reminder', 'Don''t forget about our meeting tomorrow...', NOW() - INTERVAL '1 hour', true, 'apple_mail'),
    ('sample-3', 'sender3@example.com', 'Invoice #12345', 'Please find attached invoice for services...', NOW() - INTERVAL '2 hours', false, 'apple_mail')
ON CONFLICT (message_id) DO NOTHING;

-- Insert sample email analysis
INSERT INTO email_analysis (email_id, classification, priority, sentiment, action_required)
VALUES 
    ('sample-1', 'general', 'low', 'positive', false),
    ('sample-2', 'meeting', 'medium', 'neutral', true),
    ('sample-3', 'financial', 'medium', 'neutral', true)
ON CONFLICT DO NOTHING;

-- Insert sample tasks
INSERT INTO tasks (title, description, priority, status, email_id, due_date, tags)
VALUES 
    ('Follow up: Meeting Reminder', 'Email from sender2@example.com: Don''t forget about our meeting tomorrow...', 'medium', 'pending', 'sample-2', NOW() + INTERVAL '1 day', ARRAY['meeting']),
    ('Review Invoice #12345', 'Email from sender3@example.com: Please find attached invoice for services...', 'medium', 'pending', 'sample-3', NOW() + INTERVAL '3 days', ARRAY['financial'])
ON CONFLICT DO NOTHING;
