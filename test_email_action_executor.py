#!/usr/bin/env python3
"""
Test Script for Email Action Executor

Simple test to verify the system works correctly.
"""

import sys
import time
from datetime import datetime, timedelta

try:
    from email_action_executor import (
        EmailActionExecutor, ActionType, Priority, ExecutionContext,
        ActionStatus
    )
    print("✅ Successfully imported EmailActionExecutor")
except ImportError as e:
    print(f"❌ Failed to import EmailActionExecutor: {e}")
    sys.exit(1)

def test_basic_functionality():
    """Test basic system functionality"""
    print("\n🧪 Testing Basic Functionality")
    print("-" * 40)
    
    try:
        # Initialize executor
        executor = EmailActionExecutor()
        print("✅ Executor initialized successfully")
        
        # Start the executor
        executor.start()
        print("✅ Executor started successfully")
        
        # Create test context
        context = ExecutionContext(
            user_id="test@company.com",
            session_id="test-session-123"
        )
        print("✅ Context created successfully")
        
        # Submit a simple action
        action_id = executor.submit_action(
            action_type=ActionType.SEND_REPLY,
            parameters={
                "message_id": "test-msg-123",
                "reply_content": "This is a test reply"
            },
            context=context,
            priority=Priority.LOW
        )
        print(f"✅ Action submitted successfully: {action_id}")
        
        # Wait for processing
        time.sleep(2)
        
        # Check action status
        status = executor.get_action_status(action_id)
        if status:
            print(f"✅ Action status retrieved: {status['status']}")
        else:
            print("❌ Failed to get action status")
        
        # Get statistics
        stats = executor.get_statistics()
        print(f"✅ Statistics retrieved: {stats['total_actions']} total actions")
        
        # Stop executor
        executor.stop()
        print("✅ Executor stopped successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_team_management():
    """Test team management functionality"""
    print("\n👥 Testing Team Management")
    print("-" * 40)
    
    try:
        executor = EmailActionExecutor()
        
        # Test team directory loading
        team_count = len(executor.team_directory)
        print(f"✅ Loaded {team_count} team members")
        
        # Test skill-based assignment
        assignee = executor.suggest_assignee(
            "Fix database performance issue",
            ["database", "backend"]
        )
        
        if assignee:
            member_info = executor.get_team_member_info(assignee)
            print(f"✅ Suggested assignee: {member_info['name']} ({assignee})")
        else:
            print("❌ No assignee suggested")
        
        return True
        
    except Exception as e:
        print(f"❌ Team management test failed: {e}")
        return False

def test_configuration():
    """Test configuration loading"""
    print("\n⚙️ Testing Configuration")
    print("-" * 40)
    
    try:
        executor = EmailActionExecutor()
        
        # Check configuration loaded
        config = executor.config
        print(f"✅ Configuration loaded with {len(config)} sections")
        
        # Check specific settings
        approval_actions = config.get("approval_required_actions", [])
        print(f"✅ Approval required for {len(approval_actions)} action types")
        
        integrations = config.get("external_integrations", {})
        print(f"✅ {len(integrations)} external integrations configured")
        
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

def test_database():
    """Test database functionality"""
    print("\n🗄️ Testing Database")
    print("-" * 40)
    
    try:
        executor = EmailActionExecutor()
        
        # Database should be initialized
        import sqlite3
        import os
        
        if os.path.exists(executor.db_path):
            print("✅ Database file exists")
            
            # Test database connection
            with sqlite3.connect(executor.db_path) as conn:
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                print(f"✅ Database has {len(tables)} tables: {', '.join(tables)}")
        else:
            print("❌ Database file not found")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

def run_all_tests():
    """Run all tests"""
    print("🚀 Email Action Executor - System Test")
    print("=" * 50)
    
    tests = [
        ("Basic Functionality", test_basic_functionality),
        ("Team Management", test_team_management),
        ("Configuration", test_configuration),
        ("Database", test_database)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\nRunning {test_name} test...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("🏁 Test Results Summary")
    print("=" * 50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! System is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Check the output above for details.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)