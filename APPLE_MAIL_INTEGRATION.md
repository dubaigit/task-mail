# Apple Mail Integration - API Documentation

## Overview
The backend architecture has been enhanced to use real Apple Mail data through the AppleMailConnector, replacing mock data with actual email information from Mail.app.

## New Endpoints

### 1. Enhanced Email Endpoints with Date Range Support

#### Get Emails with Date Range Filtering
```http
GET /emails?start_date=2024-01-01T00:00:00&end_date=2024-01-31T23:59:59&limit=50
```

**Query Parameters:**
- `start_date` (optional): ISO format datetime for filtering start
- `end_date` (optional): ISO format datetime for filtering end
- `limit` (optional): Maximum number of emails to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `classification` (optional): Filter by email classification
- `urgency` (optional): Filter by urgency level

#### Get Single Email
```http
GET /emails/{email_id}
```

### 2. Enhanced Batch Processing

#### Start Batch Processing
```http
POST /emails/batch/process
Content-Type: application/json

{
  "start_date": "2024-01-01T00:00:00",
  "end_date": "2024-01-31T23:59:59",
  "batch_size": 100,
  "force_reprocess": false
}
```

#### Get Batch Status
```http
GET /emails/batch/{batch_id}/status
```

### 3. Analytics Endpoints

#### Dashboard Analytics
```http
GET /analytics/dashboard
```

#### Mailbox Statistics
```http
GET /analytics/mailbox-stats
```

### 4. Drafts
```http
GET /drafts
```

## Data Models

### Email Response
```json
{
  "id": 123,
  "subject": "Meeting Tomorrow",
  "sender": "John Doe <john@company.com>",
  "date": "2024-01-15T10:30:00",
  "classification": "NEEDS_REPLY",
  "urgency": "HIGH",
  "confidence": 0.92,
  "has_draft": false,
  "is_read": true,
  "is_flagged": false,
  "size_bytes": 1024,
  "to_addresses": [{"email": "recipient@company.com", "name": "Recipient"}],
  "cc_addresses": []
}
```

### Batch Processing Response
```json
{
  "batch_id": 1704067200,
  "status": "processing",
  "start_date": "2024-01-01T00:00:00",
  "end_date": "2024-01-31T23:59:59",
  "total_emails": 247,
  "message": "Processing real Apple Mail data"
}
```

## Usage Examples

### 1. Get Recent Emails
```bash
curl "http://localhost:8002/emails?limit=10"
```

### 2. Get Emails from Last Week
```bash
curl "http://localhost:8002/emails?start_date=$(date -d '7 days ago' -Iseconds)&end_date=$(date -Iseconds)"
```

### 3. Get Mailbox Statistics
```bash
curl "http://localhost:8002/analytics/mailbox-stats"
```

### 4. Start Batch Processing
```bash
curl -X POST "http://localhost:8002/emails/batch/process" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01T00:00:00",
    "end_date": "2024-01-31T23:59:59",
    "batch_size": 100
  }'
```

## Error Handling

The system gracefully handles cases where Apple Mail data is not available:
- Falls back to mock data if Apple Mail connector fails
- Returns appropriate HTTP status codes (404, 500)
- Provides detailed error messages in response

## Testing

Run the integration test:
```bash
python test_apple_mail_integration.py
```

## Configuration

The Apple Mail connector automatically uses the default Mail.app database location:
```
~/Library/Mail/V10/MailData/Envelope Index
```

If Mail.app is not available or the database is not accessible, the system will use mock data as a fallback.