-- ============================================================================
-- SUPABASE MIGRATION: Apple Mail Task Manager Initial Schema
-- Migration from PostgreSQL to Supabase with RLS enabled
-- ============================================================================

BEGIN;

-- Enable required extensions for Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- CORE EMAIL MANAGEMENT TABLES
-- ============================================================================

-- Addresses table (stores email addresses and display names)
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rowid BIGSERIAL UNIQUE, -- Keep original ROWID for compatibility
    address TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Supabase user context
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(address, comment, user_id)
);

-- Subjects table (stores email subjects)
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rowid BIGSERIAL UNIQUE, -- Keep original ROWID for compatibility
    subject TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(subject, user_id)
);

-- Mailboxes table (stores folder/mailbox information)
CREATE TABLE mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rowid SERIAL UNIQUE, -- Keep original ROWID for compatibility
    url TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    unseen_count INTEGER NOT NULL DEFAULT 0,
    unread_count_adjusted_for_duplicates INTEGER NOT NULL DEFAULT 0,
    change_identifier TEXT,
    source INTEGER,
    alleged_change_identifier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(url, user_id)
);

-- Messages table (core email messages) - Enhanced for Supabase
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rowid BIGSERIAL UNIQUE, -- Keep original ROWID for compatibility
    message_id TEXT,
    document_id TEXT,
    in_reply_to TEXT,
    remote_id TEXT,
    sender_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    date_sent TIMESTAMPTZ,
    date_received TIMESTAMPTZ,
    display_date TIMESTAMPTZ,
    mailbox_id UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
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
    -- AI processing status
    ai_analyzed BOOLEAN DEFAULT FALSE,
    ai_processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
);

-- Message content table (for full text search) - Enhanced for Supabase
CREATE TABLE message_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    content_text TEXT,
    content_html TEXT,
    content_preview TEXT,
    -- Vector embeddings for semantic search (future enhancement)
    -- embedding VECTOR(1536), -- OpenAI embedding dimensions (requires pgvector extension)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TASK MANAGEMENT TABLES
-- ============================================================================

-- Tasks table (AI-generated tasks from emails) - Enhanced for Supabase
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_id SERIAL UNIQUE, -- Keep original ID for compatibility
    title TEXT NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled', 'archived')),
    estimated_time TEXT,
    actual_time TEXT,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tags TEXT[],
    ai_confidence INTEGER CHECK (ai_confidence BETWEEN 0 AND 100),
    classification TEXT,
    -- Enhanced task metadata
    category TEXT DEFAULT 'DO_MYSELF',
    urgency TEXT DEFAULT 'MEDIUM',
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    -- Supabase features
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- AI ANALYSIS TABLES
-- ============================================================================

-- AI Analysis table (store AI processing results) - Enhanced for Supabase
CREATE TABLE ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    classification TEXT,
    urgency TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    suggested_action TEXT,
    task_title TEXT,
    task_description TEXT,
    tags TEXT[],
    model_used TEXT,
    processing_time INTEGER,
    -- Enhanced AI metadata
    model_version TEXT,
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    -- Batch processing info
    batch_id UUID,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- AI Usage Stats table - New for cost tracking
CREATE TABLE ai_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_processed DATE NOT NULL,
    total_processed INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_batches INTEGER DEFAULT 0,
    model_usage JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(date_processed, user_id)
);

-- ============================================================================
-- EMAIL DRAFTS & USER MANAGEMENT
-- ============================================================================

-- Email drafts table - Enhanced for Supabase
CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject TEXT,
    recipient TEXT,
    cc TEXT,
    bcc TEXT,
    content TEXT,
    reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    ai_generated BOOLEAN DEFAULT FALSE,
    model_used TEXT,
    confidence INTEGER,
    -- Draft status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled', 'discarded')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User settings - Enhanced for Supabase
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(user_id, setting_key)
);

-- User profiles - Extended auth.users
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    preferences JSONB DEFAULT '{}',
    -- Apple Mail integration settings
    mail_account_settings JSONB DEFAULT '{}',
    ai_processing_enabled BOOLEAN DEFAULT TRUE,
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- ============================================================================

-- Messages indexes
CREATE INDEX idx_messages_date_received ON messages(date_received DESC, user_id);
CREATE INDEX idx_messages_sender ON messages(sender_address_id, user_id);
CREATE INDEX idx_messages_subject ON messages(subject_id, user_id);
CREATE INDEX idx_messages_mailbox ON messages(mailbox_id, user_id);
CREATE INDEX idx_messages_flags ON messages(flags, user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, user_id);
CREATE INDEX idx_messages_ai_analyzed ON messages(ai_analyzed, user_id) WHERE NOT ai_analyzed;
CREATE INDEX idx_messages_user ON messages(user_id, date_received DESC);

-- Tasks indexes  
CREATE INDEX idx_tasks_status ON tasks(status, user_id);
CREATE INDEX idx_tasks_priority ON tasks(priority, user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date, user_id) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_message ON tasks(created_from_message_id, user_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_user ON tasks(user_id, status, created_at DESC);

-- AI Analysis indexes
CREATE INDEX idx_ai_analysis_message ON ai_analysis(message_id, user_id);
CREATE INDEX idx_ai_analysis_classification ON ai_analysis(classification, user_id);
CREATE INDEX idx_ai_analysis_batch ON ai_analysis(batch_id, processing_status);
CREATE INDEX idx_ai_analysis_user ON ai_analysis(user_id, created_at DESC);

-- Full text search indexes
CREATE INDEX idx_message_content_fts ON message_content USING gin(to_tsvector('english', content_text));
CREATE INDEX idx_message_content_user ON message_content(user_id, message_id);

-- Addresses and subjects indexes
CREATE INDEX idx_addresses_user ON addresses(user_id, address);
CREATE INDEX idx_subjects_user ON subjects(user_id, subject);
CREATE INDEX idx_mailboxes_user ON mailboxes(user_id, url);

-- Settings and drafts indexes
CREATE INDEX idx_user_settings_key ON user_settings(user_id, setting_key);
CREATE INDEX idx_drafts_user ON drafts(user_id, status, created_at DESC);
CREATE INDEX idx_ai_usage_stats_user ON ai_usage_stats(user_id, date_processed DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - Users can only access their own data
CREATE POLICY "Users can access own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own subjects" ON subjects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own mailboxes" ON mailboxes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own messages" ON messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own message content" ON message_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access shared tasks" ON tasks FOR SELECT USING (auth.uid() = assigned_to);
CREATE POLICY "Users can access own AI analysis" ON ai_analysis FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own AI stats" ON ai_usage_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own drafts" ON drafts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own profile" ON user_profiles FOR ALL USING (auth.uid() = id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mailboxes_updated_at BEFORE UPDATE ON mailboxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_usage_stats_updated_at BEFORE UPDATE ON ai_usage_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORED FUNCTIONS FOR COMPATIBILITY & PERFORMANCE
-- ============================================================================

-- Function to get task category counts (cached)
CREATE OR REPLACE FUNCTION get_task_category_counts_cached()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
SELECT JSONB_OBJECT_AGG(classification, count)
FROM (
    SELECT 
        COALESCE(classification, 'DO_MYSELF') as classification,
        COUNT(*) as count
    FROM tasks 
    WHERE user_id = auth.uid() AND status != 'completed'
    GROUP BY classification
) t;
$$;

-- Function to get AI processing stats (cached)
CREATE OR REPLACE FUNCTION get_ai_processing_stats_cached()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
WITH daily_stats AS (
    SELECT 
        COALESCE(SUM(total_processed), 0) as total_processed,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(total_cost / NULLIF(total_processed, 0)), 0) as avg_cost_per_email,
        COALESCE(SUM(total_batches), 0) as total_batches
    FROM ai_usage_stats 
    WHERE user_id = auth.uid() 
      AND date_processed = CURRENT_DATE
),
unprocessed_count AS (
    SELECT COUNT(*) as count
    FROM messages 
    WHERE user_id = auth.uid() 
      AND NOT ai_analyzed
)
SELECT jsonb_build_object(
    'daily', jsonb_build_object(
        'total_processed', d.total_processed,
        'total_cost', d.total_cost,
        'avg_cost_per_email', d.avg_cost_per_email,
        'total_batches', d.total_batches
    ),
    'balance', 25.00,
    'unprocessed', u.count,
    'isProcessing', EXISTS (
        SELECT 1 FROM ai_analysis 
        WHERE user_id = auth.uid() 
          AND processing_status = 'processing'
    )
)
FROM daily_stats d, unprocessed_count u;
$$;

-- Function to get unanalyzed emails for processing
CREATE OR REPLACE FUNCTION get_unanalyzed_emails(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    message_id TEXT,
    content_text TEXT,
    sender_address TEXT,
    subject TEXT,
    date_received TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
SELECT 
    m.id,
    m.message_id,
    mc.content_text,
    a.address as sender_address,
    s.subject,
    m.date_received
FROM messages m
JOIN message_content mc ON m.id = mc.message_id
LEFT JOIN addresses a ON m.sender_address_id = a.id
LEFT JOIN subjects s ON m.subject_id = s.id
WHERE m.user_id = auth.uid() 
  AND NOT m.ai_analyzed
  AND mc.content_text IS NOT NULL
ORDER BY m.date_received DESC
LIMIT batch_size;
$$;

-- Maintenance functions
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- This would be implemented with actual cache tables if needed
    -- For now, return 0 as a placeholder
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_performance_logs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Cleanup old AI analysis records (keep last 30 days)
    DELETE FROM ai_analysis 
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND processing_status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default mailbox for each user (will be handled by application logic)
-- This would typically be done in application code after user signup

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- Key Changes from PostgreSQL to Supabase:
-- 1. Added UUID primary keys alongside legacy ROWID/SERIAL for compatibility
-- 2. Added user_id foreign keys to auth.users for multi-tenancy
-- 3. Enabled Row Level Security (RLS) for data isolation
-- 4. Enhanced indexes for better performance with user filtering
-- 5. Added triggers for automatic updated_at maintenance
-- 6. Created stored functions for cached queries and compatibility
-- 7. Added user_profiles table for extended user data
-- 8. Enhanced AI analysis tracking with cost/token usage
-- ============================================================================