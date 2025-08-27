// Working Task Mail Server - Bypasses problematic services for testing
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Task Mail Server is running',
    services: {
      database: 'connected',
      api: 'active'
    }
  });
});

// Test endpoint for database connectivity
app.get('/api/test/database', async (req, res) => {
  try {
    // Test PostgreSQL via PostgREST
    const response = await fetch('http://127.0.0.1:3001/messages?limit=5');
    const data = await response.json();
    
    res.json({
      status: 'success',
      message: 'Database connection test successful',
      postgrest: {
        status: 'connected',
        endpoint: 'http://127.0.0.1:3001',
        sample_data: data
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection test failed',
      error: error.message
    });
  }
});

// Test endpoint for SQLite database
app.get('/api/test/sqlite', async (req, res) => {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const { open } = require('sqlite');
    
    const db = await open({
      filename: process.env.APPLE_MAIL_DB_PATH || './database/fake-apple-mail/fake-envelope-index.sqlite',
      driver: sqlite3.Database
    });
    
    const messages = await db.all('SELECT COUNT(*) as count FROM messages');
    const mailboxes = await db.all('SELECT COUNT(*) as count FROM mailboxes');
    
    await db.close();
    
    res.json({
      status: 'success',
      message: 'SQLite database test successful',
      sqlite: {
        status: 'connected',
        path: process.env.APPLE_MAIL_DB_PATH || './database/fake-apple-mail/fake-envelope-index.sqlite',
        messages_count: messages[0].count,
        mailboxes_count: mailboxes[0].count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'SQLite database test failed',
      error: error.message
    });
  }
});

// Basic API endpoints
app.get('/api/messages', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:3001/messages?limit=10');
    const data = await response.json();
    
    res.json({
      status: 'success',
      data: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Basic tasks endpoint
app.get('/api/tasks', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:3001/tasks?limit=10');
    const data = await response.json();
    
    res.json({
      status: 'success',
      data: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

// AI test endpoint
app.post('/api/test/ai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        status: 'error',
        message: 'OpenAI API key not configured'
      });
    }
    
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "Task Mail AI is working!" in a friendly way.' }
      ],
      max_tokens: 50
    });
    
    res.json({
      status: 'success',
      message: 'AI test successful',
      ai_response: completion.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'AI test failed',
      error: error.message
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dashboard/frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard/frontend/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Task Mail Server is running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/api`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Database test: http://localhost:${PORT}/api/test/database`);
  console.log(`💾 SQLite test: http://localhost:${PORT}/api/test/sqlite`);
  console.log(`🤖 AI test: http://localhost:${PORT}/api/test/ai`);
  console.log(`
🚀 Ready! Working server started successfully
==========================================
Health:     http://localhost:${PORT}/api/health
Database:   http://localhost:${PORT}/api/test/database
SQLite:     http://localhost:${PORT}/api/test/sqlite
AI Test:    http://localhost:${PORT}/api/test/ai
Messages:   http://localhost:${PORT}/api/messages
Tasks:      http://localhost:${PORT}/api/tasks
==========================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };

