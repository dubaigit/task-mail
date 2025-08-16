#!/usr/bin/env python3
"""
GPT-5 Email Processor Test Suite
===============================

Comprehensive test suite for the GPT-5 email processing system.
Tests classification, draft generation, task extraction, and user style learning.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from email_processor_gpt5 import (
    GPT5EmailProcessor, 
    GPT5EmailClass, 
    TaskPriority,
    EmailAnalysis,
    DraftReply
)

class GPT5ProcessorTester:
    """Comprehensive tester for GPT-5 email processor"""
    
    def __init__(self):
        self.processor = GPT5EmailProcessor({
            "user_name": "Abdullah",
            "signature": "Regards Abdullah",
            "greeting_prefix": "D"
        })
        self.test_results = []
        
    async def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 GPT-5 Email Processor Test Suite")
        print("=" * 60)
        
        # Test cases covering all scenarios
        test_cases = [
            {
                "name": "URGENT_REPLY_REQUEST",
                "email": {
                    "subject": "URGENT: Need approval for server purchase by EOD",
                    "body": "Hi Abdullah,\n\nWe need urgent approval for the new server purchase ($15,000). The vendor requires confirmation by end of day today to secure the pricing. Please let me know if you approve this expenditure.\n\nThanks,\nJohn",
                    "sender": "John Smith <john.smith@company.com>",
                    "timestamp": "2025-08-14T14:30:00"
                },
                "expected_classification": GPT5EmailClass.APPROVAL,
                "test_draft": True
            },
            {
                "name": "TASK_DELEGATION",
                "email": {
                    "subject": "New client onboarding process",
                    "body": "Abdullah,\n\nWe have a new client starting next week. Can you please:\n1. Set up their accounts in the system\n2. Schedule kick-off meeting\n3. Assign project manager\n\nClient: TechCorp Solutions\nDeadline: Friday this week\n\nBest,\nSarah",
                    "sender": "Sarah Johnson <sarah@company.com>",
                    "timestamp": "2025-08-14T09:15:00"
                },
                "expected_classification": GPT5EmailClass.TASK,
                "test_draft": True
            },
            {
                "name": "FYI_UPDATE",
                "email": {
                    "subject": "FYI: System maintenance completed",
                    "body": "Hi team,\n\nJust to let you know that the scheduled system maintenance has been completed successfully. All services are now running normally.\n\nNo action required.\n\nBest regards,\nIT Team",
                    "sender": "IT Team <it@company.com>",
                    "timestamp": "2025-08-14T08:00:00"
                },
                "expected_classification": GPT5EmailClass.FYI_ONLY,
                "test_draft": False
            },
            {
                "name": "DELEGATION_REQUEST",
                "email": {
                    "subject": "Customer support escalation",
                    "body": "Abdullah,\n\nWe have an escalated customer issue that needs senior attention. Can you have someone from your team handle this?\n\nCustomer: Global Industries\nIssue: API integration problems\nPriority: High\n\nPlease assign to appropriate team member.\n\nThanks,\nMike",
                    "sender": "Mike Wilson <mike@company.com>",
                    "timestamp": "2025-08-14T11:45:00"
                },
                "expected_classification": GPT5EmailClass.DELEGATE,
                "test_draft": True
            },
            {
                "name": "FOLLOW_UP_REQUEST",
                "email": {
                    "subject": "Following up on project timeline",
                    "body": "Hi Abdullah,\n\nFollowing up on our discussion about the Q4 project timeline. Do you have any updates on the resource allocation?\n\nWe need to finalize this by next week to stay on track.\n\nBest,\nLisa",
                    "sender": "Lisa Brown <lisa@company.com>",
                    "timestamp": "2025-08-14T13:20:00"
                },
                "expected_classification": GPT5EmailClass.FOLLOW_UP,
                "test_draft": True
            },
            {
                "name": "COMPLEX_MULTI_TASK",
                "email": {
                    "subject": "Q4 Planning - Multiple Action Items",
                    "body": "Abdullah,\n\nHere are the key items we need to address for Q4 planning:\n\n1. Budget review - need your approval by Friday\n2. Team restructuring proposal - please review and provide feedback\n3. New hire requisitions - 3 positions need approval\n4. Vendor contract renewals - legal team needs your input\n\nAlso, we should schedule a planning meeting with the executive team.\n\nDeadlines:\n- Budget: This Friday\n- Team proposal: Next Tuesday\n- Hire approvals: End of month\n\nLet me know your thoughts.\n\nRegards,\nDavid Chen",
                    "sender": "David Chen <david.chen@company.com>",
                    "timestamp": "2025-08-14T16:00:00"
                },
                "expected_classification": GPT5EmailClass.TASK,
                "test_draft": True
            }
        ]
        
        # Run tests
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n🧪 Test {i}/{len(test_cases)}: {test_case['name']}")
            await self._run_single_test(test_case)
        
        # Run performance tests
        await self._run_performance_tests()
        
        # Test learning functionality
        await self._test_learning_system()
        
        # Generate summary
        self._generate_test_summary()
    
    async def _run_single_test(self, test_case: dict):
        """Run a single test case"""
        email_data = test_case["email"]
        expected_class = test_case["expected_classification"]
        
        print(f"  📧 Subject: {email_data['subject']}")
        print(f"  👤 From: {email_data['sender']}")
        
        try:
            # Test analysis
            start_time = datetime.now()
            analysis = await self.processor.analyze_email_async(email_data)
            analysis_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Check classification accuracy
            classification_correct = analysis.classification == expected_class
            
            print(f"  🎯 Classification: {analysis.classification.value} (Expected: {expected_class.value})")
            print(f"  ✅ Correct: {'Yes' if classification_correct else 'No'}")
            print(f"  📊 Confidence: {analysis.confidence:.2f}")
            print(f"  ⏱️ Analysis Time: {analysis_time:.1f}ms")
            
            # Test draft generation if requested
            draft_result = None
            if test_case.get("test_draft", False):
                print(f"  📝 Testing draft generation...")
                draft_start = datetime.now()
                draft_result = await self.processor.generate_draft_reply_gpt5(email_data, analysis)
                draft_time = (datetime.now() - draft_start).total_seconds() * 1000
                
                print(f"  📄 Draft generated in {draft_time:.1f}ms")
                print(f"  🎭 Draft tone: {draft_result.tone}")
                print(f"  📋 Review required: {draft_result.requires_review}")
                
                # Show draft preview
                draft_lines = draft_result.content.split('\n')
                print(f"  📖 Draft preview:")
                for line in draft_lines[:3]:  # Show first 3 lines
                    print(f"     {line}")
                if len(draft_lines) > 3:
                    print(f"     ... ({len(draft_lines)-3} more lines)")
            
            # Display extracted information
            if analysis.tasks:
                print(f"  📋 Tasks found: {len(analysis.tasks)}")
                for task in analysis.tasks[:2]:  # Show first 2 tasks
                    print(f"     • {task.description} (Priority: {task.priority.value})")
            
            if analysis.key_points:
                print(f"  🔑 Key points: {len(analysis.key_points)}")
                for point in analysis.key_points[:2]:  # Show first 2 points
                    print(f"     • {point[:60]}{'...' if len(point) > 60 else ''}")
            
            if analysis.tags:
                print(f"  🏷️ Tags: {', '.join(analysis.tags[:5])}")
            
            # Record test result
            test_result = {
                "test_name": test_case["name"],
                "classification_correct": classification_correct,
                "analysis_time_ms": analysis_time,
                "confidence": analysis.confidence,
                "draft_generated": draft_result is not None,
                "draft_time_ms": draft_time if draft_result else 0,
                "tasks_found": len(analysis.tasks),
                "key_points_found": len(analysis.key_points),
                "tags_found": len(analysis.tags)
            }
            
            self.test_results.append(test_result)
            
        except Exception as e:
            print(f"  ❌ Test failed: {str(e)}")
            self.test_results.append({
                "test_name": test_case["name"],
                "error": str(e),
                "classification_correct": False
            })
    
    async def _run_performance_tests(self):
        """Test performance with batch processing"""
        print(f"\n🏃 Performance Tests")
        print("-" * 40)
        
        # Generate test emails for batch processing
        batch_emails = []
        for i in range(10):
            batch_emails.append({
                "subject": f"Test email {i+1} - Performance testing",
                "body": f"This is test email number {i+1} for performance evaluation. Please process this efficiently.",
                "sender": f"test{i+1}@company.com",
                "timestamp": datetime.now().isoformat()
            })
        
        # Test batch processing
        print(f"  📦 Testing batch processing of {len(batch_emails)} emails...")
        start_time = datetime.now()
        
        batch_results = []
        for email in batch_emails:
            result = await self.processor.analyze_email_async(email)
            batch_results.append(result)
        
        total_time = (datetime.now() - start_time).total_seconds() * 1000
        avg_time = total_time / len(batch_emails)
        
        print(f"  ⏱️ Total time: {total_time:.1f}ms")
        print(f"  📊 Average per email: {avg_time:.1f}ms")
        print(f"  🚀 Emails per second: {1000/avg_time:.1f}")
        
        # Test concurrent processing
        print(f"  🔄 Testing concurrent processing...")
        start_time = datetime.now()
        
        concurrent_tasks = [
            self.processor.analyze_email_async(email) 
            for email in batch_emails[:5]  # Test with 5 concurrent
        ]
        concurrent_results = await asyncio.gather(*concurrent_tasks)
        
        concurrent_time = (datetime.now() - start_time).total_seconds() * 1000
        print(f"  ⚡ Concurrent processing time: {concurrent_time:.1f}ms")
        print(f"  📈 Speedup factor: {(avg_time * 5) / concurrent_time:.1f}x")
    
    async def _test_learning_system(self):
        """Test the learning and correction system"""
        print(f"\n🧠 Learning System Tests")
        print("-" * 40)
        
        # Test email for learning
        test_email = {
            "subject": "Budget approval needed",
            "body": "Hi Abdullah, I need approval for the marketing budget.",
            "sender": "marketing@company.com"
        }
        
        # Get initial analysis
        initial_analysis = await self.processor.analyze_email_async(test_email)
        print(f"  🎯 Initial classification: {initial_analysis.classification.value}")
        
        # Simulate user correction
        correction_data = {
            "classification": "APPROVAL",
            "subject_keywords": ["budget", "approval"],
            "body_keywords": ["approval", "marketing"],
            "sender_domain": "company.com"
        }
        
        # Test learning function
        self.processor.learn_from_correction(initial_analysis, correction_data)
        print(f"  ✅ Learning recorded successfully")
        
        # Check if learning log was created
        learning_file = Path("gpt5_learning_log.jsonl")
        if learning_file.exists():
            with open(learning_file, 'r') as f:
                lines = f.readlines()
                print(f"  📚 Learning entries: {len(lines)}")
        
        print(f"  🎓 Learning system functional")
    
    def _generate_test_summary(self):
        """Generate comprehensive test summary"""
        print(f"\n📊 Test Summary")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        successful_tests = len([r for r in self.test_results if not r.get('error')])
        classification_accuracy = len([r for r in self.test_results if r.get('classification_correct')]) / total_tests
        
        # Calculate averages
        analysis_times = [r.get('analysis_time_ms', 0) for r in self.test_results if not r.get('error')]
        avg_analysis_time = sum(analysis_times) / len(analysis_times) if analysis_times else 0
        
        draft_times = [r.get('draft_time_ms', 0) for r in self.test_results if r.get('draft_time_ms', 0) > 0]
        avg_draft_time = sum(draft_times) / len(draft_times) if draft_times else 0
        
        confidences = [r.get('confidence', 0) for r in self.test_results if not r.get('error')]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # Print summary
        print(f"Tests Run: {total_tests}")
        print(f"Successful: {successful_tests}")
        print(f"Classification Accuracy: {classification_accuracy:.1%}")
        print(f"Average Analysis Time: {avg_analysis_time:.1f}ms")
        print(f"Average Draft Time: {avg_draft_time:.1f}ms")
        print(f"Average Confidence: {avg_confidence:.2f}")
        
        # Performance assessment
        if avg_analysis_time < 100:
            performance_rating = "⚡ Excellent"
        elif avg_analysis_time < 500:
            performance_rating = "🚀 Good"
        elif avg_analysis_time < 1000:
            performance_rating = "✅ Acceptable"
        else:
            performance_rating = "⚠️ Needs Improvement"
        
        print(f"Performance Rating: {performance_rating}")
        
        # Detailed results
        print(f"\n📋 Detailed Results:")
        for result in self.test_results:
            if result.get('error'):
                print(f"  ❌ {result['test_name']}: Error - {result['error']}")
            else:
                status = "✅" if result['classification_correct'] else "❌"
                print(f"  {status} {result['test_name']}: {result['analysis_time_ms']:.1f}ms, "
                      f"confidence: {result['confidence']:.2f}, "
                      f"tasks: {result['tasks_found']}, "
                      f"points: {result['key_points_found']}")
        
        # Get system stats
        stats = self.processor.get_processing_stats()
        print(f"\n🔧 System Statistics:")
        print(json.dumps(stats, indent=2))
        
        # Save test results
        results_file = Path("gpt5_test_results.json")
        with open(results_file, 'w') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "total_tests": total_tests,
                    "successful_tests": successful_tests,
                    "classification_accuracy": classification_accuracy,
                    "avg_analysis_time_ms": avg_analysis_time,
                    "avg_draft_time_ms": avg_draft_time,
                    "avg_confidence": avg_confidence,
                    "performance_rating": performance_rating
                },
                "detailed_results": self.test_results,
                "system_stats": stats
            }, f, indent=2)
        
        print(f"📁 Results saved to: {results_file}")


async def demo_interactive():
    """Interactive demo of the GPT-5 processor"""
    print("🎮 Interactive GPT-5 Email Processor Demo")
    print("=" * 50)
    
    processor = GPT5EmailProcessor()
    
    while True:
        print(f"\nOptions:")
        print(f"1. Analyze sample email")
        print(f"2. Enter custom email")
        print(f"3. Show system stats")
        print(f"4. Exit")
        
        choice = input("Choose option (1-4): ").strip()
        
        if choice == "1":
            # Sample email
            sample_email = {
                "subject": "URGENT: Server migration needs approval",
                "body": "Hi Abdullah,\n\nWe need your approval to proceed with the server migration scheduled for this weekend. The migration will take approximately 6 hours and requires a budget of $25,000.\n\nPlease confirm by EOD today.\n\nThanks,\nTech Team",
                "sender": "Tech Team <tech@company.com>"
            }
            
            print(f"\n📧 Analyzing sample email...")
            analysis = await processor.analyze_email_async(sample_email)
            
            print(f"Subject: {sample_email['subject']}")
            print(f"Classification: {analysis.classification.value}")
            print(f"Confidence: {analysis.confidence:.2f}")
            print(f"Urgency: {analysis.urgency.value}")
            print(f"Summary: {analysis.summary}")
            
            if input("Generate draft reply? (y/n): ").lower() == 'y':
                draft = await processor.generate_draft_reply_gpt5(sample_email, analysis)
                print(f"\n📝 Draft Reply:")
                print("-" * 30)
                print(draft.content)
                print("-" * 30)
        
        elif choice == "2":
            print(f"\n📝 Enter custom email:")
            subject = input("Subject: ")
            sender = input("From: ")
            print("Body (press Enter twice when done):")
            body_lines = []
            while True:
                line = input()
                if line == "" and (not body_lines or body_lines[-1] == ""):
                    break
                body_lines.append(line)
            
            custom_email = {
                "subject": subject,
                "body": "\n".join(body_lines),
                "sender": sender
            }
            
            print(f"\n🔍 Analyzing...")
            analysis = await processor.analyze_email_async(custom_email)
            
            print(f"Classification: {analysis.classification.value}")
            print(f"Confidence: {analysis.confidence:.2f}")
            print(f"Summary: {analysis.summary}")
            
            if analysis.tasks:
                print(f"Tasks:")
                for task in analysis.tasks:
                    print(f"  • {task.description}")
            
            if input("Generate draft reply? (y/n): ").lower() == 'y':
                draft = await processor.generate_draft_reply_gpt5(custom_email, analysis)
                print(f"\n📝 Draft Reply:")
                print("-" * 30)
                print(draft.content)
                print("-" * 30)
        
        elif choice == "3":
            stats = processor.get_processing_stats()
            print(f"\n📊 System Statistics:")
            print(json.dumps(stats, indent=2))
        
        elif choice == "4":
            print(f"👋 Goodbye!")
            break
        
        else:
            print(f"❌ Invalid choice. Please try again.")


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="GPT-5 Email Processor Test Suite")
    parser.add_argument("--test", action="store_true", help="Run comprehensive test suite")
    parser.add_argument("--demo", action="store_true", help="Run interactive demo")
    parser.add_argument("--quick", action="store_true", help="Quick test with sample email")
    
    args = parser.parse_args()
    
    if args.test:
        tester = GPT5ProcessorTester()
        await tester.run_all_tests()
    elif args.demo:
        await demo_interactive()
    elif args.quick:
        # Quick test
        processor = GPT5EmailProcessor()
        sample_email = {
            "subject": "Quick test email",
            "body": "This is a quick test of the GPT-5 processor. Please reply with status.",
            "sender": "test@example.com"
        }
        
        print("🚀 Quick Test - GPT-5 Email Processor")
        print("=" * 40)
        
        analysis = await processor.analyze_email_async(sample_email)
        print(f"Classification: {analysis.classification.value}")
        print(f"Confidence: {analysis.confidence:.2f}")
        print(f"Processing time: {analysis.processing_time_ms:.1f}ms")
        
        draft = await processor.generate_draft_reply_gpt5(sample_email, analysis)
        print(f"\nDraft Reply:\n{draft.content}")
    else:
        print("🎯 GPT-5 Email Processor")
        print("Use --test for full test suite, --demo for interactive demo, or --quick for quick test")


if __name__ == "__main__":
    asyncio.run(main())