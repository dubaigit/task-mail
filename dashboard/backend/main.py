#!/usr/bin/env python3
"""
Email Intelligence Dashboard Backend
FastAPI server with email/task management and AI integration.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uvicorn
import os
import sys

# Ensure project root is importable when running from dashboard/backend
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from email_intelligence_engine import EmailIntelligenceEngine
from apple_mail_db_reader import AppleMailDBReader
from apple_mail_composer import AppleMailComposer
from applescript_integration import AppleScriptMailer

app = FastAPI(title="Email Intelligence API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
engine = EmailIntelligenceEngine()
db_reader = AppleMailDBReader()
composer = AppleMailComposer()
mailer = AppleScriptMailer()

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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Email Intelligence API"}

@app.get("/emails/", response_model=List[Email])
def get_emails(limit: int = 50, offset: int = 0):
    """Get recent emails with AI analysis"""
    try:
        # Get emails from Apple Mail database
        emails = db_reader.get_recent_emails(limit=limit)
        
        # Analyze each email
        analyzed_emails = []
        for email in emails:
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
        
        return analyzed_emails
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
                
                drafts.append(Draft(
                    id=len(drafts) + 1,
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
    """Get email processing statistics"""
    try:
        total_emails = db_reader.get_email_count()
        unread = db_reader.get_unread_count()
        
        # Get classifications for recent emails
        emails = db_reader.get_recent_emails(limit=100)
        classifications = {}
        urgencies = {}
        
        for email in emails:
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
        
        return {
            "total_emails": total_emails,
            "unread_emails": unread,
            "classifications": classifications,
            "urgencies": urgencies,
            "processing_stats": engine.get_performance_metrics()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/drafts/{draft_id}/send")
def send_draft(draft_id: int, to_email: str):
    """Send a draft email using AppleScript"""
    try:
        # In real implementation, fetch draft from storage
        # For now, using mock data
        subject = "Re: Your Email"
        body = "This is an automated response."
        
        success = mailer.send_email(to=to_email, subject=subject, body=body)
        
        if success:
            return {"status": "sent", "message": "Email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)