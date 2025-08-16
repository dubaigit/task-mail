#!/usr/bin/env python3
"""
Test OpenAI API Integration for Email Intelligence System
Validates that the model names are correct and API calls work.
"""

import os
import sys
import requests
import json
from typing import Dict, Any

def test_openai_model_validation():
    """Test that OpenAI API accepts our model names"""
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OPENAI_API_KEY not set. Please set the environment variable.")
        return False
    
    # Test model names
    test_models = [
        "gpt-5-nano",  # Correct model name for classification
        "gpt-5-mini",  # Correct model name for draft generation
        "gpt-4o",      # Backup model option
        "gpt-4o-mini", # Backup model option
    ]
    
    results = {}
    
    for model in test_models:
        print(f"🧪 Testing model: {model}")
        
        # Create a simple test request
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        # Use correct parameter name for GPT-5 models
        if model.startswith("gpt-5"):
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Test message - classify this email as urgent or normal."},
                ],
                "max_completion_tokens": 10,  # GPT-5 models use this parameter
                "temperature": 0.1,
            }
        else:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Test message - classify this email as urgent or normal."},
                ],
                "max_tokens": 10,  # GPT-4 models use this parameter
                "temperature": 0.1,
            }
        
        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=10,
            )
            
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                results[model] = {"status": "✅ SUCCESS", "response": content[:50] + "..."}
                print(f"  ✅ {model}: Working correctly")
            else:
                error_details = resp.text[:200] if resp.text else "No error details"
                results[model] = {"status": "❌ FAILED", "error": f"HTTP {resp.status_code}: {error_details}"}
                print(f"  ❌ {model}: HTTP {resp.status_code} - {error_details}")
                
        except Exception as e:
            results[model] = {"status": "❌ ERROR", "error": str(e)[:100]}
            print(f"  ❌ {model}: Error - {str(e)[:100]}")
    
    return results

def test_email_classification():
    """Test email classification with correct models"""
    
    # Import the email intelligence engine
    try:
        from email_intelligence_engine import EmailIntelligenceEngine
    except ImportError as e:
        print(f"❌ Failed to import EmailIntelligenceEngine: {e}")
        return False
    
    # Create engine instance
    engine = EmailIntelligenceEngine()
    
    # Test sample email
    test_email = {
        'subject': 'Urgent: Please review and approve the budget proposal',
        'content': 'Hi, I need your approval on the Q4 budget proposal. Please review the attached document and let me know if you approve by Friday. Thanks!',
        'sender_email': 'colleague@company.com'
    }
    
    print(f"🧪 Testing email classification...")
    print(f"   Subject: {test_email['subject']}")
    print(f"   Using models: classify={engine.classifier_model}, draft={engine.draft_model}")
    
    try:
        # Test classification with correct method signature
        result = engine.analyze_email(
            subject=test_email['subject'],
            body=test_email['content'],
            sender=test_email['sender_email']
        )
        print(f"  ✅ Classification: {result.classification}")
        print(f"  ✅ Confidence: {result.confidence:.2f}")
        print(f"  ✅ Urgency: {result.urgency}")
        
        # Test draft generation (if AI is configured)
        if engine.openai_api_key:
            draft = engine.generate_draft_reply(
                email=test_email,
                analysis=result
            )
            print(f"  ✅ Draft generated: {len(draft)} characters")
            print(f"     Preview: {draft[:100]}...")
        else:
            print(f"  ⚠️  Draft generation skipped (no API key)")
            
        return True
        
    except Exception as e:
        print(f"  ❌ Classification failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 OpenAI Integration Test Suite")
    print("=" * 50)
    
    # Test 1: Model validation
    print("\n1. Testing OpenAI Model Names")
    print("-" * 30)
    model_results = test_openai_model_validation()
    
    # Test 2: Email classification
    print("\n2. Testing Email Classification")
    print("-" * 30)
    classification_success = test_email_classification()
    
    # Summary
    print("\n📊 Test Summary")
    print("=" * 50)
    
    if model_results:
        working_models = [model for model, result in model_results.items() if "SUCCESS" in result["status"]]
        failed_models = [model for model, result in model_results.items() if "FAILED" in result["status"] or "ERROR" in result["status"]]
        
        print(f"✅ Working models: {', '.join(working_models) if working_models else 'None'}")
        print(f"❌ Failed models: {', '.join(failed_models) if failed_models else 'None'}")
    
    if classification_success:
        print(f"✅ Email classification: Working")
    else:
        print(f"❌ Email classification: Failed")
    
    # Recommendations
    print("\n💡 Recommendations")
    print("-" * 30)
    
    if model_results:
        if any("SUCCESS" in result["status"] for result in model_results.values()):
            print("✅ OpenAI API integration is working with correct model names")
        else:
            print("❌ All model tests failed. Check:")
            print("   - OPENAI_API_KEY is valid")
            print("   - Network connectivity")
            print("   - OpenAI API status")
    
    if not classification_success:
        print("❌ Email classification failed. Check:")
        print("   - Model configuration")
        print("   - Import paths")
        print("   - Code logic")

if __name__ == "__main__":
    main()