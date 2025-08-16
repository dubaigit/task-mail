#!/usr/bin/env python3
"""
Unified Email Intelligence Interface - Clean Version
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
    instructions: Optional[str] = None

class ReplyRequest(BaseModel):
    email_id: int
    content: str

# Global state
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
    """Generate the clean unified HTML interface template"""
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
        
        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Inter', sans-serif;
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
        
        .email-item.selected {
            background-color: var(--bg-tertiary);
            border-color: var(--accent-blue);
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
        
        .classification-badge {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-weight: 600;
        }
        
        .auto-refresh-active {
            animation: pulse 2s infinite;
        }
        
        .spinner {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="min-h-screen">
    <!-- Header -->
    <header class="bg-slate-900 border-b border-slate-800">
        <div class="max-w-7xl mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-bold text-white">Email Intelligence</h1>
                    <div class="flex items-center space-x-2 text-sm">
                        <div id="status-indicator" class="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span id="status-text" class="text-gray-400">Connected</span>
                    </div>
                </div>
                
                <div class="flex items-center space-x-4">
                    <button id="auto-refresh-toggle" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center auto-refresh-active">
                        <i class="fas fa-sync-alt mr-1"></i>Live
                    </button>
                    <button id="manual-refresh" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                        <i class="fas fa-refresh mr-1"></i>Refresh
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Navigation -->
    <nav class="bg-slate-800 border-b border-slate-700">
        <div class="max-w-7xl mx-auto px-6">
            <div class="flex space-x-8">
                <button id="inbox-tab" class="tab-button px-6 py-3 font-medium border-b-2 border-blue-500 text-blue-400">
                    <i class="fas fa-inbox mr-2"></i>Inbox
                </button>
                <button id="tasks-tab" class="tab-button px-6 py-3 font-medium border-b-2 border-transparent text-gray-400 hover:text-white">
                    <i class="fas fa-list-check mr-2"></i>Tasks
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto p-6">
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
                    <button id="bulk-actions" class="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm">
                        Actions
                    </button>
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
                <button class="filter-btn" data-filter="FYI_ONLY">
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
            </div>
            
            <div id="task-list" class="space-y-3">
                <!-- Task items will be populated here -->
            </div>
            
            <div id="task-loading" class="text-center py-8 hidden">
                <i class="fas fa-spinner spinner text-2xl text-blue-400"></i>
                <p class="mt-2 text-gray-400">Loading tasks...</p>
            </div>
        </div>
    </main>

    <script>
        // Global variables
        let currentTab = 'inbox';
        let currentEmails = [];
        let currentTasks = [];
        let selectedEmails = new Set();
        let currentEmailFilter = 'all';
        let autoRefreshEnabled = true;
        let autoRefreshInterval;
        
        // Configuration
        const API_BASE = '';
        const REFRESH_INTERVAL = 30000; // 30 seconds
        
        // Initialize the interface
        document.addEventListener('DOMContentLoaded', function() {
            initializeInterface();
            setupEventListeners();
            loadEmails();
            updateStats();
            
            // Start auto-refresh
            if (autoRefreshEnabled) {
                autoRefreshInterval = setInterval(refreshCurrentView, REFRESH_INTERVAL);
            }
        });
        
        function initializeInterface() {
            console.log('Email Intelligence Interface initialized');
            updateStatus('online');
        }
        
        function setupEventListeners() {
            // Tab navigation
            document.getElementById('inbox-tab').addEventListener('click', () => switchTab('inbox'));
            document.getElementById('tasks-tab').addEventListener('click', () => switchTab('tasks'));
            
            // Filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => applyEmailFilter(btn.dataset.filter));
            });
            
            // Auto-refresh toggle
            document.getElementById('auto-refresh-toggle').addEventListener('click', toggleAutoRefresh);
            document.getElementById('manual-refresh').addEventListener('click', refreshCurrentView);
            
            // Email selection
            document.getElementById('select-all').addEventListener('change', toggleSelectAll);
            
            // Clear filters
            document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
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
            }
        }
        
        async function loadEmails() {
            showLoading('email-loading');
            
            try {
                const response = await fetch(`${API_BASE}/emails`);
                const emails = await response.json();
                currentEmails = emails;
                displayEmails(emails);
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
            
            updateEmailCounts();
            filterEmails();
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
        }
        
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
                                <button onclick="generateDraft(${email.message_id})" class="p-1 bg-blue-600 hover:bg-blue-700 rounded">
                                    <i class="fas fa-reply text-xs"></i>
                                </button>
                            </div>
                        </div>
                        <h3 class="font-semibold text-white mb-1">${email.subject}</h3>
                        <p class="text-gray-300 text-sm mb-2">${email.snippet}</p>
                        ${email.action_items && email.action_items.length > 0 ? `
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
        
        function createTaskElement(task) {
            const div = document.createElement('div');
            div.className = `task-item bg-slate-800 rounded-lg p-4 border border-slate-700`;
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
            
            div.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <i class="${typeIcon} text-blue-400"></i>
                            <h3 class="font-semibold text-white">${task.subject}</h3>
                            <span class="classification-badge ${statusBadge} text-white">${task.status.replace('-', ' ')}</span>
                            <span class="text-xs ${priorityColor}">${task.priority}</span>
                        </div>
                        
                        <p class="text-gray-300 text-sm mb-2">${task.description}</p>
                        
                        <div class="flex items-center space-x-4 text-xs text-gray-400">
                            <span>Type: ${task.task_type}</span>
                            ${task.due_date ? `<span>Due: ${task.due_date}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="flex flex-col space-y-1">
                        <button onclick="updateTaskStatus('${task.id}', 'in-progress')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                            <i class="fas fa-play mr-1"></i>Start
                        </button>
                        <button onclick="updateTaskStatus('${task.id}', 'completed')" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">
                            <i class="fas fa-check mr-1"></i>Complete
                        </button>
                    </div>
                </div>
            `;
            
            return div;
        }
        
        // Auto-refresh functionality
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
        
        // Email filtering
        function applyEmailFilter(filter) {
            currentEmailFilter = filter;
            
            // Update filter button states
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
            
            filterEmails();
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
                FYI_ONLY: currentEmails.filter(e => e.classification === 'FYI_ONLY').length,
                CRITICAL: currentEmails.filter(e => e.urgency === 'CRITICAL').length,
                flagged: currentEmails.filter(e => e.is_flagged).length
            };
            
            document.getElementById('count-all').textContent = counts.all;
            document.getElementById('count-unread').textContent = counts.unread;
            document.getElementById('count-reply').textContent = counts.NEEDS_REPLY;
            document.getElementById('count-approval').textContent = counts.APPROVAL_REQUIRED;
            document.getElementById('count-fyi').textContent = counts.FYI_ONLY;
            document.getElementById('count-urgent').textContent = counts.CRITICAL;
            document.getElementById('count-flagged').textContent = counts.flagged;
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
        
        function toggleEmailSelection(emailId) {
            if (selectedEmails.has(emailId)) {
                selectedEmails.delete(emailId);
            } else {
                selectedEmails.add(emailId);
            }
        }
        
        function clearAllFilters() {
            currentEmailFilter = 'all';
            
            // Reset filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            
            filterEmails();
        }
        
        // Utility functions
        function formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
            
            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
            if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
            return date.toLocaleDateString();
        }
        
        function showLoading(elementId) {
            document.getElementById(elementId).classList.remove('hidden');
        }
        
        function hideLoading(elementId) {
            document.getElementById(elementId).classList.add('hidden');
        }
        
        function showError(message) {
            console.error(message);
            // You could add a toast notification here
        }
        
        function updateStatus(status) {
            const indicator = document.getElementById('status-indicator');
            const text = document.getElementById('status-text');
            
            if (status === 'online') {
                indicator.className = 'w-2 h-2 bg-green-500 rounded-full';
                text.textContent = 'Connected';
            } else {
                indicator.className = 'w-2 h-2 bg-red-500 rounded-full';
                text.textContent = 'Disconnected';
            }
        }
        
        async function updateStats() {
            try {
                const response = await fetch(`${API_BASE}/stats`);
                const stats = await response.json();
                // Update stats display if needed
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        }
        
        // Placeholder functions for actions
        function generateDraft(emailId) {
            console.log('Generate draft for email:', emailId);
        }
        
        function updateTaskStatus(taskId, status) {
            console.log('Update task status:', taskId, status);
        }
    </script>
</body>
</html>
    """

@app.get("/", response_class=HTMLResponse)
async def get_interface():
    """Serve the clean unified email intelligence interface"""
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
        # Get emails from database
        if db_reader:
            if search:
                raw_emails = db_reader.search_emails(search, limit=limit)
            else:
                raw_emails = db_reader.get_recent_emails(limit=limit)
        else:
            # Fallback to mock data if db_reader is not available
            raw_emails = []
        
        emails = []
        for raw_email in raw_emails:
            email_id = raw_email.get('message_id', 0)
            
            # Check cache first
            if email_id in email_cache:
                cached_email = email_cache[email_id]
                # Apply filters if any
                if classification and cached_email.classification != classification:
                    continue
                if urgency and cached_email.urgency != urgency:
                    continue
                emails.append(cached_email)
                continue
            
            # Process email with AI
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
            
            # Cache the processed email
            email_cache[email_id] = email_item
            
            # Apply filters
            if classification and email_item.classification != classification:
                continue
            if urgency and email_item.urgency != urgency:
                continue
            
            emails.append(email_item)
        
        return emails[:limit]
        
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
        
        # Generate tasks from cached emails (more aggressive task detection)
        for email_id, email in email_cache.items():
            # Create tasks for actionable classifications even without explicit action_items
            should_create_task = (
                email.classification in ['NEEDS_REPLY', 'APPROVAL_REQUIRED', 'CREATE_TASK', 'DELEGATE', 'FOLLOW_UP'] or
                email.action_items or
                email.urgency in ['CRITICAL', 'HIGH'] or
                not email.is_read
            )
            
            if should_create_task:
                # Use action_items if available, otherwise create from email content
                task_items = email.action_items if email.action_items else [f"Review and respond to: {email.subject[:60]}"]
                
                for i, action_item in enumerate(task_items):
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
                        assignee=None,
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
            "tasks_count": tasks_count,
            "classifications": classifications,
            "urgency_breakdown": urgency_breakdown,
            "avg_confidence": avg_confidence
        })
        
        return stats_cache
        
    except Exception as e:
        logger.error(f"Error in get_stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("Starting Clean Unified Email Intelligence Interface on port 8003")
    uvicorn.run(app, host="0.0.0.0", port=8003)