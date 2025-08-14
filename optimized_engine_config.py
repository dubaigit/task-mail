#!/usr/bin/env python3
"""
Configuration and Usage Guide for Optimized Email Intelligence Engine

This file demonstrates how to properly configure and use the optimized engine
with the exact model names specified: gpt-5-nano-2025-08-07 and gpt-5-mini-2025-08-07
"""

import os
import asyncio
from typing import Dict, List, Any
from datetime import datetime

from email_intelligence_engine_optimized import (
    OptimizedEmailIntelligenceEngine,
    OptimizedEmailIntelligenceEngineSync,
    EmailClass,
    Urgency,
    Sentiment
)

class OptimizedEngineConfig:
    """Production configuration for the optimized email intelligence engine"""
    
    # Model Configuration - EXACT models as specified by user
    CLASSIFIER_MODEL = "gpt-5-nano-2025-08-07"  # For fast email classification
    DRAFT_MODEL = "gpt-5-mini-2025-08-07"       # For higher quality draft generation
    
    # Cache Configuration
    CACHE_SIZE = 10000          # Maximum number of cached results
    CACHE_TTL_HOURS = 24        # Cache time-to-live in hours
    
    # Performance Configuration
    MAX_CONCURRENT_REQUESTS = 10    # Maximum concurrent API calls
    BATCH_SIZE_OPTIMAL = 20         # Optimal batch size for processing
    REQUEST_TIMEOUT_SECONDS = 30    # API request timeout
    
    # Cost Optimization
    ENABLE_AGGRESSIVE_CACHING = True    # Enable aggressive caching for cost savings
    FALLBACK_ALWAYS_AVAILABLE = True    # Ensure fallback is always functional
    TRACK_COST_SAVINGS = True           # Track and report cost savings
    
    @classmethod
    def get_engine_config(cls) -> Dict[str, Any]:
        """Get configuration dictionary for engine initialization"""
        return {
            'cache_size': cls.CACHE_SIZE,
            'cache_ttl_hours': cls.CACHE_TTL_HOURS,
            'max_concurrent_requests': cls.MAX_CONCURRENT_REQUESTS
        }
    
    @classmethod
    def validate_environment(cls) -> Dict[str, Any]:
        """Validate environment setup for production use"""
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        
        validation = {
            'api_key_configured': bool(api_key),
            'api_key_length': len(api_key) if api_key else 0,
            'classifier_model': cls.CLASSIFIER_MODEL,
            'draft_model': cls.DRAFT_MODEL,
            'cache_enabled': True,
            'async_enabled': True,
            'batch_processing_enabled': True,
            'environment_ready': bool(api_key)
        }
        
        return validation

class ProductionEmailProcessor:
    """Production-ready email processor using optimized engine"""
    
    def __init__(self, config: OptimizedEngineConfig = None):
        self.config = config or OptimizedEngineConfig()
        self.engine = None
        self.stats = {
            'emails_processed': 0,
            'cache_hits': 0,
            'ai_calls_made': 0,
            'cost_saved_usd': 0.0,
            'processing_time_total_ms': 0.0
        }
    
    async def initialize(self):
        """Initialize the async engine"""
        engine_config = self.config.get_engine_config()
        self.engine = OptimizedEmailIntelligenceEngine(**engine_config)
        await self.engine.__aenter__()
        
        # Validate configuration
        validation = self.config.validate_environment()
        if not validation['environment_ready']:
            print("⚠️  Warning: No API key configured. Using fallback mode.")
        
        print(f"✅ Production engine initialized")
        print(f"   📧 Classifier model: {self.config.CLASSIFIER_MODEL}")
        print(f"   ✍️  Draft model: {self.config.DRAFT_MODEL}")
        print(f"   💾 Cache size: {self.config.CACHE_SIZE}")
        print(f"   🚀 Max concurrent: {self.config.MAX_CONCURRENT_REQUESTS}")
        
    async def cleanup(self):
        """Cleanup engine resources"""
        if self.engine:
            await self.engine.__aexit__(None, None, None)
    
    async def process_single_email(self, 
                                 subject: str, 
                                 body: str, 
                                 sender: str = "",
                                 include_draft: bool = False) -> Dict[str, Any]:
        """
        Process a single email with full intelligence analysis
        
        Args:
            subject: Email subject line
            body: Email body content
            sender: Sender email/name
            include_draft: Whether to generate draft reply
            
        Returns:
            Complete analysis results with metadata
        """
        if not self.engine:
            raise RuntimeError("Engine not initialized. Call initialize() first.")
        
        start_time = datetime.now()
        
        # Analyze email
        analysis = await self.engine.analyze_email_async(subject, body, sender)
        
        # Generate draft if requested
        draft = None
        if include_draft:
            email_data = {
                'subject': subject,
                'sender_name': sender.split('@')[0] if '@' in sender else sender,
                'content': body
            }
            draft = await self.engine.generate_draft_reply_async(email_data, analysis)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Update stats
        self.stats['emails_processed'] += 1
        self.stats['processing_time_total_ms'] += processing_time
        if analysis.cached:
            self.stats['cache_hits'] += 1
        if analysis.ai_used:
            self.stats['ai_calls_made'] += 1
        
        return {
            'analysis': {
                'classification': analysis.classification.value,
                'confidence': analysis.confidence,
                'urgency': analysis.urgency.value,
                'sentiment': analysis.sentiment.value,
                'intent': analysis.intent,
                'action_items': [
                    {
                        'text': item.text,
                        'assignee': item.assignee,
                        'deadline': item.deadline.isoformat() if item.deadline else None,
                        'confidence': item.confidence
                    }
                    for item in analysis.action_items
                ],
                'deadlines': [
                    {
                        'date': deadline.isoformat(),
                        'context': context
                    }
                    for deadline, context in analysis.deadlines
                ]
            },
            'metadata': {
                'processing_time_ms': processing_time,
                'cached': analysis.cached,
                'ai_used': analysis.ai_used,
                'model_used': analysis.model_used,
                'confidence_scores': analysis.confidence_scores
            },
            'draft_reply': draft,
            'timestamp': datetime.now().isoformat()
        }
    
    async def process_email_batch(self, 
                                emails: List[Dict[str, str]], 
                                max_concurrent: int = None) -> List[Dict[str, Any]]:
        """
        Process multiple emails efficiently with batch optimization
        
        Args:
            emails: List of email dicts with 'subject', 'body', 'sender' keys
            max_concurrent: Override default concurrent limit
            
        Returns:
            List of analysis results
        """
        if not self.engine:
            raise RuntimeError("Engine not initialized. Call initialize() first.")
        
        concurrent_limit = max_concurrent or self.config.MAX_CONCURRENT_REQUESTS
        
        start_time = datetime.now()
        
        # Batch analyze
        analyses = await self.engine.batch_analyze_async(emails, max_concurrent=concurrent_limit)
        
        batch_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Format results
        results = []
        for i, analysis in enumerate(analyses):
            email = emails[i] if i < len(emails) else {}
            
            result = {
                'email_index': i,
                'subject': email.get('subject', ''),
                'sender': email.get('sender', ''),
                'analysis': {
                    'classification': analysis.classification.value,
                    'confidence': analysis.confidence,
                    'urgency': analysis.urgency.value,
                    'sentiment': analysis.sentiment.value,
                    'intent': analysis.intent
                },
                'metadata': {
                    'cached': analysis.cached,
                    'ai_used': analysis.ai_used,
                    'model_used': analysis.model_used,
                    'processing_time_ms': analysis.processing_time_ms
                }
            }
            results.append(result)
            
            # Update stats
            self.stats['emails_processed'] += 1
            if analysis.cached:
                self.stats['cache_hits'] += 1
            if analysis.ai_used:
                self.stats['ai_calls_made'] += 1
        
        self.stats['processing_time_total_ms'] += batch_time
        
        return results
    
    async def warm_cache_with_samples(self, sample_emails: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Warm up the cache with sample emails for better performance
        
        Args:
            sample_emails: Representative emails for cache warming
            
        Returns:
            Warming statistics
        """
        if not self.engine:
            raise RuntimeError("Engine not initialized. Call initialize() first.")
        
        warmup_stats = await self.engine.warmup_cache(sample_emails)
        
        print(f"🔥 Cache warmed with {warmup_stats.get('emails_processed', 0)} emails")
        print(f"⏱️  Warmup time: {warmup_stats.get('warmup_time_seconds', 0):.1f}s")
        
        return warmup_stats
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics"""
        engine_stats = self.engine.get_performance_stats() if self.engine else {}
        
        # Calculate derived metrics
        total_emails = self.stats['emails_processed']
        cache_hit_rate = (self.stats['cache_hits'] / total_emails * 100) if total_emails > 0 else 0
        avg_processing_time = (self.stats['processing_time_total_ms'] / total_emails) if total_emails > 0 else 0
        
        # Estimate cost savings (rough calculation: $0.0001 per AI call)
        potential_ai_calls = total_emails
        actual_ai_calls = self.stats['ai_calls_made']
        ai_calls_saved = potential_ai_calls - actual_ai_calls
        estimated_savings = ai_calls_saved * 0.0001
        
        return {
            'processor_stats': {
                'emails_processed': total_emails,
                'cache_hit_rate_percent': round(cache_hit_rate, 2),
                'average_processing_time_ms': round(avg_processing_time, 2),
                'ai_calls_made': actual_ai_calls,
                'ai_calls_saved': ai_calls_saved,
                'estimated_cost_saved_usd': round(estimated_savings, 4)
            },
            'engine_stats': engine_stats,
            'configuration': {
                'classifier_model': self.config.CLASSIFIER_MODEL,
                'draft_model': self.config.DRAFT_MODEL,
                'cache_size': self.config.CACHE_SIZE,
                'cache_ttl_hours': self.config.CACHE_TTL_HOURS,
                'max_concurrent': self.config.MAX_CONCURRENT_REQUESTS
            }
        }

# Example usage patterns
async def example_single_email_processing():
    """Example: Process a single email with full analysis"""
    
    processor = ProductionEmailProcessor()
    await processor.initialize()
    
    try:
        # Process single email
        result = await processor.process_single_email(
            subject="URGENT: Budget approval needed by Friday",
            body="Hi team, I need your approval for the Q4 budget of $150,000. This is urgent and must be completed by Friday. Please review and let me know if you approve.",
            sender="finance.manager@company.com",
            include_draft=True
        )
        
        print("📧 Single Email Analysis:")
        print(f"   Classification: {result['analysis']['classification']}")
        print(f"   Urgency: {result['analysis']['urgency']}")
        print(f"   Confidence: {result['analysis']['confidence']:.2%}")
        print(f"   Processing time: {result['metadata']['processing_time_ms']:.1f}ms")
        print(f"   Used AI: {result['metadata']['ai_used']}")
        print(f"   Cached: {result['metadata']['cached']}")
        
        if result['draft_reply']:
            print(f"   Draft generated: {len(result['draft_reply'])} characters")
    
    finally:
        await processor.cleanup()

async def example_batch_processing():
    """Example: Process multiple emails efficiently"""
    
    processor = ProductionEmailProcessor()
    await processor.initialize()
    
    try:
        # Sample emails for batch processing
        emails = [
            {
                'subject': 'Budget approval needed',
                'body': 'Please approve the marketing budget for Q1.',
                'sender': 'marketing@company.com'
            },
            {
                'subject': 'FYI: Server maintenance',
                'body': 'Scheduled maintenance this weekend. No action required.',
                'sender': 'it@company.com'
            },
            {
                'subject': 'Can you review the presentation?',
                'body': 'Please review the slides for tomorrow\'s meeting.',
                'sender': 'sales@company.com'
            }
        ]
        
        # Process batch
        results = await processor.process_email_batch(emails, max_concurrent=3)
        
        print(f"📧 Batch Processing Results ({len(results)} emails):")
        for i, result in enumerate(results):
            print(f"   {i+1}. {result['analysis']['classification']} "
                  f"(confidence: {result['analysis']['confidence']:.2%}, "
                  f"AI: {result['metadata']['ai_used']}, "
                  f"cached: {result['metadata']['cached']})")
        
        # Show performance stats
        stats = processor.get_performance_stats()
        print(f"\n📊 Performance Stats:")
        print(f"   Cache hit rate: {stats['processor_stats']['cache_hit_rate_percent']:.1f}%")
        print(f"   Avg processing time: {stats['processor_stats']['average_processing_time_ms']:.1f}ms")
        print(f"   AI calls saved: {stats['processor_stats']['ai_calls_saved']}")
        print(f"   Estimated savings: ${stats['processor_stats']['estimated_cost_saved_usd']:.4f}")
    
    finally:
        await processor.cleanup()

def example_sync_usage():
    """Example: Using synchronous wrapper for simple integration"""
    
    # Initialize sync engine
    engine = OptimizedEmailIntelligenceEngineSync(
        cache_size=1000,
        cache_ttl_hours=24
    )
    
    # Analyze single email
    result = engine.analyze_email(
        subject="Team meeting tomorrow",
        body="Just a reminder about our team meeting tomorrow at 2 PM in the conference room.",
        sender="manager@company.com"
    )
    
    print("🔄 Sync Analysis:")
    print(f"   Classification: {result.classification.value}")
    print(f"   Urgency: {result.urgency.value}")
    print(f"   Cached: {result.cached}")
    print(f"   AI used: {result.ai_used}")
    
    # Generate draft
    email_data = {
        'subject': "Team meeting tomorrow",
        'sender_name': "Manager",
        'content': "Just a reminder about our team meeting tomorrow at 2 PM in the conference room."
    }
    
    draft = engine.generate_draft_reply(email_data, result)
    print(f"   Draft length: {len(draft)} characters")

if __name__ == "__main__":
    print("🚀 OPTIMIZED EMAIL INTELLIGENCE ENGINE - CONFIGURATION EXAMPLES")
    print("="*70)
    
    # Validate environment
    config = OptimizedEngineConfig()
    validation = config.validate_environment()
    
    print("🔧 Environment Validation:")
    for key, value in validation.items():
        status = "✅" if value else "⚠️"
        print(f"   {status} {key}: {value}")
    
    print(f"\n📋 Configuration:")
    print(f"   Classifier Model: {config.CLASSIFIER_MODEL}")
    print(f"   Draft Model: {config.DRAFT_MODEL}")
    print(f"   Cache Size: {config.CACHE_SIZE}")
    print(f"   Cache TTL: {config.CACHE_TTL_HOURS} hours")
    print(f"   Max Concurrent: {config.MAX_CONCURRENT_REQUESTS}")
    
    # Run examples
    print(f"\n{'='*70}")
    print("RUNNING USAGE EXAMPLES")
    print("="*70)
    
    # Example 1: Single email processing
    print("\n1️⃣  Single Email Processing Example:")
    asyncio.run(example_single_email_processing())
    
    # Example 2: Batch processing
    print("\n2️⃣  Batch Processing Example:")
    asyncio.run(example_batch_processing())
    
    # Example 3: Sync usage
    print("\n3️⃣  Synchronous Usage Example:")
    example_sync_usage()
    
    print(f"\n{'='*70}")
    print("✅ ALL EXAMPLES COMPLETED SUCCESSFULLY!")
    print("="*70)