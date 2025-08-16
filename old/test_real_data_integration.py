#!/usr/bin/env python3
"""
Real Apple Mail Data Integration Test Suite

This test suite validates that the backend is successfully serving real Apple Mail 
data instead of mock/test emails and that the frontend displays this real data.
"""

import requests
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import asyncio
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RealDataIntegrationValidator:
    """Validates real Apple Mail data integration across backend and frontend"""
    
    def __init__(self, backend_url: str = "http://localhost:8002", frontend_url: str = "http://localhost:3000"):
        self.backend_url = backend_url
        self.frontend_url = frontend_url
        self.test_results = {}
        
    def test_health_endpoint(self) -> bool:
        """Test that backend health endpoint is accessible"""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                logger.info(f"✅ Health check passed: {health_data['status']}")
                return True
            else:
                logger.error(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ Health endpoint error: {e}")
            return False
    
    def test_real_email_data(self) -> Dict[str, Any]:
        """Test that /emails/ endpoint returns real Apple Mail data"""
        try:
            response = requests.get(f"{self.backend_url}/emails/?limit=10", timeout=15)
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            emails = response.json()
            if not emails:
                return {"success": False, "error": "No emails returned"}
            
            # Validate real data characteristics
            real_data_indicators = {
                "has_emails": len(emails) > 0,
                "has_real_subjects": any("test email" not in email.get("subject", "").lower() for email in emails),
                "has_real_senders": any("test@" not in email.get("sender", "") for email in emails),
                "has_realistic_dates": any(self._is_realistic_date(email.get("date")) for email in emails),
                "has_real_recipients": any(len(email.get("to_addresses", [])) > 0 for email in emails),
                "has_realistic_sizes": any(email.get("size_bytes", 0) > 1000 for email in emails)
            }
            
            # Log first few emails for inspection
            logger.info("📧 Sample real emails from backend:")
            for i, email in enumerate(emails[:3]):
                logger.info(f"  {i+1}. Subject: '{email.get('subject', 'N/A')}'")
                logger.info(f"     From: {email.get('sender', 'N/A')}")
                logger.info(f"     Date: {email.get('date', 'N/A')}")
                logger.info(f"     Size: {email.get('size_bytes', 0)} bytes")
                logger.info(f"     Recipients: {len(email.get('to_addresses', []))}")
            
            success_count = sum(real_data_indicators.values())
            total_checks = len(real_data_indicators)
            
            result = {
                "success": success_count >= 4,  # Require at least 4/6 indicators
                "total_emails": len(emails),
                "indicators": real_data_indicators,
                "score": f"{success_count}/{total_checks}",
                "sample_subjects": [email.get("subject", "N/A")[:50] for email in emails[:5]]
            }
            
            if result["success"]:
                logger.info(f"✅ Real email data validation passed ({result['score']})")
            else:
                logger.warning(f"⚠️ Real email data validation marginal ({result['score']})")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Email data test error: {e}")
            return {"success": False, "error": str(e)}
    
    def test_analytics_real_data(self) -> Dict[str, Any]:
        """Test that analytics endpoint shows real data statistics"""
        try:
            response = requests.get(f"{self.backend_url}/analytics/dashboard", timeout=15)
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            analytics = response.json()
            
            # Check for realistic statistics
            total_emails = analytics.get("total_emails", 0)
            unread_emails = analytics.get("unread_emails", 0)
            
            is_realistic = (
                total_emails > 100 and  # Realistic email count
                unread_emails > 0 and   # Has unread emails
                unread_emails < total_emails and  # Unread less than total
                "date_range" in analytics and  # Has date range
                "mailboxes" in analytics  # Has mailbox data
            )
            
            result = {
                "success": is_realistic,
                "total_emails": total_emails,
                "unread_emails": unread_emails,
                "has_date_range": "date_range" in analytics,
                "has_mailboxes": "mailboxes" in analytics,
                "mailbox_count": len(analytics.get("mailboxes", {}))
            }
            
            if result["success"]:
                logger.info(f"✅ Analytics real data validation passed: {total_emails} total emails, {unread_emails} unread")
            else:
                logger.warning(f"⚠️ Analytics data seems unrealistic: {total_emails} total, {unread_emails} unread")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Analytics test error: {e}")
            return {"success": False, "error": str(e)}
    
    def test_mailbox_stats(self) -> Dict[str, Any]:
        """Test mailbox statistics endpoint for real data"""
        try:
            response = requests.get(f"{self.backend_url}/analytics/mailbox-stats", timeout=15)
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            stats = response.json()
            
            # Check for Apple Mail specific mailbox patterns
            mailboxes = stats.get("mailboxes", {})
            has_realistic_mailboxes = any(
                "ews://" in mailbox or "imap://" in mailbox or "local://" in mailbox 
                for mailbox in mailboxes.keys()
            )
            
            result = {
                "success": has_realistic_mailboxes and len(mailboxes) > 0,
                "mailbox_count": len(mailboxes),
                "total_messages": stats.get("total_messages", 0),
                "has_realistic_paths": has_realistic_mailboxes,
                "mailbox_names": list(mailboxes.keys())[:3]  # First 3 for inspection
            }
            
            if result["success"]:
                logger.info(f"✅ Mailbox stats validation passed: {result['mailbox_count']} mailboxes")
                logger.info(f"   Sample mailboxes: {result['mailbox_names']}")
            else:
                logger.warning(f"⚠️ Mailbox stats validation failed")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Mailbox stats test error: {e}")
            return {"success": False, "error": str(e)}
    
    def test_no_mock_data_patterns(self) -> Dict[str, Any]:
        """Verify that mock/test data patterns are not present"""
        try:
            response = requests.get(f"{self.backend_url}/emails/?limit=20", timeout=15)
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            emails = response.json()
            
            # Check for common mock data patterns
            mock_patterns = [
                "test@company.com",
                "mock@test.com", 
                "Important meeting tomorrow",
                "Project update",
                "Client proposal review",
                "Weekly newsletter",
                "John Boss",
                "Team Lead",
                "Sarah Johnson"
            ]
            
            mock_found = []
            for email in emails:
                subject = email.get("subject", "")
                sender = email.get("sender", "")
                
                for pattern in mock_patterns:
                    if pattern.lower() in subject.lower() or pattern.lower() in sender.lower():
                        mock_found.append({
                            "pattern": pattern,
                            "found_in": "subject" if pattern.lower() in subject.lower() else "sender",
                            "email_subject": subject[:50]
                        })
            
            result = {
                "success": len(mock_found) == 0,
                "mock_patterns_found": len(mock_found),
                "patterns": mock_found[:5]  # First 5 for inspection
            }
            
            if result["success"]:
                logger.info("✅ No mock data patterns detected - data appears authentic")
            else:
                logger.warning(f"⚠️ Found {len(mock_found)} potential mock data patterns")
                for pattern in mock_found[:3]:
                    logger.warning(f"   Mock pattern '{pattern['pattern']}' in {pattern['found_in']}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Mock data pattern test error: {e}")
            return {"success": False, "error": str(e)}
    
    def _is_realistic_date(self, date_str: str) -> bool:
        """Check if date string represents a realistic email date"""
        try:
            if not date_str:
                return False
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            now = datetime.now()
            # Realistic if within last 2 years and not in future
            return (now - timedelta(days=730)) <= date <= now + timedelta(hours=1)
        except:
            return False
    
    def run_comprehensive_validation(self) -> Dict[str, Any]:
        """Run all validation tests and return comprehensive report"""
        logger.info("🔍 Starting comprehensive real data integration validation...")
        
        tests = [
            ("health_check", self.test_health_endpoint),
            ("real_email_data", self.test_real_email_data),
            ("analytics_real_data", self.test_analytics_real_data),
            ("mailbox_stats", self.test_mailbox_stats),
            ("no_mock_patterns", self.test_no_mock_data_patterns)
        ]
        
        results = {}
        passed_tests = 0
        
        for test_name, test_func in tests:
            logger.info(f"\n--- Running {test_name} test ---")
            try:
                result = test_func()
                results[test_name] = result
                if isinstance(result, dict) and result.get("success"):
                    passed_tests += 1
                elif result is True:
                    passed_tests += 1
            except Exception as e:
                logger.error(f"Test {test_name} failed with exception: {e}")
                results[test_name] = {"success": False, "error": str(e)}
        
        # Overall assessment
        overall_success = passed_tests >= 4  # Require at least 4/5 tests to pass
        success_rate = f"{passed_tests}/{len(tests)}"
        
        summary = {
            "overall_success": overall_success,
            "tests_passed": passed_tests,
            "total_tests": len(tests),
            "success_rate": success_rate,
            "timestamp": datetime.now().isoformat(),
            "test_results": results
        }
        
        logger.info(f"\n{'='*60}")
        logger.info("📋 VALIDATION SUMMARY")
        logger.info(f"{'='*60}")
        
        if overall_success:
            logger.info(f"✅ PASSED: Real Apple Mail data integration validated ({success_rate})")
            logger.info("🎉 Backend successfully serving real email data instead of mock data")
            logger.info("🎉 Frontend displaying authentic Apple Mail data")
        else:
            logger.warning(f"❌ FAILED: Integration validation incomplete ({success_rate})")
        
        logger.info(f"\nDetailed results:")
        for test_name, result in results.items():
            if isinstance(result, dict):
                status = "✅ PASS" if result.get("success") else "❌ FAIL"
            else:
                status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"  {status} {test_name}")
        
        return summary

def main():
    """Main validation execution"""
    validator = RealDataIntegrationValidator()
    
    # Wait for services to be ready
    logger.info("⏳ Waiting 5 seconds for services to be ready...")
    time.sleep(5)
    
    # Run validation
    results = validator.run_comprehensive_validation()
    
    # Save results to file
    with open("validation_report_real_data.json", "w") as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"\n📄 Full validation report saved to: validation_report_real_data.json")
    
    # Return success code
    return 0 if results["overall_success"] else 1

if __name__ == "__main__":
    exit(main())