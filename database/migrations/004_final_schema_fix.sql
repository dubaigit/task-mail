-- Final Schema Fix Migration
-- Uses actual column names from the messages table structure

-- 1. Drop and recreate with CORRECT column names
DROP FUNCTION IF EXISTS get_unanalyzed_emails(INTEGER);

CREATE OR REPLACE FUNCTION get_unanalyzed_emails(batch_size INTEGER DEFAULT 10)
RETURNS TABLE(
    rowid BIGINT,
    sender_address TEXT,
    subject_text TEXT,
    date_received TIMESTAMP,
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
            WHEN m.flagged_flag = true THEN 1
            WHEN m.read_flag = false THEN 2
            ELSE 5
        END as priority
    FROM messages m
    LEFT JOIN addresses a ON m.sender_address_id = a.ROWID  -- ACTUAL column name
    LEFT JOIN subjects s ON m.subject_id = s.ROWID         -- ACTUAL column name
    WHERE COALESCE(m.ai_analyzed, false) = FALSE 
    AND COALESCE(m.ai_analysis_attempts, 0) < 3
    -- No deleted column exists, so we remove this condition
    ORDER BY 
        CASE 
            WHEN m.flagged_flag = true THEN 1
            WHEN m.read_flag = false THEN 2
            ELSE 5
        END ASC,
        m.date_received DESC NULLS LAST
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix the unprocessed email count function
CREATE OR REPLACE FUNCTION get_unprocessed_email_count()
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM messages 
    WHERE COALESCE(ai_analyzed, false) = false 
    AND COALESCE(ai_analysis_attempts, 0) < 3;
    -- No deleted column exists
    
    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql;

-- 3. Update the get_ai_processing_stats function with correct logic
CREATE OR REPLACE FUNCTION get_ai_processing_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'daily', json_build_object(
            'total_processed', COALESCE((
                SELECT COUNT(*) 
                FROM ai_usage_tracking 
                WHERE processed_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'total_cost', COALESCE((
                SELECT SUM(cost_usd) 
                FROM ai_usage_tracking 
                WHERE processed_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'avg_cost_per_email', COALESCE((
                SELECT AVG(cost_usd) 
                FROM ai_usage_tracking 
                WHERE processed_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'total_batches', COALESCE((
                SELECT COUNT(DISTINCT batch_id) 
                FROM ai_usage_tracking 
                WHERE processed_at >= NOW() - INTERVAL '24 hours'
            ), 0)
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

-- 4. Create proper index
CREATE INDEX IF NOT EXISTS idx_messages_ai_processing ON messages(ai_analyzed, ai_analysis_attempts) 
WHERE COALESCE(ai_analyzed, false) = false AND COALESCE(ai_analysis_attempts, 0) < 3;

-- 5. Test functions
SELECT 'Testing get_unanalyzed_emails function...' as status;
SELECT COUNT(*) as test_count FROM get_unanalyzed_emails(5);

SELECT 'Testing get_unprocessed_email_count function...' as status;
SELECT get_unprocessed_email_count() as unprocessed_count;

SELECT 'Testing get_ai_processing_stats function...' as status;
SELECT get_ai_processing_stats() as processing_stats;

COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis - FINAL CORRECTED VERSION';
COMMENT ON FUNCTION get_unprocessed_email_count IS 'Counts unprocessed emails - FINAL CORRECTED VERSION';
COMMENT ON FUNCTION get_ai_processing_stats IS 'Returns processing stats as JSON - FINAL CORRECTED VERSION';