-- Fake Apple Mail Envelope Index SQLite Database
-- This mimics the structure of Apple Mail's SQLite database for testing

-- Core messages table (Apple Mail's main message storage)
CREATE TABLE messages (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,
    global_message_id TEXT,
    subject INTEGER,
    sender INTEGER,
    date_sent INTEGER,  -- Unix timestamp
    date_received INTEGER,  -- Unix timestamp
    date_last_viewed INTEGER,  -- Unix timestamp
    mailbox INTEGER,
    remote_mailbox TEXT,
    flags INTEGER,
    read INTEGER DEFAULT 0,  -- 0 = unread, 1 = read
    flagged INTEGER DEFAULT 0,  -- 0 = not flagged, 1 = flagged
    deleted INTEGER DEFAULT 0,  -- 0 = not deleted, 1 = deleted
    size INTEGER,
    conversation_id INTEGER,
    color INTEGER,
    flag_color INTEGER
);

-- Subjects table (normalized subject storage)
CREATE TABLE subjects (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT UNIQUE
);

-- Addresses table (normalized email address storage)
CREATE TABLE addresses (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    comment TEXT,  -- Display name
    UNIQUE(address, comment)
);

-- Recipients table (to/cc/bcc recipients)
CREATE TABLE recipients (
    message INTEGER,
    type INTEGER,  -- 0 = to, 1 = cc, 2 = bcc
    address INTEGER,
    position INTEGER,
    FOREIGN KEY(message) REFERENCES messages(ROWID),
    FOREIGN KEY(address) REFERENCES addresses(ROWID)
);

-- Mailboxes table (folder structure)
CREATE TABLE mailboxes (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    name TEXT,
    total_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    unseen_count INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0
);

-- Attachments table
CREATE TABLE attachments (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    message INTEGER,
    attachment_id TEXT,
    name TEXT,  -- filename
    size INTEGER,
    FOREIGN KEY(message) REFERENCES messages(ROWID)
);

-- Message data table (actual email content)
CREATE TABLE message_data (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT,
    data TEXT,  -- Email content/body
    FOREIGN KEY(message_id) REFERENCES messages(message_id)
);

-- Create indexes for performance (matching Apple Mail's structure)
CREATE INDEX idx_messages_date_received ON messages(date_received);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_mailbox ON messages(mailbox);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_read ON messages(read);
CREATE INDEX idx_messages_flagged ON messages(flagged);

CREATE INDEX idx_recipients_message ON recipients(message);
CREATE INDEX idx_recipients_type ON recipients(type);
CREATE INDEX idx_attachments_message ON attachments(message);
CREATE INDEX idx_subjects_subject ON subjects(subject);
CREATE INDEX idx_addresses_address ON addresses(address);