#!/usr/bin/env python3
"""
Test script to verify AppleMailConnector integration with backend_architecture.py
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the backend architecture
from backend_architecture import app, db_manager

async def test_apple_mail_integration():
    """Test Apple Mail integration"""
    print("🧪 Testing Apple Mail Integration...")
    
    # Initialize the database manager
    await db_manager.initialize()
    
    if db_manager.apple_mail_connector:
        print("✅ Apple Mail connector initialized successfully")
        
        # Test getting mailbox stats
        try:
            stats = db_manager.apple_mail_connector.get_mailbox_stats()
            print(f"📊 Mailbox stats: {stats}")
        except Exception as e:
            print(f"❌ Error getting mailbox stats: {e}")
        
        # Test getting recent emails
        try:
            recent_emails = db_manager.apple_mail_connector.get_recent_emails(days=7, limit=5)
            print(f"📧 Found {len(recent_emails)} recent emails")
            
            for email in recent_emails:
                print(f"  - {email.subject_text} from {email.sender_email}")
                
        except Exception as e:
            print(f"❌ Error getting recent emails: {e}")
            
        # Test getting emails by date range
        try:
            start_date = datetime.now() - timedelta(days=30)
            end_date = datetime.now()
            range_emails = db_manager.apple_mail_connector.get_emails_by_date_range(
                start_date, end_date, limit=10
            )
            print(f"📅 Found {len(range_emails)} emails in date range")
            
        except Exception as e:
            print(f"❌ Error getting emails by date range: {e}")
            
    else:
        print("⚠️  Apple Mail connector not available - using mock data")
    
    print("🎯 Integration test completed!")

if __name__ == "__main__":
    asyncio.run(test_apple_mail_integration())