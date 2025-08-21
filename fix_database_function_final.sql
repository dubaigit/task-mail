-- Fix the get_unanalyzed_emails function with correct column names
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
    LEFT JOIN addresses a ON m.sender_address_id = a.ROWID
    LEFT JOIN subjects s ON m.subject_id = s.ROWID
    WHERE COALESCE(m.ai_analyzed, false) = FALSE 
    AND COALESCE(m.ai_analysis_attempts, 0) < 3
    AND COALESCE(m.deleted, 0) = 0
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

COMMENT ON FUNCTION get_unanalyzed_emails IS 'Gets emails needing AI analysis with priority ordering - FULLY CORRECTED for all column names';