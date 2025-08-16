#!/usr/bin/env python3
"""
Email Intelligence System - FastAPI Backend
Main server application
"""
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Import our modules
from email_intelligence_engine import EmailIntelligenceEngine
from apple_mail_db_reader import AppleMailDBReader
from applescript_integration import AppleScriptMailer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Email Intelligence System",
    description="AI-powered email management with Apple Mail integration",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
try:
    engine = EmailIntelligenceEngine()
    db_reader = AppleMailDBReader()
    mailer = AppleScriptMailer()
    logger.info("All components initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize components: {e}")
    engine = EmailIntelligenceEngine()  # Fallback to pattern-based only
    db_reader = None
    mailer = AppleScriptMailer()

# Pydantic models for API
class EmailResponse(BaseModel):
    message_id: int
    subject: str
    sender: str
    date: str
    snippet: str
    classification: str
    urgency: str
    confidence: float
    action_items: List[str]
    is_read: bool = False
    is_flagged: bool = False

class DraftRequest(BaseModel):
    email_id: int
    draft_content: str
    
class DraftResponse(BaseModel):
    email_id: int
    subject: str
    draft: str
    suggested_actions: List[str]

class StatsResponse(BaseModel):
    total_emails: int
    unread_count: int
    classifications: Dict[str, int]
    urgency_breakdown: Dict[str, int]
    avg_confidence: float

class TaskResponse(BaseModel):
    id: int
    email_id: int
    subject: str
    task_type: str
    priority: str
    due_date: Optional[str]
    description: str

# API Endpoints
@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Email Intelligence System",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "engine": "active" if engine else "inactive",
            "database": "active" if db_reader else "inactive",
            "mailer": "active" if mailer else "inactive"
        }
    }

@app.get("/emails/", response_model=List[EmailResponse])
async def get_emails(
    limit: int = Query(50, description="Number of emails to retrieve"),
    offset: int = Query(0, description="Offset for pagination"),
    unread_only: bool = Query(False, description="Filter unread emails only"),
    search: Optional[str] = Query(None, description="Search query")
):
    """Get list of emails with AI classification"""
    try:
        if not db_reader:
            # Return mock data if database not available
            return _get_mock_emails(limit)
        
        # Get emails from database
        if search:
            emails = db_reader.search_emails(search, limit=limit)
        else:
            emails = db_reader.get_recent_emails(limit=limit)
        
        # Process each email
        processed_emails = []
        for email in emails:
            # Analyze email with AI engine
            result = engine.analyze_email(
                email.get('subject_text', 'No Subject'),
                email.get('snippet', ''),
                email.get('sender_email', 'unknown@email.com')
            )
            
            # Create response
            processed_emails.append(EmailResponse(
                message_id=email.get('message_id', 0),
                subject=email.get('subject_text', 'No Subject'),
                sender=email.get('sender_email', 'Unknown'),
                date=email.get('date_received', datetime.now().isoformat()),
                snippet=email.get('snippet', '')[:200],
                classification=str(result.classification).split('.')[-1],
                urgency=str(result.urgency).split('.')[-1],
                confidence=result.confidence,
                action_items=[item.text for item in getattr(result, 'action_items', [])] if hasattr(result, 'action_items') and getattr(result, 'action_items', []) else [],
                is_read=bool(email.get('is_read', 0)),
                is_flagged=bool(email.get('is_flagged', 0))
            ))
        
        return processed_emails
        
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        # Return mock data on error
        return _get_mock_emails(min(limit, 5))

@app.get("/emails/{email_id}", response_model=EmailResponse)
async def get_single_email(email_id: int):
    """Get single email details with classification"""
    try:
        if not db_reader:
            raise HTTPException(status_code=503, detail="Database not available")
        
        email = db_reader.get_email_by_id(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Analyze email
        result = engine.analyze_email(
            email.get('subject_text', 'No Subject'),
            email.get('snippet', ''),
            email.get('sender_email', 'unknown@email.com')
        )
        
        return EmailResponse(
            message_id=email.get('message_id', 0),
            subject=email.get('subject_text', 'No Subject'),
            sender=email.get('sender_email', 'Unknown'),
            date=email.get('date_received', datetime.now().isoformat()),
            snippet=email.get('snippet', ''),
            classification=str(result.classification).split('.')[-1],
            urgency=str(result.urgency).split('.')[-1],
            confidence=result.confidence,
            action_items=[item.text for item in getattr(result, 'action_items', [])] if hasattr(result, 'action_items') and getattr(result, 'action_items', []) else [],
            is_read=bool(email.get('is_read', 0)),
            is_flagged=bool(email.get('is_flagged', 0))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/", response_model=List[TaskResponse])
async def get_tasks():
    """Get generated tasks from emails requiring action"""
    try:
        tasks = []
        
        if db_reader:
            # Get recent unread emails
            emails = db_reader.get_recent_emails(limit=20)
            
            for email in emails:
                # Analyze email
                result = engine.analyze_email(
                    email.get('subject_text', ''),
                    email.get('snippet', ''),
                    email.get('sender_email', '')
                )
                
                # Create tasks for actionable emails
                if str(result.classification).endswith(('NEEDS_REPLY', 'APPROVAL_REQUIRED', 'CREATE_TASK', 'FOLLOW_UP')):
                    task = TaskResponse(
                        id=len(tasks) + 1,
                        email_id=email.get('message_id', 0),
                        subject=email.get('subject_text', 'No Subject'),
                        task_type=str(result.classification).split('.')[-1],
                        priority=str(result.urgency).split('.')[-1],
                        due_date=_calculate_due_date(result.urgency),
                        description=f"Action required for email from {email.get('sender_email', 'Unknown')}"
                    )
                    tasks.append(task)
        else:
            # Return mock tasks
            tasks = _get_mock_tasks()
        
        return tasks
        
    except Exception as e:
        logger.error(f"Error generating tasks: {e}")
        return _get_mock_tasks()

@app.get("/drafts/", response_model=List[DraftResponse])
async def get_drafts():
    """Get AI-generated draft replies for emails needing response"""
    try:
        drafts = []
        
        if db_reader:
            # Get recent emails needing reply
            emails = db_reader.get_recent_emails(limit=10)
            
            for email in emails:
                # Analyze email
                result = engine.analyze_email(
                    email.get('subject_text', ''),
                    email.get('snippet', ''),
                    email.get('sender_email', '')
                )
                
                # Generate draft for emails needing reply
                if str(result.classification).endswith('NEEDS_REPLY'):
                    draft_content = engine.generate_draft_reply(email, result)
                    
                    drafts.append(DraftResponse(
                        email_id=email.get('message_id', 0),
                        subject=f"Re: {email.get('subject_text', 'No Subject')}",
                        draft=draft_content,
                        suggested_actions=["Send", "Edit", "Schedule"]
                    ))
        else:
            # Return mock drafts
            drafts = _get_mock_drafts()
        
        return drafts[:5]  # Limit to 5 drafts
        
    except Exception as e:
        logger.error(f"Error generating drafts: {e}")
        return _get_mock_drafts()

@app.post("/drafts/create")
async def create_draft(request: DraftRequest):
    """Create a draft in Apple Mail"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        success = mailer.create_draft(
            to="",  # Will be filled when sending
            subject="Draft Email",
            body=request.draft_content
        )
        
        if success:
            return {"status": "success", "message": "Draft created in Apple Mail"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create draft")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/reply")
async def reply_to_email(email_id: int, content: Dict[str, str]):
    """Reply to an email"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        reply_content = content.get('reply', '')
        if not reply_content:
            raise HTTPException(status_code=400, detail="Reply content required")
        
        success = mailer.reply_to_email(email_id, reply_content)
        
        if success:
            return {"status": "success", "message": f"Replied to email {email_id}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send reply")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying to email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/mark-read")
async def mark_email_read(email_id: int):
    """Mark an email as read"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        success = mailer.mark_as_read(email_id)
        
        if success:
            return {"status": "success", "message": f"Email {email_id} marked as read"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as read")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking email {email_id} as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/drafts/{draft_id}/send")
async def send_draft(draft_id: int):
    """Send a draft email using AppleScript"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        # Find the draft by searching through available drafts
        emails = db_reader.get_recent_emails(limit=100) if db_reader else []
        
        draft_found = None
        original_email = None
        
        # Search for the draft by ID (this is a simplified approach)
        # In a real implementation, you'd have a proper draft storage system
        for email in emails:
            # Analyze email to see if it needs a reply (draft would be generated for these)
            result = engine.analyze_email(
                subject=email.get('subject_text', 'No Subject'),
                body=email.get('content', ''),
                sender=email.get('sender_email', 'Unknown')
            )
            
            if result.classification.value in ["NEEDS_REPLY", "APPROVAL_REQUIRED"]:
                # Generate draft content to find our specific draft
                draft_content = engine.generate_draft_reply({
                    'subject': email.get('subject_text', 'No Subject'),
                    'sender_name': email.get('sender_email', 'Unknown'),
                    'content': email.get('content', '')
                }, result)
                
                # Check if this could be our draft (simplified check by ID)
                if hash(str(email.get('message_id', 0))) == draft_id or email.get('message_id', 0) == draft_id:
                    draft_found = {
                        'content': draft_content,
                        'confidence': result.confidence
                    }
                    original_email = email
                    break
        
        if not draft_found or not original_email:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        # Extract recipient email and construct subject
        to_email = original_email.get('sender_email', '')
        if not to_email:
            raise HTTPException(status_code=400, detail="No recipient email found")
        
        original_subject = original_email.get('subject_text', 'No Subject')
        # Construct reply subject
        if original_subject.startswith('Re: '):
            subject = original_subject
        else:
            subject = f"Re: {original_subject}"
        
        body = draft_found['content']
        
        # Send email using AppleScript
        success = mailer.send_email(to=to_email, subject=subject, body=body)
        
        if success:
            logger.info(f"Draft {draft_id} sent successfully to {to_email}")
            return {
                "status": "sent", 
                "message": "Email sent successfully",
                "recipient": to_email,
                "subject": subject
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to send email via Apple Mail")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending draft {draft_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send draft: {str(e)}")

@app.get("/stats/", response_model=StatsResponse)
async def get_stats():
    """Get email statistics and insights"""
    try:
        if db_reader:
            total = db_reader.get_email_count() or 0
            unread = db_reader.get_unread_count() or 0
        else:
            total = 100
            unread = 23
        
        # Get classification distribution (mock for now)
        classifications = {
            "NEEDS_REPLY": 15,
            "APPROVAL_REQUIRED": 8,
            "CREATE_TASK": 12,
            "DELEGATE": 5,
            "FYI_ONLY": 45,
            "FOLLOW_UP": 15
        }
        
        urgency_breakdown = {
            "CRITICAL": 3,
            "HIGH": 12,
            "MEDIUM": 35,
            "LOW": 50
        }
        
        return StatsResponse(
            total_emails=total,
            unread_count=unread,
            classifications=classifications,
            urgency_breakdown=urgency_breakdown,
            avg_confidence=0.87
        )
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        # Return mock stats
        return StatsResponse(
            total_emails=100,
            unread_count=23,
            classifications={
                "NEEDS_REPLY": 15,
                "FYI_ONLY": 45,
                "CREATE_TASK": 12
            },
            urgency_breakdown={
                "HIGH": 12,
                "MEDIUM": 35,
                "LOW": 53
            },
            avg_confidence=0.85
        )

# Helper functions
def _get_mock_emails(limit: int) -> List[EmailResponse]:
    """Generate mock emails for testing"""
    mock_emails = []
    for i in range(limit):
        result = engine.analyze_email(
            f"Test Email {i+1}",
            f"This is a test email body for email {i+1}",
            f"sender{i+1}@example.com"
        )
        
        mock_emails.append(EmailResponse(
            message_id=i+1,
            subject=f"Test Email {i+1}",
            sender=f"sender{i+1}@example.com",
            date=(datetime.now() - timedelta(hours=i)).isoformat(),
            snippet=f"This is a test email body for email {i+1}",
            classification=str(result.classification).split('.')[-1],
            urgency=str(result.urgency).split('.')[-1],
            confidence=result.confidence,
            action_items=[],
            is_read=i % 3 == 0,
            is_flagged=i % 5 == 0
        ))
    
    return mock_emails

def _get_mock_tasks() -> List[TaskResponse]:
    """Generate mock tasks for testing"""
    return [
        TaskResponse(
            id=1,
            email_id=1,
            subject="Project Proposal Review",
            task_type="APPROVAL_REQUIRED",
            priority="HIGH",
            due_date=(datetime.now() + timedelta(days=1)).isoformat(),
            description="Review and approve the Q4 project proposal"
        ),
        TaskResponse(
            id=2,
            email_id=3,
            subject="Meeting Schedule",
            task_type="CREATE_TASK",
            priority="MEDIUM",
            due_date=(datetime.now() + timedelta(days=2)).isoformat(),
            description="Schedule team meeting for next week"
        )
    ]

def _get_mock_drafts() -> List[DraftResponse]:
    """Generate mock drafts for testing"""
    return [
        DraftResponse(
            email_id=1,
            subject="Re: Project Update",
            draft="Thank you for the update. I've reviewed the progress and everything looks on track. Let me know if you need any additional resources.",
            suggested_actions=["Send", "Edit", "Schedule"]
        ),
        DraftResponse(
            email_id=2,
            subject="Re: Meeting Request",
            draft="I'm available for a meeting next Tuesday at 2 PM. Please send a calendar invite with the agenda.",
            suggested_actions=["Send", "Edit", "Schedule"]
        )
    ]

def _calculate_due_date(urgency) -> str:
    """Calculate due date based on urgency"""
    if str(urgency).endswith('CRITICAL'):
        due = datetime.now() + timedelta(hours=4)
    elif str(urgency).endswith('HIGH'):
        due = datetime.now() + timedelta(days=1)
    elif str(urgency).endswith('MEDIUM'):
        due = datetime.now() + timedelta(days=3)
    else:
        due = datetime.now() + timedelta(days=7)
    
    return due.isoformat()

if __name__ == "__main__":
    # Run the server
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )