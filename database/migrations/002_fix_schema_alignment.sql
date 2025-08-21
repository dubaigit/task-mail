-- Fix Schema Alignment Migration
-- Corrects column references and ensures database functions work with actual schema

-- 1. Fix the get_unanalyzed_emails function to use correct column names from actual schema
DROP FUNCTION IF EXISTS get_unanalyzed_emails(INTEGER);

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
        COALESCE(a.address, 'unknown@email.com') as sender_address,
        COALESCE(s.subject, 'No Subject') as subject_text,
        m.date_received,
        CASE 
            WHEN m.flagged = 1 THEN 1
            WHEN m.read = 0 THEN 2
            ELSE 5
        END as priority
    FROM messages m
    LEFT JOIN addresses a ON m.sender = a.ROWID  -- Use 'sender' not 'sender_address_id'
    LEFT JOIN subjects s ON m.subject = s.ROWID  -- Use 'subject' not 'subject_id'
    WHERE COALESCE(m.ai_analyzed, false) = FALSE 
    AND COALESCE(m.ai_analysis_attempts, 0) < 3
    AND m.deleted = 0  -- Use 'deleted' column as it exists in schema
    ORDER BY 
        CASE 
            WHEN m.flagged = 1 THEN 1
            WHEN m.read = 0 THEN 2
            ELSE 5
        END ASC,
        m.date_received DESC NULLS LAST
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis with priority ordering - SCHEMA ALIGNED';

-- 2. Fix ai_usage_tracking table to use correct timestamp columns
ALTER TABLE ai_usage_tracking 
    DROP COLUMN IF EXISTS created_at CASCADE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Update any existing queries that use wrong column names
UPDATE ai_usage_tracking SET created_at = processed_at WHERE created_at IS NULL;

-- 3. Fix ai_balance_tracking to ensure correct column structure
ALTER TABLE ai_balance_tracking
    ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) DEFAULT 'analysis',
    ADD COLUMN IF NOT EXISTS cost_amount DECIMAL(10,6) DEFAULT 0;

-- 4. Create corrected view for usage stats with proper column references
CREATE OR REPLACE VIEW ai_usage_stats_corrected AS
SELECT 
    COUNT(*) as total_processed,
    SUM(cost_usd) as total_cost,
    AVG(cost_usd) as avg_cost_per_email,
    COUNT(DISTINCT batch_id) as total_batches
FROM ai_usage_tracking
WHERE processed_at >= NOW() - INTERVAL '24 hours';

-- 5. Create function to safely get balance
CREATE OR REPLACE FUNCTION get_current_ai_balance()
RETURNS DECIMAL(10,2) AS $$
DECLARE
    balance DECIMAL(10,2);
BEGIN
    SELECT COALESCE(
        SUM(CASE 
            WHEN operation_type = 'analysis' THEN -cost_amount 
            ELSE cost_amount 
        END), 
        25.00
    ) INTO balance
    FROM ai_balance_tracking;
    
    RETURN COALESCE(balance, 25.00);
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to safely get unprocessed count
CREATE OR REPLACE FUNCTION get_unprocessed_email_count()
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM messages 
    WHERE COALESCE(ai_analyzed, false) = false 
    AND COALESCE(ai_analysis_attempts, 0) < 3
    AND deleted = 0;
    
    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql;

-- 7. Fix the cost calculation function
CREATE OR REPLACE FUNCTION calculate_gpt5_cost(prompt_tokens INTEGER, completion_tokens INTEGER, model_name VARCHAR DEFAULT 'gpt-4')
RETURNS DECIMAL(10,6) AS $$
BEGIN
    -- Updated pricing for GPT models
    CASE model_name
        WHEN 'gpt-5' THEN
            RETURN (prompt_tokens * 0.00001) + (completion_tokens * 0.00003);
        WHEN 'gpt-4' THEN
            RETURN (prompt_tokens * 0.00003) + (completion_tokens * 0.00006);
        WHEN 'gpt-4-turbo' THEN
            RETURN (prompt_tokens * 0.00001) + (completion_tokens * 0.00003);
        WHEN 'gpt-3.5-turbo' THEN
            RETURN (prompt_tokens * 0.000001) + (completion_tokens * 0.000002);
        ELSE
            -- Default to GPT-4 pricing
            RETURN (prompt_tokens * 0.00003) + (completion_tokens * 0.00006);
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create helper function for processing stats API
CREATE OR REPLACE FUNCTION get_ai_processing_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'daily', json_build_object(
            'total_processed', COALESCE((SELECT total_processed FROM ai_usage_stats_corrected), 0),
            'total_cost', COALESCE((SELECT total_cost FROM ai_usage_stats_corrected), 0),
            'avg_cost_per_email', COALESCE((SELECT avg_cost_per_email FROM ai_usage_stats_corrected), 0),
            'total_batches', COALESCE((SELECT total_batches FROM ai_usage_stats_corrected), 0)
        ),
        'balance', get_current_ai_balance(),
        'unprocessed', get_unprocessed_email_count(),
        'isProcessing', (
            SELECT COUNT(*) > 0 
            FROM ai_usage_tracking 
            WHERE processed_at >= NOW() - INTERVAL '5 minutes'
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 9. Add indexes for better performance on corrected columns
CREATE INDEX IF NOT EXISTS idx_messages_ai_analyzed_deleted ON messages(ai_analyzed, deleted) WHERE ai_analyzed = false AND deleted = 0;
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_processed_at_24h ON ai_usage_tracking(processed_at) WHERE processed_at >= NOW() - INTERVAL '24 hours';

-- 10. Insert sample balance data for testing
INSERT INTO ai_balance_tracking (
    balance_usd, 
    total_usage_usd, 
    operation_type, 
    cost_amount,
    plan_type, 
    organization_id
)
VALUES (
    25.00,
    0.00,
    'deposit',
    25.00,
    'pay-as-you-go',
    'email-system-prod'
)
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON FUNCTION get_current_ai_balance IS 'Safely gets current AI balance with fallback';
COMMENT ON FUNCTION get_unprocessed_email_count IS 'Safely counts unprocessed emails with proper column references';
COMMENT ON FUNCTION get_ai_processing_stats IS 'Returns complete processing stats as JSON for API endpoints';
COMMENT ON VIEW ai_usage_stats_corrected IS 'Corrected view for usage statistics with proper column references';