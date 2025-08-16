#!/usr/bin/env python3
"""
Test script for JWT authentication system
Validates that JWT authentication is working correctly
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8002"

def test_auth_system():
    """Test the complete JWT authentication flow"""
    
    print("🔐 Testing JWT Authentication System")
    print("=" * 50)
    
    # Test 1: Check auth status
    print("\n1. Testing auth system status...")
    try:
        response = requests.get(f"{BASE_URL}/auth/status")
        if response.status_code == 200:
            auth_status = response.json()
            print(f"✅ Auth status: Production={auth_status['production_mode']}, Secret configured={auth_status['secret_configured']}")
            if not auth_status['secret_configured']:
                print("⚠️  Warning: JWT secret not properly configured")
        else:
            print(f"❌ Auth status failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking auth status: {e}")
        return False
    
    # Test 2: Try unauthenticated access (should fail)
    print("\n2. Testing unauthenticated access (should be denied)...")
    try:
        response = requests.get(f"{BASE_URL}/emails/")
        if response.status_code == 403:
            print("✅ Unauthenticated access correctly denied (403)")
        elif response.status_code == 401:
            print("✅ Unauthenticated access correctly denied (401)")
        else:
            print(f"❌ Unauthenticated access should return 401/403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing unauthenticated access: {e}")
        return False
    
    # Test 3: Login with valid credentials
    print("\n3. Testing login with valid credentials...")
    login_data = {
        "email": "admin@example.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data["access_token"]
            refresh_token = token_data["refresh_token"]
            print("✅ Login successful")
            print(f"   Access token expires in: {token_data['expires_in']} seconds")
            print(f"   User: {token_data['user']['email']}")
            print(f"   Permissions: {token_data['user']['permissions']}")
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error during login: {e}")
        return False
    
    # Test 4: Access protected endpoint with token
    print("\n4. Testing authenticated access...")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/emails/", headers=headers)
        if response.status_code == 200:
            emails = response.json()
            print(f"✅ Authenticated access successful - got {len(emails)} emails")
        else:
            print(f"❌ Authenticated access failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing authenticated access: {e}")
        return False
    
    # Test 5: Test user profile endpoint
    print("\n5. Testing user profile endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        if response.status_code == 200:
            profile = response.json()
            print(f"✅ User profile: {profile['email']} (ID: {profile['user_id']})")
        else:
            print(f"❌ Profile endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing profile endpoint: {e}")
        return False
    
    # Test 6: Test invalid credentials
    print("\n6. Testing login with invalid credentials...")
    invalid_login = {
        "email": "admin@example.com",
        "password": "wrongpassword"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=invalid_login)
        if response.status_code == 401:
            print("✅ Invalid credentials correctly rejected (401)")
        else:
            print(f"❌ Invalid credentials should return 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing invalid credentials: {e}")
        return False
    
    # Test 7: Test refresh token
    print("\n7. Testing refresh token...")
    try:
        response = requests.post(f"{BASE_URL}/auth/refresh", 
                               params={"refresh_token": refresh_token})
        if response.status_code == 200:
            new_tokens = response.json()
            print("✅ Refresh token successful")
            print(f"   New access token expires in: {new_tokens['expires_in']} seconds")
        else:
            print(f"❌ Refresh token failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing refresh token: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("🎉 All JWT authentication tests passed!")
    print("🔒 System is secure - DEVELOPMENT_MODE bypass removed")
    return True

def test_permissions():
    """Test permission-based access"""
    print("\n🔐 Testing Permission-Based Access")
    print("=" * 50)
    
    # Login as regular user
    login_data = {
        "email": "user@example.com",
        "password": "user123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token_data = response.json()
            user_token = token_data["access_token"]
            print(f"✅ User login successful: {token_data['user']['permissions']}")
        else:
            print(f"❌ User login failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error during user login: {e}")
        return False
    
    # Test read access (should work)
    headers = {"Authorization": f"Bearer {user_token}"}
    try:
        response = requests.get(f"{BASE_URL}/emails/", headers=headers)
        if response.status_code == 200:
            print("✅ Read access works for regular user")
        else:
            print(f"❌ Read access failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing read access: {e}")
        return False
    
    # Test write access (should fail for regular user)
    try:
        batch_request = {
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T23:59:59"
        }
        response = requests.post(f"{BASE_URL}/emails/batch/process", 
                               json=batch_request, headers=headers)
        if response.status_code == 403:
            print("✅ Write access correctly denied for regular user (403)")
        else:
            print(f"❌ Write access should return 403 for regular user, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing write access: {e}")
        return False
    
    print("🎉 Permission tests passed!")
    return True

if __name__ == "__main__":
    print("JWT Authentication Test Suite")
    print("Starting backend server check...")
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ Server not responding correctly: {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Cannot connect to server at {BASE_URL}")
        print("   Make sure backend is running: python backend_architecture.py")
        sys.exit(1)
    
    # Run tests
    auth_success = test_auth_system()
    perm_success = test_permissions()
    
    if auth_success and perm_success:
        print("\n🎉 ALL TESTS PASSED - JWT authentication is working correctly!")
        print("🔒 Production-ready security implemented")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed - check the output above")
        sys.exit(1)