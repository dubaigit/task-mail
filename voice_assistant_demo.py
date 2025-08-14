#!/usr/bin/env python3
"""
Voice Assistant Demo for AppleCLI
Demonstrates how AppleCLI can be used for voice-controlled email management.

This simulates what a voice assistant could do with the enhanced Mail features.
"""

import subprocess
import json
import sys
from datetime import datetime

class VoiceAssistant:
    """Simulates voice assistant interactions with AppleCLI."""
    
    def __init__(self):
        self.cli_path = "applecli.py"
    
    def run_command(self, *args):
        """Execute AppleCLI command and return result."""
        cmd = ["python3", self.cli_path] + list(args)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.stdout.strip()
        except Exception as e:
            return f"Error: {e}"
    
    def speak(self, text):
        """Simulate voice assistant speaking (just print for demo)."""
        print(f"\n🗣️  Assistant: {text}")
    
    def show_result(self, result):
        """Display command result."""
        if result:
            print(f"📧 {result}")
        else:
            print("📧 No results found")
    
    def demo_email_summary(self):
        """'Hey Assistant, give me my email summary'"""
        self.speak("Let me check your email summary...")
        result = self.run_command("--mail", "--action", "summary", "--format", "json")
        
        try:
            summary = json.loads(result)
            self.speak(f"You have {summary['total_emails']} total emails.")
            self.speak(f"{summary['unread']} are unread.")
            self.speak(f"You received {summary['today']} emails today.")
            self.speak(f"This week you've received {summary['this_week']} emails.")
            
            if summary['unread'] > 100:
                self.speak("You have quite a backlog. Would you like me to show you the important ones?")
        except:
            self.show_result(result)
    
    def demo_needs_reply(self):
        """'Show me emails that need replies'"""
        self.speak("Checking for emails that need your attention...")
        result = self.run_command("--mail", "--action", "needs-reply", "--limit", "5")
        
        if "No results" in result:
            self.speak("Great news! No urgent emails need replies right now.")
        else:
            self.speak("Here are emails that need replies:")
            self.show_result(result)
            self.speak("Would you like me to draft a reply to any of these?")
    
    def demo_last_week_emails(self):
        """'What emails did I get last week?'"""
        self.speak("Let me check your emails from last week...")
        result = self.run_command("--mail", "--action", "last-week", "--limit", "10")
        
        if "No results" in result:
            self.speak("You didn't receive any emails last week.")
        else:
            self.speak("Here are your emails from last week:")
            self.show_result(result)
    
    def demo_create_reply(self, subject, message):
        """'Draft a reply to the meeting invitation saying I'll be there'"""
        self.speak(f"Creating a reply draft for '{subject}'...")
        result = self.run_command("--mail", "--action", "reply-draft", 
                                 "--subject", subject,
                                 "--reply-body", message)
        self.show_result(result)
        self.speak("The reply draft is ready in your Mail app.")
    
    def demo_flag_important(self, subject):
        """'Flag the email about the budget meeting as important'"""
        self.speak(f"Flagging emails about '{subject}' as important...")
        result = self.run_command("--mail", "--action", "flag",
                                 "--subject", subject,
                                 "--flag-status")
        self.show_result(result)
    
    def demo_add_to_tasks(self, subject):
        """'Add this email to my task list'"""
        self.speak(f"Adding email '{subject}' to your reminders...")
        result = self.run_command("--mail", "--action", "add-to-reminders",
                                 "--subject", subject,
                                 "--list-name", "Email Tasks")
        self.show_result(result)
        self.speak("I've added it to your Email Tasks list in Reminders.")
    
    def demo_sender_emails(self, sender):
        """'Show me all emails from John'"""
        self.speak(f"Looking for emails from {sender}...")
        result = self.run_command("--mail", "--action", "from-sender",
                                 "--sender", sender,
                                 "--limit", "5")
        
        if "No results" in result:
            self.speak(f"No emails found from {sender}.")
        else:
            self.speak(f"Here are recent emails from {sender}:")
            self.show_result(result)
    
    def demo_recent_emails(self):
        """'What are my latest emails?'"""
        self.speak("Getting your most recent emails...")
        result = self.run_command("--mail", "--action", "recent", "--limit", "5")
        
        if "No results" in result:
            self.speak("No recent emails found.")
        else:
            self.speak("Here are your latest emails:")
            self.show_result(result)
    
    def demo_compose_email(self, to, subject, body):
        """'Send an email to Sarah about the project update'"""
        self.speak(f"Composing email to {to}...")
        result = self.run_command("--mail", "--action", "compose",
                                 "--to", to,
                                 "--subject", subject,
                                 "--body", body)
        self.show_result(result)
        self.speak("Email draft created. Would you like me to send it?")
    
    def demo_workflow(self):
        """Demonstrate a complete voice assistant workflow."""
        print("\n" + "="*60)
        print("🎙️  VOICE ASSISTANT EMAIL WORKFLOW DEMO")
        print("="*60)
        
        # Morning routine
        print("\n--- Morning Email Check ---")
        input("Press Enter to simulate: 'Good morning, check my emails'")
        self.demo_email_summary()
        
        print("\n--- Check Important Emails ---")
        input("Press Enter to simulate: 'Show me emails that need replies'")
        self.demo_needs_reply()
        
        print("\n--- Create a Reply ---")
        input("Press Enter to simulate: 'Draft a reply to the team meeting invite'")
        self.demo_create_reply("Team Meeting", "Thanks for the invite! I'll be there.")
        
        print("\n--- Flag Important Email ---")
        input("Press Enter to simulate: 'Flag the budget report as important'")
        self.demo_flag_important("Budget Report")
        
        print("\n--- Add to Task List ---")
        input("Press Enter to simulate: 'Add the project proposal email to my tasks'")
        self.demo_add_to_tasks("Project Proposal")
        
        print("\n--- Check Emails from Someone ---")
        input("Press Enter to simulate: 'Show me emails from Sarah'")
        self.demo_sender_emails("sarah")
        
        print("\n--- Compose New Email ---")
        input("Press Enter to simulate: 'Send an email to the team about lunch'")
        self.demo_compose_email("team@company.com", "Team Lunch Tomorrow", 
                              "Hi everyone,\n\nLet's have lunch together tomorrow at noon.\n\nBest regards")
        
        print("\n" + "="*60)
        print("✅ DEMO COMPLETE")
        print("="*60)
        self.speak("That's how I can help manage your emails through voice commands!")


def main():
    """Run the voice assistant demo."""
    assistant = VoiceAssistant()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "summary":
            assistant.demo_email_summary()
        elif command == "needs-reply":
            assistant.demo_needs_reply()
        elif command == "last-week":
            assistant.demo_last_week_emails()
        elif command == "recent":
            assistant.demo_recent_emails()
        elif command == "workflow":
            assistant.demo_workflow()
        else:
            print("Available commands:")
            print("  summary     - Get email summary")
            print("  needs-reply - Show emails needing replies")
            print("  last-week   - Show last week's emails")
            print("  recent      - Show recent emails")
            print("  workflow    - Run complete demo workflow")
    else:
        # Run the full workflow demo
        assistant.demo_workflow()


if __name__ == "__main__":
    main()