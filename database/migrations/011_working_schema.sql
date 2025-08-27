-- Working Email System Schema
-- This creates a simplified, working schema for testing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they have issues
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.drafts CASCADE;
DROP TABLE IF EXISTS public.emails CASCADE;

-- Create emails table with all required fields
CREATE TABLE public.emails (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apple_mail_id TEXT UNIQUE,
    rowid BIGINT,
    subject TEXT,
    sender TEXT,
    recipients TEXT[],
    to_recipients TEXT[],
    cc_recipients TEXT[],
    bcc_recipients TEXT[],
    reply_to TEXT,
    message_content TEXT,
    date_sent TIMESTAMPTZ,
    date_received TIMESTAMPTZ,
    flags BIGINT,
    size BIGINT,
    mailbox TEXT,
    folder_path TEXT,
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    attachments JSONB,
    conversation_id BIGINT,
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    flag_color INTEGER,
    priority TEXT,
    labels TEXT[],
    raw_data JSONB,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    source_email_id UUID REFERENCES public.emails(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create drafts table
CREATE TABLE public.drafts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subject TEXT,
    to_recipients TEXT[],
    cc_recipients TEXT[],
    bcc_recipients TEXT[],
    content TEXT,
    reply_to_email_id UUID REFERENCES public.emails(id),
    synced_to_apple_mail BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation_rules table
CREATE TABLE public.automation_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_emails_apple_mail_id ON public.emails(apple_mail_id);
CREATE INDEX idx_emails_sender ON public.emails(sender);
CREATE INDEX idx_emails_date_received ON public.emails(date_received);
CREATE INDEX idx_emails_is_read ON public.emails(is_read);
CREATE INDEX idx_emails_is_flagged ON public.emails(is_flagged);
CREATE INDEX idx_emails_folder_path ON public.emails(folder_path);

CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_source_email ON public.tasks(source_email_id);

CREATE INDEX idx_drafts_synced ON public.drafts(synced_to_apple_mail);
CREATE INDEX idx_automation_rules_enabled ON public.automation_rules(enabled);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON public.emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON public.drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO public.emails (
    apple_mail_id, 
    subject, 
    sender, 
    to_recipients,
    message_content,
    date_received,
    is_read,
    folder_path
) VALUES 
(
    'sample-email-1',
    'Welcome to Task Mail',
    'system@taskmail.com',
    ARRAY['user@example.com'],
    'Welcome to your new email management system!',
    NOW() - INTERVAL '1 hour',
    false,
    'INBOX'
);

-- Grant permissions
GRANT ALL ON public.emails TO postgres;
GRANT ALL ON public.tasks TO postgres;
GRANT ALL ON public.drafts TO postgres;
GRANT ALL ON public.automation_rules TO postgres;

-- Comments
COMMENT ON TABLE public.emails IS 'Email messages synced from Apple Mail';
COMMENT ON TABLE public.tasks IS 'Tasks generated from emails or created manually';
COMMENT ON TABLE public.drafts IS 'Draft emails to be synced to Apple Mail';
COMMENT ON TABLE public.automation_rules IS 'Email automation rules';

