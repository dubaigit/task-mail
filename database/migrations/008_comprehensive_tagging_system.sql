-- Apple MCP Knowledge Base - Comprehensive Tagging System Migration
-- 
-- This migration adds all necessary tables and indexes for the hierarchical
-- tagging system with AI suggestions, quality scoring, and analytics.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tag definitions table - stores the hierarchical taxonomy
CREATE TABLE IF NOT EXISTS tag_definitions (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(3,2) DEFAULT 1.0,
    is_mandatory BOOLEAN DEFAULT false,
    allow_multiple BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(category, tag_value)
);

-- Document tags table - maps tags to documents
CREATE TABLE IF NOT EXISTS document_tags (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(4,3) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'ai-suggested', 'validated')),
    applied_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES knowledge_base_content(id) ON DELETE CASCADE,
    FOREIGN KEY (category, tag_value) REFERENCES tag_definitions(category, tag_value) ON DELETE CASCADE,
    UNIQUE(document_id, category, tag_value)
);

-- Tag suggestions table - stores AI-generated tag suggestions
CREATE TABLE IF NOT EXISTS tag_suggestions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    suggested_tags JSONB NOT NULL,
    confidence_scores DECIMAL(4,3)[] DEFAULT '{}',
    reasoning TEXT,
    suggestion_source VARCHAR(20) DEFAULT 'ai' CHECK (suggestion_source IN ('ai', 'pattern', 'similarity', 'manual')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'modified')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(100),
    
    FOREIGN KEY (document_id) REFERENCES knowledge_base_content(id) ON DELETE CASCADE
);

-- Source quality scores table - stores quality assessments
CREATE TABLE IF NOT EXISTS source_quality_scores (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL,
    overall_score DECIMAL(5,2) DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
    accuracy_score DECIMAL(5,2) DEFAULT 0 CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    completeness_score DECIMAL(5,2) DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
    clarity_score DECIMAL(5,2) DEFAULT 0 CHECK (clarity_score >= 0 AND clarity_score <= 100),
    recency_score DECIMAL(5,2) DEFAULT 0 CHECK (recency_score >= 0 AND recency_score <= 100),
    examples_score DECIMAL(5,2) DEFAULT 0 CHECK (examples_score >= 0 AND examples_score <= 100),
    authority_score DECIMAL(5,2) DEFAULT 0 CHECK (authority_score >= 0 AND authority_score <= 100),
    evaluation_criteria JSONB,
    last_evaluated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    evaluator VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_id) REFERENCES knowledge_base_sources(id) ON DELETE CASCADE,
    UNIQUE(source_id)
);

-- Tag analytics events table - tracks tag usage and interactions
CREATE TABLE IF NOT EXISTS tag_analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    tag_category VARCHAR(50),
    tag_value VARCHAR(100),
    document_id INTEGER,
    source_id INTEGER,
    metadata JSONB,
    session_id UUID,
    user_context VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES knowledge_base_content(id) ON DELETE SET NULL,
    FOREIGN KEY (source_id) REFERENCES knowledge_base_sources(id) ON DELETE SET NULL
);

-- Indexes for performance optimization

-- Document tags indexes
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_category ON document_tags(category);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_value ON document_tags(tag_value);
CREATE INDEX IF NOT EXISTS idx_document_tags_source ON document_tags(source);
CREATE INDEX IF NOT EXISTS idx_document_tags_confidence ON document_tags(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_document_tags_composite ON document_tags(category, tag_value, confidence_score DESC);

-- Tag definitions indexes
CREATE INDEX IF NOT EXISTS idx_tag_definitions_category ON tag_definitions(category);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_weight ON tag_definitions(weight DESC);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_mandatory ON tag_definitions(is_mandatory);

-- Tag suggestions indexes
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_document_id ON tag_suggestions(document_id);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_status ON tag_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_source ON tag_suggestions(suggestion_source);
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_created_at ON tag_suggestions(created_at DESC);

-- Source quality scores indexes
CREATE INDEX IF NOT EXISTS idx_source_quality_scores_source_id ON source_quality_scores(source_id);
CREATE INDEX IF NOT EXISTS idx_source_quality_scores_overall ON source_quality_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_source_quality_scores_last_evaluated ON source_quality_scores(last_evaluated DESC);

-- Tag analytics events indexes
CREATE INDEX IF NOT EXISTS idx_tag_analytics_event_type ON tag_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tag_analytics_category ON tag_analytics_events(tag_category);
CREATE INDEX IF NOT EXISTS idx_tag_analytics_created_at ON tag_analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_analytics_session_id ON tag_analytics_events(session_id);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_tag_suggestions_suggested_tags ON tag_suggestions USING GIN(suggested_tags);
CREATE INDEX IF NOT EXISTS idx_source_quality_evaluation_criteria ON source_quality_scores USING GIN(evaluation_criteria);
CREATE INDEX IF NOT EXISTS idx_tag_analytics_metadata ON tag_analytics_events USING GIN(metadata);

-- Add quality_scores JSONB column to knowledge_base_content if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_base_content' 
        AND column_name = 'quality_scores'
    ) THEN
        ALTER TABLE knowledge_base_content ADD COLUMN quality_scores JSONB;
        CREATE INDEX idx_knowledge_base_content_quality_scores ON knowledge_base_content USING GIN(quality_scores);
    END IF;
END $$;

-- Insert initial tag taxonomy
INSERT INTO tag_definitions (category, tag_value, description, weight, is_mandatory, allow_multiple) VALUES
-- Source Type Tags (mandatory, single selection)
('source-type', 'documentation', 'Official documentation and guides', 1.0, true, false),
('source-type', 'code', 'Source code files and repositories', 1.0, true, false),
('source-type', 'specs', 'Technical specifications and standards', 1.0, true, false),
('source-type', 'guides', 'Tutorials and how-to guides', 1.0, true, false),
('source-type', 'tutorials', 'Step-by-step learning materials', 1.0, true, false),
('source-type', 'blog', 'Blog posts and articles', 1.0, true, false),
('source-type', 'api-docs', 'API documentation and references', 1.0, true, false),
('source-type', 'examples', 'Code examples and demos', 1.0, true, false),

-- Technology Tags (optional, multiple selection)
('technology', 'react', 'React framework and ecosystem', 0.9, false, true),
('technology', 'typescript', 'TypeScript language and tooling', 0.9, false, true),
('technology', 'javascript', 'JavaScript language and runtime', 0.9, false, true),
('technology', 'node.js', 'Node.js runtime and ecosystem', 0.9, false, true),
('technology', 'express', 'Express.js web framework', 0.9, false, true),
('technology', 'postgresql', 'PostgreSQL database system', 0.9, false, true),
('technology', 'redis', 'Redis in-memory data store', 0.9, false, true),
('technology', 'openai', 'OpenAI API and services', 0.9, false, true),
('technology', 'claude', 'Claude AI and MCP system', 0.9, false, true),
('technology', 'tailwindcss', 'Tailwind CSS framework', 0.9, false, true),
('technology', 'vite', 'Vite build tool', 0.9, false, true),
('technology', 'jest', 'Jest testing framework', 0.9, false, true),
('technology', 'playwright', 'Playwright testing tool', 0.9, false, true),
('technology', 'docker', 'Docker containerization', 0.9, false, true),
('technology', 'pm2', 'PM2 process manager', 0.9, false, true),
('technology', 'nginx', 'Nginx web server', 0.9, false, true),
('technology', 'aws', 'Amazon Web Services', 0.9, false, true),
('technology', 'git', 'Git version control', 0.9, false, true),
('technology', 'github', 'GitHub platform and tools', 0.9, false, true),
('technology', 'mcp', 'Model Context Protocol', 0.9, false, true),
('technology', 'archon', 'Archon project management system', 0.9, false, true),

-- Domain Tags (mandatory, multiple selection)
('domain', 'frontend', 'Frontend development and UI', 0.8, true, true),
('domain', 'backend', 'Backend development and APIs', 0.8, true, true),
('domain', 'database', 'Database design and management', 0.8, true, true),
('domain', 'ai', 'Artificial intelligence and ML', 0.8, true, true),
('domain', 'testing', 'Testing strategies and tools', 0.8, true, true),
('domain', 'deployment', 'Deployment and infrastructure', 0.8, true, true),
('domain', 'devops', 'DevOps practices and tools', 0.8, true, true),
('domain', 'security', 'Security practices and tools', 0.8, true, true),
('domain', 'performance', 'Performance optimization', 0.8, true, true),
('domain', 'architecture', 'System architecture and design', 0.8, true, true),
('domain', 'ui-ux', 'User interface and experience', 0.8, true, true),

-- Complexity Tags (mandatory, single selection)
('complexity', 'beginner', 'Basic concepts and introductory material', 0.7, true, false),
('complexity', 'intermediate', 'Moderate complexity requiring some experience', 0.7, true, false),
('complexity', 'advanced', 'Complex topics for experienced developers', 0.7, true, false),
('complexity', 'expert', 'Highly specialized and complex content', 0.7, true, false),

-- Use Case Tags (optional, multiple selection)
('use-case', 'development', 'Active development and implementation', 0.6, false, true),
('use-case', 'debugging', 'Troubleshooting and error resolution', 0.6, false, true),
('use-case', 'optimization', 'Performance and efficiency improvements', 0.6, false, true),
('use-case', 'security', 'Security implementation and auditing', 0.6, false, true),
('use-case', 'deployment', 'Deployment and release processes', 0.6, false, true),
('use-case', 'testing', 'Testing strategies and implementation', 0.6, false, true),
('use-case', 'monitoring', 'System monitoring and observability', 0.6, false, true),
('use-case', 'integration', 'System integration and APIs', 0.6, false, true),
('use-case', 'maintenance', 'System maintenance and updates', 0.6, false, true),
('use-case', 'troubleshooting', 'Problem diagnosis and resolution', 0.6, false, true),

-- Content Features Tags (optional, multiple selection)
('content-features', 'code-examples', 'Contains practical code examples', 0.5, false, true),
('content-features', 'step-by-step', 'Provides step-by-step instructions', 0.5, false, true),
('content-features', 'visual-diagrams', 'Includes visual diagrams and charts', 0.5, false, true),
('content-features', 'interactive', 'Interactive content and demos', 0.5, false, true),
('content-features', 'video-content', 'Contains video tutorials or demos', 0.5, false, true),
('content-features', 'downloadable', 'Provides downloadable resources', 0.5, false, true),
('content-features', 'live-demo', 'Includes live demonstrations', 0.5, false, true),
('content-features', 'case-study', 'Real-world case studies and examples', 0.5, false, true)

ON CONFLICT (category, tag_value) DO UPDATE SET
    description = EXCLUDED.description,
    weight = EXCLUDED.weight,
    is_mandatory = EXCLUDED.is_mandatory,
    allow_multiple = EXCLUDED.allow_multiple,
    updated_at = CURRENT_TIMESTAMP;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_tag_definitions_updated_at ON tag_definitions;
CREATE TRIGGER update_tag_definitions_updated_at
    BEFORE UPDATE ON tag_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_source_quality_scores_updated_at ON source_quality_scores;
CREATE TRIGGER update_source_quality_scores_updated_at
    BEFORE UPDATE ON source_quality_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for tag usage statistics
CREATE OR REPLACE VIEW tag_usage_stats AS
SELECT 
    dt.category,
    dt.tag_value,
    COUNT(*) as usage_count,
    AVG(dt.confidence_score) as avg_confidence,
    COUNT(CASE WHEN dt.source = 'manual' THEN 1 END) as manual_count,
    COUNT(CASE WHEN dt.source = 'auto' THEN 1 END) as auto_count,
    COUNT(CASE WHEN dt.source = 'ai-suggested' THEN 1 END) as ai_suggested_count,
    COUNT(CASE WHEN dt.source = 'validated' THEN 1 END) as validated_count
FROM document_tags dt
GROUP BY dt.category, dt.tag_value
ORDER BY usage_count DESC;

-- Create view for quality distribution
CREATE OR REPLACE VIEW quality_distribution AS
SELECT 
    CASE 
        WHEN (quality_scores->>'overall_score')::numeric >= 80 THEN 'High'
        WHEN (quality_scores->>'overall_score')::numeric >= 60 THEN 'Medium'
        WHEN (quality_scores->>'overall_score')::numeric >= 40 THEN 'Low'
        ELSE 'Very Low'
    END as quality_tier,
    COUNT(*) as count
FROM knowledge_base_content
WHERE quality_scores IS NOT NULL
GROUP BY 
    CASE 
        WHEN (quality_scores->>'overall_score')::numeric >= 80 THEN 'High'
        WHEN (quality_scores->>'overall_score')::numeric >= 60 THEN 'Medium'
        WHEN (quality_scores->>'overall_score')::numeric >= 40 THEN 'Low'
        ELSE 'Very Low'
    END
ORDER BY 
    CASE quality_tier
        WHEN 'High' THEN 1
        WHEN 'Medium' THEN 2
        WHEN 'Low' THEN 3
        WHEN 'Very Low' THEN 4
    END;

-- Create function to get tag co-occurrence
CREATE OR REPLACE FUNCTION get_tag_cooccurrence(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
    category1 VARCHAR(50),
    value1 VARCHAR(100),
    category2 VARCHAR(50),
    value2 VARCHAR(100),
    frequency BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt1.category as category1,
        dt1.tag_value as value1,
        dt2.category as category2,
        dt2.tag_value as value2,
        COUNT(*) as frequency
    FROM document_tags dt1
    JOIN document_tags dt2 ON dt1.document_id = dt2.document_id
    WHERE dt1.category < dt2.category 
       OR (dt1.category = dt2.category AND dt1.tag_value < dt2.tag_value)
    GROUP BY dt1.category, dt1.tag_value, dt2.category, dt2.tag_value
    HAVING COUNT(*) > 1
    ORDER BY frequency DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document success
COMMENT ON TABLE tag_definitions IS 'Hierarchical tag taxonomy with categories and validation rules';
COMMENT ON TABLE document_tags IS 'Maps tags to documents with confidence scores and sources';
COMMENT ON TABLE tag_suggestions IS 'AI-generated tag suggestions awaiting validation';
COMMENT ON TABLE source_quality_scores IS 'Quality assessments for knowledge base sources';
COMMENT ON TABLE tag_analytics_events IS 'Analytics events for tag usage tracking';

-- Migration completed successfully
SELECT 'Comprehensive tagging system migration completed successfully' as status;