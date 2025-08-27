-- Add missing users table that the backend expects
BEGIN;

-- Users table (required by backend API endpoints)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Insert a default user for the demo
INSERT INTO users (email, name, display_name, preferences, settings) 
VALUES (
    'demo@taskflow.com', 
    'Demo User', 
    'Demo User',
    '{"theme": "dark", "notifications": true}',
    '{"autoSync": true, "aiProcessing": true}'
) ON CONFLICT (email) DO NOTHING;

-- Add missing columns to existing tables that backend might expect
DO $$ 
BEGIN
    -- Add ai_analyzed column to messages if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'ai_analyzed'
    ) THEN
        ALTER TABLE messages ADD COLUMN ai_analyzed BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_messages_ai_analyzed ON messages(ai_analyzed);
    END IF;
    
    -- Add user_id column to tasks if it doesn't exist  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id) DEFAULT 1;
        CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    END IF;
END $$;

COMMIT;