// MongoDB initialization script
db = db.getSiblingDB('emaildb');

// Create user for the email database
db.createUser({
  user: 'emailuser',
  pwd: 'emailpass',
  roles: [
    {
      role: 'readWrite',
      db: 'emaildb'
    }
  ]
});

// Create collections with indexes
db.createCollection('emails');
db.createCollection('tasks');
db.createCollection('drafts');

// Create indexes for better performance
db.emails.createIndex({ 'date_received': -1 });
db.emails.createIndex({ 'sender_email': 1 });
db.emails.createIndex({ 'subject': 'text', 'content': 'text' });
db.emails.createIndex({ 'requires_reply': 1, 'reply_drafted': 1 });
db.emails.createIndex({ 'flags.important': 1 });
db.emails.createIndex({ 'metadata.processed': 1 });

db.tasks.createIndex({ 'email_id': 1 });
db.tasks.createIndex({ 'status': 1 });
db.tasks.createIndex({ 'due_date': 1 });

db.drafts.createIndex({ 'email_id': 1 });
db.drafts.createIndex({ 'created_at': -1 });

print('Email database initialized successfully');