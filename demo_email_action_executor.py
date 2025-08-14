#!/usr/bin/env python3
"""
Email Action Executor Demo and Test Script

Comprehensive demonstration of the email action execution system including:
- Integration with GPT-5 email intelligence
- Queue-based action processing
- Approval workflows
- Team member management
- External system integrations
- Undo capabilities
"""

import json
import logging
import time
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Import our components
from email_action_executor import (
    EmailActionExecutor, ActionType, Priority, ExecutionContext,
    ActionStatus, TeamMember
)
from email_intelligence_engine import EmailIntelligenceEngine, EmailClass


def setup_logging():
    """Setup logging for demo"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('email_action_demo.log')
        ]
    )


def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")


def print_subsection(title: str):
    """Print a formatted subsection header"""
    print(f"\n{'-'*40}")
    print(f" {title}")
    print(f"{'-'*40}")


def demo_email_intelligence_integration():
    """Demonstrate integration with email intelligence engine"""
    print_section("EMAIL INTELLIGENCE INTEGRATION DEMO")
    
    # Initialize components
    intelligence_engine = EmailIntelligenceEngine()
    executor = EmailActionExecutor()
    
    # Sample emails that would trigger different actions
    test_emails = [
        {
            "id": "email-001",
            "subject": "URGENT: Please approve Q4 budget by EOD",
            "body": """Hi team,

I need your approval for the Q4 marketing budget proposal. The total amount is $150,000 and includes:
- Digital advertising: $80,000
- Content creation: $40,000  
- Events and conferences: $30,000

Please review the attached document and approve by end of day today so we can proceed with planning.

Thanks,
Sarah""",
            "sender": "sarah.johnson@company.com",
            "received": "2024-08-14T09:30:00"
        },
        {
            "id": "email-002", 
            "subject": "Can you help with the database performance issue?",
            "body": """Hi Alex,

We're experiencing significant performance issues with the production database. Query response times have increased by 300% since yesterday and users are complaining.

Could you please investigate this and implement a fix? This is blocking several customer operations.

Let me know if you need any additional information.

Best,
Mike""",
            "sender": "mike.chen@company.com",
            "received": "2024-08-14T10:15:00"
        },
        {
            "id": "email-003",
            "subject": "Meeting request: Weekly team sync",
            "body": """Hi everyone,

I'd like to schedule our weekly team sync for this Thursday at 2:00 PM. We'll cover:
- Sprint progress updates
- Upcoming deliverables
- Resource allocation

Please let me know if you can attend. The meeting should take about 1 hour.

Thanks,
Jennifer""",
            "sender": "jennifer.taylor@company.com", 
            "received": "2024-08-14T11:00:00"
        }
    ]
    
    print("Analyzing emails and generating suggested actions...")
    
    for email in test_emails:
        print_subsection(f"Email: {email['subject'][:50]}...")
        
        # Analyze email with intelligence engine
        analysis = intelligence_engine.analyze_email(
            subject=email["subject"],
            body=email["body"],
            sender=email["sender"]
        )
        
        print(f"📧 From: {email['sender']}")
        print(f"🏷️  Classification: {analysis.classification.value}")
        print(f"🔥 Urgency: {analysis.urgency.value}")
        print(f"😊 Sentiment: {analysis.sentiment.value}")
        print(f"🎯 Intent: {analysis.intent}")
        print(f"📊 Confidence: {analysis.confidence:.2f}")
        
        if analysis.action_items:
            print(f"✅ Action Items:")
            for item in analysis.action_items:
                print(f"   • {item.text}")
                if item.assignee:
                    print(f"     Assignee: {item.assignee}")
                if item.deadline:
                    print(f"     Deadline: {item.deadline}")
        
        # Generate suggested actions based on classification
        suggested_actions = generate_actions_from_analysis(email, analysis)
        
        if suggested_actions:
            print(f"🤖 Suggested Actions:")
            for i, action in enumerate(suggested_actions, 1):
                print(f"   {i}. {action['description']}")
                print(f"      Type: {action['type'].value}")
                print(f"      Priority: {action['priority'].name}")
        
        print()
    
    return test_emails


def generate_actions_from_analysis(email, analysis):
    """Generate suggested actions based on email analysis"""
    actions = []
    
    classification = analysis.classification
    urgency = analysis.urgency
    
    # Create demo context
    context = ExecutionContext(
        user_id="demo@company.com",
        session_id="demo-session",
        email_id=email["id"],
        original_email=email
    )
    
    if classification == EmailClass.APPROVAL_REQUIRED:
        actions.append({
            "type": ActionType.APPROVE_REQUEST,
            "description": "Process approval request",
            "priority": Priority.HIGH if urgency.name == "HIGH" else Priority.MEDIUM,
            "params": {
                "request_id": email["id"],
                "request_type": "budget_approval",
                "amount": "$150,000",
                "requester": email["sender"]
            },
            "context": context
        })
        
        actions.append({
            "type": ActionType.SEND_REPLY,
            "description": "Send approval confirmation",
            "priority": Priority.HIGH,
            "params": {
                "message_id": email["id"],
                "reply_content": "Thank you for the budget proposal. I approve the Q4 marketing budget as outlined. Please proceed with implementation."
            },
            "context": context
        })
    
    elif classification == EmailClass.DELEGATE:
        # Find appropriate assignee
        assignee = suggest_assignee_for_task(email["body"])
        
        actions.append({
            "type": ActionType.DELEGATE_TASK,
            "description": f"Delegate to {assignee}",
            "priority": Priority.HIGH if urgency.name in ["CRITICAL", "HIGH"] else Priority.MEDIUM,
            "params": {
                "task_description": email["body"],
                "assignee_email": assignee,
                "original_requester": email["sender"],
                "priority": urgency.name.lower(),
                "due_date": (datetime.now() + timedelta(days=1)).isoformat()
            },
            "context": context
        })
        
        actions.append({
            "type": ActionType.CREATE_TASK,
            "description": "Create tracking task",
            "priority": Priority.MEDIUM,
            "params": {
                "title": f"Database performance investigation - {email['subject']}",
                "description": email["body"],
                "assignee": assignee,
                "due_date": (datetime.now() + timedelta(days=2)).isoformat(),
                "project": "infrastructure"
            },
            "context": context
        })
    
    elif classification == EmailClass.SCHEDULE_MEETING:
        actions.append({
            "type": ActionType.SCHEDULE_MEETING,
            "description": "Schedule requested meeting",
            "priority": Priority.MEDIUM,
            "params": {
                "title": "Weekly Team Sync",
                "attendees": ["team@company.com"],
                "start_time": (datetime.now().replace(hour=14, minute=0) + timedelta(days=2)).isoformat(),
                "duration": 60,
                "location": "Conference Room A",
                "description": "Weekly team sync covering sprint progress and upcoming deliverables"
            },
            "context": context
        })
    
    elif classification == EmailClass.NEEDS_REPLY:
        actions.append({
            "type": ActionType.SEND_REPLY,
            "description": "Send acknowledgment reply",
            "priority": Priority.MEDIUM,
            "params": {
                "message_id": email["id"],
                "reply_content": "Thank you for your email. I've received your request and will get back to you with more details soon."
            },
            "context": context
        })
    
    return actions


def suggest_assignee_for_task(task_description):
    """Suggest assignee based on task content (simplified)"""
    task_lower = task_description.lower()
    
    if any(word in task_lower for word in ["database", "performance", "infrastructure"]):
        return "alex.smith@company.com"
    elif any(word in task_lower for word in ["frontend", "ui", "react"]):
        return "emma.williams@company.com"  
    elif any(word in task_lower for word in ["backend", "api", "server"]):
        return "mike.chen@company.com"
    elif any(word in task_lower for word in ["test", "qa", "quality"]):
        return "lisa.rodriguez@company.com"
    else:
        return "sarah.johnson@company.com"  # Default to manager


def demo_action_execution():
    """Demonstrate action execution with approval workflows"""
    print_section("ACTION EXECUTION DEMO")
    
    executor = EmailActionExecutor()
    executor.start()
    
    # Demo context
    context = ExecutionContext(
        user_id="demo@company.com",
        session_id="demo-session-456"
    )
    
    # Submit various actions
    print_subsection("Submitting Actions")
    
    actions_to_submit = [
        {
            "type": ActionType.SEND_REPLY,
            "params": {
                "message_id": "msg-001",
                "reply_content": "Thank you for reaching out. I'll review this and respond by Friday."
            },
            "priority": Priority.MEDIUM,
            "description": "Send reply to customer inquiry"
        },
        {
            "type": ActionType.CREATE_TASK,
            "params": {
                "title": "Implement user authentication system",
                "description": "Design and implement OAuth 2.0 authentication for the web application",
                "assignee": "mike.chen@company.com",
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "project": "web_app"
            },
            "priority": Priority.HIGH,
            "description": "Create development task"
        },
        {
            "type": ActionType.SCHEDULE_MEETING,
            "params": {
                "title": "Architecture Review",
                "attendees": ["sarah.johnson@company.com", "mike.chen@company.com"],
                "start_time": (datetime.now() + timedelta(days=1)).replace(hour=15, minute=0).isoformat(),
                "duration": 90,
                "location": "Conference Room B",
                "description": "Review system architecture for Q4 initiatives"
            },
            "priority": Priority.MEDIUM,
            "description": "Schedule architecture review meeting"
        },
        {
            "type": ActionType.DELEGATE_TASK,
            "params": {
                "task_description": "Investigate and fix SSL certificate renewal issues",
                "assignee_email": "alex.smith@company.com",
                "original_requester": "security@company.com",
                "priority": "high",
                "due_date": (datetime.now() + timedelta(days=1)).isoformat()
            },
            "priority": Priority.HIGH,
            "description": "Delegate SSL certificate fix"
        }
    ]
    
    submitted_action_ids = []
    
    for action_info in actions_to_submit:
        action_id = executor.submit_action(
            action_type=action_info["type"],
            parameters=action_info["params"],
            context=context,
            priority=action_info["priority"]
        )
        submitted_action_ids.append(action_id)
        
        print(f"✅ Submitted: {action_info['description']}")
        print(f"   Action ID: {action_id}")
        print(f"   Type: {action_info['type'].value}")
        print(f"   Priority: {action_info['priority'].name}")
        print()
    
    # Wait for initial processing
    print("⏳ Waiting for initial processing...")
    time.sleep(3)
    
    # Check action statuses
    print_subsection("Action Status Report")
    
    for action_id in submitted_action_ids:
        status = executor.get_action_status(action_id)
        if status:
            print(f"🔍 Action {action_id[:8]}...")
            print(f"   Status: {status['status']}")
            print(f"   Type: {status['action_type']}")
            if status.get('executed_at'):
                print(f"   Executed: {status['executed_at']}")
            if status.get('error_message'):
                print(f"   Error: {status['error_message']}")
            print()
    
    # Show pending approvals
    print_subsection("Pending Approvals")
    
    pending_approvals = executor.get_pending_approvals()
    if pending_approvals:
        print(f"📋 Found {len(pending_approvals)} pending approvals:")
        for approval in pending_approvals:
            print(f"   • {approval['action_type']} (Action: {approval['action_id'][:8]}...)")
            print(f"     Requested: {approval['requested_at']}")
            print(f"     Priority: {approval['priority']}")
            print()
        
        # Demo approval process
        if pending_approvals:
            approval = pending_approvals[0]
            print(f"🔄 Demonstrating approval for: {approval['action_type']}")
            
            # Approve the first pending action
            success = executor.approve_action(
                approval_id=approval['approval_id'],
                approver_id="sarah.johnson@company.com",
                comments="Approved via demo - action looks good to proceed"
            )
            
            if success:
                print("✅ Approval successful!")
                
                # Wait for execution
                time.sleep(2)
                
                # Check updated status
                updated_status = executor.get_action_status(approval['action_id'])
                if updated_status:
                    print(f"   Updated status: {updated_status['status']}")
    else:
        print("📝 No pending approvals found")
    
    executor.stop()
    return submitted_action_ids


def demo_team_management():
    """Demonstrate team member management and skill-based assignment"""
    print_section("TEAM MANAGEMENT DEMO")
    
    executor = EmailActionExecutor()
    
    print_subsection("Team Directory")
    
    print("👥 Current team members:")
    for email, member in executor.team_directory.items():
        print(f"   • {member.name} ({member.role})")
        print(f"     Email: {email}")
        print(f"     Skills: {', '.join(member.skills)}")
        print(f"     Availability: {member.availability}")
        print()
    
    print_subsection("Skill-Based Assignment Demo")
    
    # Test scenarios for assignment
    test_scenarios = [
        {
            "task": "Debug production API performance issues",
            "required_skills": ["backend", "database", "api_development"]
        },
        {
            "task": "Design new user interface for mobile app",
            "required_skills": ["frontend", "ui_design", "mobile"]
        },
        {
            "task": "Set up CI/CD pipeline for new microservice",
            "required_skills": ["infrastructure", "deployment"]
        },
        {
            "task": "Conduct security audit of web application",
            "required_skills": ["security", "penetration_testing"]
        },
        {
            "task": "Analyze user engagement metrics and create report",
            "required_skills": ["data_science", "analytics"]
        }
    ]
    
    for scenario in test_scenarios:
        suggested_assignee = executor.suggest_assignee(
            task_description=scenario["task"],
            required_skills=scenario["required_skills"]
        )
        
        if suggested_assignee:
            member_info = executor.get_team_member_info(suggested_assignee)
            print(f"📋 Task: {scenario['task']}")
            print(f"🎯 Required skills: {', '.join(scenario['required_skills'])}")
            print(f"👤 Suggested assignee: {member_info['name']} ({suggested_assignee})")
            print(f"   Role: {member_info['role']}")
            print(f"   Matching skills: {', '.join(set(scenario['required_skills']) & set(member_info['skills']))}")
            print()


def demo_undo_capabilities():
    """Demonstrate undo capabilities"""
    print_section("UNDO CAPABILITIES DEMO")
    
    executor = EmailActionExecutor()
    executor.start()
    
    context = ExecutionContext(
        user_id="demo@company.com",
        session_id="undo-demo-session"
    )
    
    print_subsection("Creating Actions with Undo Support")
    
    # Submit actions that support undo
    undo_actions = [
        {
            "type": ActionType.CREATE_TASK,
            "params": {
                "title": "Test task for undo demo",
                "description": "This task will be created and then undone",
                "assignee": "lisa.rodriguez@company.com",
                "due_date": (datetime.now() + timedelta(days=3)).isoformat()
            },
            "priority": Priority.LOW,
            "description": "Create test task"
        },
        {
            "type": ActionType.SET_REMINDER,
            "params": {
                "text": "Demo reminder for undo test",
                "time": (datetime.now() + timedelta(hours=2)).isoformat()
            },
            "priority": Priority.LOW,
            "description": "Set test reminder"
        }
    ]
    
    action_results = []
    
    for action_info in undo_actions:
        action_id = executor.submit_action(
            action_type=action_info["type"],
            parameters=action_info["params"],
            context=context,
            priority=action_info["priority"]
        )
        
        print(f"✅ Created: {action_info['description']} (ID: {action_id})")
        action_results.append((action_id, action_info))
    
    # Wait for execution
    print("\n⏳ Waiting for execution...")
    time.sleep(3)
    
    print_subsection("Checking for Undo Tokens")
    
    undo_tokens = []
    for action_id, action_info in action_results:
        status = executor.get_action_status(action_id)
        if status and status.get('undo_token'):
            undo_token = status['undo_token']
            undo_tokens.append((undo_token, action_info['description']))
            print(f"🎫 Undo token available for '{action_info['description']}': {undo_token}")
    
    if undo_tokens:
        print_subsection("Demonstrating Undo")
        
        # Undo the first action
        undo_token, description = undo_tokens[0]
        print(f"🔄 Attempting to undo: {description}")
        
        success = executor.undo_action(undo_token)
        if success:
            print("✅ Undo successful!")
        else:
            print("❌ Undo failed!")
    else:
        print("📝 No undo tokens available (actions may not have completed yet)")
    
    executor.stop()


def demo_statistics_and_monitoring():
    """Demonstrate statistics and monitoring capabilities"""
    print_section("STATISTICS AND MONITORING DEMO")
    
    executor = EmailActionExecutor()
    
    print_subsection("Execution Statistics")
    
    stats = executor.get_statistics()
    
    print(f"📊 **Overall Statistics:**")
    print(f"   Total actions processed: {stats['total_actions']}")
    print(f"   Success rate: {stats['success_rate_percent']:.1f}%")
    print(f"   Average execution time: {stats['average_execution_time_ms']:.1f}ms")
    print(f"   Currently active actions: {stats['active_actions']}")
    print(f"   Queue size: {stats['queue_size']}")
    print(f"   Undo stack size: {stats['undo_stack_size']}")
    
    print(f"\n📈 **Status Distribution:**")
    for status, count in stats['status_distribution'].items():
        print(f"   {status}: {count}")
    
    print(f"\n🔧 **Action Type Distribution:**")
    for action_type, count in stats['action_type_distribution'].items():
        print(f"   {action_type}: {count}")
    
    print_subsection("System Health Check")
    
    # Check configuration
    config_status = "✅ OK" if Path("action_config.json").exists() else "❌ Missing"
    team_status = "✅ OK" if Path("team_directory.json").exists() else "❌ Missing"
    templates_status = "✅ OK" if Path("templates").exists() else "❌ Missing"
    db_status = "✅ OK" if Path("email_actions.db").exists() else "❌ Missing"
    
    print(f"Configuration file: {config_status}")
    print(f"Team directory: {team_status}")
    print(f"Email templates: {templates_status}")
    print(f"Database: {db_status}")
    
    # Check external integrations
    print(f"\n🔌 **External Integrations:**")
    config = executor.config.get("external_integrations", {})
    for service, settings in config.items():
        enabled = settings.get("enabled", False)
        status = "✅ Enabled" if enabled else "⚪ Disabled"
        print(f"   {service.title()}: {status}")


def run_comprehensive_demo():
    """Run the complete comprehensive demo"""
    setup_logging()
    
    print_section("EMAIL ACTION EXECUTOR COMPREHENSIVE DEMO")
    print("This demo showcases the complete email action execution system")
    print("including AI integration, queue processing, approvals, and team management.")
    
    try:
        # Run all demo sections
        test_emails = demo_email_intelligence_integration()
        action_ids = demo_action_execution()
        demo_team_management()
        demo_undo_capabilities()
        demo_statistics_and_monitoring()
        
        print_section("DEMO COMPLETION")
        print("✅ All demo sections completed successfully!")
        print("\n📝 **Summary:**")
        print(f"   - Analyzed {len(test_emails)} sample emails")
        print(f"   - Submitted {len(action_ids)} actions for execution")
        print(f"   - Demonstrated approval workflows")
        print(f"   - Showcased team member management")
        print(f"   - Tested undo capabilities")
        print(f"   - Displayed system statistics")
        
        print(f"\n📁 **Generated Files:**")
        print(f"   - email_actions.db (SQLite database)")
        print(f"   - action_config.json (Configuration)")
        print(f"   - team_directory.json (Team members)")
        print(f"   - templates/ (Email templates)")
        print(f"   - email_action_demo.log (Demo log)")
        
        print(f"\n🚀 **Next Steps:**")
        print(f"   1. Configure external integrations (Jira, Asana, etc.)")
        print(f"   2. Customize team directory for your organization")
        print(f"   3. Modify email templates to match your style")
        print(f"   4. Set up production deployment with proper security")
        print(f"   5. Integrate with your existing email workflow")
        
    except Exception as e:
        print(f"❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_comprehensive_demo()