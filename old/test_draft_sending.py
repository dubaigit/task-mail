#!/usr/bin/env python3
"""
Test script to verify draft sending functionality
This tests the complete workflow from draft generation to email sending
"""

import requests
import json
import sys

def test_draft_sending():
    """Test the complete draft sending workflow"""
    
    BASE_URL = "http://localhost:8000"
    
    print("=== Testing Draft Sending Functionality ===\n")
    
    # Step 1: Check if backend is running
    print("1. Testing backend connectivity...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Backend is running and responsive")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to backend: {e}")
        return False
    
    # Step 2: Get available drafts
    print("\n2. Fetching available drafts...")
    try:
        response = requests.get(f"{BASE_URL}/drafts/")
        if response.status_code == 200:
            drafts = response.json()
            print(f"✅ Found {len(drafts)} drafts")
            if drafts:
                first_draft = drafts[0]
                print(f"   First draft: ID={first_draft['id']}, Email ID={first_draft['email_id']}")
                print(f"   Content preview: {first_draft['content'][:100]}...")
                return first_draft
            else:
                print("❌ No drafts available for testing")
                return None
        else:
            print(f"❌ Failed to fetch drafts: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error fetching drafts: {e}")
        return None

def test_send_draft(draft):
    """Test sending a specific draft"""
    if not draft:
        return False
        
    BASE_URL = "http://localhost:8000"
    draft_id = draft['id']
    
    print(f"\n3. Testing draft sending for draft ID {draft_id}...")
    try:
        response = requests.post(
            f"{BASE_URL}/drafts/{draft_id}/send",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   HTTP Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Draft sent successfully!")
            print(f"   Recipient: {result.get('recipient', 'Unknown')}")
            print(f"   Subject: {result.get('subject', 'Unknown')}")
            return True
        else:
            print(f"❌ Failed to send draft: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error details: {error}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error sending draft: {e}")
        return False

if __name__ == "__main__":
    print("Starting draft sending test...\n")
    
    # Test draft fetching
    draft = test_draft_sending()
    
    if draft:
        # Test draft sending
        success = test_send_draft(draft)
        if success:
            print("\n🎉 All tests passed! Draft sending functionality is working.")
        else:
            print("\n❌ Draft sending test failed.")
    else:
        print("\n❌ Cannot test draft sending - no drafts available.")
    
    print("\n=== Test Complete ===")