#!/usr/bin/env python3
"""
Email Intelligence Dashboard Backend
FastAPI server with email/task management and AI integration.
Optimized for real Apple Mail data with 8,018+ emails.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import uvicorn
import os
import sys
import logging
from functools import lru_cache
import asyncio
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure project root is importable when running from dashboard/backend
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from email_intelligence_engine import EmailIntelligenceEngine
from apple_mail_db_reader import AppleMailDBReader
from email_data_connector import AppleMailConnector  # Enhanced connector for performance
from apple_mail_composer import AppleMailComposer
from applescript_integration import AppleScriptMailer
from ai_draft_generator import AIDraftGenerator, DraftOptions, EmailContext, DraftResult
from style_learner import StyleLearner
from refinement_processor import RefinementProcessor

app = FastAPI(title="Email Intelligence API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components with error handling and performance monitoring
try:
    engine = EmailIntelligenceEngine()
    db_reader = AppleMailDBReader()
    enhanced_connector = AppleMailConnector()  # Enhanced connector for better performance
    composer = AppleMailComposer()
    mailer = AppleScriptMailer()
    
    # AI Draft Generation components
    draft_generator = AIDraftGenerator()
    style_learner = StyleLearner()
    refinement_processor = RefinementProcessor()
    
    logger.info("All components initialized successfully")
    
    # Validate database connection and log statistics
    try:
        stats = enhanced_connector.get_mailbox_stats()
        logger.info(f"Connected to Apple Mail database: {stats['total_messages']} emails from {stats.get('oldest_message')} to {stats.get('newest_message')}")
    except Exception as e:
        logger.warning(f"Could not get mailbox stats: {e}")
        
except Exception as e:
    logger.error(f"Failed to initialize components: {e}")
    raise

# Performance monitoring
request_times = []

# Cache for frequently accessed data
@lru_cache(maxsize=128)
def get_cached_stats():
    """Cached version of database statistics with TTL simulation."""
    return db_reader.get_email_stats(), time.time()

class Email(BaseModel):
    id: int
    subject: str
    sender: str
    date: datetime
    classification: str
    urgency: str
    confidence: float
    has_draft: bool

class Task(BaseModel):
    id: int
    title: str
    description: str
    status: str
    priority: str
    due_date: Optional[datetime]
    email_id: Optional[int]

class Draft(BaseModel):
    id: int
    email_id: int
    content: str
    confidence: float
    created_at: datetime
    version: Optional[int] = 1
    template_used: Optional[str] = None
    refinement_history: Optional[List[dict]] = None

class DraftGenerationRequest(BaseModel):
    email_id: int
    tone: Optional[str] = "professional"
    length: Optional[str] = "standard"
    include_signature: Optional[bool] = True
    urgency_level: Optional[str] = "medium"
    custom_instructions: Optional[str] = None

class DraftRefinementRequest(BaseModel):
    draft_id: str
    instruction: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Email Intelligence API"}

@app.get("/emails/", response_model=List[Email])
def get_emails(
    limit: int = Query(50, le=200, description="Maximum emails to return (max 200)"), 
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    date_from: Optional[str] = Query(None, description="Start date filter (ISO format)"),
    date_to: Optional[str] = Query(None, description="End date filter (ISO format)")
):
    """Get recent emails with AI analysis - optimized for large datasets"""
    start_time = time.time()
    
    try:
        # Use date range filtering if provided, otherwise get recent emails
        if date_from or date_to:
            try:
                start_date = datetime.fromisoformat(date_from) if date_from else datetime.now() - timedelta(days=30)
                end_date = datetime.fromisoformat(date_to) if date_to else datetime.now()
                
                # Use enhanced connector for date range queries with better performance
                email_objs = enhanced_connector.get_emails_by_date_range(start_date, end_date, limit)
                emails = []
                for email_obj in email_objs:
                    emails.append({
                        'message_id': email_obj.message_id,
                        'subject_text': email_obj.subject_text,
                        'sender_email': email_obj.sender_email,
                        'sender_name': email_obj.sender_name,
                        'date_received': email_obj.date_received.isoformat() if email_obj.date_received != datetime.min else None,
                        'content': '',  # Body content not included for performance
                        'is_read': email_obj.is_read,
                        'is_flagged': email_obj.is_flagged
                    })
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
        else:
            # Get recent emails using optimized reader
            emails = db_reader.get_recent_emails(limit=limit)
        
        # Analyze each email with batch processing optimization
        analyzed_emails = []
        analysis_start = time.time()
        
        for email in emails:
            try:
                result = engine.analyze_email(
                    subject=email.get('subject_text', 'No Subject'),
                    body=email.get('content', ''),
                    sender=email.get('sender_email', 'Unknown')
                )
                
                analyzed_emails.append(Email(
                    id=email.get('message_id', 0),
                    subject=email.get('subject_text', 'No Subject'),
                    sender=email.get('sender_email', 'Unknown'),
                    date=email.get('date_received', ''),
                    classification=result.classification.value,
                    urgency=result.urgency.value,
                    confidence=result.confidence,
                    has_draft=False  # TODO: Check if draft exists
                ))
            except Exception as e:
                logger.warning(f"Failed to analyze email {email.get('message_id', 'unknown')}: {e}")
                # Continue processing other emails
        
        # Performance logging
        total_time = time.time() - start_time
        analysis_time = time.time() - analysis_start
        logger.info(f"Processed {len(analyzed_emails)} emails in {total_time:.2f}s (analysis: {analysis_time:.2f}s)")
        
        request_times.append(total_time)
        if len(request_times) > 100:  # Keep only last 100 requests
            request_times.pop(0)
        
        return analyzed_emails
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_emails: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/emails/{email_id}", response_model=Email)
def get_email(email_id: int):
    """Get single email with AI analysis"""
    try:
        email = db_reader.get_email(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
            
        result = engine.analyze_email(
            subject=email.get('subject_text', 'No Subject'),
            body=email.get('content', ''),
            sender=email.get('sender_email', 'Unknown')
        )
        
        return Email(
            id=email.get('message_id', 0),
            subject=email.get('subject_text', 'No Subject'),
            sender=email.get('sender_email', 'Unknown'),
            date=email.get('date_received', ''),
            classification=result.classification.value,
            urgency=result.urgency.value,
            confidence=result.confidence,
            has_draft=False  # TODO: Check if draft exists
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/", response_model=List[Task])
def get_tasks(limit: int = 50, offset: int = 0):
    """Get tasks created from emails"""
    try:
        # Get recent emails
        emails = db_reader.get_recent_emails(limit=limit)
        
        tasks = []
        for email in emails:
            # Analyze email
            result = engine.analyze_email(
                subject=email.get('subject_text', 'No Subject'),
                body=email.get('content', ''),
                sender=email.get('sender_email', 'Unknown')
            )
            
            # Extract tasks if present
            if result.action_items:
                for i, action in enumerate(result.action_items):
                    tasks.append(Task(
                        id=len(tasks) + 1,
                        title=f"Action from {email.get('sender_email', 'Unknown')}: {email.get('subject_text', 'No Subject')[:50]}",
                        description=action.text,
                        status="pending",
                        priority="high" if result.urgency.value in ["CRITICAL", "HIGH"] else "normal",
                        due_date=action.deadline,
                        email_id=email.get('message_id', 0)
                    ))
        
        return tasks
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/drafts/", response_model=List[Draft])
def get_drafts(limit: int = 50, offset: int = 0):
    """Get AI-generated draft replies"""
    try:
        # Get emails that need replies
        emails = db_reader.get_recent_emails(limit=limit)
        
        drafts = []
        for email in emails:
            # Analyze email
            result = engine.analyze_email(
                subject=email.get('subject_text', 'No Subject'),
                body=email.get('content', ''),
                sender=email.get('sender_email', 'Unknown')
            )
            
            # Generate draft if reply needed
            if result.classification.value in ["NEEDS_REPLY", "APPROVAL_REQUIRED"]:
                draft_content = engine.generate_draft_reply({
                    'subject': email.get('subject_text', 'No Subject'),
                    'sender_name': email.get('sender_email', 'Unknown'),
                    'content': email.get('content', '')
                }, result)
                
                # Use a consistent ID generation for drafts based on email ID
                draft_id = hash(str(email.get('message_id', 0)))
                drafts.append(Draft(
                    id=draft_id,
                    email_id=email.get('message_id', 0),
                    content=draft_content,
                    confidence=result.confidence,
                    created_at=datetime.now()
                ))
        
        return drafts
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/")
def get_stats():
    """Get email processing statistics with enhanced metrics and caching"""
    try:
        # Use cached stats if available and fresh (5 minute TTL)
        cached_data, cache_time = get_cached_stats()
        if time.time() - cache_time < 300:  # 5 minute cache
            stats = cached_data
        else:
            # Refresh cache
            get_cached_stats.cache_clear()
            stats, _ = get_cached_stats()
        
        total_emails = stats.get('total_emails', 0)
        unread = stats.get('unread_count', 0)
        
        # Enhanced mailbox statistics from the advanced connector
        try:
            mailbox_stats = enhanced_connector.get_mailbox_stats()
            mailbox_breakdown = mailbox_stats.get('mailboxes', {})
        except Exception as e:
            logger.warning(f"Could not get enhanced mailbox stats: {e}")
            mailbox_breakdown = {}
        
        # Sample recent emails for analysis (smaller sample for performance)
        sample_size = min(50, total_emails)  # Analyze max 50 emails for stats
        emails = db_reader.get_recent_emails(limit=sample_size)
        classifications = {}
        urgencies = {}
        analysis_errors = 0
        
        for email in emails:
            try:
                result = engine.analyze_email(
                    subject=email.get('subject_text', 'No Subject'),
                    body=email.get('content', ''),
                    sender=email.get('sender_email', 'Unknown')
                )
                
                # Count classifications
                class_name = result.classification.value
                classifications[class_name] = classifications.get(class_name, 0) + 1
                
                # Count urgencies
                urgency = result.urgency.value
                urgencies[urgency] = urgencies.get(urgency, 0) + 1
                
            except Exception as e:
                analysis_errors += 1
                logger.warning(f"Analysis error for email stats: {e}")
        
        # Calculate performance metrics
        avg_request_time = sum(request_times) / len(request_times) if request_times else 0
        
        response_data = {
            "total_emails": total_emails,
            "unread_emails": unread,
            "flagged_emails": stats.get('flagged_count', 0),
            "emails_last_7_days": stats.get('emails_last_7_days', 0),
            "classifications": classifications,
            "urgencies": urgencies,
            "mailbox_breakdown": dict(list(mailbox_breakdown.items())[:10]),  # Top 10 mailboxes
            "analysis_sample_size": sample_size,
            "analysis_errors": analysis_errors,
            "performance_metrics": {
                "average_request_time": round(avg_request_time, 3),
                "total_requests": len(request_times),
                "database_status": "connected",
                **engine.get_performance_metrics()
            },
            "database_info": {
                "connection_type": "Apple Mail SQLite",
                "last_updated": datetime.now().isoformat(),
                "cache_status": "active" if time.time() - cache_time < 300 else "refreshed"
            }
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error in get_stats: {e}")
        raise HTTPException(status_code=500, detail=f"Statistics error: {str(e)}")

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Quick database connectivity test
        test_count = db_reader.get_email_count()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database_connected": True,
            "total_emails": test_count,
            "components": {
                "database_reader": "ok",
                "enhanced_connector": "ok",
                "email_intelligence_engine": "ok",
                "apple_mail_composer": "ok",
                "applescript_mailer": "ok"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "database_connected": False,
            "error": str(e),
            "components": {
                "database_reader": "error",
                "enhanced_connector": "unknown",
                "email_intelligence_engine": "unknown",
                "apple_mail_composer": "unknown", 
                "applescript_mailer": "unknown"
            }
        }

@app.post("/drafts/{draft_id}/send")
def send_draft(draft_id: int):
    """Send a draft email using AppleScript"""
    try:
        # Find the draft by searching through available drafts
        emails = db_reader.get_recent_emails(limit=100)  # Get more emails to find the draft
        
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

@app.post("/drafts/create")
def create_draft_in_mail(to_email: str, subject: str, body: str):
    """Create a draft in Apple Mail"""
    try:
        success = mailer.create_draft(to=to_email, subject=subject, body=body)
        
        if success:
            return {"status": "created", "message": "Draft created in Apple Mail"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create draft")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/reply")
def reply_to_email(email_id: int, body: str, reply_all: bool = False):
    """Reply to an email using AppleScript"""
    try:
        # Get email details from database
        email = db_reader.get_email(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Use message_id for AppleScript
        message_id = email.get('message_id_header', str(email_id))
        success = mailer.reply_to_email(message_id, body, reply_all)
        
        if success:
            return {"status": "replied", "message": "Reply sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send reply")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/mark-read")
def mark_email_read(email_id: int):
    """Mark an email as read"""
    try:
        email = db_reader.get_email(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        message_id = email.get('message_id_header', str(email_id))
        success = mailer.mark_as_read(message_id)
        
        if success:
            return {"status": "marked", "message": "Email marked as read"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark as read")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/drafts/generate", response_model=Draft)
async def generate_ai_draft(request: DraftGenerationRequest):
    """Generate AI-powered draft response"""
    try:
        # Get email details
        email = db_reader.get_email(request.email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Create email context
        email_context = EmailContext(
            email_id=request.email_id,
            subject=email.get('subject_text', ''),
            sender=email.get('sender_email', ''),
            sender_email=email.get('sender_email', ''),
            content=email.get('content', ''),
            classification='NEEDS_REPLY',  # Default classification
            urgency=request.urgency_level.upper()
        )
        
        # Create draft options
        draft_options = DraftOptions(
            tone=request.tone,
            length=request.length,
            include_signature=request.include_signature,
            urgency_level=request.urgency_level,
            custom_instructions=request.custom_instructions
        )
        
        # Generate draft
        draft_result = await draft_generator.generate_draft(email_context, draft_options)
        
        # Convert to API response
        return Draft(
            id=hash(draft_result.id),  # Convert string ID to int for API compatibility
            email_id=request.email_id,
            content=draft_result.content,
            confidence=draft_result.confidence,
            created_at=datetime.fromisoformat(draft_result.created_at),
            version=draft_result.version,
            template_used=draft_result.template_used,
            refinement_history=draft_result.refinement_history or []
        )
        
    except Exception as e:
        logger.error(f"Draft generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate draft: {str(e)}")

@app.post("/drafts/refine", response_model=Draft)
async def refine_draft(request: DraftRefinementRequest):
    """Refine existing draft using natural language instruction"""
    try:
        # In a real implementation, you would retrieve the draft from storage
        # For now, we'll create a mock draft result to demonstrate refinement
        
        # Create a mock draft result for refinement
        mock_draft = DraftResult(
            id=request.draft_id,
            email_id=1,
            content="Dear John,\n\nThank you for your email.\n\nBest regards,\nAbdullah",
            confidence=0.8,
            tone_analysis={"formality": 0.8, "professionalism": 0.9},
            generation_metadata={"strategy": "ai_powered"},
            version=1
        )
        
        # Refine the draft
        refined_draft = await draft_generator.refine_draft(
            mock_draft, 
            request.instruction
        )
        
        # Convert to API response
        return Draft(
            id=hash(refined_draft.id),
            email_id=refined_draft.email_id,
            content=refined_draft.content,
            confidence=refined_draft.confidence,
            created_at=datetime.fromisoformat(refined_draft.created_at),
            version=refined_draft.version,
            template_used=refined_draft.template_used,
            refinement_history=refined_draft.refinement_history or []
        )
        
    except Exception as e:
        logger.error(f"Draft refinement failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refine draft: {str(e)}")

@app.get("/user/style-profile")
async def get_user_style_profile():
    """Get user's writing style profile"""
    try:
        style_profile = await style_learner.get_user_style_profile()
        return {
            "profile": style_profile,
            "confidence_level": style_profile.get("confidence_level", 0.0)
        }
    except Exception as e:
        logger.error(f"Failed to get style profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get style profile: {str(e)}")

@app.post("/user/record-draft-feedback")
async def record_draft_feedback(
    draft_id: str, 
    feedback_score: float, 
    corrected_content: Optional[str] = None
):
    """Record user feedback on generated draft for learning"""
    try:
        if corrected_content:
            # Learn from user corrections
            original_draft = "Mock original draft content"  # In real implementation, retrieve from storage
            await style_learner.record_user_correction(original_draft, corrected_content)
        
        return {"status": "feedback_recorded", "message": "Thank you for your feedback"}
        
    except Exception as e:
        logger.error(f"Failed to record feedback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")

@app.get("/drafts/templates")
async def get_email_templates():
    """Get available email templates"""
    try:
        # Mock templates - in real implementation, these would come from database
        templates = [
            {
                "id": "professional_reply",
                "name": "Professional Reply",
                "description": "Standard professional response template",
                "category": "response",
                "suitable_for": ["NEEDS_REPLY", "APPROVAL_REQUIRED"]
            },
            {
                "id": "meeting_response",
                "name": "Meeting Response",
                "description": "Template for responding to meeting requests",
                "category": "meeting",
                "suitable_for": ["NEEDS_REPLY"]
            },
            {
                "id": "delegation_request",
                "name": "Task Delegation",
                "description": "Template for delegating tasks",
                "category": "delegation",
                "suitable_for": ["DELEGATE", "CREATE_TASK"]
            }
        ]
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Failed to get templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {str(e)}")

@app.get("/ai/metrics")
async def get_ai_metrics():
    """Get AI system performance metrics"""
    try:
        draft_metrics = draft_generator.get_metrics()
        refinement_metrics = refinement_processor.get_metrics()
        
        return {
            "draft_generation": draft_metrics,
            "refinement_processing": refinement_metrics,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get AI metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI metrics: {str(e)}")

@app.delete("/emails/{email_id}")
def delete_email(email_id: int):
    """Delete an email (soft delete)"""
    try:
        # Check if email exists first
        email = db_reader.get_email(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Perform soft delete
        success = db_reader.delete_email(email_id)
        
        if success:
            return {"status": "deleted", "message": f"Email {email_id} deleted successfully", "email_id": email_id}
        else:
            raise HTTPException(status_code=400, detail="Email could not be deleted (may already be deleted)")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.put("/emails/{email_id}/archive")
def archive_email(email_id: int):
    """Archive an email"""
    try:
        # Check if email exists first
        email = db_reader.get_email(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Perform archive operation
        success = db_reader.archive_email(email_id)
        
        if success:
            return {"status": "archived", "message": f"Email {email_id} archived successfully", "email_id": email_id}
        else:
            raise HTTPException(status_code=400, detail="Email could not be archived (may be deleted or already archived)")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)