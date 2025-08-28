-- ===========================================
-- Apple MCP Email Task Manager
-- Supabase Initial Database Schema
-- ===========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- AUTHENTICATION & USER MANAGEMENT
-- ===========================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- User can read their own profile
CREATE POLICY "Users can read own profile" ON public.users 
FOR SELECT USING (auth.uid() = id);

-- User can update their own profile
CREATE POLICY "Users can update own profile" ON public.users 
FOR UPDATE USING (auth.uid() = id);

-- ===========================================
-- EMAIL MANAGEMENT SYSTEM
-- ===========================================

-- Email categories enum
CREATE TYPE email_category AS ENUM (
    'CREATE_TASK',
    'URGENT_RESPONSE', 
    'FYI_ONLY',
    'SPAM',
    'UNKNOWN'
);

-- Email processing status enum
CREATE TYPE processing_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'skipped'
);

-- Emails table
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    apple_mail_id VARCHAR(255) UNIQUE,
    
    -- Email metadata
    subject TEXT NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipient_email VARCHAR(255),
    message_id VARCHAR(500) UNIQUE,
    thread_id VARCHAR(255),
    
    -- Content
    body_text TEXT,
    body_html TEXT,
    body_preview TEXT,
    
    -- Classification & Processing
    category email_category DEFAULT 'UNKNOWN',
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    processing_status processing_status DEFAULT 'pending',
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    email_date TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Flags
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    
    -- Indexes for performance
    CONSTRAINT emails_priority_check CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT emails_confidence_check CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);

-- Enable RLS on emails table
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Users can only access their own emails
CREATE POLICY "Users can access own emails" ON public.emails 
USING (auth.uid() = user_id);

-- ===========================================
-- TASK MANAGEMENT
-- ===========================================

-- Task status enum
CREATE TYPE task_status AS ENUM (
    'pending',
    'in_progress', 
    'completed',
    'cancelled',
    'on_hold'
);

-- Task priority enum  
CREATE TYPE task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
    
    -- Task details
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    
    -- Classification
    status task_status DEFAULT 'pending',
    priority task_priority DEFAULT 'medium',
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Scheduling
    due_date TIMESTAMP WITH TIME ZONE,
    estimated_duration INTEGER, -- minutes
    actual_duration INTEGER, -- minutes
    
    -- Assignment
    assigned_to UUID REFERENCES public.users(id),
    created_by UUID REFERENCES public.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT tasks_duration_check CHECK (estimated_duration >= 0 AND actual_duration >= 0)
);

-- Enable RLS on tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Users can access tasks assigned to them or created by them
CREATE POLICY "Users can access own tasks" ON public.tasks 
USING (auth.uid() = user_id OR auth.uid() = assigned_to OR auth.uid() = created_by);

-- ===========================================
-- AI PROCESSING & ANALYTICS
-- ===========================================

-- AI processing logs
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES public.emails(id) ON DELETE CASCADE,
    
    -- Processing details
    model_used VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0.0000,
    
    -- Results
    classification_result JSONB,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Timestamps
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT ai_logs_tokens_check CHECK (prompt_tokens >= 0 AND completion_tokens >= 0 AND total_tokens >= 0),
    CONSTRAINT ai_logs_cost_check CHECK (cost >= 0.0)
);

-- Enable RLS on AI processing logs
ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;

-- Users can access their own AI processing logs
CREATE POLICY "Users can access own AI logs" ON public.ai_processing_logs 
USING (auth.uid() = user_id);

-- ===========================================
-- SYSTEM METRICS & MONITORING
-- ===========================================

-- System usage statistics
CREATE TABLE IF NOT EXISTS public.system_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE DEFAULT CURRENT_DATE,
    
    -- Email stats
    emails_processed INTEGER DEFAULT 0,
    emails_classified INTEGER DEFAULT 0,
    classification_accuracy DECIMAL(5,2) DEFAULT 0.0,
    
    -- AI usage stats
    total_ai_requests INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_ai_cost DECIMAL(10,4) DEFAULT 0.0000,
    
    -- Task stats
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    avg_task_completion_time INTEGER, -- minutes
    
    -- System performance
    avg_response_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    uptime_percentage DECIMAL(5,2) DEFAULT 100.0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date)
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Email indexes
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_category ON public.emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_processing_status ON public.emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_emails_date ON public.emails(email_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON public.emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_apple_mail_id ON public.emails(apple_mail_id);

-- Task indexes  
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_email_id ON public.tasks(email_id);

-- AI processing logs indexes
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_processing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_email_id ON public.ai_processing_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_processed_at ON public.ai_processing_logs(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON public.ai_processing_logs(model_used);

-- System stats indexes
CREATE INDEX IF NOT EXISTS idx_system_stats_date ON public.system_stats(date DESC);

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON public.emails 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_stats_updated_at BEFORE UPDATE ON public.system_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set completed_at when task status changes to completed
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_task_completed_at BEFORE UPDATE ON public.tasks 
    FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- Function to update email processing timestamp
CREATE OR REPLACE FUNCTION set_email_processed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.processing_status = 'completed' AND OLD.processing_status != 'completed' THEN
        NEW.processed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_email_processed_at BEFORE UPDATE ON public.emails 
    FOR EACH ROW EXECUTE FUNCTION set_email_processed_at();

-- ===========================================
-- DEFAULT DATA
-- ===========================================

-- Insert default user (will be replaced with actual Supabase auth)
INSERT INTO public.users (id, email, name, display_name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'admin@apple-mcp.local',
    'Admin User', 
    'System Administrator',
    'admin'
) ON CONFLICT (id) DO NOTHING;

-- Insert sample system stats entry
INSERT INTO public.system_stats (date) 
VALUES (CURRENT_DATE) 
ON CONFLICT (date) DO NOTHING;

-- ===========================================
-- VIEWS FOR COMMON QUERIES
-- ===========================================

-- Email dashboard view
CREATE OR REPLACE VIEW public.email_dashboard AS
SELECT 
    e.id,
    e.subject,
    e.sender_email,
    e.sender_name,
    e.category,
    e.priority,
    e.processing_status,
    e.email_date,
    e.created_at,
    t.id as task_id,
    t.status as task_status,
    t.title as task_title
FROM public.emails e
LEFT JOIN public.tasks t ON e.id = t.email_id
WHERE e.is_deleted = false;

-- Task summary view
CREATE OR REPLACE VIEW public.task_summary AS
SELECT 
    user_id,
    status,
    COUNT(*) as count,
    AVG(actual_duration) as avg_duration
FROM public.tasks 
GROUP BY user_id, status;

-- Daily AI usage view
CREATE OR REPLACE VIEW public.daily_ai_usage AS
SELECT 
    DATE(processed_at) as date,
    COUNT(*) as requests,
    SUM(total_tokens) as total_tokens,
    SUM(cost) as total_cost,
    AVG(processing_time_ms) as avg_processing_time
FROM public.ai_processing_logs 
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

-- Grant appropriate permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read access to anonymous for health checks
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.system_stats TO anon;

COMMENT ON SCHEMA public IS 'Apple MCP Email Task Manager - Main application schema';