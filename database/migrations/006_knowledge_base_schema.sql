-- Apple MCP Knowledge Base Schema
-- Migration 006: Knowledge Base Tables and Indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Sources table for content source management
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('documentation', 'github', 'api-docs', 'blog', 'forum')),
    crawl_frequency INTERVAL DEFAULT '1 day',
    last_crawled TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    authority_weight FLOAT DEFAULT 1.0 CHECK (authority_weight >= 0 AND authority_weight <= 10),
    crawl_config JSONB DEFAULT '{}',
    statistics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table for storing processed content
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT UNIQUE,
    content_type VARCHAR(50) DEFAULT 'documentation',
    content_hash VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5) DEFAULT 2,
    authority_score FLOAT DEFAULT 0.0 CHECK (authority_score >= 0 AND authority_score <= 100),
    word_count INTEGER DEFAULT 0,
    reading_time INTEGER DEFAULT 0, -- in minutes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_crawled TIMESTAMP DEFAULT NOW()
);

-- Document embeddings for vector search
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER DEFAULT 0,
    content_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-large dimensions
    chunk_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crawl jobs tracking
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    documents_processed INTEGER DEFAULT 0,
    documents_updated INTEGER DEFAULT 0,
    documents_new INTEGER DEFAULT 0,
    documents_deleted INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_log JSONB DEFAULT '[]',
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tags for content categorization
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- 'technology', 'difficulty', 'type', 'domain'
    description TEXT,
    color VARCHAR(7), -- Hex color for UI
    weight INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Document-tag associations
CREATE TABLE IF NOT EXISTS document_tags (
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('auto', 'manual', 'community', 'ai')),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (document_id, tag_id)
);

-- API keys for authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the actual key
    name VARCHAR(255),
    permissions TEXT[] DEFAULT '{"read"}',
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Search analytics for tracking usage
CREATE TABLE IF NOT EXISTS search_analytics (
    id SERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64), -- Hash for deduplication
    user_id VARCHAR(255),
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    clicked_results INTEGER[] DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User feedback and ratings
CREATE TABLE IF NOT EXISTS document_feedback (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_type VARCHAR(20) CHECK (feedback_type IN ('helpful', 'not_helpful', 'outdated', 'incorrect', 'spam')),
    comment TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Content change snapshots for incremental crawling
CREATE TABLE IF NOT EXISTS content_snapshots (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    last_modified TIMESTAMP,
    crawl_timestamp TIMESTAMP DEFAULT NOW(),
    change_type VARCHAR(20) CHECK (change_type IN ('new', 'modified', 'deleted', 'unchanged')),
    size_bytes INTEGER,
    INDEX (url, content_hash)
);

-- Performance and optimization indexes

-- Documents indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_source_type 
ON documents(source_id, content_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_updated_at 
ON documents(updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_difficulty 
ON documents(difficulty_level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_authority 
ON documents(authority_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_url_hash 
ON documents(url) WHERE url IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_content_hash 
ON documents(content_hash) WHERE content_hash IS NOT NULL;

-- Full-text search index on documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_fts 
ON documents USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));

-- Metadata indexes for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_metadata_gin 
ON documents USING gin(metadata);

-- Technology-specific index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_technology 
ON documents USING gin((metadata->>'technology') gin_trgm_ops) 
WHERE metadata->>'technology' IS NOT NULL;

-- Vector similarity index with optimized parameters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_vector 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 1000);

-- Document embeddings compound index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_document_chunk 
ON document_embeddings(document_id, chunk_index);

-- Crawl jobs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crawl_jobs_status_created 
ON crawl_jobs(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crawl_jobs_source_started 
ON crawl_jobs(source_id, started_at DESC);

-- Tags indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_category_name 
ON tags(category, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tags_confidence 
ON document_tags(tag_id, confidence DESC);

-- API keys indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_user_active 
ON api_keys(user_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_expires 
ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Search analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_created 
ON search_analytics(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_query_hash 
ON search_analytics(query_hash, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_user_session 
ON search_analytics(user_id, session_id, created_at DESC);

-- Content snapshots indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_snapshots_url_modified 
ON content_snapshots(url, last_modified DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_snapshots_hash_timestamp 
ON content_snapshots(content_hash, crawl_timestamp DESC);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_source_authority_updated 
ON documents(source_id, authority_score DESC, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_difficulty_type_authority 
ON documents(difficulty_level, content_type, authority_score DESC);

-- Partial indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_recent_high_authority 
ON documents(updated_at DESC, authority_score DESC) 
WHERE updated_at > NOW() - INTERVAL '30 days' AND authority_score > 70;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sources_last_crawled 
ON sources(last_crawled DESC) WHERE is_active = true;

-- Functions and triggers for automatic updates

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at 
    BEFORE UPDATE ON sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate document word count
CREATE OR REPLACE FUNCTION calculate_word_count(content_text TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF content_text IS NULL OR content_text = '' THEN
        RETURN 0;
    END IF;
    
    RETURN array_length(string_to_array(regexp_replace(content_text, '\s+', ' ', 'g'), ' '), 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to estimate reading time (200 words per minute)
CREATE OR REPLACE FUNCTION calculate_reading_time(word_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF word_count IS NULL OR word_count <= 0 THEN
        RETURN 0;
    END IF;
    
    RETURN GREATEST(1, ROUND(word_count::FLOAT / 200));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically update word count and reading time
CREATE OR REPLACE FUNCTION update_document_metrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = calculate_word_count(NEW.content);
    NEW.reading_time = calculate_reading_time(NEW.word_count);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_metrics_trigger ON documents;
CREATE TRIGGER update_document_metrics_trigger
    BEFORE INSERT OR UPDATE OF content ON documents
    FOR EACH ROW EXECUTE FUNCTION update_document_metrics();

-- Function for semantic search with filters
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20,
    source_filter TEXT[] DEFAULT NULL,
    difficulty_filter INTEGER[] DEFAULT NULL,
    content_type_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    document_id INTEGER,
    title TEXT,
    url TEXT,
    content_snippet TEXT,
    similarity_score FLOAT,
    source_name TEXT,
    content_type TEXT,
    difficulty_level INTEGER,
    authority_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.url,
        LEFT(de.content_text, 300) as content_snippet,
        (1 - (de.embedding <=> query_embedding))::FLOAT as similarity_score,
        s.name as source_name,
        d.content_type,
        d.difficulty_level,
        d.authority_score
    FROM document_embeddings de
    JOIN documents d ON de.document_id = d.id
    JOIN sources s ON d.source_id = s.id
    WHERE 
        (1 - (de.embedding <=> query_embedding)) > similarity_threshold
        AND (source_filter IS NULL OR s.name = ANY(source_filter))
        AND (difficulty_filter IS NULL OR d.difficulty_level = ANY(difficulty_filter))
        AND (content_type_filter IS NULL OR d.content_type = ANY(content_type_filter))
        AND s.is_active = true
    ORDER BY de.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function for hybrid search (semantic + keyword)
CREATE OR REPLACE FUNCTION hybrid_search(
    search_query TEXT,
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    document_id INTEGER,
    title TEXT,
    url TEXT,
    content_snippet TEXT,
    combined_score FLOAT,
    semantic_score FLOAT,
    keyword_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        SELECT 
            d.id,
            d.title,
            d.url,
            LEFT(de.content_text, 300) as snippet,
            (1 - (de.embedding <=> query_embedding))::FLOAT as sem_score
        FROM document_embeddings de
        JOIN documents d ON de.document_id = d.id
        JOIN sources s ON d.source_id = s.id
        WHERE 
            (1 - (de.embedding <=> query_embedding)) > similarity_threshold
            AND s.is_active = true
    ),
    keyword_results AS (
        SELECT 
            d.id,
            d.title,
            d.url,
            LEFT(d.content, 300) as snippet,
            ts_rank(
                to_tsvector('english', d.title || ' ' || COALESCE(d.content, '')),
                plainto_tsquery('english', search_query)
            ) as kw_score
        FROM documents d
        JOIN sources s ON d.source_id = s.id
        WHERE 
            to_tsvector('english', d.title || ' ' || COALESCE(d.content, '')) @@ plainto_tsquery('english', search_query)
            AND s.is_active = true
    )
    SELECT 
        COALESCE(sr.id, kr.id) as document_id,
        COALESCE(sr.title, kr.title) as title,
        COALESCE(sr.url, kr.url) as url,
        COALESCE(sr.snippet, kr.snippet) as content_snippet,
        (COALESCE(sr.sem_score, 0) * 0.7 + COALESCE(kr.kw_score, 0) * 0.3) as combined_score,
        COALESCE(sr.sem_score, 0) as semantic_score,
        COALESCE(kr.kw_score, 0) as keyword_score
    FROM semantic_results sr
    FULL OUTER JOIN keyword_results kr ON sr.id = kr.id
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Insert default tags
INSERT INTO tags (name, category, description, color) VALUES
('javascript', 'technology', 'JavaScript programming language', '#f7df1e'),
('typescript', 'technology', 'TypeScript programming language', '#3178c6'),
('react', 'technology', 'React JavaScript library', '#61dafb'),
('node.js', 'technology', 'Node.js runtime environment', '#339933'),
('python', 'technology', 'Python programming language', '#3776ab'),
('api', 'type', 'Application Programming Interface', '#ff6b6b'),
('tutorial', 'type', 'Step-by-step learning content', '#4ecdc4'),
('reference', 'type', 'Reference documentation', '#45b7d1'),
('beginner', 'difficulty', 'Beginner-friendly content', '#2ed573'),
('intermediate', 'difficulty', 'Intermediate level content', '#ffa502'),
('advanced', 'difficulty', 'Advanced level content', '#ff4757'),
('frontend', 'domain', 'Frontend development', '#6c5ce7'),
('backend', 'domain', 'Backend development', '#fd79a8'),
('testing', 'domain', 'Software testing', '#fdcb6e'),
('security', 'domain', 'Security and authentication', '#e17055')
ON CONFLICT (name) DO NOTHING;

-- Create initial admin API key (to be replaced in production)
INSERT INTO api_keys (user_id, key_hash, name, permissions) VALUES
('admin', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Default Admin Key', '{"admin", "read", "write"}')
ON CONFLICT (key_hash) DO NOTHING;

-- Performance statistics view
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
    s.name as source_name,
    s.source_type,
    COUNT(d.id) as total_documents,
    AVG(d.authority_score) as avg_authority_score,
    AVG(d.word_count) as avg_word_count,
    MAX(d.updated_at) as last_updated,
    COUNT(CASE WHEN d.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as documents_last_week
FROM sources s
LEFT JOIN documents d ON s.id = d.source_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.source_type
ORDER BY total_documents DESC;

-- Search analytics view
CREATE OR REPLACE VIEW search_analytics_summary AS
SELECT 
    DATE_TRUNC('hour', created_at) as time_bucket,
    COUNT(*) as total_searches,
    COUNT(CASE WHEN success THEN 1 END) as successful_searches,
    AVG(response_time_ms) as avg_response_time,
    AVG(results_count) as avg_results_count,
    COUNT(DISTINCT user_id) as unique_users
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time_bucket
ORDER BY time_bucket DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Add helpful comments
COMMENT ON TABLE sources IS 'Content sources configuration and management';
COMMENT ON TABLE documents IS 'Processed documents with content and metadata';
COMMENT ON TABLE document_embeddings IS 'Vector embeddings for semantic search';
COMMENT ON TABLE crawl_jobs IS 'Tracking of crawling jobs and their progress';
COMMENT ON TABLE tags IS 'Content categorization tags';
COMMENT ON TABLE api_keys IS 'API authentication keys';
COMMENT ON TABLE search_analytics IS 'Search usage analytics and metrics';

COMMENT ON COLUMN documents.difficulty_level IS 'Content difficulty: 1=beginner, 2=intermediate, 3=advanced, 4=expert, 5=research';
COMMENT ON COLUMN documents.authority_score IS 'Content quality/authority score (0-100)';
COMMENT ON COLUMN document_embeddings.embedding IS 'Vector embedding for semantic search (1536 dimensions)';
COMMENT ON COLUMN sources.authority_weight IS 'Source authority weight for search ranking (0-10)';

-- Analyze tables for query optimization
ANALYZE sources;
ANALYZE documents;
ANALYZE document_embeddings;
ANALYZE tags;
ANALYZE document_tags;
ANALYZE crawl_jobs;