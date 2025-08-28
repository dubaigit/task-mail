-- Enhanced Knowledge Base Schema for Documentation Crawling
-- Migration 007: Advanced content storage with semantic search capabilities

-- Drop existing knowledge base table if it exists (for clean migration)
DROP TABLE IF EXISTS knowledge_base_content CASCADE;

-- Create enhanced knowledge base content table
CREATE TABLE knowledge_base_content (
    id SERIAL PRIMARY KEY,
    
    -- Content identification
    url TEXT NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL UNIQUE,
    
    -- Content metadata
    title TEXT NOT NULL,
    content_text TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    last_modified TIMESTAMP,
    
    -- Quality and categorization
    quality_score NUMERIC(5,2) DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 100),
    priority_level VARCHAR(20) DEFAULT 'medium' CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Technical content analysis
    code_blocks JSONB DEFAULT '[]'::jsonb,
    examples JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Semantic search
    embedding VECTOR(1536), -- OpenAI ada-002 embedding dimension
    
    -- Content flags
    has_api_reference BOOLEAN DEFAULT FALSE,
    has_best_practices BOOLEAN DEFAULT FALSE,
    has_performance_tips BOOLEAN DEFAULT FALSE,
    has_type_definitions BOOLEAN DEFAULT FALSE,
    has_code_examples BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexing
    CONSTRAINT unique_content_hash UNIQUE (content_hash)
);

-- Create comprehensive indexes for performance

-- Primary search indexes
CREATE INDEX idx_kb_content_domain ON knowledge_base_content(domain);
CREATE INDEX idx_kb_content_quality_score ON knowledge_base_content(quality_score DESC);
CREATE INDEX idx_kb_content_priority ON knowledge_base_content(priority_level);
CREATE INDEX idx_kb_content_updated_at ON knowledge_base_content(updated_at DESC);

-- Full-text search index
CREATE INDEX idx_kb_content_fts ON knowledge_base_content USING gin(to_tsvector('english', title || ' ' || content_text));

-- JSONB indexes for tags and metadata
CREATE INDEX idx_kb_content_tags ON knowledge_base_content USING gin(tags);
CREATE INDEX idx_kb_content_metadata ON knowledge_base_content USING gin(metadata);

-- Semantic search index (requires pgvector extension)
-- CREATE INDEX idx_kb_content_embedding ON knowledge_base_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Content flags indexes for fast filtering
CREATE INDEX idx_kb_content_api_ref ON knowledge_base_content(has_api_reference) WHERE has_api_reference = TRUE;
CREATE INDEX idx_kb_content_best_practices ON knowledge_base_content(has_best_practices) WHERE has_best_practices = TRUE;
CREATE INDEX idx_kb_content_performance ON knowledge_base_content(has_performance_tips) WHERE has_performance_tips = TRUE;
CREATE INDEX idx_kb_content_types ON knowledge_base_content(has_type_definitions) WHERE has_type_definitions = TRUE;
CREATE INDEX idx_kb_content_code ON knowledge_base_content(has_code_examples) WHERE has_code_examples = TRUE;

-- Composite indexes for common query patterns
CREATE INDEX idx_kb_content_domain_quality ON knowledge_base_content(domain, quality_score DESC);
CREATE INDEX idx_kb_content_domain_updated ON knowledge_base_content(domain, updated_at DESC);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_kb_content_updated_at
    BEFORE UPDATE ON knowledge_base_content
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Create crawl jobs tracking table
CREATE TABLE crawl_jobs (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Job metadata
    job_id VARCHAR(255), -- Bull queue job ID
    config JSONB DEFAULT '{}'::jsonb,
    
    -- Statistics
    pages_processed INTEGER DEFAULT 0,
    pages_successful INTEGER DEFAULT 0,
    pages_failed INTEGER DEFAULT 0,
    average_quality_score NUMERIC(5,2) DEFAULT 0.0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for crawl jobs
CREATE INDEX idx_crawl_jobs_domain ON crawl_jobs(domain);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_priority ON crawl_jobs(priority);
CREATE INDEX idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC);

-- Create content quality analytics table
CREATE TABLE content_quality_analytics (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    
    -- Quality metrics
    total_pages INTEGER DEFAULT 0,
    average_quality_score NUMERIC(5,2) DEFAULT 0.0,
    high_quality_pages INTEGER DEFAULT 0, -- quality_score >= 75
    medium_quality_pages INTEGER DEFAULT 0, -- quality_score 50-74
    low_quality_pages INTEGER DEFAULT 0, -- quality_score < 50
    
    -- Content metrics
    total_word_count BIGINT DEFAULT 0,
    total_code_blocks INTEGER DEFAULT 0,
    total_examples INTEGER DEFAULT 0,
    
    -- Content type distribution
    api_reference_count INTEGER DEFAULT 0,
    best_practices_count INTEGER DEFAULT 0,
    performance_tips_count INTEGER DEFAULT 0,
    type_definitions_count INTEGER DEFAULT 0,
    
    -- Temporal data
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_domain_date UNIQUE (domain, analysis_date)
);

-- Index for analytics
CREATE INDEX idx_quality_analytics_domain_date ON content_quality_analytics(domain, analysis_date DESC);

-- Create search analytics table
CREATE TABLE search_analytics (
    id SERIAL PRIMARY KEY,
    
    -- Query information
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    
    -- Search parameters
    domain_filter VARCHAR(255),
    tags_filter JSONB,
    quality_threshold NUMERIC(5,2),
    
    -- Results
    results_count INTEGER DEFAULT 0,
    avg_result_quality NUMERIC(5,2),
    execution_time_ms INTEGER,
    
    -- User context (if available)
    user_session VARCHAR(255),
    search_context VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search analytics
CREATE INDEX idx_search_analytics_query_hash ON search_analytics(query_hash);
CREATE INDEX idx_search_analytics_created_at ON search_analytics(created_at DESC);
CREATE INDEX idx_search_analytics_domain ON search_analytics(domain_filter);

-- Create function to calculate content quality analytics
CREATE OR REPLACE FUNCTION calculate_content_quality_analytics(target_domain VARCHAR DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- Delete existing analytics for the date
    IF target_domain IS NOT NULL THEN
        DELETE FROM content_quality_analytics 
        WHERE domain = target_domain AND analysis_date = CURRENT_DATE;
    ELSE
        DELETE FROM content_quality_analytics WHERE analysis_date = CURRENT_DATE;
    END IF;
    
    -- Insert fresh analytics
    INSERT INTO content_quality_analytics (
        domain, total_pages, average_quality_score, 
        high_quality_pages, medium_quality_pages, low_quality_pages,
        total_word_count, total_code_blocks, total_examples,
        api_reference_count, best_practices_count, performance_tips_count, type_definitions_count
    )
    SELECT 
        domain,
        COUNT(*) as total_pages,
        AVG(quality_score) as average_quality_score,
        COUNT(*) FILTER (WHERE quality_score >= 75) as high_quality_pages,
        COUNT(*) FILTER (WHERE quality_score >= 50 AND quality_score < 75) as medium_quality_pages,
        COUNT(*) FILTER (WHERE quality_score < 50) as low_quality_pages,
        SUM(word_count) as total_word_count,
        SUM(jsonb_array_length(COALESCE(code_blocks, '[]'::jsonb))) as total_code_blocks,
        SUM(jsonb_array_length(COALESCE(examples, '[]'::jsonb))) as total_examples,
        COUNT(*) FILTER (WHERE has_api_reference = TRUE) as api_reference_count,
        COUNT(*) FILTER (WHERE has_best_practices = TRUE) as best_practices_count,
        COUNT(*) FILTER (WHERE has_performance_tips = TRUE) as performance_tips_count,
        COUNT(*) FILTER (WHERE has_type_definitions = TRUE) as type_definitions_count
    FROM knowledge_base_content
    WHERE (target_domain IS NULL OR domain = target_domain)
    GROUP BY domain;
END;
$$ LANGUAGE plpgsql;

-- Create function for semantic search
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    domain_filter VARCHAR DEFAULT NULL,
    min_quality_score NUMERIC DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    url TEXT,
    title TEXT,
    domain VARCHAR,
    quality_score NUMERIC,
    similarity_score FLOAT,
    tags JSONB,
    word_count INTEGER,
    has_code_examples BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.url,
        kb.title,
        kb.domain,
        kb.quality_score,
        (1 - (kb.embedding <=> query_embedding)) as similarity_score,
        kb.tags,
        kb.word_count,
        kb.has_code_examples
    FROM knowledge_base_content kb
    WHERE 
        kb.embedding IS NOT NULL
        AND (1 - (kb.embedding <=> query_embedding)) >= similarity_threshold
        AND (domain_filter IS NULL OR kb.domain = domain_filter)
        AND kb.quality_score >= min_quality_score
    ORDER BY kb.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create function for hybrid search (full-text + semantic)
CREATE OR REPLACE FUNCTION hybrid_search(
    search_query TEXT,
    query_embedding VECTOR(1536) DEFAULT NULL,
    domain_filter VARCHAR DEFAULT NULL,
    tag_filters TEXT[] DEFAULT NULL,
    min_quality_score NUMERIC DEFAULT 30,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    id INTEGER,
    url TEXT,
    title TEXT,
    domain VARCHAR,
    quality_score NUMERIC,
    combined_score FLOAT,
    tags JSONB,
    word_count INTEGER,
    has_code_examples BOOLEAN,
    content_snippet TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.url,
        kb.title,
        kb.domain,
        kb.quality_score,
        -- Combined scoring: 70% semantic similarity + 30% text relevance + quality boost
        CASE 
            WHEN query_embedding IS NOT NULL THEN
                ((1 - (kb.embedding <=> query_embedding)) * 0.7) +
                (ts_rank(to_tsvector('english', kb.title || ' ' || kb.content_text), plainto_tsquery('english', search_query)) * 0.3) +
                (kb.quality_score / 100.0 * 0.2)
            ELSE
                ts_rank(to_tsvector('english', kb.title || ' ' || kb.content_text), plainto_tsquery('english', search_query)) +
                (kb.quality_score / 100.0 * 0.3)
        END as combined_score,
        kb.tags,
        kb.word_count,
        kb.has_code_examples,
        LEFT(kb.content_text, 200) || '...' as content_snippet
    FROM knowledge_base_content kb
    WHERE 
        (
            to_tsvector('english', kb.title || ' ' || kb.content_text) @@ plainto_tsquery('english', search_query)
            OR (query_embedding IS NOT NULL AND kb.embedding IS NOT NULL AND (1 - (kb.embedding <=> query_embedding)) >= 0.6)
        )
        AND (domain_filter IS NULL OR kb.domain = domain_filter)
        AND (tag_filters IS NULL OR kb.tags ?| tag_filters)
        AND kb.quality_score >= min_quality_score
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create views for common queries

-- High-quality content view
CREATE VIEW high_quality_content AS
SELECT 
    id, url, domain, title, quality_score, tags, word_count,
    has_api_reference, has_best_practices, has_performance_tips,
    has_type_definitions, has_code_examples, updated_at
FROM knowledge_base_content
WHERE quality_score >= 75
ORDER BY quality_score DESC;

-- Recent content view
CREATE VIEW recent_content AS
SELECT 
    id, url, domain, title, quality_score, tags, word_count,
    has_code_examples, updated_at
FROM knowledge_base_content
WHERE updated_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY updated_at DESC;

-- Content by domain summary
CREATE VIEW content_by_domain AS
SELECT 
    domain,
    COUNT(*) as total_pages,
    AVG(quality_score) as avg_quality,
    COUNT(*) FILTER (WHERE has_code_examples = TRUE) as pages_with_code,
    COUNT(*) FILTER (WHERE has_best_practices = TRUE) as pages_with_best_practices,
    MAX(updated_at) as last_updated
FROM knowledge_base_content
GROUP BY domain
ORDER BY avg_quality DESC;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base_content TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON crawl_jobs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON content_quality_analytics TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON search_analytics TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Create initial analytics entry
SELECT calculate_content_quality_analytics();

COMMENT ON TABLE knowledge_base_content IS 'Enhanced storage for crawled documentation content with semantic search capabilities';
COMMENT ON TABLE crawl_jobs IS 'Tracking table for documentation crawling jobs';
COMMENT ON TABLE content_quality_analytics IS 'Daily analytics on content quality metrics by domain';
COMMENT ON TABLE search_analytics IS 'Analytics for search queries and performance metrics';

COMMENT ON COLUMN knowledge_base_content.embedding IS 'OpenAI ada-002 embedding vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN knowledge_base_content.quality_score IS 'Calculated quality score from 0-100 based on content analysis';
COMMENT ON COLUMN knowledge_base_content.tags IS 'JSON array of content tags for categorization and filtering';
COMMENT ON COLUMN knowledge_base_content.code_blocks IS 'JSON array of extracted code blocks with language detection';
COMMENT ON COLUMN knowledge_base_content.examples IS 'JSON array of extracted code examples and demonstrations';