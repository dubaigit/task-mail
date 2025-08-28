-- ==========================================================================
-- Enhanced Supabase Schema with RLS and Performance Optimization
-- Phase 2 Database Consolidation - Single Source of Truth
-- ==========================================================================

-- ==========================================================================
-- CORE USER MANAGEMENT
-- ==========================================================================

-- Profiles table with enhanced metadata
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'light',
    
    -- Preferences
    email_notifications BOOLEAN DEFAULT true,
    desktop_notifications BOOLEAN DEFAULT true,
    ai_features_enabled BOOLEAN DEFAULT true,
    task_auto_creation BOOLEAN DEFAULT true,
    
    -- Metadata
    last_seen_at TIMESTAMPTZ,
    onboarded_at TIMESTAMPTZ,
    subscription_tier TEXT DEFAULT 'free',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('free', 'pro', 'enterprise'))
);

-- ==========================================================================
-- EMAIL MANAGEMENT
-- ==========================================================================

-- Enhanced emails table with full-text search and metadata
CREATE TABLE IF NOT EXISTS emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Apple Mail Integration
    apple_mail_id BIGINT UNIQUE, -- Apple Mail's internal ID
    mailbox_id TEXT, -- Apple Mail mailbox identifier
    conversation_id BIGINT, -- For threading
    
    -- Email Headers
    message_id TEXT UNIQUE NOT NULL, -- RFC 2822 Message-ID
    subject TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_name TEXT,
    recipients TEXT[] DEFAULT '{}',
    cc TEXT[] DEFAULT '{}',
    bcc TEXT[] DEFAULT '{}',
    reply_to TEXT,
    
    -- Content
    content_text TEXT,
    content_html TEXT,
    content_snippet TEXT, -- First 200 chars for previews
    
    -- Classification & AI
    ai_classification JSONB DEFAULT '{}',
    ai_summary TEXT,
    ai_sentiment REAL, -- -1.0 to 1.0
    ai_priority_score REAL DEFAULT 0.5, -- 0.0 to 1.0
    ai_actionable BOOLEAN DEFAULT false,
    ai_tags TEXT[] DEFAULT '{}',
    
    -- Email Status
    folder TEXT DEFAULT 'INBOX',
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    is_spam BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Timestamps
    date_received TIMESTAMPTZ NOT NULL,
    date_sent TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Performance indexes
    CONSTRAINT emails_user_id_date_idx UNIQUE (user_id, date_received, id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON emails (user_id, folder, date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_user_status ON emails (user_id, is_read, is_flagged, date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails (conversation_id, date_received ASC);
CREATE INDEX IF NOT EXISTS idx_emails_apple_mail_id ON emails (apple_mail_id) WHERE apple_mail_id IS NOT NULL;

-- ==========================================================================
-- TASK MANAGEMENT
-- ==========================================================================

-- Enhanced tasks table with dependencies and time tracking
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- Task Details
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    
    -- Classification
    status TEXT DEFAULT 'pending' NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Assignment & Collaboration
    assignee TEXT, -- Email or username
    assignee_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    collaborators TEXT[] DEFAULT '{}',
    
    -- Time Management
    estimated_hours REAL,
    actual_hours REAL DEFAULT 0,
    due_date TIMESTAMPTZ,
    reminder_at TIMESTAMPTZ,
    
    -- AI Enhancement
    ai_generated BOOLEAN DEFAULT false,
    ai_context JSONB DEFAULT '{}',
    ai_suggested_priority TEXT,
    ai_estimated_time REAL,
    
    -- Progress Tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived')),
    CONSTRAINT valid_priority CHECK (priority IN ('urgent', 'high', 'medium', 'low'))
);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_user_id, status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_email ON tasks (email_id) WHERE email_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;

-- ==========================================================================
-- CATEGORIES & ORGANIZATION
-- ==========================================================================

-- Enhanced categories with hierarchy
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT,
    
    -- Organization
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false, -- For built-in categories
    
    -- Settings
    auto_assign_rules JSONB DEFAULT '{}', -- Rules for auto-categorization
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE (user_id, name, parent_category_id)
);

-- Category indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_sort ON categories (user_id, sort_order, name);

-- ==========================================================================
-- SYSTEM TABLES
-- ==========================================================================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    sync_direction TEXT DEFAULT 'bidirectional', -- 'up', 'down', 'bidirectional'
    records_synced INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    last_error TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE (table_name)
);

-- ==========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================================

-- Enable RLS on all user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Emails policies
CREATE POLICY "Users can view their own emails" ON emails FOR SELECT USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their own emails" ON emails FOR INSERT WITH CHECK (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their own emails" ON emails FOR UPDATE USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete their own emails" ON emails FOR DELETE USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Tasks policies
CREATE POLICY "Users can view their own tasks" ON tasks FOR SELECT USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()) OR assignee_user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their own tasks" ON tasks FOR INSERT WITH CHECK (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their assigned tasks" ON tasks FOR UPDATE USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()) OR assignee_user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete their own tasks" ON tasks FOR DELETE USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Categories policies
CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- ==========================================================================
-- INITIAL SYSTEM DATA
-- ==========================================================================

-- Insert default system settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
    ('app_version', '"2.0.0"', 'Current application version', true),
    ('maintenance_mode', 'false', 'Enable maintenance mode', false),
    ('ai_features_enabled', 'true', 'Global AI features toggle', true),
    ('max_emails_per_sync', '1000', 'Maximum emails to sync in one batch', false),
    ('sync_interval_seconds', '300', 'Email sync interval', false),
    ('task_auto_creation', 'true', 'Enable automatic task creation from emails', true),
    ('supported_languages', '["en", "es", "fr", "de", "zh"]', 'Supported UI languages', true)
ON CONFLICT (key) DO NOTHING;