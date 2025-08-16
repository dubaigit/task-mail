#!/usr/bin/env python3
"""
Test all backend API endpoints to ensure they work correctly
"""

import requests
import json
import sys

def test_endpoint(url, endpoint_name):
    """Test a single endpoint"""
    try:
        print(f"Testing {endpoint_name}...")
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"  ✓ {endpoint_name} returned array with {len(data)} items")
            else:
                print(f"  ✓ {endpoint_name} returned object with keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
            return True
        else:
            print(f"  ✗ {endpoint_name} returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"  ✗ {endpoint_name} failed: {e}")
        return False

def main():
    """Test all endpoints"""
    base_url = "http://localhost:8002"
    
    endpoints = [
        ("/emails/", "Emails"),
        ("/tasks/", "Tasks"), 
        ("/drafts/", "Drafts"),
        ("/analytics/dashboard", "Analytics"),
        ("/health", "Health Check")
    ]
    
    print(f"Testing backend API at {base_url}")
    print("=" * 50)
    
    passed = 0
    total = len(endpoints)
    
    for endpoint, name in endpoints:
        if test_endpoint(f"{base_url}{endpoint}", name):
            passed += 1
    
    print("=" * 50)
    print(f"Results: {passed}/{total} endpoints passed")
    
    if passed == total:
        print("🎉 All endpoints are working correctly!")
        print("\nFrontend should now be able to connect to the backend.")
        return True
    else:
        print("❌ Some endpoints failed. Check the backend logs.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)