#!/usr/bin/env node

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Find available port starting from 9800
async function findAvailablePort(startPort = 9800) {
    const net = require('net');
    
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

async function startChatServer() {
    const PORT = await findAvailablePort();
    const SESSION_ID = Math.random().toString(36).substring(2, 15);
    
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    app.use(express.json());
    app.use(express.static('.'));

    // In-memory storage for chat session
    let agents = [];
    let chatLog = [];
    let fileLocks = {};
    let activeFiles = {};

    // Serve beautiful chat interface
    app.get(`/agent-chat-${SESSION_ID}`, (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Intelligence Agent Chat - Session ${SESSION_ID}</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            color: #333;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            height: 100vh;
            display: flex;
            gap: 20px;
            padding: 20px;
        }
        .sidebar {
            width: 300px;
            background: rgba(255,255,255,0.95);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .main-chat {
            flex: 1;
            background: rgba(255,255,255,0.95);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        .session-id {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .agents-list {
            margin-bottom: 20px;
        }
        .agent-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 8px;
            background: #f8f9ff;
            border: 1px solid #e1e5fe;
        }
        .agent-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 10px;
        }
        .status-active { background: #4caf50; }
        .status-idle { background: #ff9800; }
        .status-offline { background: #9e9e9e; }
        .files-section {
            margin-top: 20px;
        }
        .file-item {
            padding: 6px 10px;
            margin: 3px 0;
            border-radius: 6px;
            background: #fff3e0;
            border: 1px solid #ffcc02;
            font-size: 13px;
        }
        .chat-container {
            flex: 1;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            padding: 15px;
            background: #fafafa;
            margin-bottom: 15px;
        }
        .message {
            margin: 10px 0;
            padding: 10px 15px;
            border-radius: 10px;
            max-width: 80%;
        }
        .message.orchestrator {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            margin-left: 0;
            border: 2px solid #5a6cf3;
        }
        .message.agent {
            background: #e3f2fd;
            color: #1976d2;
            margin-left: 20%;
            border: 1px solid #bbdefb;
        }
        .message.system {
            background: #f0f0f0;
            color: #666;
            text-align: center;
            margin: 5px auto;
            font-style: italic;
        }
        .message-header {
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .timestamp {
            font-size: 11px;
            opacity: 0.7;
        }
        .input-container {
            display: flex;
            gap: 10px;
        }
        .input-container input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
        }
        .input-container button {
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
        }
        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #f8f9ff;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e1e5fe;
        }
        .stat-number {
            font-size: 20px;
            font-weight: bold;
            color: #5a6cf3;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <div class="header">
                <h3>🤖 Agent Orchestration</h3>
                <div class="session-id">Session: ${SESSION_ID}</div>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" id="agentCount">0</div>
                    <div class="stat-label">Active Agents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="messageCount">0</div>
                    <div class="stat-label">Messages</div>
                </div>
            </div>
            
            <div class="agents-list">
                <h4>🎯 Active Agents</h4>
                <div id="agentsList"></div>
            </div>
            
            <div class="files-section">
                <h4>📁 Active Files</h4>
                <div id="filesList"></div>
            </div>
        </div>
        
        <div class="main-chat">
            <div class="header">
                <h2>🧠 Email Intelligence System</h2>
                <div class="session-id">Live Agent Collaboration</div>
            </div>
            
            <div class="chat-container" id="chatContainer">
                <div class="message system">
                    🚀 Agent chat session started. Waiting for orchestrator...
                </div>
            </div>
            
            <div class="input-container">
                <input type="text" id="messageInput" placeholder="Send message to agents..." />
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const agentsList = document.getElementById('agentsList');
        const filesList = document.getElementById('filesList');
        
        let messageCount = 0;
        
        function updateStats() {
            document.getElementById('messageCount').textContent = messageCount;
        }
        
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message) {
                socket.emit('chat-message', {
                    agent: 'coordinator',
                    message: message,
                    timestamp: new Date().toLocaleTimeString()
                });
                messageInput.value = '';
            }
        }
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        socket.on('agent-joined', (agent) => {
            addMessage('system', \`🤖 \${agent.name} joined the chat\`);
            updateAgentsList();
        });
        
        socket.on('chat-message', (data) => {
            addMessage(data.agent === 'context-manager' ? 'orchestrator' : 'agent', 
                      \`\${data.message}\`, data.agent, data.timestamp);
        });
        
        socket.on('file-locked', (data) => {
            addMessage('system', \`📁 \${data.agent} locked \${data.file}\`);
            updateFilesList();
        });
        
        socket.on('progress-update', (data) => {
            addMessage('agent', \`📊 Progress: \${data.progress}% - \${data.message}\`, data.agent);
        });
        
        function addMessage(type, message, agent = '', timestamp = '') {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}\`;
            
            const time = timestamp || new Date().toLocaleTimeString();
            
            messageDiv.innerHTML = \`
                <div class="message-header">
                    <span>\${agent ? '🤖 ' + agent : ''}</span>
                    <span class="timestamp">\${time}</span>
                </div>
                <div>\${message}</div>
            \`;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            messageCount++;
            updateStats();
        }
        
        function updateAgentsList() {
            // This would be populated by real agent data
            const agents = ['context-manager', 'python-pro', 'ai-engineer'];
            agentsList.innerHTML = agents.map(agent => \`
                <div class="agent-item">
                    <div class="agent-status status-active"></div>
                    <span>\${agent}</span>
                </div>
            \`).join('');
            document.getElementById('agentCount').textContent = agents.length;
        }
        
        function updateFilesList() {
            const files = [
                'email_intelligence_orchestrator.py',
                'gpt5_email_processor.py',
                'embedded_agents.py'
            ];
            filesList.innerHTML = files.map(file => \`
                <div class="file-item">📄 \${file}</div>
            \`).join('');
        }
        
        // Initialize
        addMessage('system', '🎯 Email Intelligence System initialization starting...');
        updateAgentsList();
        updateFilesList();
    </script>
</body>
</html>
        `);
    });

    // API Endpoints for agent communication
    app.post('/chat', (req, res) => {
        const { agent, message, status, file } = req.body;
        const timestamp = new Date().toLocaleTimeString();
        
        const chatMessage = {
            agent,
            message,
            status,
            file,
            timestamp
        };
        
        chatLog.push(chatMessage);
        io.emit('chat-message', chatMessage);
        
        console.log(`[${timestamp}] ${agent}: ${message}`);
        res.json({ success: true, timestamp });
    });

    app.post('/join', (req, res) => {
        const { agent, capabilities } = req.body;
        
        if (!agents.find(a => a.name === agent)) {
            agents.push({ name: agent, capabilities, status: 'active', joinedAt: new Date() });
            io.emit('agent-joined', { name: agent, capabilities });
            console.log(`Agent ${agent} joined with capabilities: ${capabilities}`);
        }
        
        res.json({ 
            success: true, 
            sessionId: SESSION_ID,
            chatUrl: `http://localhost:${PORT}/agent-chat-${SESSION_ID}`,
            agents: agents.length
        });
    });

    app.post('/lock-file', (req, res) => {
        const { agent, file } = req.body;
        
        if (fileLocks[file]) {
            res.json({ success: false, lockedBy: fileLocks[file] });
        } else {
            fileLocks[file] = agent;
            activeFiles[file] = { agent, lockedAt: new Date() };
            io.emit('file-locked', { agent, file });
            res.json({ success: true });
        }
    });

    app.post('/unlock-file', (req, res) => {
        const { agent, file } = req.body;
        
        if (fileLocks[file] === agent) {
            delete fileLocks[file];
            delete activeFiles[file];
            io.emit('file-unlocked', { agent, file });
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Not authorized to unlock this file' });
        }
    });

    app.post('/progress', (req, res) => {
        const { agent, progress, message } = req.body;
        
        io.emit('progress-update', { agent, progress, message });
        res.json({ success: true });
    });

    app.get('/status', (req, res) => {
        res.json({
            sessionId: SESSION_ID,
            port: PORT,
            agents,
            chatLog: chatLog.slice(-50), // Last 50 messages
            activeFiles,
            uptime: process.uptime()
        });
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log('Client connected to chat session');
        
        socket.emit('session-info', {
            sessionId: SESSION_ID,
            agents,
            recentMessages: chatLog.slice(-20)
        });
        
        socket.on('chat-message', (data) => {
            const message = {
                ...data,
                timestamp: new Date().toLocaleTimeString()
            };
            chatLog.push(message);
            io.emit('chat-message', message);
        });
    });

    server.listen(PORT, () => {
        console.log(`🚀 Agent Chat Server running on http://localhost:${PORT}/agent-chat-${SESSION_ID}`);
        console.log(`📊 Status API: http://localhost:${PORT}/status`);
        console.log(`🔧 Session ID: ${SESSION_ID}`);
        
        // Write connection info for agents
        fs.writeFileSync('chat_server_info.json', JSON.stringify({
            port: PORT,
            sessionId: SESSION_ID,
            chatUrl: `http://localhost:${PORT}/agent-chat-${SESSION_ID}`,
            apiBase: `http://localhost:${PORT}`,
            startedAt: new Date().toISOString()
        }, null, 2));
    });

    return { PORT, SESSION_ID };
}

// Start server
startChatServer().catch(console.error);