-- Performance Optimization Migration
-- Based on ZEN Analysis findings and recommendations

BEGIN;

-- ============================================================================
-- PHASE 1: CRITICAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- 1. Composite index for message queries with sender and date
-- Optimizes queries filtering by sender and ordering by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_date 
ON messages(sender_address_id, date_received DESC)
WHERE sender_address_id IS NOT NULL;

-- 2. Composite index for subject and flags
-- Optimizes queries for unread messages by subject
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_subject_flags 
ON messages(subject_id, flags) 
WHERE read_flag = false OR flagged_flag = true;

-- 3. Conversation thread optimization
-- Optimizes conversation view queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_date 
ON messages(conversation_id, date_received DESC) 
WHERE conversation_id IS NOT NULL;

-- 4. AI processing queue optimization
-- Optimizes the get_unanalyzed_emails function
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_ai_processing_priority 
ON messages(ai_analyzed, flagged_flag, date_received) 
WHERE COALESCE(ai_analyzed, false) = false;

-- 5. Mailbox performance index
-- Optimizes mailbox-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_mailbox_date 
ON messages(mailbox_id, date_received DESC)
WHERE mailbox_id IS NOT NULL;

-- 6. Task performance indexes
-- Optimizes task dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_priority_date 
ON tasks(status, priority, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date_status 
ON tasks(due_date, status) 
WHERE due_date IS NOT NULL;

-- ============================================================================
-- PHASE 2: QUERY CACHING INFRASTRUCTURE
-- ============================================================================

-- Create cache table for database-level caching
CREATE TABLE IF NOT EXISTS query_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    content JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_query_cache_key_expires 
ON query_cache(cache_key, expires_at);

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM query_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 3: OPTIMIZED DATABASE FUNCTIONS
-- ============================================================================

-- Optimized AI processing stats with caching
CREATE OR REPLACE FUNCTION get_ai_processing_stats_cached()
RETURNS JSON AS $$
DECLARE
    stats JSON;
    cache_key TEXT := 'ai_stats_' || EXTRACT(EPOCH FROM date_trunc('minute', NOW()));
BEGIN
    -- Check cached stats
    SELECT content INTO stats 
    FROM query_cache 
    WHERE cache_key = cache_key AND expires_at > NOW();
    
    IF stats IS NOT NULL THEN
        RETURN stats;
    END IF;
    
    -- Calculate fresh stats
    SELECT json_build_object(
        'daily', json_build_object(
            'total_processed', COALESCE((
                SELECT COUNT(*) 
                FROM ai_analysis 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'total_cost', COALESCE((
                SELECT SUM(processing_time::float / 1000 * 0.0001) 
                FROM ai_analysis 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'avg_confidence', COALESCE((
                SELECT AVG(confidence) 
                FROM ai_analysis 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            ), 0),
            'total_batches', COALESCE((
                SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at)) 
                FROM ai_analysis 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            ), 0)
        ),
        'balance', 25.00, -- Default balance
        'unprocessed', get_unprocessed_email_count(),
        'isProcessing', (
            SELECT COUNT(*) > 0 
            FROM ai_analysis 
            WHERE created_at >= NOW() - INTERVAL '5 minutes'
        )
    ) INTO stats;
    
    -- Cache for 1 minute
    INSERT INTO query_cache (cache_key, content, expires_at) 
    VALUES (cache_key, stats, NOW() + INTERVAL '1 minute')
    ON CONFLICT (cache_key) DO UPDATE SET 
        content = EXCLUDED.content,
        expires_at = EXCLUDED.expires_at;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Optimized task category counts with caching
CREATE OR REPLACE FUNCTION get_task_category_counts_cached()
RETURNS JSON AS $$
DECLARE
    counts JSON;
    cache_key TEXT := 'task_counts_' || EXTRACT(EPOCH FROM date_trunc('5 minutes', NOW()));
BEGIN
    -- Check cached counts
    SELECT content INTO counts 
    FROM query_cache 
    WHERE cache_key = cache_key AND expires_at > NOW();
    
    IF counts IS NOT NULL THEN
        RETURN counts;
    END IF;
    
    -- Calculate fresh counts
    SELECT json_object_agg(
        COALESCE(classification, 'UNKNOWN'), 
        count
    ) INTO counts
    FROM (
        SELECT 
            classification,
            COUNT(*) as count 
        FROM tasks 
        WHERE status != 'completed'
        GROUP BY classification
    ) subquery;
    
    -- Cache for 5 minutes
    INSERT INTO query_cache (cache_key, content, expires_at) 
    VALUES (cache_key, counts, NOW() + INTERVAL '5 minutes')
    ON CONFLICT (cache_key) DO UPDATE SET 
        content = EXCLUDED.content,
        expires_at = EXCLUDED.expires_at;
    
    RETURN COALESCE(counts, '{}'::json);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 4: PERFORMANCE MONITORING
-- ============================================================================

-- Table for query performance monitoring
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_type VARCHAR(50),
    execution_time_ms INTEGER NOT NULL,
    rows_affected INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    query_sample TEXT
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_query_performance_time_type 
ON query_performance_log(executed_at, query_type, execution_time_ms);

-- Function to log slow queries
CREATE OR REPLACE FUNCTION log_slow_query(
    p_query_hash VARCHAR(64),
    p_query_type VARCHAR(50),
    p_execution_time INTEGER,
    p_rows_affected INTEGER DEFAULT NULL,
    p_query_sample TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Only log queries slower than 100ms
    IF p_execution_time > 100 THEN
        INSERT INTO query_performance_log (
            query_hash, 
            query_type, 
            execution_time_ms, 
            rows_affected,
            query_sample
        ) VALUES (
            p_query_hash, 
            p_query_type, 
            p_execution_time, 
            p_rows_affected,
            LEFT(p_query_sample, 500)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 5: MAINTENANCE AND CLEANUP
-- ============================================================================

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION get_query_performance_stats(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    query_type VARCHAR(50),
    avg_execution_time NUMERIC,
    max_execution_time INTEGER,
    query_count BIGINT,
    slow_query_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qpl.query_type,
        ROUND(AVG(qpl.execution_time_ms), 2) as avg_execution_time,
        MAX(qpl.execution_time_ms) as max_execution_time,
        COUNT(*) as query_count,
        COUNT(*) FILTER (WHERE qpl.execution_time_ms > 1000) as slow_query_count
    FROM query_performance_log qpl
    WHERE qpl.executed_at >= NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY qpl.query_type
    ORDER BY avg_execution_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old performance logs (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_performance_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM query_performance_log 
    WHERE executed_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 6: VACUUM AND ANALYZE OPTIMIZATION
-- ============================================================================

-- Update table statistics for query planner
ANALYZE messages;
ANALYZE tasks;
ANALYZE ai_analysis;
ANALYZE addresses;
ANALYZE subjects;

-- ============================================================================
-- FINAL VALIDATION
-- ============================================================================

-- Test new indexes are working
EXPLAIN (ANALYZE, BUFFERS) 
SELECT m.*, a.address, s.subject 
FROM messages m
LEFT JOIN addresses a ON m.sender_address_id = a.ROWID
LEFT JOIN subjects s ON m.subject_id = s.ROWID
WHERE m.sender_address_id = 1
ORDER BY m.date_received DESC
LIMIT 10;

-- Test cached functions
SELECT 'Testing cached AI stats...' as status;
SELECT get_ai_processing_stats_cached() as ai_stats_test;

SELECT 'Testing cached task counts...' as status;
SELECT get_task_category_counts_cached() as task_counts_test;

-- Test performance monitoring
SELECT 'Testing performance monitoring...' as status;
SELECT log_slow_query('test_hash', 'TEST', 1500, 100, 'SELECT * FROM test_table');

COMMIT;

-- Add comments for documentation
COMMENT ON INDEX idx_messages_sender_date IS 'Optimizes queries filtering by sender and ordering by date';
COMMENT ON INDEX idx_messages_conversation_date IS 'Optimizes conversation thread queries';
COMMENT ON INDEX idx_messages_ai_processing_priority IS 'Optimizes AI processing queue queries';
COMMENT ON TABLE query_cache IS 'Database-level caching for expensive queries';
COMMENT ON FUNCTION get_ai_processing_stats_cached IS 'Cached version of AI processing statistics';
COMMENT ON FUNCTION get_task_category_counts_cached IS 'Cached version of task category counts';
COMMENT ON TABLE query_performance_log IS 'Tracks query performance for optimization';