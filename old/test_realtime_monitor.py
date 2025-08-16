#!/usr/bin/env python3
"""
Test script for Real-time Email Monitor
Verifies the implementation works correctly with exact GPT-5 models
"""

import asyncio
import logging
from datetime import datetime
from realtime_email_monitor import EmailMonitorService, example_event_handler, print_banner
from websocket_manager import create_websocket_manager_with_email_integration

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_monitor_initialization():
    """Test monitor initialization and basic functionality"""
    print("🔬 Testing Real-time Email Monitor Initialization...")
    
    try:
        # Create WebSocket manager
        websocket_manager = create_websocket_manager_with_email_integration(max_clients=10)
        
        # Create email monitoring service
        service = EmailMonitorService(websocket_manager, redis_url="redis://localhost:6379")
        
        print("✅ WebSocket manager created successfully")
        print("✅ Email monitoring service created successfully")
        
        # Test status before starting
        status = service.get_status()
        print(f"📊 Initial status: {status}")
        
        # Test starting the service
        print("🚀 Starting email monitoring service...")
        success = await service.start(example_event_handler)
        
        if success:
            print("✅ Email monitoring service started successfully")
            
            # Wait a moment and check status
            await asyncio.sleep(2)
            status = service.get_status()
            print(f"📊 Running status: {status}")
            
            # Test force check
            print("🔍 Testing force email check...")
            result = await service.force_check()
            print(f"📈 Force check result: {result}")
            
            # Test stopping the service
            print("🛑 Stopping email monitoring service...")
            stop_success = await service.stop()
            
            if stop_success:
                print("✅ Email monitoring service stopped successfully")
            else:
                print("❌ Failed to stop email monitoring service")
                
        else:
            print("❌ Failed to start email monitoring service")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        logger.exception("Test error")

async def test_email_classification():
    """Test email classification with exact GPT-5 models"""
    print("\n🧠 Testing Email Classification with GPT-5 Models...")
    
    try:
        from realtime_email_monitor import RealtimeEmailMonitor
        from websocket_manager import create_websocket_manager
        
        # Create components
        websocket_manager = create_websocket_manager()
        monitor = RealtimeEmailMonitor(websocket_manager)
        
        # Test email content processing
        test_content = """
        Subject: Urgent: Budget Approval Required
        From: ceo@company.com
        
        Hi Team,
        
        I need your immediate approval for the Q4 marketing budget of $500,000.
        Please review the attached proposal and respond by end of day.
        
        This is critical for our upcoming product launch.
        
        Best regards,
        John Doe
        CEO
        """
        
        test_metadata = {
            'id': 'test_001',
            'from_address': 'ceo@company.com',
            'subject': 'Urgent: Budget Approval Required',
            'date_received': datetime.now().isoformat()
        }
        
        print("📧 Processing test email content...")
        result = await monitor.process_email_content(test_content, test_metadata)
        
        print("✅ Email classification completed")
        print(f"📊 Classification result: {result['intelligence']['classification']}")
        print(f"⚡ Urgency: {result['intelligence']['urgency']}")
        print(f"💭 Sentiment: {result['intelligence']['sentiment']}")
        print(f"📋 Action items: {result['intelligence']['action_items']}")
        print(f"🏷️ Model used: {result['intelligence'].get('model_used', 'Unknown')}")
        
    except Exception as e:
        print(f"❌ Classification test failed: {e}")
        logger.exception("Classification test error")

async def test_websocket_integration():
    """Test WebSocket integration for real-time updates"""
    print("\n🌐 Testing WebSocket Integration...")
    
    try:
        from websocket_manager import create_websocket_manager_with_email_integration, WebSocketMessage, MessageType
        
        # Create WebSocket manager
        manager = create_websocket_manager_with_email_integration()
        
        # Start background tasks
        await manager.start_background_tasks()
        
        print("✅ WebSocket manager started with background tasks")
        
        # Test broadcasting email update
        test_message = WebSocketMessage(
            event_type=MessageType.EMAIL_UPDATE.value,
            timestamp=datetime.now(),
            data={
                "email_id": "test_123",
                "subject": "Test Email",
                "sender": "test@example.com",
                "classification": "NEEDS_REPLY",
                "urgency_level": 3
            },
            metadata={"test": True}
        )
        
        await manager.broadcast_to_topic("emails", test_message)
        print("✅ Email update broadcasted successfully")
        
        # Test urgent notification
        urgent_data = {
            "email_id": "urgent_456",
            "subject": "URGENT: Critical Issue",
            "sender": "critical@example.com",
            "urgency_level": 5,
            "action_required": True
        }
        
        await manager.broadcast_urgent_notification(urgent_data)
        print("✅ Urgent notification broadcasted successfully")
        
        # Get connection stats
        stats = manager.get_connection_stats()
        print(f"📊 WebSocket stats: {stats}")
        
        # Stop background tasks
        await manager.stop_background_tasks()
        print("✅ WebSocket manager stopped successfully")
        
    except Exception as e:
        print(f"❌ WebSocket test failed: {e}")
        logger.exception("WebSocket test error")

async def main():
    """Run all tests"""
    print_banner()
    print("🧪 Starting Real-time Email Monitor Tests\n")
    
    # Run tests
    await test_monitor_initialization()
    await test_email_classification()
    await test_websocket_integration()
    
    print("\n🎉 All tests completed!")
    print("💡 To run the full monitor: python realtime_email_monitor.py")
    print("🌐 To test WebSocket manager: python websocket_manager.py --test-mode")

if __name__ == "__main__":
    asyncio.run(main())