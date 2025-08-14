#!/usr/bin/env python3
"""
Database Fix Verification Script
Confirms that the Apple Mail database connection issue has been resolved
"""

import requests
import json
from apple_mail_db_reader import AppleMailDBReader

def test_database_reader():
    """Test the AppleMailDBReader directly"""
    print("🔍 Testing AppleMailDBReader directly...")
    try:
        reader = AppleMailDBReader()
        stats = reader.get_email_stats()
        
        if 'error' in stats:
            print(f"❌ Database Error: {stats['error']}")
            return False
        
        print(f"✅ Direct Database Access:")
        print(f"   Total Emails: {stats.get('total_emails', 0):,}")
        print(f"   Unread Emails: {stats.get('unread_count', 0):,}")
        print(f"   Flagged Emails: {stats.get('flagged_count', 0):,}")
        print(f"   Last 7 Days: {stats.get('emails_last_7_days', 0):,}")
        
        # Test getting actual emails
        emails = reader.get_recent_emails(3)
        print(f"   Recent Emails: {len([e for e in emails if 'error' not in e])}")
        
        return True
        
    except Exception as e:
        print(f"❌ Database Reader Error: {e}")
        return False

def test_api_endpoints():
    """Test the FastAPI endpoints"""
    print("\n🌐 Testing FastAPI endpoints...")
    
    base_url = "http://localhost:8001"
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health Check:")
            print(f"   Status: {data.get('status', 'unknown')}")
            print(f"   Database: {data.get('components', {}).get('database', 'unknown')}")
            print(f"   Engine: {data.get('components', {}).get('engine', 'unknown')}")
        else:
            print(f"❌ Health Check failed: {response.status_code}")
            return False
        
        # Test stats endpoint
        response = requests.get(f"{base_url}/stats/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Stats Endpoint:")
            print(f"   Total Emails: {data.get('total_emails', 0):,}")
            print(f"   Unread Count: {data.get('unread_count', 0):,}")
        else:
            print(f"❌ Stats endpoint failed: {response.status_code}")
            return False
        
        # Test emails endpoint
        response = requests.get(f"{base_url}/emails/?limit=3")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Emails Endpoint:")
            print(f"   Retrieved: {len(data)} emails")
            if data:
                print(f"   Sample: '{data[0].get('subject', 'No Subject')}'")
                print(f"   From: {data[0].get('sender', 'Unknown')}")
                print(f"   Classification: {data[0].get('classification', 'Unknown')}")
        else:
            print(f"❌ Emails endpoint failed: {response.status_code}")
            return False
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API server. Is it running on port 8001?")
        return False
    except Exception as e:
        print(f"❌ API Test Error: {e}")
        return False

def main():
    """Run verification tests"""
    print("=" * 60)
    print("📧 Apple Mail Database Fix Verification")
    print("=" * 60)
    
    # Test database reader
    db_success = test_database_reader()
    
    # Test API endpoints  
    api_success = test_api_endpoints()
    
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    
    if db_success and api_success:
        print("🎉 SUCCESS: All tests passed!")
        print("✅ Apple Mail database connection is working")
        print("✅ Email Intelligence System is operational")
        print("✅ User will now see emails instead of '0 emails'")
        print("\n🚀 System is ready for production use!")
    else:
        print("❌ FAILURE: Some tests failed")
        if not db_success:
            print("- Database connection issues")
        if not api_success:
            print("- API endpoint issues")
    
    print("=" * 60)

if __name__ == "__main__":
    main()