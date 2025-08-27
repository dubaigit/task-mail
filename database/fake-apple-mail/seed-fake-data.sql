-- Fake email data to populate the Apple Mail SQLite database for testing
-- This creates realistic email scenarios for testing the sync service

BEGIN TRANSACTION;

-- First, insert basic mailboxes
INSERT INTO mailboxes (url, name, total_count, unread_count, unseen_count, deleted_count) VALUES
('imap://imap.gmail.com/INBOX', 'INBOX', 25, 5, 3, 0),
('imap://imap.gmail.com/Sent', 'Sent', 8, 0, 0, 0),
('imap://imap.gmail.com/Drafts', 'Drafts', 2, 0, 0, 0),
('imap://imap.gmail.com/Trash', 'Trash', 1, 0, 0, 1),
('imap://imap.gmail.com/[Gmail]/All Mail', 'All Mail', 36, 5, 3, 1),
('imap://imap.gmail.com/Work', 'Work', 12, 3, 2, 0),
('imap://imap.gmail.com/Personal', 'Personal', 8, 1, 1, 0);

-- Insert subjects
INSERT INTO subjects (subject) VALUES
('Weekly Team Meeting - Q4 Planning'),
('Code Review Required: Authentication Module'),
('[GitHub] Pull Request #456 merged'),
('Invoice #INV-2024-12345 - Payment Due'),
('Re: Project Timeline Discussion'),
('Security Alert: New Login from MacBook Pro'),
('Customer Support Ticket #789 - API Question'),
('Monthly Newsletter - December 2024'),
('Meeting Reminder: Budget Review Tomorrow'),
('Action Required: Update Your Password'),
('Welcome to TaskMail - Getting Started'),
('[Slack] You have 3 new messages in #general'),
('Your Order #ORD-2024-001 Has Shipped'),
('Quarterly Performance Review Schedule'),
('Re: Database Migration Planning'),
('[URGENT] Server Maintenance Tonight'),
('Conference Call Notes - Sprint Retrospective'),
('New Feature Release: Dashboard 2.0'),
('Re: Client Requirements Document'),
('Weekend Server Monitoring Report'),
('Task Assignment: Frontend Optimization'),
('[Automated] Backup Completed Successfully'),
('Interview Schedule: Senior Developer Position'),
('Re: API Rate Limiting Discussion'),
('Year-End Report - Please Review');

-- Insert email addresses (senders and recipients)
INSERT INTO addresses (address, comment) VALUES
-- Work colleagues
('john.doe@company.com', 'John Doe'),
('sarah.martinez@company.com', 'Sarah Martinez'),
('mike.johnson@company.com', 'Mike Johnson'),
('lisa.chen@company.com', 'Lisa Chen'),
('david.wilson@company.com', 'David Wilson'),
('emily.rodriguez@company.com', 'Emily Rodriguez'),
-- Clients/External
('alex.brown@clientcorp.com', 'Alex Brown'),
('jennifer.taylor@partnerfirm.com', 'Jennifer Taylor'),
('robert.anderson@supplier.com', 'Robert Anderson'),
-- System/Service accounts
('noreply@github.com', 'GitHub'),
('notifications@slack.com', 'Slack'),
('alerts@system.com', 'System Alerts'),
('support@taskmail.com', 'TaskMail Support'),
('billing@services.com', 'Billing Department'),
('security@company.com', 'Security Team'),
-- Personal
('mom@family.com', 'Mom'),
('friend@gmail.com', 'Best Friend'),
('newsletter@techblog.com', 'Tech Blog'),
('admin@ecommerce.com', 'Online Store'),
('noreply@banking.com', 'First National Bank');

-- Insert realistic messages with proper timestamps
-- Recent messages (last 7 days)
INSERT INTO messages (
    message_id, global_message_id, subject, sender, date_sent, date_received, 
    date_last_viewed, mailbox, flags, read, flagged, deleted, size, conversation_id, color
) VALUES
-- Today's messages (unread)
('msg-001', 'global-001', 1, 1, 1735257600, 1735257600, NULL, 1, 0, 0, 0, 0, 2048, 1, 0),
('msg-002', 'global-002', 16, 12, 1735254000, 1735254000, NULL, 1, 0, 0, 1, 0, 1536, 2, 0),
('msg-003', 'global-003', 10, 15, 1735250400, 1735250400, NULL, 1, 0, 0, 0, 0, 3072, 3, 0),

-- Yesterday's messages (mostly read)
('msg-004', 'global-004', 2, 2, 1735171200, 1735171200, 1735180000, 1, 1, 1, 0, 0, 4096, 4, 0),
('msg-005', 'global-005', 7, 8, 1735167600, 1735167600, 1735170000, 1, 1, 1, 0, 0, 2560, 5, 0),
('msg-006', 'global-006', 12, 11, 1735164000, 1735164000, NULL, 1, 0, 0, 0, 0, 1792, 6, 0),

-- This week's messages
('msg-007', 'global-007', 3, 10, 1735084800, 1735084800, 1735090000, 1, 1, 1, 0, 0, 3584, 7, 0),
('msg-008', 'global-008', 14, 3, 1735081200, 1735081200, 1735085000, 6, 1, 1, 1, 0, 2304, 8, 0),
('msg-009', 'global-009', 5, 4, 1735077600, 1735077600, 1735080000, 1, 1, 1, 0, 0, 4608, 9, 0),
('msg-010', 'global-010', 9, 13, 1735074000, 1735074000, NULL, 1, 0, 0, 0, 0, 1280, 10, 0),

-- Last week's messages
('msg-011', 'global-011', 18, 5, 1734652800, 1734652800, 1734660000, 1, 1, 1, 0, 0, 5120, 11, 0),
('msg-012', 'global-012', 21, 6, 1734649200, 1734649200, 1734655000, 6, 1, 1, 0, 0, 2816, 12, 0),
('msg-013', 'global-013', 4, 9, 1734645600, 1734645600, 1734650000, 1, 1, 1, 0, 0, 1920, 13, 0),
('msg-014', 'global-014', 11, 13, 1734642000, 1734642000, 1734645000, 1, 1, 1, 0, 0, 3328, 14, 0),
('msg-015', 'global-015', 8, 18, 1734638400, 1734638400, 1734640000, 7, 1, 1, 0, 0, 2240, 15, 0),

-- Older messages (flagged and important)
('msg-016', 'global-016', 17, 7, 1734048000, 1734048000, 1734050000, 1, 2, 1, 1, 0, 6144, 16, 1),
('msg-017', 'global-017', 6, 12, 1734044400, 1734044400, 1734048000, 1, 2, 1, 1, 0, 2688, 17, 2),
('msg-018', 'global-018', 15, 14, 1734040800, 1734040800, 1734045000, 6, 1, 1, 0, 0, 4352, 18, 0),

-- Sent messages
('msg-019', 'global-019', 19, 20, 1735200000, 1735200000, 1735200000, 2, 1, 1, 0, 0, 1664, 19, 0),
('msg-020', 'global-020', 24, 20, 1735120000, 1735120000, 1735120000, 2, 1, 1, 0, 0, 3456, 20, 0),

-- Draft messages
('msg-021', 'global-021', 25, 20, NULL, NULL, NULL, 3, 0, 0, 0, 0, 1152, 21, 0),
('msg-022', 'global-022', 20, 20, NULL, NULL, NULL, 3, 0, 0, 0, 0, 2048, 22, 0),

-- Deleted message
('msg-023', 'global-023', 22, 19, 1734960000, 1734960000, 1734965000, 4, 1, 1, 0, 1, 896, 23, 0);

-- Insert recipients for messages
-- Message 1: Team meeting email (to multiple recipients)
INSERT INTO recipients (message, type, address, position) VALUES
(1, 0, 1, 0),  -- to: john.doe@company.com
(1, 0, 2, 1),  -- to: sarah.martinez@company.com
(1, 0, 3, 2),  -- to: mike.johnson@company.com
(1, 1, 4, 0),  -- cc: lisa.chen@company.com
(1, 1, 5, 1);  -- cc: david.wilson@company.com

-- Message 2: Urgent server maintenance
INSERT INTO recipients (message, type, address, position) VALUES
(2, 0, 15, 0); -- to: security@company.com

-- Message 3: Security alert
INSERT INTO recipients (message, type, address, position) VALUES
(3, 0, 20, 0); -- to: yourself (the user)

-- Message 4: Code review request
INSERT INTO recipients (message, type, address, position) VALUES
(4, 0, 3, 0),  -- to: mike.johnson@company.com
(4, 1, 1, 0);  -- cc: john.doe@company.com

-- Message 5: Customer support
INSERT INTO recipients (message, type, address, position) VALUES
(5, 0, 8, 0);  -- to: alex.brown@clientcorp.com

-- Add more recipients for other messages...
INSERT INTO recipients (message, type, address, position) VALUES
(6, 0, 20, 0), -- Slack notification
(7, 0, 2, 0),  -- GitHub notification
(8, 0, 1, 0),  -- Work email
(8, 1, 4, 0),  -- CC
(9, 0, 20, 0), -- Project discussion
(10, 0, 13, 0), -- Support email
(11, 0, 6, 0),  -- Feature release
(12, 0, 3, 0),  -- Task assignment
(13, 0, 14, 0), -- Billing
(14, 0, 13, 0), -- Support
(15, 0, 17, 0), -- Personal
(16, 0, 1, 0),  -- Conference call
(16, 0, 2, 0),
(17, 0, 20, 0), -- Security alert
(18, 0, 5, 0),  -- Work planning
-- Sent messages (from you to others)
(19, 0, 1, 0),  -- Reply to client
(20, 0, 8, 0),  -- API discussion
-- Drafts (to various recipients)
(21, 0, 9, 0),  -- Draft to partner
(22, 0, 12, 0); -- Draft system notification

-- Insert sample attachments
INSERT INTO attachments (message, attachment_id, name, size) VALUES
(4, 'att-001', 'code-review-checklist.pdf', 245760),
(8, 'att-002', 'project-timeline.xlsx', 87424),
(11, 'att-003', 'dashboard-v2-mockup.png', 524288),
(16, 'att-004', 'meeting-notes.docx', 98304),
(17, 'att-005', 'security-audit-report.pdf', 1048576),
(20, 'att-006', 'api-documentation.pdf', 331776);

-- Insert message content/body data
INSERT INTO message_data (message_id, data) VALUES
('msg-001', 'Hi team,

Our weekly Q4 planning meeting is scheduled for tomorrow at 2 PM in the main conference room. Please review the attached agenda and come prepared to discuss:

1. Sprint retrospective
2. Q4 roadmap priorities
3. Resource allocation
4. Holiday schedule planning

Looking forward to seeing everyone there!

Best regards,
John'),

('msg-002', 'URGENT: Server Maintenance Tonight

We will be performing critical security updates on our production servers tonight from 11 PM to 3 AM EST. During this time, the following services may be temporarily unavailable:

- API endpoints
- Dashboard access
- Email notifications

Please plan accordingly and notify your clients if necessary.

If you encounter any issues after the maintenance window, please contact the on-call engineer immediately.

Thanks for your cooperation.

System Operations Team'),

('msg-003', 'Security Alert: New Login Detected

We detected a new login to your account from:

Device: MacBook Pro
Location: San Francisco, CA
Time: December 26, 2024 at 10:30 AM PST

If this was you, you can ignore this message. If you don''t recognize this activity, please:

1. Change your password immediately
2. Review your recent account activity
3. Enable two-factor authentication

Stay secure,
TaskMail Security Team'),

('msg-004', 'Hi Mike,

I''ve completed the initial review of the authentication module code. Overall, the implementation looks solid, but I have a few suggestions:

1. Consider adding rate limiting to prevent brute force attacks
2. The password validation could be more robust
3. Add logging for failed authentication attempts

I''ve attached a detailed checklist. Let me know if you''d like to discuss any of these points in detail.

Best,
Sarah'),

('msg-005', 'Dear Alex,

Thank you for reaching out regarding the API rate limiting question. I understand you''re experiencing some throttling during peak hours.

Our current rate limits are:
- 1000 requests per hour for basic plans
- 5000 requests per hour for premium plans
- 10000 requests per hour for enterprise plans

If you need higher limits, we can discuss upgrading your plan or implementing request caching strategies.

I''ve attached our API best practices guide which includes optimization tips.

Best regards,
Lisa Chen
Customer Success Team'),

('msg-021', 'Hi Jennifer,

I wanted to follow up on our discussion about the partnership proposal. After reviewing it with our team, we''re very interested in moving forward.

Could we schedule a call next week to discuss the implementation timeline and technical requirements?

I''m available:
- Tuesday 2-4 PM
- Wednesday 10 AM - 12 PM  
- Friday 1-3 PM

Looking forward to hearing from you.

Best regards,
[Your name]

[DRAFT - NOT SENT]'),

('msg-022', 'Subject: System Monitoring Report - Week of Dec 23

Hi team,

Here''s the weekly system performance summary:

Uptime: 99.8%
Average Response Time: 125ms
Error Rate: 0.02%
Peak Traffic: Thursday 2 PM (15,000 requests)

Notable Events:
- Brief latency spike Tuesday evening (resolved)
- Successful deployment of security patches
- Database optimization completed

No action required at this time.

[DRAFT - REVIEW BEFORE SENDING]');

COMMIT;