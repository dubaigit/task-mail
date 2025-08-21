-- Update email_ai_analysis table to support all EmailClassification types
-- Fix constraint and VARCHAR length issues

-- First, remove the existing constraint
ALTER TABLE email_ai_analysis DROP CONSTRAINT IF EXISTS email_ai_analysis_classification_check;

-- Increase VARCHAR length for classification to handle longer names
ALTER TABLE email_ai_analysis ALTER COLUMN classification TYPE VARCHAR(30);

-- Add new constraint with all supported classification types from ai_service.js
ALTER TABLE email_ai_analysis ADD CONSTRAINT email_ai_analysis_classification_check 
CHECK (classification IN (
    'NEEDS_REPLY',
    'CREATE_TASK', 
    'APPROVAL_REQUIRED',
    'DELEGATE',
    'FYI_ONLY',
    'FOLLOW_UP',
    'MEETING_REQUEST',
    'MEETING_CANCELLED',
    'CALENDAR_CONFLICT',
    'DOCUMENT_REVIEW',
    'SIGNATURE_REQUIRED',
    'PAYMENT_PROCESSING',
    'ESCALATION',
    'DEADLINE_REMINDER',
    'CUSTOMER_COMPLAINT',
    'INTERNAL_ANNOUNCEMENT',
    'PROJECT_UPDATE',
    'BLOCKED_WAITING'
));

-- Verify the changes
\d email_ai_analysis;