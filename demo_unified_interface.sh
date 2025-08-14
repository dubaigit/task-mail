#!/bin/bash

# Demo Script for Unified Email Intelligence Interface
# Showcases key features and API capabilities

echo "🧠 Email Intelligence Interface Demo"
echo "======================================"
echo ""

# Base URL for the interface
BASE_URL="http://localhost:8003"

# Check if server is running
echo "🔍 Checking server status..."
if curl -s "${BASE_URL}/health" > /dev/null; then
    echo "✅ Server is running at ${BASE_URL}"
else
    echo "❌ Server is not running. Start with: ./run_unified_interface.sh"
    exit 1
fi

echo ""
echo "📊 System Health Check"
echo "======================"
curl -s "${BASE_URL}/health" | python3 -m json.tool
echo ""

echo "📈 Email Statistics"
echo "==================="
curl -s "${BASE_URL}/stats" | python3 -m json.tool
echo ""

echo "📧 Recent Emails (AI Classified)"
echo "================================="
echo "Fetching first 3 emails with AI classification..."
curl -s "${BASE_URL}/emails?limit=3" | python3 -c "
import json
import sys
data = json.load(sys.stdin)
for i, email in enumerate(data[:3], 1):
    print(f'Email {i}:')
    print(f'  Subject: {email[\"subject\"]}')
    print(f'  From: {email[\"sender_name\"]}')
    print(f'  Classification: {email[\"classification\"]}')
    print(f'  Urgency: {email[\"urgency\"]}')
    print(f'  Confidence: {email[\"confidence\"]:.1%}')
    if email['action_items']:
        print(f'  Action Items: {len(email[\"action_items\"])} found')
    print()
"
echo ""

echo "🔍 Search Demonstration"
echo "======================="
echo "Searching for emails containing 'meeting'..."
curl -s "${BASE_URL}/search?q=meeting&limit=2" | python3 -c "
import json
import sys
data = json.load(sys.stdin)
print(f'Found {data[\"total_results\"]} results')
for email in data['results'][:2]:
    print(f'  - {email[\"subject\"]} (from {email[\"sender_name\"]})')
"
echo ""

echo "📋 Task Extraction"
echo "=================="
echo "Checking for automatically extracted tasks..."
TASKS=$(curl -s "${BASE_URL}/tasks")
TASK_COUNT=$(echo $TASKS | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "Found ${TASK_COUNT} tasks extracted from emails"

if [ "$TASK_COUNT" -gt 0 ]; then
    echo $TASKS | python3 -c "
import json
import sys
data = json.load(sys.stdin)
for i, task in enumerate(data[:3], 1):
    print(f'Task {i}:')
    print(f'  Subject: {task[\"subject\"]}')
    print(f'  Type: {task[\"task_type\"]}')
    print(f'  Priority: {task[\"priority\"]}')
    print(f'  Status: {task[\"status\"]}')
    print()
"
fi

echo ""
echo "🎯 Classification Breakdown"
echo "==========================="
curl -s "${BASE_URL}/stats" | python3 -c "
import json
import sys
data = json.load(sys.stdin)
classifications = data['classifications']
total = sum(classifications.values())
print('Email Classifications:')
for cls, count in classifications.items():
    percentage = (count / total * 100) if total > 0 else 0
    print(f'  {cls.replace(\"_\", \" \").title()}: {count} ({percentage:.1f}%)')
print()
urgency = data['urgency_breakdown']
print('Urgency Levels:')
for level, count in urgency.items():
    percentage = (count / total * 100) if total > 0 else 0
    print(f'  {level}: {count} ({percentage:.1f}%)')
"

echo ""
echo "🚀 AI Draft Generation Demo"
echo "==========================="
echo "Testing AI draft generation (using first email)..."

# Get first email ID
FIRST_EMAIL_ID=$(curl -s "${BASE_URL}/emails?limit=1" | python3 -c "
import json
import sys
data = json.load(sys.stdin)
if data:
    print(data[0]['message_id'])
")

if [ ! -z "$FIRST_EMAIL_ID" ]; then
    echo "Generating draft for email ID: $FIRST_EMAIL_ID"
    curl -s -X POST "${BASE_URL}/drafts/generate" \
         -H "Content-Type: application/json" \
         -d "{\"email_id\": $FIRST_EMAIL_ID, \"action\": \"reply\"}" | \
    python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    print(f'Subject: {data[\"subject\"]}')
    print('Draft:')
    print(data['draft'])
    print()
    print('Suggested Actions:')
    for action in data['suggested_actions']:
        print(f'  - {action}')
except:
    print('Draft generation requires AI API configuration')
"
else
    echo "No emails available for draft generation"
fi

echo ""
echo "🎉 Demo Complete!"
echo "================="
echo ""
echo "💡 To explore the full interface:"
echo "   Open http://localhost:8003 in your browser"
echo ""
echo "🔧 Key Features Demonstrated:"
echo "   ✅ Real-time email processing with GPT-5"
echo "   ✅ Intelligent classification and urgency detection"
echo "   ✅ Automatic task extraction from emails"
echo "   ✅ Advanced search and filtering"
echo "   ✅ AI-powered draft generation"
echo "   ✅ Comprehensive statistics and metrics"
echo ""
echo "📚 Full documentation: UNIFIED_EMAIL_INTERFACE_README.md"