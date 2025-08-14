#!/usr/bin/env python3
"""
Email Scheduler FastAPI Integration

Integration endpoints for the email scheduling system with the main FastAPI backend.
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio

# Import our scheduler components
from email_scheduler import (
    EmailScheduler,
    EmailSchedulerConfig,
    get_scheduler,
    TemplateCreateRequest,
    EmailScheduleRequest,
    TemplateEmailScheduleRequest,
    AutomationRuleRequest,
    ScheduleType,
    AutomationTrigger
)
from scheduled_tasks import TaskStatus, TaskType


def setup_scheduler_routes(app: FastAPI):
    """Add email scheduler routes to existing FastAPI app"""
    
    # ==================== TEMPLATE MANAGEMENT ====================
    
    @app.post("/api/scheduler/templates", response_model=Dict[str, str])
    async def create_template(request: TemplateCreateRequest):
        """Create a new email template"""
        try:
            scheduler = get_scheduler()
            
            # Convert string enums to objects if provided
            classification = None
            urgency = None
            
            if request.classification:
                from email_intelligence_engine import EmailClass
                classification = EmailClass(request.classification)
            
            if request.urgency:
                from email_intelligence_engine import Urgency
                urgency = Urgency(request.urgency)
            
            template_id = scheduler.create_template(
                name=request.name,
                subject_template=request.subject_template,
                body_template=request.body_template,
                classification=classification,
                urgency=urgency,
                tags=request.tags
            )
            
            return {"template_id": template_id, "status": "created"}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.get("/api/scheduler/templates")
    async def list_templates(classification: Optional[str] = None, tags: Optional[str] = None):
        """List all email templates with optional filtering"""
        try:
            scheduler = get_scheduler()
            
            # Parse filters
            filter_classification = None
            filter_tags = None
            
            if classification:
                from email_intelligence_engine import EmailClass
                filter_classification = EmailClass(classification)
            
            if tags:
                filter_tags = tags.split(",")
            
            templates = scheduler.list_templates(
                classification=filter_classification,
                tags=filter_tags
            )
            
            # Convert to JSON-serializable format
            result = []
            for template in templates:
                template_dict = {
                    "id": template.id,
                    "name": template.name,
                    "subject_template": template.subject_template,
                    "body_template": template.body_template,
                    "classification": template.classification.value if template.classification else None,
                    "urgency": template.urgency.value if template.urgency else None,
                    "tags": template.tags,
                    "created_at": template.created_at.isoformat()
                }
                result.append(template_dict)
            
            return {"templates": result, "count": len(result)}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.get("/api/scheduler/templates/{template_id}")
    async def get_template(template_id: str):
        """Get a specific template"""
        try:
            scheduler = get_scheduler()
            template = scheduler.get_template(template_id)
            
            if not template:
                raise HTTPException(status_code=404, detail="Template not found")
            
            return {
                "id": template.id,
                "name": template.name,
                "subject_template": template.subject_template,
                "body_template": template.body_template,
                "classification": template.classification.value if template.classification else None,
                "urgency": template.urgency.value if template.urgency else None,
                "tags": template.tags,
                "created_at": template.created_at.isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.post("/api/scheduler/templates/{template_id}/render")
    async def render_template(template_id: str, variables: Dict[str, str]):
        """Render a template with variables"""
        try:
            scheduler = get_scheduler()
            rendered = scheduler.render_template(template_id, variables)
            return rendered
            
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # ==================== EMAIL SCHEDULING ====================
    
    @app.post("/api/scheduler/emails", response_model=Dict[str, str])
    async def schedule_email(request: EmailScheduleRequest):
        """Schedule an email for future sending"""
        try:
            scheduler = get_scheduler()
            
            email_id = scheduler.schedule_email(
                to=request.to,
                subject=request.subject,
                body=request.body,
                scheduled_time=request.scheduled_time,
                cc=request.cc,
                bcc=request.bcc
            )
            
            return {"email_id": email_id, "status": "scheduled"}
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/scheduler/emails/template", response_model=Dict[str, str])
    async def schedule_template_email(request: TemplateEmailScheduleRequest):
        """Schedule an email using a template"""
        try:
            scheduler = get_scheduler()
            
            email_id = scheduler.schedule_template_email(
                template_id=request.template_id,
                to=request.to,
                variables=request.variables,
                scheduled_time=request.scheduled_time,
                cc=request.cc,
                bcc=request.bcc
            )
            
            return {"email_id": email_id, "status": "scheduled"}
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/scheduler/emails")
    async def list_scheduled_emails(status: Optional[str] = None):
        """List scheduled emails with optional status filtering"""
        try:
            scheduler = get_scheduler()
            emails = scheduler.get_scheduled_emails(status=status)
            
            # Convert to JSON-serializable format
            result = []
            for email in emails:
                email_dict = {
                    "id": email.id,
                    "to": email.to,
                    "subject": email.subject,
                    "scheduled_time": email.scheduled_time.isoformat(),
                    "schedule_type": email.schedule_type.value,
                    "status": email.status,
                    "created_at": email.created_at.isoformat(),
                    "sent_at": email.sent_at.isoformat() if email.sent_at else None,
                    "error_message": email.error_message
                }
                result.append(email_dict)
            
            return {"emails": result, "count": len(result)}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.delete("/api/scheduler/emails/{email_id}")
    async def cancel_scheduled_email(email_id: str):
        """Cancel a scheduled email"""
        try:
            scheduler = get_scheduler()
            success = scheduler.cancel_scheduled_email(email_id)
            
            if not success:
                raise HTTPException(status_code=404, detail="Email not found or cannot be cancelled")
            
            return {"status": "cancelled"}
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # ==================== AUTOMATION RULES ====================
    
    @app.post("/api/scheduler/automation", response_model=Dict[str, str])
    async def create_automation_rule(request: AutomationRuleRequest):
        """Create an automation rule"""
        try:
            scheduler = get_scheduler()
            
            # Convert string to enum
            trigger = AutomationTrigger(request.trigger)
            
            rule_id = scheduler.create_automation_rule(
                name=request.name,
                trigger=trigger,
                conditions=request.conditions,
                template_id=request.template_id,
                delay_minutes=request.delay_minutes,
                max_daily_sends=request.max_daily_sends
            )
            
            return {"rule_id": rule_id, "status": "created"}
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/scheduler/automation")
    async def list_automation_rules():
        """List all automation rules"""
        try:
            scheduler = get_scheduler()
            rules = list(scheduler.automation_rules.values())
            
            # Convert to JSON-serializable format
            result = []
            for rule in rules:
                rule_dict = {
                    "id": rule.id,
                    "name": rule.name,
                    "trigger": rule.trigger.value,
                    "conditions": rule.conditions,
                    "template_id": rule.template_id,
                    "enabled": rule.enabled,
                    "delay_minutes": rule.delay_minutes,
                    "max_daily_sends": rule.max_daily_sends,
                    "daily_send_count": rule.daily_send_count,
                    "created_at": rule.created_at.isoformat()
                }
                result.append(rule_dict)
            
            return {"rules": result, "count": len(result)}
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.put("/api/scheduler/automation/{rule_id}/toggle")
    async def toggle_automation_rule(rule_id: str):
        """Enable/disable an automation rule"""
        try:
            scheduler = get_scheduler()
            rule = scheduler.automation_rules.get(rule_id)
            
            if not rule:
                raise HTTPException(status_code=404, detail="Rule not found")
            
            rule.enabled = not rule.enabled
            scheduler._save_automation_rules()
            
            return {"rule_id": rule_id, "enabled": rule.enabled}
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # ==================== RECURRING SCHEDULES ====================
    
    @app.post("/api/scheduler/recurring")
    async def create_recurring_schedule(
        cron_expression: str,
        template_id: str,
        to: str,
        variables: Dict[str, str]
    ):
        """Create a recurring email schedule"""
        try:
            scheduler = get_scheduler()
            
            task_id = scheduler.create_recurring_schedule(
                cron_expression=cron_expression,
                template_id=template_id,
                to=to,
                variables=variables
            )
            
            return {"task_id": task_id, "status": "created"}
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    # ==================== AUTOMATION TRIGGERS ====================
    
    @app.post("/api/scheduler/trigger-automation")
    async def trigger_automation(email_data: Dict[str, Any], analysis_data: Dict[str, Any]):
        """Manually trigger automation based on email analysis"""
        try:
            scheduler = get_scheduler()
            
            # Convert analysis data back to EmailIntelligence object
            from email_intelligence_engine import EmailIntelligence, EmailClass, Urgency, Sentiment, ActionItem
            
            # Parse action items
            action_items = []
            for item_data in analysis_data.get("action_items", []):
                action_items.append(ActionItem(
                    text=item_data["text"],
                    assignee=item_data.get("assignee"),
                    deadline=datetime.fromisoformat(item_data["deadline"]) if item_data.get("deadline") else None,
                    confidence=item_data.get("confidence", 0.0)
                ))
            
            # Parse deadlines
            deadlines = []
            for deadline_data in analysis_data.get("deadlines", []):
                deadlines.append((
                    datetime.fromisoformat(deadline_data[0]),
                    deadline_data[1]
                ))
            
            analysis = EmailIntelligence(
                classification=EmailClass(analysis_data["classification"]),
                confidence=analysis_data["confidence"],
                urgency=Urgency(analysis_data["urgency"]),
                sentiment=Sentiment(analysis_data["sentiment"]),
                intent=analysis_data["intent"],
                action_items=action_items,
                deadlines=deadlines,
                confidence_scores=analysis_data.get("confidence_scores", {}),
                processing_time_ms=analysis_data.get("processing_time_ms", 0.0)
            )
            
            triggered_responses = scheduler.trigger_automation(email_data, analysis)
            
            return {
                "triggered_responses": triggered_responses,
                "count": len(triggered_responses)
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # ==================== STATISTICS AND MONITORING ====================
    
    @app.get("/api/scheduler/stats")
    async def get_scheduler_stats():
        """Get scheduler statistics"""
        try:
            scheduler = get_scheduler()
            stats = scheduler.get_stats()
            return stats
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/scheduler/tasks/stats")
    async def get_task_stats():
        """Get task manager statistics"""
        try:
            scheduler = get_scheduler()
            stats = scheduler.task_manager.get_stats()
            return stats
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/scheduler/health")
    async def health_check():
        """Health check endpoint"""
        try:
            scheduler = get_scheduler()
            
            redis_ok = scheduler._test_redis_connection()
            celery_ok = True  # Could add Celery health check
            
            return {
                "status": "healthy" if redis_ok and celery_ok else "degraded",
                "redis_connected": redis_ok,
                "celery_connected": celery_ok,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    # ==================== BULK OPERATIONS ====================
    
    @app.post("/api/scheduler/bulk/schedule")
    async def bulk_schedule_emails(emails: List[EmailScheduleRequest]):
        """Schedule multiple emails at once"""
        try:
            scheduler = get_scheduler()
            results = []
            
            for email_request in emails:
                try:
                    email_id = scheduler.schedule_email(
                        to=email_request.to,
                        subject=email_request.subject,
                        body=email_request.body,
                        scheduled_time=email_request.scheduled_time,
                        cc=email_request.cc,
                        bcc=email_request.bcc
                    )
                    results.append({"email_id": email_id, "status": "scheduled", "to": email_request.to})
                    
                except Exception as e:
                    results.append({"status": "failed", "error": str(e), "to": email_request.to})
            
            successful = len([r for r in results if r["status"] == "scheduled"])
            failed = len([r for r in results if r["status"] == "failed"])
            
            return {
                "results": results,
                "summary": {
                    "total": len(emails),
                    "successful": successful,
                    "failed": failed
                }
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.delete("/api/scheduler/cleanup")
    async def cleanup_old_tasks(days_old: int = 30):
        """Clean up old completed/failed tasks"""
        try:
            scheduler = get_scheduler()
            cleaned_count = scheduler.task_manager.cleanup_old_tasks(days_old)
            
            return {
                "cleaned_count": cleaned_count,
                "days_old": days_old,
                "status": "completed"
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# ==================== WEBHOOK INTEGRATION ====================

async def process_incoming_email_webhook(email_data: Dict[str, Any]):
    """
    Process incoming email webhook for automation triggers.
    This would be called from the main email processing pipeline.
    """
    try:
        scheduler = get_scheduler()
        
        # First, analyze the email with AI
        analysis = scheduler.ai_engine.analyze_email(
            subject=email_data.get("subject", ""),
            body=email_data.get("body", ""),
            sender=email_data.get("sender", "")
        )
        
        # Trigger any matching automation rules
        triggered_responses = scheduler.trigger_automation(email_data, analysis)
        
        return {
            "analysis": {
                "classification": analysis.classification.value,
                "urgency": analysis.urgency.value,
                "confidence": analysis.confidence,
                "processing_time_ms": analysis.processing_time_ms
            },
            "automation": {
                "triggered_responses": triggered_responses,
                "count": len(triggered_responses)
            }
        }
        
    except Exception as e:
        print(f"Error processing email webhook: {e}")
        return {"error": str(e)}


# ==================== INTEGRATION EXAMPLE ====================

def integrate_with_main_app():
    """
    Example of how to integrate the scheduler with the main FastAPI app.
    This would be called from main_optimized.py or similar.
    """
    
    # In main_optimized.py, add:
    """
    from scheduler_api_integration import setup_scheduler_routes
    
    # After creating the FastAPI app
    app = FastAPI(...)
    
    # Add scheduler routes
    setup_scheduler_routes(app)
    
    # In your email processing endpoint
    @app.post("/api/emails/process")
    async def process_email(email_data: Dict[str, Any]):
        # ... existing email processing ...
        
        # Add automation trigger
        automation_result = await process_incoming_email_webhook(email_data)
        
        return {
            "email_processing": {...},
            "automation": automation_result
        }
    """
    
    print("Integration example provided in comments above")


if __name__ == "__main__":
    print("Email Scheduler API Integration")
    print("This module provides FastAPI routes for the email scheduling system.")
    print("Import and call setup_scheduler_routes(app) to add routes to your FastAPI app.")
    
    integrate_with_main_app()