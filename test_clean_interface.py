#!/usr/bin/env python3
"""
Test script for the clean unified email interface
"""

import requests
import json
import time

def test_clean_interface():
    """Test the clean unified email interface endpoints"""
    base_url = "http://localhost:8003"
    
    print("🧪 Testing Clean Unified Email Interface")
    print("=" * 50)
    
    # Test 1: Check if interface loads
    try:
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ Interface loads successfully")
            print(f"   Response length: {len(response.text)} characters")
        else:
            print(f"❌ Interface failed to load: {response.status_code}")
    except Exception as e:
        print(f"❌ Interface connection failed: {e}")
        return
    
    # Test 2: Check emails endpoint
    try:
        response = requests.get(f"{base_url}/emails")
        if response.status_code == 200:
            emails = response.json()
            print(f"✅ Emails endpoint working - {len(emails)} emails loaded")
            
            if emails:
                sample_email = emails[0]
                print(f"   Sample email: '{sample_email.get('subject', 'No subject')[:50]}...'")
                print(f"   Classification: {sample_email.get('classification')}")
                print(f"   Urgency: {sample_email.get('urgency')}")
                print(f"   Has draft: {'Yes' if sample_email.get('draft_reply') else 'No'}")
        else:
            print(f"❌ Emails endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Emails endpoint error: {e}")
    
    # Test 3: Check tasks endpoint
    try:
        response = requests.get(f"{base_url}/tasks")
        if response.status_code == 200:
            tasks = response.json()
            print(f"✅ Tasks endpoint working - {len(tasks)} tasks generated")
            
            if tasks:
                sample_task = tasks[0]
                print(f"   Sample task: '{sample_task.get('subject', 'No subject')[:50]}...'")
                print(f"   Task type: {sample_task.get('task_type')}")
                print(f"   Priority: {sample_task.get('priority')}")
        else:
            print(f"❌ Tasks endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Tasks endpoint error: {e}")
    
    # Test 4: Check stats endpoint
    try:
        response = requests.get(f"{base_url}/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Stats endpoint working")
            print(f"   Total emails: {stats.get('total_emails', 0)}")
            print(f"   Unread count: {stats.get('unread_count', 0)}")
            print(f"   Tasks count: {stats.get('tasks_count', 0)}")
            print(f"   Avg confidence: {stats.get('avg_confidence', 0):.2f}")
        else:
            print(f"❌ Stats endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Stats endpoint error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Clean interface testing completed!")
    print(f"🌐 Access the interface at: {base_url}")

if __name__ == "__main__":
    test_clean_interface()