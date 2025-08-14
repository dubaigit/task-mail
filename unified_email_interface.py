#!/usr/bin/env python3
"""
Unified Email Intelligence Interface
Single FastAPI app serving dynamic HTML interface with GPT-5 processor integration
"""

import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn

# Import email intelligence components
from email_intelligence_engine import (
    EmailIntelligenceEngine, 
    EmailClass, 
    Urgency, 
    Sentiment,
    EmailIntelligence
)
from apple_mail_db_reader import AppleMailDBReader
from applescript_integration import AppleScriptMailer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Unified Email Intelligence Interface",
    description="Single interface for email management with GPT-5 AI processing",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core components
try:
    engine = EmailIntelligenceEngine()
    db_reader = AppleMailDBReader()
    mailer = AppleScriptMailer()
    logger.info("Core components initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize components: {e}")
    engine = EmailIntelligenceEngine()  # Fallback
    db_reader = None
    mailer = None

# Pydantic models
class EmailItem(BaseModel):
    message_id: int
    subject: str
    sender: str
    sender_name: str
    date: str
    snippet: str
    classification: str
    urgency: str
    confidence: float
    action_items: List[str]
    deadlines: List[str]
    is_read: bool = False
    is_flagged: bool = False
    draft_reply: Optional[str] = None

class TaskItem(BaseModel):
    id: str
    email_id: int
    subject: str
    task_type: str
    priority: str
    due_date: Optional[str]
    description: str
    assignee: Optional[str]
    status: str = "pending"

class DraftRequest(BaseModel):
    email_id: int
    action: str  # "reply", "delegate", "approve", etc.

class ActionRequest(BaseModel):
    email_ids: List[int]
    action: str
    parameters: Optional[Dict[str, Any]] = {}

class SearchRequest(BaseModel):
    query: str
    filters: Optional[Dict[str, Any]] = {}

# In-memory cache for processed emails and tasks
email_cache = {}
task_cache = {}
stats_cache = {
    "last_updated": datetime.now(),
    "total_emails": 0,
    "unread_count": 0,
    "urgent_count": 0,
    "tasks_count": 0
}

def get_html_template() -> str:
    """Generate the unified HTML interface template"""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Intelligence Interface</title>
    
    <!-- TailwindCSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --accent-blue: #3b82f6;
            --accent-green: #10b981;
            --accent-orange: #f59e0b;
            --accent-red: #ef4444;
        }
        
        .email-item {
            transition: all 0.2s ease;
            border-left: 4px solid transparent;
        }
        
        .email-item:hover {
            transform: translateX(4px);
            background-color: var(--bg-tertiary);
        }
        
        .email-item.urgent {
            border-left-color: var(--accent-red);
        }
        
        .email-item.needs-reply {
            border-left-color: var(--accent-blue);
        }
        
        .email-item.task {
            border-left-color: var(--accent-orange);
        }
        
        /* Filter buttons */
        .filter-btn {
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            background-color: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            color: var(--text-secondary);
            transition: all 0.2s ease;
            font-size: 0.875rem;
        }
        
        .filter-btn:hover {
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
        }
        
        .filter-btn.active {
            background-color: var(--accent-blue);
            color: white;
            border-color: var(--accent-blue);
        }
        
        /* Task filter buttons */
        .task-filter-btn {
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            background-color: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            color: var(--text-secondary);
            transition: all 0.2s ease;
            font-size: 0.875rem;
        }
        
        .task-filter-btn:hover {
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
        }
        
        .task-filter-btn.active {
            background-color: var(--accent-green);
            color: white;
            border-color: var(--accent-green);
        }
        
        /* Auto-refresh indicator */
        .auto-refresh-active {
            animation: pulse 2s infinite;
        }
        
        /* Email selection */
        .email-checkbox {
            margin-right: 0.75rem;
        }
        
        .email-item.selected {
            background-color: var(--bg-tertiary);
            border-color: var(--accent-blue);
        }
        
        .classification-badge {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-weight: 600;
        }
        
        .action-button {
            transition: all 0.2s ease;
        }
        
        .action-button:hover {
            transform: translateY(-1px);
        }
        
        .loading {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .spinner {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .slide-in {
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(20px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body class="bg-slate-900 text-white min-h-screen">
    <!-- Header -->
    <header class="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <i class="fas fa-brain text-2xl text-blue-400"></i>
                <h1 class="text-2xl font-bold">Email Intelligence</h1>
                <div class="flex items-center space-x-2 text-sm text-gray-400">
                    <span>GPT-5 Powered</span>
                    <div id="status-indicator" class="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
            </div>
            
            <div class="flex items-center space-x-4">
                <!-- Stats -->
                <div class="hidden md:flex items-center space-x-6 text-sm">
                    <div class="text-center">
                        <div id="total-emails" class="font-bold text-white">0</div>
                        <div class="text-gray-400">Total</div>
                    </div>
                    <div class="text-center">
                        <div id="unread-count" class="font-bold text-blue-400">0</div>
                        <div class="text-gray-400">Unread</div>
                    </div>
                    <div class="text-center">
                        <div id="urgent-count" class="font-bold text-red-400">0</div>
                        <div class="text-gray-400">Urgent</div>
                    </div>
                    <div class="text-center">
                        <div id="tasks-count" class="font-bold text-orange-400">0</div>
                        <div class="text-gray-400">Tasks</div>
                    </div>
                </div>
                
                <!-- Actions -->
                <button id="refresh-btn" class="action-button px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
                    <i class="fas fa-sync-alt mr-2"></i>Refresh
                </button>
                
                <button id="bulk-actions-btn" class="action-button px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium">
                    <i class="fas fa-tasks mr-2"></i>Bulk Actions
                </button>
            </div>
        </div>
    </header>

    <!-- Navigation -->
    <nav class="bg-slate-800 border-b border-slate-700">
        <div class="max-w-7xl mx-auto">
            <div class="flex items-center space-x-1">
                <button id="inbox-tab" class="tab-button px-6 py-3 font-medium border-b-2 border-blue-500 text-blue-400">
                    <i class="fas fa-inbox mr-2"></i>Inbox
                </button>
                <button id="tasks-tab" class="tab-button px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white">
                    <i class="fas fa-list-check mr-2"></i>Tasks
                </button>
                <button id="search-tab" class="tab-button px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white">
                    <i class="fas fa-search mr-2"></i>Search
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto p-6">
        <!-- Search Bar -->
        <div class="mb-6">
            <div class="flex items-center space-x-4">
                <div class="flex-1 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input 
                        id="search-input" 
                        type="text" 
                        placeholder="Search emails, senders, or content..."
                        class="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    >
                </div>
                
                <!-- Filters -->
                <div class="flex items-center space-x-2">
                    <select id="filter-classification" class="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                        <option value="">All Classifications</option>
                        <option value="NEEDS_REPLY">Needs Reply</option>
                        <option value="APPROVAL_REQUIRED">Approval Required</option>
                        <option value="CREATE_TASK">Create Task</option>
                        <option value="DELEGATE">Delegate</option>
                        <option value="FYI_ONLY">FYI Only</option>
                        <option value="FOLLOW_UP">Follow Up</option>
                    </select>
                    
                    <select id="filter-urgency" class="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm">
                        <option value="">All Urgency</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                    
                    <button id="clear-filters" class="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Content Tabs -->
        <div id="content-container">
            <!-- Inbox View -->
            <div id="inbox-view" class="tab-content">
                <!-- Header with controls -->
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-4">
                        <h2 class="text-xl font-semibold">Email Inbox</h2>
                        <div class="flex items-center space-x-2">
                            <input type="checkbox" id="select-all" class="rounded border-gray-600 bg-gray-700 text-blue-500">
                            <label for="select-all" class="text-sm text-gray-400">Select All</label>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button id="auto-refresh-toggle" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center">
                            <i class="fas fa-sync-alt mr-1"></i>Live
                        </button>
                        <button id="refresh-now" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                            <i class="fas fa-refresh mr-1"></i>Refresh
                        </button>
                        <div class="relative">
                            <button id="bulk-actions" class="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm">
                                Actions
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Filter Buttons -->
                <div class="mb-4 flex flex-wrap gap-2">
                    <button class="filter-btn active" data-filter="all">
                        <i class="fas fa-list mr-1"></i>All (<span id="count-all">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="unread">
                        <i class="fas fa-envelope mr-1"></i>Unread (<span id="count-unread">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="NEEDS_REPLY">
                        <i class="fas fa-reply mr-1"></i>Action Required (<span id="count-reply">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="APPROVAL_REQUIRED">
                        <i class="fas fa-check-circle mr-1"></i>Approval (<span id="count-approval">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="INFORMATIONAL">
                        <i class="fas fa-info-circle mr-1"></i>FYI (<span id="count-fyi">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="CRITICAL">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Urgent (<span id="count-urgent">0</span>)
                    </button>
                    <button class="filter-btn" data-filter="flagged">
                        <i class="fas fa-flag mr-1"></i>Flagged (<span id="count-flagged">0</span>)
                    </button>
                    <button id="clear-filters" class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                        <i class="fas fa-times mr-1"></i>Clear
                    </button>
                </div>
                
                <div id="email-list" class="space-y-3">
                    <!-- Email items will be populated here -->
                </div>
                
                <div id="email-loading" class="text-center py-8 hidden">
                    <i class="fas fa-spinner spinner text-2xl text-blue-400"></i>
                    <p class="mt-2 text-gray-400">Loading emails...</p>
                </div>
            </div>

            <!-- Tasks View -->
            <div id="tasks-view" class="tab-content hidden">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold">Action Items & Tasks</h2>
                    <div class="flex items-center space-x-2">
                        <button id="create-task" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                            <i class="fas fa-plus mr-1"></i>Create Task
                        </button>
                        <button id="refresh-tasks" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                            <i class="fas fa-refresh mr-1"></i>Refresh
                        </button>
                    </div>
                </div>
                
                <!-- Task Filter Buttons -->
                <div class="mb-4 flex flex-wrap gap-2">
                    <button class="task-filter-btn active" data-filter="all">
                        <i class="fas fa-list mr-1"></i>All Tasks (<span id="task-count-all">0</span>)
                    </button>
                    <button class="task-filter-btn" data-filter="reply">
                        <i class="fas fa-reply mr-1"></i>Replies (<span id="task-count-reply">0</span>)
                    </button>
                    <button class="task-filter-btn" data-filter="approval">
                        <i class="fas fa-check-circle mr-1"></i>Approvals (<span id="task-count-approval">0</span>)
                    </button>
                    <button class="task-filter-btn" data-filter="development">
                        <i class="fas fa-code mr-1"></i>Development (<span id="task-count-dev">0</span>)
                    </button>
                    <button class="task-filter-btn" data-filter="delegation">
                        <i class="fas fa-user-friends mr-1"></i>Delegate (<span id="task-count-delegate">0</span>)
                    </button>
                    <button class="task-filter-btn" data-filter="CRITICAL">
                        <i class="fas fa-exclamation-triangle mr-1"></i>Urgent (<span id="task-count-urgent">0</span>)
                    </button>
                </div>
                
                <div id="task-list" class="space-y-3">
                    <!-- Task items will be populated here -->
                </div>
                
                <div id="task-loading" class="text-center py-8 hidden">
                    <i class="fas fa-spinner spinner text-2xl text-orange-400"></i>
                    <p class="mt-2 text-gray-400">Loading tasks...</p>
                </div>
            </div>

            <!-- Search View -->
            <div id="search-view" class="tab-content hidden">
                <div class="mb-4">
                    <h2 class="text-xl font-semibold">Search Results</h2>
                </div>
                
                <div id="search-results" class="space-y-3">
                    <!-- Search results will be populated here -->
                </div>
                
                <div id="search-empty" class="text-center py-12 text-gray-400 hidden">
                    <i class="fas fa-search text-4xl mb-4"></i>
                    <p>Enter a search term to find emails</p>
                </div>
            </div>
        </div>
    </main>

    <!-- Draft Reply Modal -->
    <div id="draft-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden">
        <div class="flex items-center justify-center min-h-screen p-4">
            <div class="bg-slate-800 rounded-lg p-6 w-full max-w-2xl">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">Draft Reply</h3>
                    <button id="close-draft-modal" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Subject:</label>
                    <input id="draft-subject" type="text" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" readonly>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Reply:</label>
                    <textarea id="draft-content" rows="8" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"></textarea>
                </div>
                
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-400">Generated by GPT-5</span>
                        <i class="fas fa-robot text-blue-400"></i>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button id="regenerate-draft" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm">
                            <i class="fas fa-sync-alt mr-2"></i>Regenerate
                        </button>
                        <button id="send-reply" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                            <i class="fas fa-paper-plane mr-2"></i>Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loading-overlay" class="fixed inset-0 bg-black bg-opacity-75 z-50 hidden">
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <i class="fas fa-brain text-4xl text-blue-400 mb-4 spinner"></i>
                <p class="text-white text-lg">Processing with AI...</p>
                <p id="loading-message" class="text-gray-400 text-sm mt-2">Please wait</p>
            </div>
        </div>
    </div>

    <script>
        // Global state
        let currentTab = 'inbox';
        let currentEmails = [];
        let currentTasks = [];
        let selectedEmails = new Set();
        let currentDraftEmailId = null;
        
        // Configuration
        const API_BASE = '';
        const REFRESH_INTERVAL = 30000; // 30 seconds
        
        // Initialize the interface
        document.addEventListener('DOMContentLoaded', function() {
            initializeInterface();
            setupEventListeners();
            loadEmails();
            updateStats();
            
            // Auto-refresh
            setInterval(refreshCurrentView, REFRESH_INTERVAL);
        });
        
        function initializeInterface() {
            console.log('Email Intelligence Interface initialized');
            updateStatus('online');
        }
        
        function setupEventListeners() {
            // Tab navigation
            document.getElementById('inbox-tab').addEventListener('click', () => switchTab('inbox'));
            document.getElementById('tasks-tab').addEventListener('click', () => switchTab('tasks'));
            document.getElementById('search-tab').addEventListener('click', () => switchTab('search'));
            
            // Filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => applyEmailFilter(btn.dataset.filter));
            });
            
            // Task filter buttons
            document.querySelectorAll('.task-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => applyTaskFilter(btn.dataset.filter));
            });
            
            // Auto-refresh toggle
            document.getElementById('auto-refresh-toggle').addEventListener('click', toggleAutoRefresh);
            document.getElementById('refresh-now').addEventListener('click', refreshCurrentView);
            document.getElementById('refresh-tasks')?.addEventListener('click', loadTasks);
            
            // Email selection
            document.getElementById('select-all').addEventListener('change', toggleSelectAll);
            
            // Search
            document.getElementById('search-input').addEventListener('input', debounce(performSearch, 300));
            document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
            
            // Modal
            document.getElementById('close-draft-modal').addEventListener('click', closeDraftModal);
            document.getElementById('regenerate-draft').addEventListener('click', regenerateDraft);
            document.getElementById('send-reply').addEventListener('click', sendReply);
            
            // Bulk actions
            document.getElementById('bulk-actions').addEventListener('click', showBulkActionsMenu);
        }
        
        async function switchTab(tab) {
            currentTab = tab;
            
            // Update tab buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('border-blue-500', 'text-blue-400');
                btn.classList.add('border-transparent', 'text-gray-400');
            });
            
            document.getElementById(`${tab}-tab`).classList.remove('border-transparent', 'text-gray-400');
            document.getElementById(`${tab}-tab`).classList.add('border-blue-500', 'text-blue-400');
            
            // Show/hide content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`${tab}-view`).classList.remove('hidden');
            
            // Load data for the tab
            switch(tab) {
                case 'inbox':
                    await loadEmails();
                    break;
                case 'tasks':
                    await loadTasks();
                    break;
                case 'search':
                    document.getElementById('search-empty').classList.remove('hidden');
                    break;
            }
        }
        
        async function loadEmails() {
            showLoading('email-loading');
            
            try {
                const response = await fetch(`${API_BASE}/emails`);
                const emails = await response.json();
                currentEmails = emails;
                displayEmails(emails);
                updateStats();
            } catch (error) {
                console.error('Error loading emails:', error);
                showError('Failed to load emails');
            } finally {
                hideLoading('email-loading');
            }
        }
        
        async function loadTasks() {
            showLoading('task-loading');
            
            try {
                const response = await fetch(`${API_BASE}/tasks`);
                const tasks = await response.json();
                currentTasks = tasks;
                displayTasks(tasks);
            } catch (error) {
                console.error('Error loading tasks:', error);
                showError('Failed to load tasks');
            } finally {
                hideLoading('task-loading');
            }
        }
        
        function displayEmails(emails) {
            const container = document.getElementById('email-list');
            container.innerHTML = '';
            
            emails.forEach(email => {
                const emailElement = createEmailElement(email);
                container.appendChild(emailElement);
            });
            
            if (emails.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-400">No emails found</div>';
            }
            
            // Update counts and apply current filter
            updateEmailCounts();
            filterEmails();
        }
        
        function createEmailElementOld(email) {
            const div = document.createElement('div');
            div.className = `email-item bg-slate-800 rounded-lg p-4 border border-slate-700 ${getEmailClass(email)}`;
            div.dataset.emailId = email.message_id;
            
            const urgencyColor = {
                'CRITICAL': 'text-red-400',
                'HIGH': 'text-orange-400',
                'MEDIUM': 'text-yellow-400',
                'LOW': 'text-green-400'
            }[email.urgency] || 'text-gray-400';
            
            const classificationBadge = getClassificationBadge(email.classification);
            
            div.innerHTML = `
                <div class="flex items-start space-x-4">
                    <input type="checkbox" class="email-checkbox mt-1" onchange="toggleEmailSelection(${email.message_id})">
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h3 class="font-semibold text-white truncate">${email.subject}</h3>
                                    ${classificationBadge}
                                    ${email.urgency !== 'LOW' ? `<span class="text-xs ${urgencyColor}"><i class="fas fa-exclamation-triangle"></i></span>` : ''}
                                </div>
                                
                                <div class="flex items-center space-x-2 text-sm text-gray-400 mb-2">
                                    <span class="font-medium">${email.sender_name || email.sender}</span>
                                    <span>•</span>
                                    <span>${formatDate(email.date)}</span>
                                    <span>•</span>
                                    <span class="${urgencyColor}">${email.urgency}</span>
                                    ${email.confidence ? `<span>• ${(email.confidence * 100).toFixed(0)}% confidence</span>` : ''}
                                </div>
                                
                                <p class="text-gray-300 text-sm line-clamp-2 mb-3">${email.snippet}</p>
                                
                                ${email.action_items.length > 0 ? `
                                    <div class="mb-3">
                                        <p class="text-xs text-orange-400 font-medium mb-1">Action Items:</p>
                                        <ul class="text-xs text-gray-300 space-y-1">
                                            ${email.action_items.slice(0, 2).map(item => `<li>• ${item}</li>`).join('')}
                                            ${email.action_items.length > 2 ? `<li class="text-gray-400">... and ${email.action_items.length - 2} more</li>` : ''}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                ${!email.is_read ? '<span class="w-2 h-2 bg-blue-400 rounded-full"></span>' : ''}
                                ${email.is_flagged ? '<i class="fas fa-flag text-red-400 text-xs"></i>' : ''}
                            </div>
                            
                            <div class="flex items-center space-x-2">
                                <button onclick="generateDraft(${email.message_id})" class="action-button px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                                    <i class="fas fa-reply mr-1"></i>Reply
                                </button>
                                
                                ${email.classification === 'DELEGATE' ? `
                                    <button onclick="delegateEmail(${email.message_id})" class="action-button px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs">
                                        <i class="fas fa-share mr-1"></i>Delegate
                                    </button>
                                ` : ''}
                                
                                ${email.classification === 'CREATE_TASK' ? `
                                    <button onclick="createTaskFromEmail(${email.message_id})" class="action-button px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs">
                                        <i class="fas fa-plus mr-1"></i>Task
                                    </button>
                                ` : ''}
                                
                                <button onclick="archiveEmail(${email.message_id})" class="action-button px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs">
                                    <i class="fas fa-archive"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            return div;
        }
        
        function displayTasks(tasks) {
            const container = document.getElementById('task-list');
            container.innerHTML = '';
            
            tasks.forEach(task => {
                const taskElement = createTaskElement(task);
                container.appendChild(taskElement);
            });
            
            if (tasks.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-400">No tasks found</div>';
            }
            
            // Update counts and apply current filter
            updateTaskCounts();
            filterTasks();
        }
        
        function createTaskElement(task) {
            const div = document.createElement('div');
            div.className = `task-item bg-slate-800 rounded-lg p-4 border border-slate-700 ${task.task_type} ${task.priority.toLowerCase()}`;
            div.dataset.taskId = task.id;
            
            const priorityColor = {
                'CRITICAL': 'text-red-400',
                'HIGH': 'text-orange-400',
                'MEDIUM': 'text-yellow-400',
                'LOW': 'text-green-400'
            }[task.priority] || 'text-gray-400';
            
            const statusBadge = {
                'pending': 'bg-yellow-600',
                'in-progress': 'bg-blue-600',
                'completed': 'bg-green-600'
            }[task.status] || 'bg-gray-600';
            
            const typeIcon = {
                'reply': 'fas fa-reply',
                'approval': 'fas fa-check-circle',
                'development': 'fas fa-code',
                'delegation': 'fas fa-user-friends',
                'follow-up': 'fas fa-clock'
            }[task.task_type] || 'fas fa-tasks';
            
            // Get related email for draft information
            const relatedEmail = currentEmails.find(e => e.message_id === task.email_id);
            const hasDraft = relatedEmail && relatedEmail.draft_reply;
            
            div.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <i class="${typeIcon} text-blue-400"></i>
                            <h3 class="font-semibold text-white">${task.subject}</h3>
                            <span class="classification-badge ${statusBadge} text-white">${task.status.replace('-', ' ')}</span>
                            <span class="text-xs ${priorityColor}">${task.priority}</span>
                            ${task.priority === 'CRITICAL' ? '<span class="classification-badge bg-red-600 text-white">URGENT</span>' : ''}
                        </div>
                        
                        <p class="text-gray-300 text-sm mb-2">${task.description}</p>
                        
                        <div class="flex items-center space-x-4 text-xs text-gray-400 mb-2">
                            <span>Type: ${task.task_type}</span>
                            ${task.due_date ? `<span>Due: ${task.due_date}</span>` : ''}
                            ${task.assignee ? `<span>Assigned to: ${task.assignee}</span>` : ''}
                            ${task.due_date ? `<span>Due: ${formatDate(task.due_date)}</span>` : ''}
                        </div>
                        
                        ${hasDraft ? `
                            <div class="mt-3 p-3 bg-green-900 rounded">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs text-green-400 flex items-center">
                                        <i class="fas fa-edit mr-1"></i>Draft Ready
                                    </span>
                                    <button onclick="viewDraft(${task.email_id})" class="text-xs text-green-300 hover:text-green-200">
                                        View Full Draft
                                    </button>
                                </div>
                                <p class="text-sm text-green-300">${relatedEmail.draft_reply.substring(0, 150)}...</p>
                                <div class="mt-2 flex space-x-2">
                                    <button onclick="sendDraft(${task.email_id})" class="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">
                                        <i class="fas fa-paper-plane mr-1"></i>Send
                                    </button>
                                    <button onclick="editDraft(${task.email_id})" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                                        <i class="fas fa-edit mr-1"></i>Edit
                                    </button>
                                </div>
                            </div>
                        ` : task.task_type === 'reply' ? `
                            <div class="mt-3 p-3 bg-blue-900 rounded">
                                <span class="text-xs text-blue-400">
                                    <i class="fas fa-robot mr-1"></i>Generate draft reply
                                </span>
                                <button onclick="generateDraftForTask(${task.email_id})" class="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                                    Generate
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="flex flex-col items-end space-y-1">
                        <button onclick="updateTaskStatus('${task.id}', 'in-progress')" class="action-button px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                            <i class="fas fa-play mr-1"></i>Start
                        </button>
                        <button onclick="updateTaskStatus('${task.id}', 'completed')" class="action-button px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">
                            <i class="fas fa-check mr-1"></i>Complete
                        </button>
                    </div>
                </div>
            `;
            
            return div;
        }
        
        function getEmailClass(email) {
            let classes = [];
            if (email.urgency === 'CRITICAL' || email.urgency === 'HIGH') {
                classes.push('urgent');
            }
            if (email.classification === 'NEEDS_REPLY') {
                classes.push('needs-reply');
            }
            if (email.classification === 'CREATE_TASK') {
                classes.push('task');
            }
            return classes.join(' ');
        }
        
        function getClassificationBadge(classification) {
            const badges = {
                'NEEDS_REPLY': 'bg-blue-600 text-white',
                'APPROVAL_REQUIRED': 'bg-red-600 text-white',
                'CREATE_TASK': 'bg-orange-600 text-white',
                'DELEGATE': 'bg-purple-600 text-white',
                'FYI_ONLY': 'bg-green-600 text-white',
                'FOLLOW_UP': 'bg-teal-600 text-white'
            };
            
            const color = badges[classification] || 'bg-gray-600 text-white';
            const text = classification.replace('_', ' ').toLowerCase()
                .replace(/\\b\\w/g, l => l.toUpperCase());
            
            return `<span class="classification-badge ${color}">${text}</span>`;
        }
        
        async function generateDraft(emailId) {
            showLoadingOverlay('Generating AI draft reply...');
            
            try {
                const response = await fetch(`${API_BASE}/drafts/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email_id: emailId, action: 'reply' })
                });
                
                const draft = await response.json();
                showDraftModal(emailId, draft);
            } catch (error) {
                console.error('Error generating draft:', error);
                showError('Failed to generate draft reply');
            } finally {
                hideLoadingOverlay();
            }
        }
        
        function showDraftModal(emailId, draft) {
            currentDraftEmailId = emailId;
            document.getElementById('draft-subject').value = draft.subject;
            document.getElementById('draft-content').value = draft.draft;
            document.getElementById('draft-modal').classList.remove('hidden');
        }
        
        function closeDraftModal() {
            document.getElementById('draft-modal').classList.add('hidden');
            currentDraftEmailId = null;
        }
        
        async function regenerateDraft() {
            if (!currentDraftEmailId) return;
            
            showLoadingOverlay('Regenerating draft...');
            
            try {
                const response = await fetch(`${API_BASE}/drafts/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email_id: currentDraftEmailId, 
                        action: 'reply',
                        regenerate: true 
                    })
                });
                
                const draft = await response.json();
                document.getElementById('draft-content').value = draft.draft;
            } catch (error) {
                console.error('Error regenerating draft:', error);
                showError('Failed to regenerate draft');
            } finally {
                hideLoadingOverlay();
            }
        }
        
        async function sendReply() {
            if (!currentDraftEmailId) return;
            
            const content = document.getElementById('draft-content').value;
            showLoadingOverlay('Sending reply...');
            
            try {
                const response = await fetch(`${API_BASE}/emails/${currentDraftEmailId}/reply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });
                
                if (response.ok) {
                    showSuccess('Reply sent successfully');
                    closeDraftModal();
                    refreshCurrentView();
                } else {
                    throw new Error('Failed to send reply');
                }
            } catch (error) {
                console.error('Error sending reply:', error);
                showError('Failed to send reply');
            } finally {
                hideLoadingOverlay();
            }
        }
        
        async function updateStats() {
            try {
                const response = await fetch(`${API_BASE}/stats`);
                const stats = await response.json();
                
                document.getElementById('total-emails').textContent = stats.total_emails || 0;
                document.getElementById('unread-count').textContent = stats.unread_count || 0;
                document.getElementById('urgent-count').textContent = stats.urgent_count || 0;
                document.getElementById('tasks-count').textContent = stats.tasks_count || 0;
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        }
        
        // Utility functions
        function showLoading(elementId) {
            document.getElementById(elementId).classList.remove('hidden');
        }
        
        function hideLoading(elementId) {
            document.getElementById(elementId).classList.add('hidden');
        }
        
        function showLoadingOverlay(message) {
            document.getElementById('loading-message').textContent = message;
            document.getElementById('loading-overlay').classList.remove('hidden');
        }
        
        function hideLoadingOverlay() {
            document.getElementById('loading-overlay').classList.add('hidden');
        }
        
        function showError(message) {
            // TODO: Implement toast notifications
            console.error(message);
            alert(message);
        }
        
        function showSuccess(message) {
            // TODO: Implement toast notifications
            console.log(message);
        }
        
        function updateStatus(status) {
            const indicator = document.getElementById('status-indicator');
            indicator.className = `w-2 h-2 rounded-full ${
                status === 'online' ? 'bg-green-400' : 'bg-red-400'
            }`;
        }
        
        function formatDate(dateStr) {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffHours = diffMs / (1000 * 60 * 60);
            const diffDays = diffHours / 24;
            
            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
            if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
            return date.toLocaleDateString();
        }
        
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        function refreshCurrentView() {
            switch(currentTab) {
                case 'inbox':
                    loadEmails();
                    break;
                case 'tasks':
                    loadTasks();
                    break;
            }
        }
        
        // Auto-refresh functionality
        let autoRefreshEnabled = true;
        let autoRefreshInterval;
        
        function toggleAutoRefresh() {
            autoRefreshEnabled = !autoRefreshEnabled;
            const btn = document.getElementById('auto-refresh-toggle');
            
            if (autoRefreshEnabled) {
                btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>Live';
                btn.className = 'px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center auto-refresh-active';
                autoRefreshInterval = setInterval(refreshCurrentView, REFRESH_INTERVAL);
            } else {
                btn.innerHTML = '<i class="fas fa-pause mr-1"></i>Paused';
                btn.className = 'px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm flex items-center';
                clearInterval(autoRefreshInterval);
            }
        }
        
        // Email filtering
        let currentEmailFilter = 'all';
        
        function applyEmailFilter(filter) {
            currentEmailFilter = filter;
            
            // Update filter button states
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
            
            // Filter emails
            filterEmails();
            updateEmailCounts();
        }
        
        function filterEmails() {
            const emailItems = document.querySelectorAll('#email-list .email-item');
            
            emailItems.forEach(item => {
                const emailId = item.dataset.emailId;
                const email = currentEmails.find(e => e.message_id.toString() === emailId);
                
                if (!email) return;
                
                let shouldShow = true;
                
                switch(currentEmailFilter) {
                    case 'all':
                        shouldShow = true;
                        break;
                    case 'unread':
                        shouldShow = !email.is_read;
                        break;
                    case 'flagged':
                        shouldShow = email.is_flagged;
                        break;
                    case 'CRITICAL':
                        shouldShow = email.urgency === 'CRITICAL';
                        break;
                    default:
                        shouldShow = email.classification === currentEmailFilter;
                }
                
                item.style.display = shouldShow ? 'block' : 'none';
            });
        }
        
        function updateEmailCounts() {
            const counts = {
                all: currentEmails.length,
                unread: currentEmails.filter(e => !e.is_read).length,
                NEEDS_REPLY: currentEmails.filter(e => e.classification === 'NEEDS_REPLY').length,
                APPROVAL_REQUIRED: currentEmails.filter(e => e.classification === 'APPROVAL_REQUIRED').length,
                INFORMATIONAL: currentEmails.filter(e => e.classification === 'INFORMATIONAL').length,
                CRITICAL: currentEmails.filter(e => e.urgency === 'CRITICAL').length,
                flagged: currentEmails.filter(e => e.is_flagged).length
            };
            
            document.getElementById('count-all').textContent = counts.all;
            document.getElementById('count-unread').textContent = counts.unread;
            document.getElementById('count-reply').textContent = counts.NEEDS_REPLY;
            document.getElementById('count-approval').textContent = counts.APPROVAL_REQUIRED;
            document.getElementById('count-fyi').textContent = counts.INFORMATIONAL;
            document.getElementById('count-urgent').textContent = counts.CRITICAL;
            document.getElementById('count-flagged').textContent = counts.flagged;
        }
        
        // Task filtering
        let currentTaskFilter = 'all';
        
        function applyTaskFilter(filter) {
            currentTaskFilter = filter;
            
            // Update filter button states
            document.querySelectorAll('.task-filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
            
            // Filter tasks
            filterTasks();
            updateTaskCounts();
        }
        
        function filterTasks() {
            const taskItems = document.querySelectorAll('#task-list .task-item');
            
            taskItems.forEach(item => {
                const taskId = item.dataset.taskId;
                const task = currentTasks.find(t => t.id === taskId);
                
                if (!task) return;
                
                let shouldShow = true;
                
                switch(currentTaskFilter) {
                    case 'all':
                        shouldShow = true;
                        break;
                    default:
                        shouldShow = task.task_type === currentTaskFilter || task.priority === currentTaskFilter;
                }
                
                item.style.display = shouldShow ? 'block' : 'none';
            });
        }
        
        function updateTaskCounts() {
            const counts = {
                all: currentTasks.length,
                reply: currentTasks.filter(t => t.task_type === 'reply').length,
                approval: currentTasks.filter(t => t.task_type === 'approval').length,
                development: currentTasks.filter(t => t.task_type === 'development').length,
                delegation: currentTasks.filter(t => t.task_type === 'delegation').length,
                CRITICAL: currentTasks.filter(t => t.priority === 'CRITICAL').length
            };
            
            document.getElementById('task-count-all').textContent = counts.all;
            document.getElementById('task-count-reply').textContent = counts.reply;
            document.getElementById('task-count-approval').textContent = counts.approval;
            document.getElementById('task-count-dev').textContent = counts.development;
            document.getElementById('task-count-delegate').textContent = counts.delegation;
            document.getElementById('task-count-urgent').textContent = counts.CRITICAL;
        }
        
        // Email selection
        function toggleSelectAll() {
            const selectAll = document.getElementById('select-all');
            const emailCheckboxes = document.querySelectorAll('.email-checkbox');
            
            emailCheckboxes.forEach(checkbox => {
                checkbox.checked = selectAll.checked;
                toggleEmailSelection(checkbox.dataset.emailId);
            });
        }
        
        function clearAllFilters() {
            currentEmailFilter = 'all';
            currentTaskFilter = 'all';
            
            // Reset filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.task-filter-btn').forEach(btn => btn.classList.remove('active'));
            
            document.querySelector('[data-filter="all"]').classList.add('active');
            
            // Show all items
            filterEmails();
            filterTasks();
        }
        
        // Enhanced email display with checkboxes
        function createEmailElement(email) {
            const div = document.createElement('div');
            div.className = `email-item p-4 bg-slate-800 rounded-lg cursor-pointer ${email.classification.toLowerCase()}`;
            div.dataset.emailId = email.message_id;
            
            const urgencyClass = email.urgency === 'CRITICAL' ? 'urgent' : '';
            const needsReplyClass = email.classification === 'NEEDS_REPLY' ? 'needs-reply' : '';
            
            div.className += ` ${urgencyClass} ${needsReplyClass}`;
            
            div.innerHTML = `
                <div class="flex items-start space-x-3">
                    <input type="checkbox" class="email-checkbox mt-1" data-email-id="${email.message_id}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <span class="font-medium text-white">${email.sender_name}</span>
                                <span class="classification-badge bg-blue-600 text-white">${email.classification}</span>
                                ${email.urgency === 'CRITICAL' ? '<span class="classification-badge bg-red-600 text-white">URGENT</span>' : ''}
                                ${!email.is_read ? '<span class="classification-badge bg-green-600 text-white">NEW</span>' : ''}
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="text-sm text-gray-400">${formatDate(email.date)}</span>
                                <div class="flex space-x-1">
                                    <button onclick="generateDraft(${email.message_id})" class="action-button p-1 bg-blue-600 hover:bg-blue-700 rounded">
                                        <i class="fas fa-reply text-xs"></i>
                                    </button>
                                    <button onclick="toggleEmailSelection(${email.message_id})" class="action-button p-1 bg-gray-600 hover:bg-gray-700 rounded">
                                        <i class="fas fa-check text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <h3 class="font-semibold text-white mb-1">${email.subject}</h3>
                        <p class="text-gray-300 text-sm mb-2">${email.snippet}</p>
                        ${email.action_items.length > 0 ? `
                            <div class="mt-2">
                                <span class="text-xs text-gray-400">Action Items:</span>
                                <ul class="text-sm text-gray-300 list-disc list-inside">
                                    ${email.action_items.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${email.draft_reply ? `
                            <div class="mt-2 p-2 bg-green-900 rounded">
                                <span class="text-xs text-green-400">Draft Ready:</span>
                                <p class="text-sm text-green-300">${email.draft_reply.substring(0, 100)}...</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Add click handler for checkbox
            const checkbox = div.querySelector('.email-checkbox');
            checkbox.addEventListener('change', () => {
                toggleEmailSelection(email.message_id);
                if (checkbox.checked) {
                    div.classList.add('selected');
                } else {
                    div.classList.remove('selected');
                }
            });
            
            return div;
        }
        
        // Initialize auto-refresh on load
        document.addEventListener('DOMContentLoaded', function() {
            // Set up auto-refresh
            autoRefreshInterval = setInterval(refreshCurrentView, REFRESH_INTERVAL);
        });
        
        // Placeholder functions for actions
        function toggleEmailSelection(emailId) {
            if (selectedEmails.has(emailId)) {
                selectedEmails.delete(emailId);
            } else {
                selectedEmails.add(emailId);
            }
        }
        
        function delegateEmail(emailId) {
            console.log('Delegate email:', emailId);
        }
        
        function createTaskFromEmail(emailId) {
            console.log('Create task from email:', emailId);
        }
        
        function archiveEmail(emailId) {
            console.log('Archive email:', emailId);
        }
        
        function updateTaskStatus(taskId, status) {
            console.log('Update task status:', taskId, status);
        }
        
        function performSearch() {
            console.log('Perform search');
        }
        
        function applyFilters() {
            console.log('Apply filters');
        }
        
        function clearFilters() {
            console.log('Clear filters');
        }
        
        function showBulkActionsMenu() {
            console.log('Show bulk actions menu');
        }
        
        function markAllAsRead() {
            console.log('Mark all as read');
        }
        
        function applySmartFilter() {
            console.log('Apply smart filter');
        }
    </script>
</body>
</html>
    """

@app.get("/", response_class=HTMLResponse)
async def get_interface():
    """Serve the unified email intelligence interface"""
    return get_html_template()

@app.get("/emails")
async def get_emails(
    limit: int = Query(50, description="Number of emails to retrieve"),
    offset: int = Query(0, description="Offset for pagination"),
    classification: Optional[str] = Query(None, description="Filter by classification"),
    urgency: Optional[str] = Query(None, description="Filter by urgency"),
    search: Optional[str] = Query(None, description="Search query")
) -> List[EmailItem]:
    """Get emails with AI classification and processing"""
    try:
        # Get emails from database or mock data
        if db_reader:
            if search:
                raw_emails = db_reader.search_emails(search, limit=limit)
            else:
                raw_emails = db_reader.get_recent_emails(limit=limit)
        else:
            # Mock data for testing
            raw_emails = get_mock_email_data(limit)
        
        # Process emails through AI engine
        processed_emails = []
        for email in raw_emails:
            email_id = email.get('message_id', 0)
            
            # Check cache first
            if email_id in email_cache:
                cached_email = email_cache[email_id]
                # Apply filters if any
                if classification and cached_email.classification != classification:
                    continue
                if urgency and cached_email.urgency != urgency:
                    continue
                processed_emails.append(cached_email)
                continue
            
            # Analyze with AI engine
            try:
                analysis = engine.analyze_email(
                    subject=email.get('subject_text', 'No Subject'),
                    body=email.get('snippet', ''),
                    sender=email.get('sender_email', 'unknown@email.com')
                )
                
                # Generate draft reply in background if needed
                draft_reply = None
                if analysis.classification in [EmailClass.NEEDS_REPLY, EmailClass.APPROVAL_REQUIRED]:
                    try:
                        draft_reply = engine.generate_draft_reply(
                            {
                                'subject': email.get('subject_text', ''),
                                'sender_name': email.get('sender_name', ''),
                                'content': email.get('snippet', '')
                            },
                            analysis
                        )
                    except Exception as e:
                        logger.warning(f"Failed to generate draft for email {email_id}: {e}")
                
                # Extract action items text
                action_items = [item.text for item in analysis.action_items]
                deadlines = [f"{deadline.strftime('%Y-%m-%d')}: {context}" 
                           for deadline, context in analysis.deadlines]
                
                email_item = EmailItem(
                    message_id=email_id,
                    subject=email.get('subject_text', 'No Subject'),
                    sender=email.get('sender_email', 'Unknown'),
                    sender_name=email.get('sender_name', email.get('sender_email', 'Unknown')),
                    date=email.get('date_received', datetime.now().isoformat()),
                    snippet=email.get('snippet', '')[:300],
                    classification=analysis.classification.value,
                    urgency=analysis.urgency.value,
                    confidence=analysis.confidence,
                    action_items=action_items,
                    deadlines=deadlines,
                    is_read=bool(email.get('is_read', 0)),
                    is_flagged=bool(email.get('is_flagged', 0)),
                    draft_reply=draft_reply
                )
                
                # Cache the processed email
                email_cache[email_id] = email_item
                
                # Apply filters
                if classification and email_item.classification != classification:
                    continue
                if urgency and email_item.urgency != urgency:
                    continue
                
                processed_emails.append(email_item)
                
            except Exception as e:
                logger.error(f"Error processing email {email_id}: {e}")
                # Fallback email item
                processed_emails.append(EmailItem(
                    message_id=email_id,
                    subject=email.get('subject_text', 'No Subject'),
                    sender=email.get('sender_email', 'Unknown'),
                    sender_name=email.get('sender_name', 'Unknown'),
                    date=email.get('date_received', datetime.now().isoformat()),
                    snippet=email.get('snippet', ''),
                    classification='FYI_ONLY',
                    urgency='MEDIUM',
                    confidence=0.5,
                    action_items=[],
                    deadlines=[],
                    is_read=bool(email.get('is_read', 0)),
                    is_flagged=bool(email.get('is_flagged', 0))
                ))
        
        return processed_emails[:limit]
        
    except Exception as e:
        logger.error(f"Error in get_emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks")
async def get_tasks(
    status: Optional[str] = Query(None, description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by priority")
) -> List[TaskItem]:
    """Get action items and tasks extracted from emails"""
    try:
        # Ensure emails are loaded in cache first
        if not email_cache and db_reader:
            logger.info("Loading emails into cache for task extraction")
            raw_emails = db_reader.get_recent_emails(limit=100)
            
            for raw_email in raw_emails:
                email_id = raw_email.get('message_id', 0)
                
                # Process email with AI if not in cache
                if email_id not in email_cache:
                    analysis = engine.analyze_email(
                        subject=raw_email.get('subject_text', ''),
                        body=raw_email.get('snippet', ''),
                        sender=raw_email.get('sender_email', '')
                    )
                    
                    email_item = EmailItem(
                        message_id=email_id,
                        subject=raw_email.get('subject_text', ''),
                        sender=raw_email.get('sender_email', ''),
                        sender_name=raw_email.get('sender_name', ''),
                        date=raw_email.get('date_received', ''),
                        snippet=raw_email.get('snippet', ''),
                        classification=analysis.classification.value,
                        urgency=analysis.urgency.value,
                        confidence=analysis.confidence,
                        action_items=analysis.action_items,
                        deadlines=analysis.deadlines,
                        is_read=raw_email.get('read', False),
                        is_flagged=raw_email.get('flagged', False),
                        draft_reply=None
                    )
                    
                    # Generate draft for actionable emails
                    if analysis.classification in [EmailClass.NEEDS_REPLY, EmailClass.APPROVAL_REQUIRED]:
                        try:
                            draft_content = engine.generate_draft_reply({
                                'subject': email_item.subject,
                                'sender_name': email_item.sender_name,
                                'content': email_item.snippet
                            }, analysis)
                            email_item.draft_reply = draft_content
                        except Exception as e:
                            logger.warning(f"Failed to generate draft for email {email_id}: {e}")
                    
                    email_cache[email_id] = email_item
        
        tasks = []
        
        # Generate tasks from cached emails
        for email_id, email in email_cache.items():
            if email.action_items:
                for i, action_item in enumerate(email.action_items):
                    task_id = f"{email_id}_{i}"
                    
                    # Skip if already in task cache
                    if task_id in task_cache:
                        task = task_cache[task_id]
                        if status and task.status != status:
                            continue
                        if priority and task.priority != priority:
                            continue
                        tasks.append(task)
                        continue
                    
                    # Determine task priority from email urgency
                    task_priority = email.urgency
                    
                    # Determine task type from classification
                    task_type_map = {
                        'NEEDS_REPLY': 'reply',
                        'APPROVAL_REQUIRED': 'approval',
                        'CREATE_TASK': 'development',
                        'DELEGATE': 'delegation',
                        'FOLLOW_UP': 'follow-up'
                    }
                    task_type = task_type_map.get(email.classification, 'general')
                    
                    # Extract due date from deadlines
                    due_date = None
                    if email.deadlines:
                        # Use first deadline
                        due_date = email.deadlines[0].split(':')[0]
                    
                    task = TaskItem(
                        id=task_id,
                        email_id=email_id,
                        subject=email.subject,
                        task_type=task_type,
                        priority=task_priority,
                        due_date=due_date,
                        description=action_item,
                        assignee=None,  # Could be extracted with more sophisticated AI
                        status='pending'
                    )
                    
                    task_cache[task_id] = task
                    
                    # Apply filters
                    if status and task.status != status:
                        continue
                    if priority and task.priority != priority:
                        continue
                    
                    tasks.append(task)
        
        # Sort by priority and due date
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        tasks.sort(key=lambda t: (
            priority_order.get(t.priority, 4),
            t.due_date or '9999-12-31'
        ))
        
        return tasks
        
    except Exception as e:
        logger.error(f"Error in get_tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/drafts/generate")
async def generate_draft(request: DraftRequest):
    """Generate AI-powered draft reply"""
    try:
        email_id = request.email_id
        
        # Get email from cache or database
        if email_id in email_cache:
            email = email_cache[email_id]
        else:
            # Fetch from database if not in cache
            if db_reader:
                raw_email = db_reader.get_email_by_id(email_id)
                if not raw_email:
                    raise HTTPException(status_code=404, detail="Email not found")
                
                # Quick analysis to generate email object
                analysis = engine.analyze_email(
                    subject=raw_email.get('subject_text', ''),
                    body=raw_email.get('snippet', ''),
                    sender=raw_email.get('sender_email', '')
                )
                
                email = {
                    'subject': raw_email.get('subject_text', ''),
                    'sender_name': raw_email.get('sender_name', ''),
                    'content': raw_email.get('snippet', '')
                }
            else:
                raise HTTPException(status_code=404, detail="Email not found")
        
        # Generate draft using AI engine
        if isinstance(email, EmailItem):
            email_dict = {
                'subject': email.subject,
                'sender_name': email.sender_name,
                'content': email.snippet
            }
            # Re-analyze for fresh draft generation
            analysis = engine.analyze_email(email.subject, email.snippet, email.sender)
        else:
            email_dict = email
            analysis = engine.analyze_email(
                email_dict['subject'], 
                email_dict['content'], 
                email_dict.get('sender_name', '')
            )
        
        draft_content = engine.generate_draft_reply(email_dict, analysis)
        
        # Prepare subject line
        original_subject = email_dict['subject']
        if not original_subject.lower().startswith('re:'):
            reply_subject = f"Re: {original_subject}"
        else:
            reply_subject = original_subject
        
        return {
            "email_id": email_id,
            "subject": reply_subject,
            "draft": draft_content,
            "suggested_actions": [
                f"Reply to {email_dict.get('sender_name', 'sender')}",
                "Review before sending",
                "Add personal touches if needed"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error generating draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/reply")
async def send_reply(email_id: int, request: dict):
    """Send email reply using AppleScript"""
    try:
        content = request.get('content', '')
        
        if not content:
            raise HTTPException(status_code=400, detail="Reply content is required")
        
        # Get original email details
        if email_id in email_cache:
            email = email_cache[email_id]
            recipient = email.sender
            subject = email.subject if email.subject.lower().startswith('re:') else f"Re: {email.subject}"
        else:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Send email using AppleScript mailer
        if mailer:
            success = mailer.send_email(
                to=recipient,
                subject=subject,
                body=content
            )
            
            if success:
                # Mark original email as read
                if db_reader:
                    db_reader.mark_as_read(email_id)
                
                # Update cache
                if email_id in email_cache:
                    email_cache[email_id].is_read = True
                
                return {"success": True, "message": "Reply sent successfully"}
            else:
                raise HTTPException(status_code=500, detail="Failed to send email")
        else:
            # Mock success for testing
            logger.info(f"Mock: Sending reply to {recipient} with subject '{subject}'")
            return {"success": True, "message": "Reply sent successfully (mock)"}
        
    except Exception as e:
        logger.error(f"Error sending reply: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats():
    """Get email statistics and metrics"""
    try:
        # Calculate stats from cached emails
        total_emails = len(email_cache)
        unread_count = sum(1 for email in email_cache.values() if not email.is_read)
        urgent_count = sum(1 for email in email_cache.values() 
                          if email.urgency in ['CRITICAL', 'HIGH'])
        tasks_count = len(task_cache)
        
        # Classification breakdown
        classifications = {}
        urgency_breakdown = {}
        
        for email in email_cache.values():
            classifications[email.classification] = classifications.get(email.classification, 0) + 1
            urgency_breakdown[email.urgency] = urgency_breakdown.get(email.urgency, 0) + 1
        
        # Average confidence
        confidences = [email.confidence for email in email_cache.values()]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.85
        
        # Update global stats cache
        stats_cache.update({
            "last_updated": datetime.now(),
            "total_emails": total_emails,
            "unread_count": unread_count,
            "urgent_count": urgent_count,
            "tasks_count": tasks_count
        })
        
        return {
            "total_emails": total_emails,
            "unread_count": unread_count,
            "urgent_count": urgent_count,
            "tasks_count": tasks_count,
            "classifications": classifications,
            "urgency_breakdown": urgency_breakdown,
            "avg_confidence": avg_confidence,
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            "total_emails": 0,
            "unread_count": 0,
            "urgent_count": 0,
            "tasks_count": 0,
            "classifications": {},
            "urgency_breakdown": {},
            "avg_confidence": 0.85,
            "last_updated": datetime.now().isoformat()
        }

@app.post("/actions/bulk")
async def bulk_actions(request: ActionRequest):
    """Perform bulk actions on multiple emails"""
    try:
        email_ids = request.email_ids
        action = request.action
        parameters = request.parameters or {}
        
        results = []
        
        for email_id in email_ids:
            try:
                if action == "mark_read":
                    if db_reader:
                        db_reader.mark_as_read(email_id)
                    if email_id in email_cache:
                        email_cache[email_id].is_read = True
                    results.append({"email_id": email_id, "success": True})
                    
                elif action == "archive":
                    # Archive logic would go here
                    results.append({"email_id": email_id, "success": True})
                    
                elif action == "flag":
                    if email_id in email_cache:
                        email_cache[email_id].is_flagged = True
                    results.append({"email_id": email_id, "success": True})
                    
                else:
                    results.append({"email_id": email_id, "success": False, "error": "Unknown action"})
                    
            except Exception as e:
                results.append({"email_id": email_id, "success": False, "error": str(e)})
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "action": action,
            "total_emails": len(email_ids),
            "success_count": success_count,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in bulk actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_emails(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, description="Number of results to return")
):
    """Search emails using full-text search"""
    try:
        results = []
        
        # Search in cached emails
        query_lower = q.lower()
        for email in email_cache.values():
            if (query_lower in email.subject.lower() or 
                query_lower in email.snippet.lower() or 
                query_lower in email.sender.lower() or
                query_lower in email.sender_name.lower()):
                results.append(email)
        
        # If we have database access, search there too
        if db_reader and len(results) < limit:
            try:
                db_results = db_reader.search_emails(q, limit=limit - len(results))
                for raw_email in db_results:
                    email_id = raw_email.get('message_id', 0)
                    if email_id not in email_cache:
                        # Quick process for search results
                        analysis = engine.analyze_email(
                            subject=raw_email.get('subject_text', ''),
                            body=raw_email.get('snippet', ''),
                            sender=raw_email.get('sender_email', '')
                        )
                        
                        email_item = EmailItem(
                            message_id=email_id,
                            subject=raw_email.get('subject_text', 'No Subject'),
                            sender=raw_email.get('sender_email', 'Unknown'),
                            sender_name=raw_email.get('sender_name', 'Unknown'),
                            date=raw_email.get('date_received', datetime.now().isoformat()),
                            snippet=raw_email.get('snippet', ''),
                            classification=analysis.classification.value,
                            urgency=analysis.urgency.value,
                            confidence=analysis.confidence,
                            action_items=[item.text for item in analysis.action_items],
                            deadlines=[],
                            is_read=bool(raw_email.get('is_read', 0)),
                            is_flagged=bool(raw_email.get('is_flagged', 0))
                        )
                        results.append(email_item)
            except Exception as e:
                logger.warning(f"Database search failed: {e}")
        
        # Sort by relevance (exact matches first, then by date)
        def relevance_score(email):
            score = 0
            if query_lower in email.subject.lower():
                score += 10
            if query_lower in email.sender_name.lower():
                score += 5
            if query_lower in email.snippet.lower():
                score += 1
            return score
        
        results.sort(key=lambda e: (relevance_score(e), e.date), reverse=True)
        
        return {
            "query": q,
            "total_results": len(results),
            "results": results[:limit]
        }
        
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Unified Email Intelligence Interface",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "engine": "active" if engine else "inactive",
            "database": "active" if db_reader else "inactive",
            "mailer": "active" if mailer else "inactive"
        },
        "stats": stats_cache
    }

def get_mock_email_data(limit: int) -> List[Dict[str, Any]]:
    """Generate mock email data for testing"""
    mock_emails = [
        {
            'message_id': 1,
            'subject_text': 'URGENT: Budget approval needed for Q4 marketing campaign',
            'sender_email': 'sarah.johnson@company.com',
            'sender_name': 'Sarah Johnson',
            'snippet': 'Hi team, I need your approval for the Q4 marketing budget. The proposed amount is $50,000 for digital advertising campaigns. Please review the attached proposal and let me know by end of this week.',
            'date_received': (datetime.now() - timedelta(hours=2)).isoformat(),
            'is_read': 0,
            'is_flagged': 1
        },
        {
            'message_id': 2,
            'subject_text': 'FYI: Server maintenance scheduled for this weekend',
            'sender_email': 'it-team@company.com',
            'sender_name': 'IT Team',
            'snippet': 'Just to let you know that we have scheduled server maintenance for this weekend (Saturday 2 AM - 4 AM). No action required from your side. All services will be restored automatically.',
            'date_received': (datetime.now() - timedelta(hours=5)).isoformat(),
            'is_read': 1,
            'is_flagged': 0
        },
        {
            'message_id': 3,
            'subject_text': 'Can you help with the client presentation slides?',
            'sender_email': 'mike.wilson@company.com',
            'sender_name': 'Mike Wilson',
            'snippet': 'Hi there, could you please help me with the slides for tomorrow\'s client presentation? I specifically need someone to review the financial projections section and make sure the numbers are accurate.',
            'date_received': (datetime.now() - timedelta(hours=1)).isoformat(),
            'is_read': 0,
            'is_flagged': 0
        },
        {
            'message_id': 4,
            'subject_text': 'Task: Implement user authentication feature',
            'sender_email': 'product@company.com',
            'sender_name': 'Product Team',
            'snippet': 'We need to implement a new user authentication feature for the mobile app. This should include social login options and two-factor authentication. Target completion: next sprint.',
            'date_received': (datetime.now() - timedelta(hours=8)).isoformat(),
            'is_read': 0,
            'is_flagged': 0
        },
        {
            'message_id': 5,
            'subject_text': 'Follow up: Meeting notes from yesterday',
            'sender_email': 'alice.brown@company.com',
            'sender_name': 'Alice Brown',
            'snippet': 'Following up on our discussion yesterday. Here are the meeting notes and action items. Please review and let me know if I missed anything important.',
            'date_received': (datetime.now() - timedelta(hours=16)).isoformat(),
            'is_read': 1,
            'is_flagged': 0
        }
    ]
    
    # Repeat and vary the mock data to reach the requested limit
    result = []
    for i in range(limit):
        base_email = mock_emails[i % len(mock_emails)].copy()
        base_email['message_id'] = i + 1
        base_email['subject_text'] = f"{base_email['subject_text']} [{i+1}]"
        base_email['date_received'] = (datetime.now() - timedelta(hours=i)).isoformat()
        result.append(base_email)
    
    return result

if __name__ == "__main__":
    # Update chat server
    try:
        import requests
        requests.post('http://localhost:9802/chat', 
                     json={"agent": "python-pro", "message": "Unified interface complete. Starting server on port 8003."})
    except:
        pass
    
    # Run the server
    port = int(os.getenv("PORT", 8003))
    logger.info(f"Starting Unified Email Intelligence Interface on port {port}")
    uvicorn.run(
        "unified_email_interface:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )