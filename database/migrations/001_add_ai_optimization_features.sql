-- AI Optimization Features Migration
-- Adds ai_analyzed tracking, cost monitoring, and batch processing support

-- 1. Add ai_analyzed tracking to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_analysis_attempts INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_analysis_last_attempt TIMESTAMP;

-- 2. Add cost tracking and usage analytics table
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
    id SERIAL PRIMARY KEY,
    email_id BIGINT REFERENCES messages(ROWID) ON DELETE CASCADE,
    batch_id UUID DEFAULT gen_random_uuid(),
    model_used VARCHAR(50) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10,6) NOT NULL,
    batch_size INTEGER DEFAULT 1,
    processing_time_ms INTEGER,
    api_response_time_ms INTEGER,
    processed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(email_id)
);

-- 3. Add OpenAI balance monitoring table
CREATE TABLE IF NOT EXISTS ai_balance_tracking (
    id SERIAL PRIMARY KEY,
    balance_usd DECIMAL(10,2),
    total_usage_usd DECIMAL(10,2),
    hard_limit_usd DECIMAL(10,2),
    soft_limit_usd DECIMAL(10,2),
    plan_type VARCHAR(50),
    organization_id VARCHAR(100),
    checked_at TIMESTAMP DEFAULT NOW()
);

-- 4. Add processing queue for background job management
CREATE TABLE IF NOT EXISTS ai_processing_queue (
    id SERIAL PRIMARY KEY,
    email_id BIGINT REFERENCES messages(ROWID) ON DELETE CASCADE,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(email_id)
);

-- 5. Add batch processing logs
CREATE TABLE IF NOT EXISTS ai_batch_processing (
    id SERIAL PRIMARY KEY,
    batch_id UUID DEFAULT gen_random_uuid(),
    email_ids BIGINT[] NOT NULL,
    batch_size INTEGER NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    total_tokens INTEGER,
    total_cost_usd DECIMAL(10,6),
    processing_time_ms INTEGER,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_details JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 6. Add cost analytics view for easy querying
CREATE OR REPLACE VIEW ai_cost_analytics AS
SELECT 
    DATE_TRUNC('day', processed_at) as date,
    COUNT(*) as emails_processed,
    SUM(cost_usd) as total_cost,
    AVG(cost_usd) as avg_cost_per_email,
    SUM(total_tokens) as total_tokens,
    AVG(total_tokens) as avg_tokens_per_email,
    COUNT(DISTINCT batch_id) as batch_count,
    AVG(batch_size) as avg_batch_size
FROM ai_usage_tracking 
GROUP BY DATE_TRUNC('day', processed_at)
ORDER BY date DESC;

-- 7. Add monthly cost summary view
CREATE OR REPLACE VIEW ai_monthly_costs AS
SELECT 
    DATE_TRUNC('month', processed_at) as month,
    COUNT(*) as emails_processed,
    SUM(cost_usd) as total_cost,
    AVG(cost_usd) as avg_cost_per_email,
    MIN(cost_usd) as min_cost_per_email,
    MAX(cost_usd) as max_cost_per_email,
    SUM(total_tokens) as total_tokens
FROM ai_usage_tracking 
GROUP BY DATE_TRUNC('month', processed_at)
ORDER BY month DESC;

-- 8. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_messages_ai_analyzed ON messages(ai_analyzed);
CREATE INDEX IF NOT EXISTS idx_messages_ai_attempts ON messages(ai_analysis_attempts);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_processed_at ON ai_usage_tracking(processed_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_batch_id ON ai_usage_tracking(batch_id);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_status ON ai_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_priority ON ai_processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_created_at ON ai_processing_queue(created_at);

-- 9. Add functions for cost calculations
CREATE OR REPLACE FUNCTION calculate_gpt5_cost(prompt_tokens INTEGER, completion_tokens INTEGER, model_name VARCHAR)
RETURNS DECIMAL(10,6) AS $$
BEGIN
    -- GPT-5 pricing (as of implementation)
    IF model_name = 'gpt-5' THEN
        RETURN (prompt_tokens * 0.00001) + (completion_tokens * 0.00003);
    ELSIF model_name = 'gpt-5-mini' THEN
        RETURN (prompt_tokens * 0.000001) + (completion_tokens * 0.000004);
    ELSIF model_name = 'gpt-5-nano' THEN
        RETURN (prompt_tokens * 0.0000005) + (completion_tokens * 0.000002);
    ELSE
        -- Default pricing for unknown models
        RETURN (prompt_tokens * 0.00001) + (completion_tokens * 0.00003);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Add trigger to auto-calculate costs
CREATE OR REPLACE FUNCTION auto_calculate_cost()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cost_usd = calculate_gpt5_cost(NEW.prompt_tokens, NEW.completion_tokens, NEW.model_used);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_calculate_cost
    BEFORE INSERT OR UPDATE ON ai_usage_tracking
    FOR EACH ROW EXECUTE FUNCTION auto_calculate_cost();

-- 11. Add function to get unanalyzed emails for background processing
CREATE OR REPLACE FUNCTION get_unanalyzed_emails(batch_size INTEGER DEFAULT 10)
RETURNS TABLE(
    rowid BIGINT,
    sender_address TEXT,
    subject_text TEXT,
    date_received BIGINT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.ROWID,
        a.address as sender_address,
        s.subject as subject_text,
        m.date_received,
        CASE 
            WHEN m.flagged = 1 THEN 1
            WHEN m.read = 0 THEN 2
            ELSE 5
        END as priority
    FROM messages m
    LEFT JOIN addresses a ON m.sender_address_id = a.ROWID
    LEFT JOIN subjects s ON m.subject_id = s.ROWID
    WHERE m.ai_analyzed = FALSE 
    AND (m.ai_analysis_attempts < 3 OR m.ai_analysis_attempts IS NULL)
    AND m.deleted = 0
    ORDER BY 
        CASE 
            WHEN m.flagged = 1 THEN 1
            WHEN m.read = 0 THEN 2
            ELSE 5
        END ASC,
        m.date_received DESC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 12. Add function to mark emails as analyzed
CREATE OR REPLACE FUNCTION mark_email_analyzed(email_rowid BIGINT, success BOOLEAN DEFAULT TRUE)
RETURNS VOID AS $$
BEGIN
    UPDATE messages 
    SET 
        ai_analyzed = success,
        ai_analysis_attempts = COALESCE(ai_analysis_attempts, 0) + 1,
        ai_analysis_last_attempt = NOW()
    WHERE ROWID = email_rowid;
END;
$$ LANGUAGE plpgsql;

-- 13. Add sample data for testing (if no real data exists)
INSERT INTO ai_balance_tracking (balance_usd, total_usage_usd, hard_limit_usd, plan_type, organization_id)
VALUES (47.32, 152.68, 200.00, 'pay-as-you-go', 'org-sample123')
ON CONFLICT DO NOTHING;

-- 14. Create materialized view for real-time dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_dashboard_metrics AS
SELECT 
    -- Today's stats
    COUNT(CASE WHEN DATE(processed_at) = CURRENT_DATE THEN 1 END) as emails_today,
    SUM(CASE WHEN DATE(processed_at) = CURRENT_DATE THEN cost_usd ELSE 0 END) as cost_today,
    
    -- This month's stats
    COUNT(CASE WHEN DATE_TRUNC('month', processed_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as emails_month,
    SUM(CASE WHEN DATE_TRUNC('month', processed_at) = DATE_TRUNC('month', CURRENT_DATE) THEN cost_usd ELSE 0 END) as cost_month,
    
    -- Overall stats
    COUNT(*) as total_emails,
    SUM(cost_usd) as total_cost,
    AVG(cost_usd) as avg_cost_per_email,
    
    -- Performance stats
    AVG(processing_time_ms) as avg_processing_time,
    AVG(batch_size) as avg_batch_size,
    
    -- Pending analysis
    (SELECT COUNT(*) FROM messages WHERE ai_analyzed = FALSE AND deleted = 0) as pending_analysis
    
FROM ai_usage_tracking;

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_ai_dashboard_metrics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW ai_dashboard_metrics;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE ai_usage_tracking IS 'Tracks AI API usage, costs, and performance metrics per email';
COMMENT ON TABLE ai_balance_tracking IS 'Monitors OpenAI account balance and usage limits';
COMMENT ON TABLE ai_processing_queue IS 'Queue for background AI processing with retry logic';
COMMENT ON TABLE ai_batch_processing IS 'Logs batch processing operations and performance';
COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis with priority ordering';
COMMENT ON FUNCTION mark_email_analyzed IS 'Marks an email as processed by AI analysis';
COMMENT ON FUNCTION calculate_gpt5_cost IS 'Calculates cost for GPT-5 model usage based on tokens';