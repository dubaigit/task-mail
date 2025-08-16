#!/usr/bin/env python3
"""
Test script to verify AI integration in email intelligence engine
"""

import os
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from email_intelligence_engine import EmailIntelligenceEngine

def test_ai_integration():
    """Test the AI integration for both classification and draft generation"""
    
    # Initialize engine (will use env OPENAI_API_KEY if set)
    engine = EmailIntelligenceEngine()
    
    # Test email
    test_email = {
        'subject': 'Budget Approval Needed for Q1 Marketing Campaign',
        'sender': 'marketing.lead@company.com',
        'content': '''Hi there,

I need your approval for the Q1 marketing campaign budget. 
The total amount is $75,000 and we need to finalize this by Friday.

Key items:
- Digital advertising: $30,000
- Content creation: $20,000
- Events and sponsorships: $25,000

Please review and let me know if you approve or have any questions.

Thanks,
Sarah'''
    }
    
    print("=" * 60)
    print("EMAIL INTELLIGENCE ENGINE - AI INTEGRATION TEST")
    print("=" * 60)
    
    # Check API key
    api_key_set = bool(os.getenv("OPENAI_API_KEY"))
    print(f"\n✓ OpenAI API Key: {'Configured' if api_key_set else 'Not configured (will use fallback)'}")
    print(f"✓ Classification Model: {engine.classifier_model}")
    print(f"✓ Draft Model: {engine.draft_model}")
    
    print("\n" + "=" * 60)
    print("ANALYZING EMAIL...")
    print("=" * 60)
    
    # Analyze email
    start = datetime.now()
    result = engine.analyze_email(
        subject=test_email['subject'],
        body=test_email['content'],
        sender=test_email['sender']
    )
    elapsed = (datetime.now() - start).total_seconds() * 1000
    
    print(f"\n✓ Analysis completed in {elapsed:.0f}ms")
    print(f"\nClassification: {result.classification.value}")
    print(f"Confidence: {result.confidence:.2%}")
    print(f"Urgency: {result.urgency.value}")
    print(f"Sentiment: {result.sentiment.value}")
    print(f"Intent: {result.intent}")
    
    if result.action_items:
        print(f"\nAction Items ({len(result.action_items)}):")
        for i, item in enumerate(result.action_items, 1):
            print(f"  {i}. {item.text}")
            if item.deadline:
                print(f"     Deadline: {item.deadline.strftime('%Y-%m-%d')}")
    
    print("\n" + "=" * 60)
    print("GENERATING AI DRAFT REPLY...")
    print("=" * 60)
    
    # Generate draft
    start = datetime.now()
    draft = engine.generate_draft_reply(test_email, result)
    elapsed = (datetime.now() - start).total_seconds() * 1000
    
    print(f"\n✓ Draft generated in {elapsed:.0f}ms")
    print(f"\nDraft Reply:\n{'-' * 40}")
    print(draft)
    print('-' * 40)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    if api_key_set:
        print("\n✅ AI integration is configured!")
        print(f"   - Using {engine.classifier_model} for classification")
        print(f"   - Using {engine.draft_model} for draft generation")
    else:
        print("\n⚠️  Running in fallback mode (no API key)")
        print("   - Pattern-based classification")
        print("   - Template-based draft generation")
        print("\nTo enable AI features, set your OpenAI API key:")
        print("export OPENAI_API_KEY='your-key-here'")

if __name__ == "__main__":
    test_ai_integration()