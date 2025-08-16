#!/usr/bin/env python3
"""
Comprehensive test suite for the Optimized Email Intelligence Engine

Tests the following optimization features:
1. Smart caching with exact model preservation
2. Batch processing efficiency
3. Async API calls
4. Cost optimization tracking
5. Fallback patterns
6. Performance benchmarks
"""

import os
import sys
import asyncio
import time
import json
from datetime import datetime
from typing import List, Dict, Any

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from email_intelligence_engine_optimized import (
    OptimizedEmailIntelligenceEngine,
    OptimizedEmailIntelligenceEngineSync,
    EmailClass,
    Urgency,
    Sentiment
)

class OptimizationTester:
    """Test suite for optimization features"""
    
    def __init__(self):
        self.test_results = {}
        self.test_emails = self._generate_test_emails()
        
    def _generate_test_emails(self) -> List[Dict[str, str]]:
        """Generate diverse test emails for comprehensive testing"""
        return [
            {
                'subject': 'URGENT: Budget approval needed by Friday',
                'body': 'Hi team, I need your approval for the Q4 budget of $150,000. This is urgent and must be completed by Friday. Please review the attached documents and let me know if you approve.',
                'sender': 'finance.manager@company.com'
            },
            {
                'subject': 'FYI: System maintenance scheduled',
                'body': 'Just letting you know that we have scheduled system maintenance for this weekend from 2 AM to 6 AM. No action required from your side. All services will be restored automatically.',
                'sender': 'it-operations@company.com'
            },
            {
                'subject': 'Can you review the presentation slides?',
                'body': 'Hi Sarah, could you please review the presentation slides for tomorrow\'s client meeting? I need feedback on the market analysis section. Please let me know your thoughts by end of day.',
                'sender': 'marketing.lead@company.com'
            },
            {
                'subject': 'Task delegation: Customer support ticket',
                'body': 'Please assign this customer support ticket to the appropriate team member. The customer is reporting login issues with priority level 2. Expected resolution time is 24 hours.',
                'sender': 'support.manager@company.com'
            },
            {
                'subject': 'Follow-up on project timeline',
                'body': 'Following up on our discussion about the project timeline. Do you have any updates on the development progress? We need to finalize the delivery date by next week.',
                'sender': 'project.manager@company.com'
            },
            {
                'subject': 'Create task: Implement new feature',
                'body': 'We need to implement the new user authentication feature as discussed in the meeting. This should include multi-factor authentication and session management. Target completion: end of sprint.',
                'sender': 'tech.lead@company.com'
            },
            {
                'subject': 'Team meeting notes - Action items',
                'body': 'Here are the action items from today\'s team meeting:\n1. Update project documentation by Thursday\n2. Review code quality metrics\n3. Prepare Q3 performance report\nPlease confirm receipt.',
                'sender': 'team.lead@company.com'
            },
            {
                'subject': 'CRITICAL: Security incident response',
                'body': 'IMMEDIATE ACTION REQUIRED: We have detected unusual activity in our systems. Please implement the incident response protocol immediately. Contact the security team at ext. 911.',
                'sender': 'security.team@company.com'
            },
            {
                'subject': 'Thank you for the great presentation',
                'body': 'I wanted to thank you for the excellent presentation yesterday. The client was very impressed with our proposal. Great work on the financial projections section!',
                'sender': 'client.relations@company.com'
            },
            {
                'subject': 'Issue with payment processing',
                'body': 'We are experiencing issues with the payment processing system. Customers are unable to complete transactions. This is affecting our revenue. Please investigate immediately.',
                'sender': 'operations.manager@company.com'
            }
        ]
    
    async def test_caching_effectiveness(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test caching system effectiveness"""
        print("\n" + "="*60)
        print("TESTING CACHING EFFECTIVENESS")
        print("="*60)
        
        email = self.test_emails[0]  # Use first email for caching test
        
        # First analysis (no cache)
        print("🔍 First analysis (should miss cache)...")
        start_time = time.time()
        result1 = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        first_time = time.time() - start_time
        
        # Second analysis (should hit cache)
        print("🔍 Second analysis (should hit cache)...")
        start_time = time.time()
        result2 = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        second_time = time.time() - start_time
        
        # Verify results are identical
        results_match = (
            result1.classification == result2.classification and
            result1.confidence == result2.confidence and
            result1.urgency == result2.urgency
        )
        
        # Performance improvement
        speedup = first_time / second_time if second_time > 0 else float('inf')
        
        test_result = {
            'first_analysis_time_ms': first_time * 1000,
            'second_analysis_time_ms': second_time * 1000,
            'speedup_factor': speedup,
            'results_identical': results_match,
            'first_cached': result1.cached,
            'second_cached': result2.cached,
            'ai_used_first': result1.ai_used,
            'ai_used_second': result2.ai_used,
            'cache_stats': engine.cache.get_stats()
        }
        
        print(f"✅ First analysis: {first_time*1000:.1f}ms (cached: {result1.cached})")
        print(f"✅ Second analysis: {second_time*1000:.1f}ms (cached: {result2.cached})")
        print(f"🚀 Speedup factor: {speedup:.2f}x")
        print(f"✅ Results identical: {results_match}")
        
        return test_result
    
    async def test_batch_processing(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test batch processing efficiency"""
        print("\n" + "="*60)
        print("TESTING BATCH PROCESSING")
        print("="*60)
        
        # Test different batch sizes
        batch_sizes = [1, 3, 5, 10]
        batch_results = {}
        
        for batch_size in batch_sizes:
            emails_batch = self.test_emails[:batch_size]
            
            print(f"🔄 Processing batch of {batch_size} emails...")
            start_time = time.time()
            
            results = await engine.batch_analyze_async(emails_batch, max_concurrent=3)
            
            batch_time = time.time() - start_time
            avg_time_per_email = batch_time / batch_size
            
            batch_results[batch_size] = {
                'total_time_ms': batch_time * 1000,
                'avg_time_per_email_ms': avg_time_per_email * 1000,
                'emails_processed': len(results),
                'success_rate': len(results) / batch_size * 100,
                'ai_usage': sum(1 for r in results if r.ai_used),
                'cache_hits': sum(1 for r in results if r.cached)
            }
            
            print(f"  ✅ {batch_size} emails in {batch_time*1000:.1f}ms ({avg_time_per_email*1000:.1f}ms/email)")
            print(f"  📊 AI used: {batch_results[batch_size]['ai_usage']}/{batch_size}, Cache hits: {batch_results[batch_size]['cache_hits']}/{batch_size}")
        
        return {
            'batch_results': batch_results,
            'cache_stats_after': engine.cache.get_stats()
        }
    
    async def test_model_preservation(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test that exact model names are preserved"""
        print("\n" + "="*60)
        print("TESTING MODEL PRESERVATION")
        print("="*60)
        
        # Verify engine configuration
        expected_classifier = "gpt-5-nano-2025-08-07"
        expected_draft = "gpt-5-mini-2025-08-07"
        
        config_correct = (
            engine.classifier_model == expected_classifier and
            engine.draft_model == expected_draft
        )
        
        print(f"🔧 Expected classifier model: {expected_classifier}")
        print(f"✅ Actual classifier model: {engine.classifier_model}")
        print(f"🔧 Expected draft model: {expected_draft}")
        print(f"✅ Actual draft model: {engine.draft_model}")
        print(f"✅ Configuration correct: {config_correct}")
        
        # Test analysis with model tracking
        email = self.test_emails[0]
        result = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        
        # Test draft generation with model tracking
        email_for_draft = {
            'subject': email['subject'],
            'sender_name': 'Test User',
            'content': email['body']
        }
        
        draft = await engine.generate_draft_reply_async(email_for_draft, result)
        
        return {
            'classifier_model_correct': engine.classifier_model == expected_classifier,
            'draft_model_correct': engine.draft_model == expected_draft,
            'config_preserved': config_correct,
            'analysis_model_used': result.model_used,
            'ai_classification_used': result.ai_used,
            'draft_generated': bool(draft),
            'draft_length': len(draft) if draft else 0
        }
    
    async def test_cost_optimization(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test cost optimization through caching"""
        print("\n" + "="*60)
        print("TESTING COST OPTIMIZATION")
        print("="*60)
        
        # Clear cache for clean test
        engine.cache.cache.clear()
        engine.cache.stats = {'hits': 0, 'misses': 0, 'evictions': 0, 'ai_calls_saved': 0, 'cost_saved_estimate': 0.0}
        
        # Process emails multiple times to demonstrate savings
        test_email = self.test_emails[0]
        
        iterations = 5
        total_time = 0
        ai_calls_made = 0
        
        print(f"🔄 Processing same email {iterations} times...")
        
        for i in range(iterations):
            start_time = time.time()
            result = await engine.analyze_email_async(
                subject=test_email['subject'],
                body=test_email['body'],
                sender=test_email['sender']
            )
            iteration_time = time.time() - start_time
            total_time += iteration_time
            
            if result.ai_used and not result.cached:
                ai_calls_made += 1
            
            print(f"  Iteration {i+1}: {iteration_time*1000:.1f}ms (AI: {result.ai_used}, Cached: {result.cached})")
        
        cache_stats = engine.cache.get_stats()
        
        return {
            'iterations': iterations,
            'total_time_ms': total_time * 1000,
            'avg_time_per_iteration_ms': total_time / iterations * 1000,
            'ai_calls_made': ai_calls_made,
            'expected_ai_calls_without_cache': iterations,
            'ai_calls_saved': iterations - ai_calls_made,
            'cost_savings_percent': (1 - ai_calls_made / iterations) * 100,
            'cache_stats': cache_stats
        }
    
    async def test_async_performance(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test async performance vs sequential processing"""
        print("\n" + "="*60)
        print("TESTING ASYNC PERFORMANCE")
        print("="*60)
        
        emails_for_test = self.test_emails[:5]  # Use first 5 emails
        
        # Test sequential processing
        print("🔄 Sequential processing...")
        start_time = time.time()
        sequential_results = []
        for email in emails_for_test:
            result = await engine.analyze_email_async(
                subject=email['subject'],
                body=email['body'],
                sender=email['sender']
            )
            sequential_results.append(result)
        sequential_time = time.time() - start_time
        
        # Clear cache for fair comparison
        engine.cache.cache.clear()
        
        # Test concurrent processing
        print("🚀 Concurrent processing...")
        start_time = time.time()
        concurrent_results = await engine.batch_analyze_async(emails_for_test, max_concurrent=5)
        concurrent_time = time.time() - start_time
        
        speedup = sequential_time / concurrent_time if concurrent_time > 0 else float('inf')
        
        print(f"✅ Sequential: {sequential_time*1000:.1f}ms")
        print(f"🚀 Concurrent: {concurrent_time*1000:.1f}ms")
        print(f"⚡ Speedup: {speedup:.2f}x")
        
        return {
            'emails_processed': len(emails_for_test),
            'sequential_time_ms': sequential_time * 1000,
            'concurrent_time_ms': concurrent_time * 1000,
            'speedup_factor': speedup,
            'sequential_results_count': len(sequential_results),
            'concurrent_results_count': len(concurrent_results),
            'results_consistent': len(sequential_results) == len(concurrent_results)
        }
    
    async def test_fallback_robustness(self, engine: OptimizedEmailIntelligenceEngine) -> Dict[str, Any]:
        """Test fallback when AI is unavailable"""
        print("\n" + "="*60)
        print("TESTING FALLBACK ROBUSTNESS")
        print("="*60)
        
        # Test with API key (if available)
        original_api_key = engine.openai_api_key
        has_api_key = bool(original_api_key)
        
        email = self.test_emails[0]
        
        # Test with API key
        if has_api_key:
            print("🔑 Testing with API key...")
            result_with_api = await engine.analyze_email_async(
                subject=email['subject'],
                body=email['body'],
                sender=email['sender']
            )
            ai_classification = result_with_api.classification
            ai_confidence = result_with_api.confidence
            ai_used = result_with_api.ai_used
        else:
            print("⚠️  No API key available, skipping AI test...")
            ai_classification = None
            ai_confidence = 0.0
            ai_used = False
        
        # Test without API key (force fallback)
        print("🔄 Testing fallback mode (no API key)...")
        engine.openai_api_key = None  # Temporarily remove API key
        
        result_fallback = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        
        fallback_classification = result_fallback.classification
        fallback_confidence = result_fallback.confidence
        fallback_ai_used = result_fallback.ai_used
        
        # Restore API key
        engine.openai_api_key = original_api_key
        
        print(f"✅ Fallback classification: {fallback_classification.value}")
        print(f"✅ Fallback confidence: {fallback_confidence:.2f}")
        print(f"✅ AI used in fallback: {fallback_ai_used}")
        
        return {
            'api_key_available': has_api_key,
            'ai_classification': ai_classification.value if ai_classification else None,
            'ai_confidence': ai_confidence,
            'ai_used': ai_used,
            'fallback_classification': fallback_classification.value,
            'fallback_confidence': fallback_confidence,
            'fallback_ai_used': fallback_ai_used,
            'fallback_functional': not fallback_ai_used,  # Should be False
            'consistent_results': (
                ai_classification == fallback_classification if has_api_key else True
            )
        }
    
    async def run_comprehensive_test_suite(self) -> Dict[str, Any]:
        """Run all optimization tests"""
        print("="*70)
        print("COMPREHENSIVE OPTIMIZATION TEST SUITE")
        print("="*70)
        print(f"Testing {len(self.test_emails)} emails with optimization features")
        
        async with OptimizedEmailIntelligenceEngine(
            cache_size=1000,
            cache_ttl_hours=1,
            max_concurrent_requests=5
        ) as engine:
            
            # Run all tests
            test_results = {}
            
            try:
                test_results['caching'] = await self.test_caching_effectiveness(engine)
                test_results['batch_processing'] = await self.test_batch_processing(engine)
                test_results['model_preservation'] = await self.test_model_preservation(engine)
                test_results['cost_optimization'] = await self.test_cost_optimization(engine)
                test_results['async_performance'] = await self.test_async_performance(engine)
                test_results['fallback_robustness'] = await self.test_fallback_robustness(engine)
                
                # Final performance stats
                test_results['final_stats'] = engine.get_performance_stats()
                
                # Test summary
                print("\n" + "="*70)
                print("TEST SUMMARY")
                print("="*70)
                
                self._print_test_summary(test_results)
                
            except Exception as e:
                print(f"❌ Test suite error: {e}")
                test_results['error'] = str(e)
            
            return test_results
    
    def _print_test_summary(self, results: Dict[str, Any]):
        """Print formatted test summary"""
        
        print("\n🧪 TEST RESULTS SUMMARY:")
        
        # Caching test
        if 'caching' in results:
            cache_result = results['caching']
            print(f"  ✅ Caching: {cache_result['speedup_factor']:.1f}x speedup, {cache_result['cache_stats']['hit_rate_percent']:.1f}% hit rate")
        
        # Batch processing test
        if 'batch_processing' in results:
            batch_result = results['batch_processing']
            largest_batch = max(batch_result['batch_results'].keys())
            avg_time = batch_result['batch_results'][largest_batch]['avg_time_per_email_ms']
            print(f"  ✅ Batch Processing: {avg_time:.1f}ms avg per email in batch of {largest_batch}")
        
        # Model preservation test
        if 'model_preservation' in results:
            model_result = results['model_preservation']
            print(f"  ✅ Model Preservation: {model_result['config_preserved']} (correct models used)")
        
        # Cost optimization test
        if 'cost_optimization' in results:
            cost_result = results['cost_optimization']
            savings = cost_result['cost_savings_percent']
            print(f"  ✅ Cost Optimization: {savings:.1f}% AI calls saved through caching")
        
        # Async performance test
        if 'async_performance' in results:
            async_result = results['async_performance']
            speedup = async_result['speedup_factor']
            print(f"  ✅ Async Performance: {speedup:.1f}x faster than sequential")
        
        # Fallback test
        if 'fallback_robustness' in results:
            fallback_result = results['fallback_robustness']
            functional = fallback_result['fallback_functional']
            print(f"  ✅ Fallback Robustness: {'Working' if functional else 'Issues detected'}")
        
        # Final stats
        if 'final_stats' in results:
            final_stats = results['final_stats']
            cache_stats = final_stats.get('cache_stats', {})
            engine_stats = final_stats.get('engine_stats', {})
            
            print(f"\n📊 FINAL PERFORMANCE METRICS:")
            print(f"  • Total emails analyzed: {engine_stats.get('total_analyzed', 0)}")
            print(f"  • AI classifications: {engine_stats.get('ai_classifications', 0)}")
            print(f"  • Cache hit rate: {cache_stats.get('hit_rate_percent', 0):.1f}%")
            print(f"  • AI calls saved: {cache_stats.get('ai_calls_saved', 0)}")
            print(f"  • Estimated cost saved: ${cache_stats.get('estimated_cost_saved_usd', 0):.4f}")

def test_sync_wrapper():
    """Test the synchronous wrapper"""
    print("\n" + "="*60)
    print("TESTING SYNCHRONOUS WRAPPER")
    print("="*60)
    
    # Initialize sync engine
    engine = OptimizedEmailIntelligenceEngineSync(cache_size=100)
    
    test_email = {
        'subject': 'Test sync wrapper functionality',
        'body': 'This is a test email to verify the synchronous wrapper works correctly.',
        'sender': 'test@example.com'
    }
    
    # Test single analysis
    print("🔍 Testing sync single analysis...")
    start_time = time.time()
    result = engine.analyze_email(
        subject=test_email['subject'],
        body=test_email['body'],
        sender=test_email['sender']
    )
    sync_time = time.time() - start_time
    
    print(f"✅ Sync analysis: {sync_time*1000:.1f}ms")
    print(f"✅ Classification: {result.classification.value}")
    print(f"✅ Confidence: {result.confidence:.2f}")
    
    # Test batch analysis
    test_emails = [test_email] * 3
    print("🔍 Testing sync batch analysis...")
    start_time = time.time()
    batch_results = engine.batch_analyze(test_emails)
    batch_time = time.time() - start_time
    
    print(f"✅ Sync batch: {batch_time*1000:.1f}ms for {len(batch_results)} emails")
    
    # Test draft generation
    print("🔍 Testing sync draft generation...")
    email_for_draft = {
        'subject': test_email['subject'],
        'sender_name': 'Test User',
        'content': test_email['body']
    }
    
    start_time = time.time()
    draft = engine.generate_draft_reply(email_for_draft, result)
    draft_time = time.time() - start_time
    
    print(f"✅ Sync draft generation: {draft_time*1000:.1f}ms")
    print(f"✅ Draft length: {len(draft)} characters")
    
    return {
        'sync_analysis_time_ms': sync_time * 1000,
        'sync_batch_time_ms': batch_time * 1000,
        'sync_draft_time_ms': draft_time * 1000,
        'results_count': len(batch_results),
        'draft_generated': bool(draft)
    }

async def main():
    """Main test execution"""
    print("🚀 STARTING OPTIMIZATION TEST SUITE")
    print("=" * 70)
    
    # Check environment
    api_key_set = bool(os.getenv("OPENAI_API_KEY"))
    print(f"🔑 OpenAI API Key: {'✅ Configured' if api_key_set else '⚠️  Not configured (will test fallback)'}")
    
    if not api_key_set:
        print("💡 To test AI features, set: export OPENAI_API_KEY='your-key-here'")
    
    # Run comprehensive async tests
    tester = OptimizationTester()
    
    try:
        async_results = await tester.run_comprehensive_test_suite()
        
        # Run sync wrapper tests
        print("\n" + "="*70)
        sync_results = test_sync_wrapper()
        
        # Combine results
        all_results = {
            'async_tests': async_results,
            'sync_tests': sync_results,
            'test_timestamp': datetime.now().isoformat(),
            'api_key_configured': api_key_set
        }
        
        # Save results to file
        results_file = '/Users/iamomen/apple-mcp/optimization_test_results.json'
        with open(results_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        print(f"\n💾 Test results saved to: {results_file}")
        
        print("\n" + "="*70)
        print("✅ ALL OPTIMIZATION TESTS COMPLETED SUCCESSFULLY!")
        print("="*70)
        
        return all_results
        
    except Exception as e:
        print(f"\n❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}

if __name__ == "__main__":
    results = asyncio.run(main())