#!/bin/bash

# AppleCLI Demo Script
# Demonstrates various features of the AppleCLI tool

echo "🚀 AppleCLI Demo Script"
echo "======================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run command and show output
demo_command() {
    echo -e "${BLUE}Command:${NC} $1"
    echo -e "${YELLOW}Output:${NC}"
    eval $1
    echo ""
    echo "Press Enter to continue..."
    read
    echo ""
}

echo "This demo will show various AppleCLI features."
echo "Make sure you have granted the necessary permissions!"
echo ""
echo "Press Enter to start..."
read

echo -e "${GREEN}=== WEB SEARCH DEMO ===${NC}"
demo_command "python3 applecli.py --web --action search --query 'macOS automation' --limit 3"

echo -e "${GREEN}=== JSON OUTPUT FORMAT ===${NC}"
demo_command "python3 applecli.py --web --action search --query 'Python CLI tools' --limit 2 --format json"

echo -e "${GREEN}=== CONTACTS DEMO ===${NC}"
echo "Note: This requires Contacts permission..."
demo_command "python3 applecli.py --contacts --action count"

echo -e "${GREEN}=== NOTES DEMO ===${NC}"
echo "Creating a sample note..."
demo_command "python3 applecli.py --notes --action create --title 'AppleCLI Demo Note' --body 'This note was created by the AppleCLI demo script at $(date)'"

echo "Searching for the created note..."
demo_command "python3 applecli.py --notes --action search --query 'AppleCLI Demo'"

echo -e "${GREEN}=== CALENDAR DEMO ===${NC}"
echo "Viewing today's events..."
demo_command "python3 applecli.py --calendar --action today"

echo -e "${GREEN}=== REMINDERS DEMO ===${NC}"
echo "Creating a demo reminder..."
demo_command "python3 applecli.py --reminders --action create --title 'AppleCLI Demo Reminder - $(date +%H:%M)' --days 1"

echo "Searching for demo reminders..."
demo_command "python3 applecli.py --reminders --action search --query 'AppleCLI Demo'"

echo -e "${GREEN}=== MAPS DEMO ===${NC}"
echo "Searching for Apple Park..."
demo_command "python3 applecli.py --maps --action search --location 'Apple Park Cupertino'"

echo -e "${GREEN}=== MAIL DEMO ===${NC}"
echo "Checking unread emails..."
demo_command "python3 applecli.py --mail --action unread"

echo ""
echo -e "${GREEN}🎉 Demo Complete!${NC}"
echo ""
echo "Try running these commands manually:"
echo "  python3 applecli.py --help"
echo "  python3 applecli.py --contacts --action list --limit 5"
echo "  python3 applecli.py --web --action search --query 'your topic' --format json"
echo ""
echo "For full documentation, see: README_APPLECLI.md"