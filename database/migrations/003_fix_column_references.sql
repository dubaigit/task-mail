-- Fix Column References Migration
-- Corrects the get_unanalyzed_emails function to use actual column names

-- 1. Drop and recreate the function with correct column references
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
    LEFT JOIN addresses a ON m.sender = a.ROWID  -- Correct: sender, not sender_address_id
    LEFT JOIN subjects s ON m.subject = s.ROWID  -- Correct: subject, not subject_id
    WHERE COALESCE(m.ai_analyzed, false) = FALSE 
    AND COALESCE(m.ai_analysis_attempts, 0) < 3
    AND m.deleted = 0  -- Correct: deleted is INTEGER (0 = not deleted, 1 = deleted)
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

-- 2. Fix the unprocessed email count function
CREATE OR REPLACE FUNCTION get_unprocessed_email_count()
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM messages 
    WHERE COALESCE(ai_analyzed, false) = false 
    AND COALESCE(ai_analysis_attempts, 0) < 3
    AND deleted = 0;  -- Use integer comparison
    
    RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql;

-- 3. Update the index to use correct syntax
DROP INDEX IF EXISTS idx_messages_ai_analyzed_deleted;
CREATE INDEX idx_messages_ai_analyzed_deleted ON messages(ai_analyzed, deleted) 
WHERE COALESCE(ai_analyzed, false) = false AND deleted = 0;

-- 4. Test the function works
SELECT 'Testing get_unanalyzed_emails function...' as status;
SELECT COUNT(*) as test_count FROM get_unanalyzed_emails(5);

-- 5. Test the count function
SELECT 'Testing get_unprocessed_email_count function...' as status;
SELECT get_unprocessed_email_count() as unprocessed_count;

COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis - CORRECTED column references';
COMMENT ON FUNCTION get_unprocessed_email_count IS 'Counts unprocessed emails - CORRECTED column references';