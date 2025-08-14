#!/usr/bin/env python3
"""
Email Scheduler Demo

Demonstrates the email scheduling and automation system capabilities.
"""

import asyncio
import json
from datetime import datetime, timedelta
from email_scheduler import (
    EmailScheduler, 
    EmailSchedulerConfig,
    ScheduleType,
    AutomationTrigger,
    create_default_templates
)
from email_intelligence_engine import EmailClass, Urgency, Sentiment


async def main():
    """Demo the email scheduling system"""
    
    print("🚀 Email Scheduling and Automation System Demo")
    print("=" * 60)
    
    # Initialize scheduler
    config = EmailSchedulerConfig()
    scheduler = EmailScheduler(config)
    
    # Create default templates
    create_default_templates(scheduler)
    
    print(f"✅ Scheduler initialized with {len(scheduler.templates)} templates")
    
    # Demo 1: Create a custom template
    print("\n📝 Demo 1: Creating Custom Template")
    template_id = scheduler.create_template(
        name="Project Update",
        subject_template="Project {project_name} - Weekly Update",
        body_template="""Hi {recipient_name},

Here's the weekly update for project {project_name}:

Status: {status}
Progress: {progress}%
Next milestone: {next_milestone}

Best regards,
{sender_name}""",
        classification=EmailClass.FYI_ONLY,
        tags=["project", "update", "weekly"]
    )
    
    print(f"✅ Created template: {template_id}")
    
    # Demo 2: Schedule a simple email
    print("\n📅 Demo 2: Scheduling Simple Email")
    send_time = datetime.now() + timedelta(minutes=2)
    
    email_id = scheduler.schedule_email(
        to="demo@example.com",
        subject="Scheduled Test Email",
        body="This email was scheduled using the email automation system!",
        scheduled_time=send_time,
        schedule_type=ScheduleType.ONE_TIME
    )
    
    print(f"✅ Scheduled email {email_id} for {send_time}")
    
    # Demo 3: Schedule template-based email
    print("\n📋 Demo 3: Scheduling Template-Based Email")
    template_variables = {
        "recipient_name": "Alice",
        "project_name": "AI Email System",
        "status": "On Track",
        "progress": "85",
        "next_milestone": "Production Deployment",
        "sender_name": "Project Manager"
    }
    
    template_email_id = scheduler.schedule_template_email(
        template_id=template_id,
        to="alice@example.com",
        variables=template_variables,
        scheduled_time=datetime.now() + timedelta(minutes=3)
    )
    
    print(f"✅ Scheduled template email {template_email_id}")
    
    # Demo 4: Create automation rule
    print("\n🤖 Demo 4: Creating Automation Rule")
    rule_id = scheduler.create_automation_rule(
        name="Auto-acknowledge urgent emails",
        trigger=AutomationTrigger.URGENCY,
        conditions={"urgency": Urgency.CRITICAL.value},
        template_id=list(scheduler.templates.keys())[0],  # Use first template
        delay_minutes=1,
        max_daily_sends=5
    )
    
    print(f"✅ Created automation rule: {rule_id}")
    
    # Demo 5: Test automation trigger
    print("\n⚡ Demo 5: Testing Automation Trigger")
    
    # Simulate an email that would trigger automation
    email_data = {
        "subject": "URGENT: Server Down!",
        "body": "The production server is down and needs immediate attention.",
        "sender": "alerts@company.com",
        "sender_name": "System Alerts"
    }
    
    # Simulate AI analysis
    from email_intelligence_engine import EmailIntelligence, ActionItem
    
    mock_analysis = EmailIntelligence(
        classification=EmailClass.NEEDS_REPLY,
        confidence=0.95,
        urgency=Urgency.CRITICAL,
        sentiment=Sentiment.NEGATIVE,
        intent="report_critical_issue",
        action_items=[
            ActionItem(text="Investigate server outage", confidence=0.9),
            ActionItem(text="Restore service", confidence=0.85)
        ],
        deadlines=[],
        confidence_scores={"classification": 0.95, "urgency": 0.9},
        processing_time_ms=45.2
    )
    
    triggered_responses = scheduler.trigger_automation(email_data, mock_analysis)
    print(f"✅ Triggered {len(triggered_responses)} automated responses")
    
    # Demo 6: Create recurring schedule
    print("\n🔄 Demo 6: Creating Recurring Schedule")
    
    # Weekly team update (every Monday at 9 AM)
    recurring_id = scheduler.create_recurring_schedule(
        cron_expression="0 9 * * MON",  # Every Monday at 9 AM
        template_id=template_id,
        to="team@company.com",
        variables={
            "recipient_name": "Team",
            "project_name": "Weekly Status",
            "status": "In Progress",
            "progress": "Variable",
            "next_milestone": "Weekly Goals",
            "sender_name": "Automation System"
        }
    )
    
    print(f"✅ Created recurring schedule: {recurring_id}")
    
    # Demo 7: Show current stats
    print("\n📊 Demo 7: Current System Stats")
    stats = scheduler.get_stats()
    
    print(json.dumps(stats, indent=2))
    
    # Demo 8: List scheduled emails
    print("\n📋 Demo 8: Scheduled Emails")
    scheduled_emails = scheduler.get_scheduled_emails()
    
    print(f"Total scheduled emails: {len(scheduled_emails)}")
    for email in scheduled_emails[:3]:  # Show first 3
        print(f"  - {email.id}: {email.subject} -> {email.to} at {email.scheduled_time}")
    
    # Demo 9: List templates
    print("\n📝 Demo 9: Available Templates")
    templates = scheduler.list_templates()
    
    print(f"Total templates: {len(templates)}")
    for template in templates[:3]:  # Show first 3
        print(f"  - {template.name}: {template.subject_template}")
    
    # Demo 10: Show task manager stats
    print("\n⚙️ Demo 10: Task Manager Stats")
    task_stats = scheduler.task_manager.get_stats()
    
    print(json.dumps(task_stats, indent=2))
    
    print("\n" + "=" * 60)
    print("✨ Demo completed! Email scheduling system is ready for production use.")
    print("\nKey Features Demonstrated:")
    print("- ✅ Template management")
    print("- ✅ Email scheduling")
    print("- ✅ Automation rules")
    print("- ✅ Recurring schedules")
    print("- ✅ AI-triggered responses")
    print("- ✅ Background task processing")
    print("- ✅ Performance monitoring")
    
    print(f"\nAI Models Used:")
    print(f"- Classification: {scheduler.ai_engine.classifier_model}")
    print(f"- Draft Generation: {scheduler.ai_engine.draft_model}")


if __name__ == "__main__":
    asyncio.run(main())