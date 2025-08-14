#!/usr/bin/env python3
"""
GPT-5 Email Action Integration

Integrates the Email Intelligence Engine (GPT-5) with the Email Action Executor
to create a complete automated email processing pipeline.
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from email_intelligence_engine import EmailIntelligenceEngine, EmailClass
from email_action_executor import (
    EmailActionExecutor, ActionType, Priority, ExecutionContext
)
from mail_tool import MailTool


class GPT5ActionIntegration:
    """
    Integration layer between GPT-5 email intelligence and action execution.
    
    This class orchestrates the complete email processing workflow:
    1. Fetch emails from Apple Mail
    2. Analyze emails with GPT-5 intelligence
    3. Generate appropriate actions
    4. Execute actions with approval workflows
    5. Monitor and report results
    """
    
    def __init__(self, config_path: str = "gpt5_integration_config.json"):
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.intelligence_engine = EmailIntelligenceEngine()
        self.action_executor = EmailActionExecutor()
        self.mail_tool = MailTool()
        
        # Load integration configuration
        self.config = self._load_config(config_path)
        
        # Processing state
        self.processed_emails = set()
        self.active_sessions = {}
        
        self.logger.info("GPT-5 Action Integration initialized")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load integration configuration"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            # Default configuration
            default_config = {
                "email_processing": {
                    "check_interval_minutes": 5,
                    "max_emails_per_batch": 20,
                    "skip_processed_emails": True,
                    "process_unread_only": True
                },
                "action_generation": {
                    "confidence_threshold": 0.7,
                    "auto_execute_threshold": 0.9,
                    "require_approval_below": 0.8,
                    "max_actions_per_email": 3
                },
                "priority_mapping": {
                    "CRITICAL": "HIGH",
                    "HIGH": "HIGH", 
                    "MEDIUM": "MEDIUM",
                    "LOW": "LOW"
                },
                "classification_to_action": {
                    "NEEDS_REPLY": ["SEND_REPLY"],
                    "APPROVAL_REQUIRED": ["APPROVE_REQUEST", "SEND_REPLY"],
                    "CREATE_TASK": ["CREATE_TASK", "DELEGATE_TASK"],
                    "DELEGATE": ["DELEGATE_TASK", "CREATE_TASK"],
                    "FOLLOW_UP": ["SET_REMINDER", "FOLLOW_UP"],
                    "FYI_ONLY": []
                },
                "auto_reply_templates": {
                    "acknowledgment": "Thank you for your email. I've received your request and will respond appropriately.",
                    "approval": "Thank you for your request. I've reviewed and approved it. Please proceed as outlined.",
                    "delegation": "Thank you for bringing this to my attention. I've assigned this to the appropriate team member who will follow up with you.",
                    "task_created": "I've created a task to address your request. You'll receive updates as we make progress."
                }
            }
            
            # Save default config
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            
            return default_config
    
    def start_processing(self):
        """Start the email processing system"""
        self.action_executor.start()
        self.logger.info("Started GPT-5 Action Integration processing")
    
    def stop_processing(self):
        """Stop the email processing system"""
        self.action_executor.stop()
        self.logger.info("Stopped GPT-5 Action Integration processing")
    
    def process_emails_batch(self, limit: int = None) -> Dict:
        """
        Process a batch of emails through the complete pipeline
        
        Returns:
            Dict with processing results and statistics
        """
        start_time = datetime.now()
        
        # Get configuration
        config = self.config["email_processing"]
        batch_size = limit or config["max_emails_per_batch"]
        
        # Fetch emails
        if config["process_unread_only"]:
            emails = self.mail_tool.get_unread_emails(limit=batch_size)
        else:
            emails = self.mail_tool.get_recent_emails(limit=batch_size)
        
        self.logger.info(f"Fetched {len(emails)} emails for processing")
        
        # Filter out already processed emails
        if config["skip_processed_emails"]:
            emails = [email for email in emails if email.get("id") not in self.processed_emails]
            self.logger.info(f"Processing {len(emails)} new emails")
        
        # Process each email
        results = {
            "total_emails": len(emails),
            "processed_successfully": 0,
            "processing_errors": 0,
            "actions_generated": 0,
            "actions_executed": 0,
            "actions_pending_approval": 0,
            "processing_time_ms": 0,
            "email_details": []
        }
        
        for email in emails:
            try:
                email_result = self._process_single_email(email)
                results["email_details"].append(email_result)
                
                if email_result["success"]:
                    results["processed_successfully"] += 1
                    results["actions_generated"] += len(email_result["actions"])
                    results["actions_executed"] += len([a for a in email_result["actions"] if a["status"] == "executed"])
                    results["actions_pending_approval"] += len([a for a in email_result["actions"] if a["status"] == "pending_approval"])
                else:
                    results["processing_errors"] += 1
                
                # Mark as processed
                if email.get("id"):
                    self.processed_emails.add(email["id"])
            
            except Exception as e:
                self.logger.error(f"Error processing email {email.get('id', 'unknown')}: {e}")
                results["processing_errors"] += 1
        
        results["processing_time_ms"] = (datetime.now() - start_time).total_seconds() * 1000
        
        self.logger.info(f"Batch processing completed: {results['processed_successfully']}/{results['total_emails']} emails processed successfully")
        
        return results
    
    def _process_single_email(self, email: Dict) -> Dict:
        """Process a single email through the complete pipeline"""
        email_id = email.get("id", f"email-{int(time.time())}")
        
        try:
            # 1. Analyze email with GPT-5 intelligence
            analysis = self.intelligence_engine.analyze_email(
                subject=email.get("subject", ""),
                body=email.get("content", ""),
                sender=email.get("from", ""),
                metadata=email
            )
            
            # 2. Generate actions based on analysis
            suggested_actions = self._generate_actions_from_analysis(email, analysis)
            
            # 3. Execute actions
            executed_actions = []
            for action_config in suggested_actions:
                action_result = self._execute_action(action_config, email_id)
                executed_actions.append(action_result)
            
            return {
                "success": True,
                "email_id": email_id,
                "subject": email.get("subject", ""),
                "from": email.get("from", ""),
                "analysis": {
                    "classification": analysis.classification.value,
                    "urgency": analysis.urgency.value,
                    "sentiment": analysis.sentiment.value,
                    "confidence": analysis.confidence,
                    "intent": analysis.intent,
                    "action_items_count": len(analysis.action_items)
                },
                "actions": executed_actions,
                "processing_time_ms": analysis.processing_time_ms
            }
            
        except Exception as e:
            return {
                "success": False,
                "email_id": email_id,
                "error": str(e),
                "actions": []
            }
    
    def _generate_actions_from_analysis(self, email: Dict, analysis) -> List[Dict]:
        """Generate actions based on email analysis"""
        actions = []
        classification = analysis.classification
        
        # Get action types for this classification
        action_types = self.config["classification_to_action"].get(classification.value, [])
        
        # Priority mapping
        priority_mapping = self.config["priority_mapping"]
        urgency_str = analysis.urgency.value
        priority_str = priority_mapping.get(urgency_str, "MEDIUM")
        priority = getattr(Priority, priority_str)
        
        # Create execution context
        context = ExecutionContext(
            user_id=email.get("from", "unknown@email.com"),
            session_id=f"session-{int(time.time())}",
            email_id=email.get("id"),
            original_email=email,
            approval_required=analysis.confidence < self.config["action_generation"]["require_approval_below"]
        )
        
        # Generate specific actions
        for action_type_str in action_types:
            try:
                action_type = getattr(ActionType, action_type_str)
                parameters = self._generate_action_parameters(action_type, email, analysis)
                
                if parameters:  # Only add if parameters were successfully generated
                    actions.append({
                        "type": action_type,
                        "parameters": parameters,
                        "priority": priority,
                        "context": context,
                        "confidence": analysis.confidence,
                        "description": self._get_action_description(action_type, parameters)
                    })
            except AttributeError:
                self.logger.warning(f"Unknown action type: {action_type_str}")
        
        # Limit number of actions per email
        max_actions = self.config["action_generation"]["max_actions_per_email"]
        return actions[:max_actions]
    
    def _generate_action_parameters(self, action_type: ActionType, email: Dict, analysis) -> Optional[Dict]:
        """Generate parameters for specific action types"""
        
        if action_type == ActionType.SEND_REPLY:
            # Generate reply content using intelligence engine
            reply_content = self.intelligence_engine.generate_draft_reply(email, analysis)
            return {
                "message_id": email.get("id"),
                "reply_content": reply_content
            }
        
        elif action_type == ActionType.APPROVE_REQUEST:
            return {
                "request_id": email.get("id"),
                "request_type": "general_approval",
                "requester": email.get("from"),
                "comments": f"Auto-approved based on AI analysis (confidence: {analysis.confidence:.2f})"
            }
        
        elif action_type == ActionType.CREATE_TASK:
            # Extract task info from action items
            if analysis.action_items:
                first_action = analysis.action_items[0]
                suggested_assignee = self.action_executor.suggest_assignee(
                    first_action.text,
                    ["general"]  # Could be enhanced with skill extraction
                )
                
                return {
                    "title": first_action.text[:100],  # Truncate title
                    "description": email.get("content", "")[:500],  # Truncate description
                    "assignee": suggested_assignee,
                    "due_date": (first_action.deadline or datetime.now() + timedelta(days=3)).isoformat(),
                    "project": "email_derived"
                }
        
        elif action_type == ActionType.DELEGATE_TASK:
            # Find appropriate assignee
            task_description = email.get("content", "")
            assignee = self._suggest_assignee_from_content(task_description)
            
            if assignee:
                return {
                    "task_description": task_description,
                    "assignee_email": assignee,
                    "original_requester": email.get("from"),
                    "priority": analysis.urgency.value.lower(),
                    "due_date": (datetime.now() + timedelta(days=2)).isoformat()
                }
        
        elif action_type == ActionType.SET_REMINDER:
            # Set reminder for follow-up
            if analysis.deadlines:
                reminder_time = analysis.deadlines[0][0] - timedelta(hours=24)  # 24h before deadline
            else:
                reminder_time = datetime.now() + timedelta(days=1)  # Default 1 day
            
            return {
                "text": f"Follow up on: {email.get('subject', 'Email')}",
                "time": reminder_time.isoformat()
            }
        
        elif action_type == ActionType.FOLLOW_UP:
            return {
                "original_message_id": email.get("id"),
                "follow_up_text": f"Following up on your previous email regarding: {email.get('subject', '')}",
                "recipient": email.get("from")
            }
        
        return None  # Return None if parameters couldn't be generated
    
    def _suggest_assignee_from_content(self, content: str) -> Optional[str]:
        """Suggest assignee based on email content"""
        content_lower = content.lower()
        
        # Simple keyword-based assignment (could be enhanced with ML)
        if any(word in content_lower for word in ["database", "sql", "performance", "infrastructure"]):
            return "alex.smith@company.com"
        elif any(word in content_lower for word in ["frontend", "ui", "react", "design"]):
            return "emma.williams@company.com"
        elif any(word in content_lower for word in ["backend", "api", "server"]):
            return "mike.chen@company.com"
        elif any(word in content_lower for word in ["test", "qa", "quality", "bug"]):
            return "lisa.rodriguez@company.com"
        elif any(word in content_lower for word in ["security", "auth", "encryption"]):
            return "robert.brown@company.com"
        else:
            return "sarah.johnson@company.com"  # Default to manager
    
    def _execute_action(self, action_config: Dict, email_id: str) -> Dict:
        """Execute a single action"""
        try:
            # Check confidence threshold for auto-execution
            confidence = action_config.get("confidence", 0.0)
            auto_execute_threshold = self.config["action_generation"]["auto_execute_threshold"]
            
            if confidence >= auto_execute_threshold:
                # Execute immediately
                action_id = self.action_executor.submit_action(
                    action_type=action_config["type"],
                    parameters=action_config["parameters"],
                    context=action_config["context"],
                    priority=action_config["priority"]
                )
                
                return {
                    "action_id": action_id,
                    "type": action_config["type"].value,
                    "description": action_config["description"],
                    "status": "executed",
                    "confidence": confidence
                }
            else:
                # Require approval
                action_config["context"].approval_required = True
                action_id = self.action_executor.submit_action(
                    action_type=action_config["type"],
                    parameters=action_config["parameters"],
                    context=action_config["context"],
                    priority=action_config["priority"]
                )
                
                return {
                    "action_id": action_id,
                    "type": action_config["type"].value,
                    "description": action_config["description"],
                    "status": "pending_approval",
                    "confidence": confidence
                }
        
        except Exception as e:
            return {
                "action_id": None,
                "type": action_config["type"].value,
                "description": action_config["description"],
                "status": "failed",
                "error": str(e),
                "confidence": action_config.get("confidence", 0.0)
            }
    
    def _get_action_description(self, action_type: ActionType, parameters: Dict) -> str:
        """Generate human-readable action description"""
        if action_type == ActionType.SEND_REPLY:
            return f"Send reply to message {parameters.get('message_id', 'unknown')}"
        elif action_type == ActionType.CREATE_TASK:
            return f"Create task: {parameters.get('title', 'Untitled')}"
        elif action_type == ActionType.DELEGATE_TASK:
            assignee = parameters.get('assignee_email', 'unknown')
            return f"Delegate task to {assignee}"
        elif action_type == ActionType.SET_REMINDER:
            return f"Set reminder: {parameters.get('text', 'Unknown reminder')}"
        elif action_type == ActionType.APPROVE_REQUEST:
            return f"Approve request {parameters.get('request_id', 'unknown')}"
        elif action_type == ActionType.FOLLOW_UP:
            recipient = parameters.get('recipient', 'unknown')
            return f"Schedule follow-up with {recipient}"
        else:
            return f"Execute {action_type.value}"
    
    def get_processing_statistics(self) -> Dict:
        """Get integration processing statistics"""
        executor_stats = self.action_executor.get_statistics()
        
        return {
            "emails_processed": len(self.processed_emails),
            "active_sessions": len(self.active_sessions),
            "executor_stats": executor_stats,
            "last_processing_time": datetime.now().isoformat()
        }
    
    def process_single_email_id(self, email_id: str) -> Dict:
        """Process a specific email by ID"""
        # Fetch specific email
        emails = self.mail_tool.get_recent_emails(limit=100)
        target_email = None
        
        for email in emails:
            if email.get("id") == email_id:
                target_email = email
                break
        
        if not target_email:
            return {"success": False, "error": f"Email {email_id} not found"}
        
        return self._process_single_email(target_email)


def demo_gpt5_integration():
    """Demo the complete GPT-5 integration system"""
    print("🚀 GPT-5 Email Action Integration Demo")
    print("=" * 60)
    
    # Initialize integration
    integration = GPT5ActionIntegration()
    integration.start_processing()
    
    try:
        print("\n📧 Processing recent emails...")
        
        # Process a small batch of emails
        results = integration.process_emails_batch(limit=5)
        
        print(f"\n📊 Processing Results:")
        print(f"   Total emails: {results['total_emails']}")
        print(f"   Successfully processed: {results['processed_successfully']}")
        print(f"   Processing errors: {results['processing_errors']}")
        print(f"   Actions generated: {results['actions_generated']}")
        print(f"   Actions executed: {results['actions_executed']}")
        print(f"   Pending approval: {results['actions_pending_approval']}")
        print(f"   Processing time: {results['processing_time_ms']:.1f}ms")
        
        # Show details for each email
        if results['email_details']:
            print(f"\n📝 Email Processing Details:")
            for i, email_detail in enumerate(results['email_details'], 1):
                if email_detail['success']:
                    print(f"\n   Email {i}: {email_detail['subject'][:50]}...")
                    print(f"      From: {email_detail['from']}")
                    print(f"      Classification: {email_detail['analysis']['classification']}")
                    print(f"      Urgency: {email_detail['analysis']['urgency']}")
                    print(f"      Confidence: {email_detail['analysis']['confidence']:.2f}")
                    print(f"      Actions: {len(email_detail['actions'])}")
                    
                    for action in email_detail['actions']:
                        print(f"         • {action['description']} [{action['status']}]")
                else:
                    print(f"\n   Email {i}: Processing failed - {email_detail['error']}")
        
        # Show system statistics
        print(f"\n📈 System Statistics:")
        stats = integration.get_processing_statistics()
        print(f"   Emails processed: {stats['emails_processed']}")
        print(f"   Active sessions: {stats['active_sessions']}")
        print(f"   Executor success rate: {stats['executor_stats']['success_rate_percent']:.1f}%")
        
    finally:
        integration.stop_processing()
    
    print(f"\n✅ Demo completed successfully!")


if __name__ == "__main__":
    demo_gpt5_integration()