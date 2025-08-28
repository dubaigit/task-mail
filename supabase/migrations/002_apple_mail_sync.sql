-- Apple Mail Sync Schema
-- Adds support for real-time syncing from Apple Mail SQLite database

-- Create sync metadata table to track last synced position
CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sync_type TEXT UNIQUE NOT NULL,
  last_rowid BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create emails table for synced Apple Mail messages
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  apple_mail_id TEXT UNIQUE,
  rowid BIGINT,
  subject TEXT,
  sender TEXT,
  recipients TEXT[],
  date_sent TIMESTAMPTZ,
  date_received TIMESTAMPTZ,
  flags BIGINT,  -- Changed from INTEGER to BIGINT for Apple Mail compatibility
  size BIGINT,    -- Changed from INTEGER to BIGINT for Apple Mail compatibility
  mailbox TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_apple_mail_id ON emails(apple_mail_id);
CREATE INDEX IF NOT EXISTS idx_emails_rowid ON emails(rowid);
CREATE INDEX IF NOT EXISTS idx_emails_synced_at ON emails(synced_at);

-- Create sync log table for monitoring
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sync_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  emails_synced INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update sync metadata
CREATE OR REPLACE FUNCTION update_sync_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sync metadata updates
DROP TRIGGER IF EXISTS update_sync_metadata_trigger ON sync_metadata;
CREATE TRIGGER update_sync_metadata_trigger
BEFORE UPDATE ON sync_metadata
FOR EACH ROW
EXECUTE FUNCTION update_sync_metadata();

-- RLS policies for sync tables
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access sync metadata
CREATE POLICY "Service role full access to sync_metadata" ON sync_metadata
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to sync_logs" ON sync_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own sync logs
CREATE POLICY "Users can view sync logs" ON sync_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Function to get sync stats
CREATE OR REPLACE FUNCTION get_sync_stats()
RETURNS TABLE (
  total_emails_synced BIGINT,
  last_sync_time TIMESTAMPTZ,
  sync_status TEXT,
  recent_sync_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_emails_synced,
    MAX(synced_at) as last_sync_time,
    (SELECT sync_status FROM sync_metadata WHERE sync_type = 'apple_mail' LIMIT 1),
    (SELECT COUNT(*)::INTEGER FROM emails WHERE synced_at > NOW() - INTERVAL '1 hour')
  FROM emails
  WHERE synced_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_sync_stats() TO authenticated;