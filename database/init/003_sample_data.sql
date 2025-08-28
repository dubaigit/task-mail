-- Sample data to populate the TaskFlow dashboard
BEGIN;

-- Add some sample email addresses
INSERT INTO addresses (address, comment) VALUES 
('john.doe@company.com', 'John Doe'),
('sarah.smith@company.com', 'Sarah Smith'),
('mike.johnson@company.com', 'Mike Johnson'),
('lisa.williams@company.com', 'Lisa Williams'),
('noreply@github.com', 'GitHub Notifications'),
('notifications@slack.com', 'Slack Notifications')
ON CONFLICT (address, comment) DO NOTHING;

-- Add some sample subjects
INSERT INTO subjects (subject) VALUES 
('Weekly Project Update'),
('Q4 Budget Review Meeting'),
('Code Review Required - Feature Branch'),
('Security Alert: New Login Detected'),
('Team Meeting Tomorrow at 2 PM'),
('[GitHub] Pull Request #123 merged'),
('Slack notification: Message in #general'),
('Invoice #INV-2024-001 is now due'),
('Customer Support Ticket #456'),
('Monthly Performance Review')
ON CONFLICT (subject) DO NOTHING;

-- Add sample messages
INSERT INTO messages (
    message_id, 
    sender_address_id, 
    subject_id, 
    date_sent, 
    date_received, 
    display_date,
    mailbox_id,
    read_flag,
    flagged_flag,
    ai_analyzed,
    conversation_id
) 
SELECT 
    'msg_' || generate_random_uuid(),
    (SELECT ROWID FROM addresses ORDER BY RANDOM() LIMIT 1),
    (SELECT ROWID FROM subjects ORDER BY RANDOM() LIMIT 1),
    NOW() - (INTERVAL '1 day' * (random() * 7)),
    NOW() - (INTERVAL '1 day' * (random() * 7)),
    NOW() - (INTERVAL '1 day' * (random() * 7)),
    1, -- INBOX
    (random() > 0.3), -- 70% read
    (random() > 0.8), -- 20% flagged
    (random() > 0.5), -- 50% analyzed
    floor(random() * 10) + 1
FROM generate_series(1, 25);

-- Add sample tasks with realistic data
INSERT INTO tasks (
    title,
    description,
    priority,
    status,
    estimated_time,
    due_date,
    created_from_message_id,
    assigned_to,
    tags,
    ai_confidence,
    classification,
    user_id
) VALUES 
(
    'Review Q4 Budget Proposal',
    'Analyze the quarterly budget proposal and provide feedback on resource allocation',
    'high',
    'pending',
    '2 hours',
    NOW() + INTERVAL '3 days',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['finance', 'review', 'quarterly'],
    85,
    'ACTION_REQUIRED',
    1
),
(
    'Code Review - Authentication Module',
    'Review the new authentication module implementation for security compliance',
    'high',
    'in-progress',
    '1.5 hours',
    NOW() + INTERVAL '1 day',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['code-review', 'security', 'authentication'],
    92,
    'CODE_REVIEW',
    1
),
(
    'Prepare Team Meeting Agenda',
    'Create agenda for weekly team meeting including project updates and blockers',
    'medium',
    'pending',
    '30 minutes',
    NOW() + INTERVAL '2 days',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['meeting', 'planning', 'team'],
    78,
    'MEETING',
    1
),
(
    'Respond to Customer Support Ticket',
    'Address customer inquiry about API rate limiting and provide documentation',
    'medium',
    'pending',
    '45 minutes',
    NOW() + INTERVAL '1 day',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['support', 'api', 'documentation'],
    88,
    'SUPPORT',
    1
),
(
    'Update Project Documentation',
    'Revise README and API documentation to reflect recent changes',
    'low',
    'pending',
    '1 hour',
    NOW() + INTERVAL '5 days',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['documentation', 'maintenance'],
    75,
    'DOCUMENTATION',
    1
),
(
    'Security Audit Follow-up',
    'Address findings from recent security audit and implement recommended changes',
    'urgent',
    'in-progress',
    '3 hours',
    NOW() + INTERVAL '1 day',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['security', 'audit', 'critical'],
    95,
    'SECURITY',
    1
),
(
    'Deploy Feature to Production',
    'Deploy the new user dashboard feature to production environment',
    'high',
    'completed',
    '2 hours',
    NOW() - INTERVAL '1 day',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['deployment', 'production', 'feature'],
    90,
    'DEPLOYMENT',
    1
),
(
    'Performance Optimization Research',
    'Research and document database optimization strategies for improved query performance',
    'medium',
    'pending',
    '4 hours',
    NOW() + INTERVAL '7 days',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    'demo@taskflow.com',
    ARRAY['performance', 'database', 'research'],
    82,
    'RESEARCH',
    1
);

-- Add sample AI analysis data
INSERT INTO ai_analysis (
    message_id,
    classification,
    urgency,
    confidence,
    suggested_action,
    task_title,
    task_description,
    tags,
    model_used,
    processing_time
)
SELECT 
    m.ROWID,
    CASE (random() * 5)::int
        WHEN 0 THEN 'ACTION_REQUIRED'
        WHEN 1 THEN 'INFORMATIONAL' 
        WHEN 2 THEN 'MEETING'
        WHEN 3 THEN 'CODE_REVIEW'
        ELSE 'SUPPORT'
    END,
    CASE (random() * 3)::int
        WHEN 0 THEN 'low'
        WHEN 1 THEN 'medium'
        ELSE 'high'
    END,
    floor(random() * 40 + 60),
    'Review and respond',
    'Generated task from email analysis',
    'AI-generated task based on email content analysis',
    ARRAY['ai-generated', 'email-derived'],
    'gpt-4',
    floor(random() * 2000 + 500)
FROM messages m
WHERE m.ai_analyzed = true
LIMIT 15;

-- Add sample drafts
INSERT INTO drafts (
    subject,
    recipient,
    content,
    reply_to_message_id,
    ai_generated,
    model_used,
    confidence
) VALUES 
(
    'Re: Q4 Budget Review Meeting',
    'john.doe@company.com',
    'Thank you for organizing the Q4 budget review. I have reviewed the materials and will be prepared to discuss the proposed allocations during our meeting.',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    true,
    'gpt-4',
    85
),
(
    'Follow-up: Security Audit Findings',
    'security-team@company.com',
    'Following up on the recent security audit findings. I have implemented the recommended changes to the authentication module and would like to schedule a review.',
    (SELECT ROWID FROM messages ORDER BY RANDOM() LIMIT 1),
    true,
    'gpt-4',
    90
);

COMMIT;