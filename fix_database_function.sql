-- Fix the get_unanalyzed_emails function to use correct column names
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

COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis with priority ordering - FIXED for correct column names';