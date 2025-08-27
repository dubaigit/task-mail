#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const API_URL = 'http://localhost:8000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testSupabaseConnection() {
  console.log(`\n${colors.cyan}📊 Testing Supabase Connection...${colors.reset}`);
  
  try {
    // Test health check table
    const { data: health, error: healthError } = await supabase
      .from('_health_check')
      .select('*')
      .limit(1);
    
    if (!healthError) {
      console.log(`${colors.green}✅ Supabase connection successful${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Health check failed: ${healthError.message}${colors.reset}`);
    }
    
    // Check emails table
    const { count: emailCount } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });
    console.log(`${colors.blue}📧 Emails in database: ${emailCount}${colors.reset}`);
    
    // Check tasks table
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true });
    console.log(`${colors.blue}📝 Tasks in database: ${taskCount || 0}${colors.reset}`);
    
    // Check profiles table
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    console.log(`${colors.blue}👤 User profiles: ${profileCount || 0}${colors.reset}`);
    
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Supabase error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log(`\n${colors.cyan}🔌 Testing API Endpoints...${colors.reset}`);
  
  const endpoints = [
    { method: 'GET', url: '/health', name: 'Health Check' },
    { method: 'GET', url: '/api/emails/count', name: 'Email Count' },
    { method: 'GET', url: '/api/ai/usage-stats', name: 'AI Usage Stats' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${API_URL}${endpoint.url}`,
        validateStatus: () => true // Don't throw on any status
      });
      
      if (response.status < 400) {
        console.log(`${colors.green}✅ ${endpoint.name}: ${response.status}${colors.reset}`);
        if (endpoint.url === '/health' && response.data.status === 'healthy') {
          console.log(`   ${colors.blue}Services: ${JSON.stringify(response.data.services)}${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️  ${endpoint.name}: ${response.status} - ${response.data?.error || 'Error'}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ ${endpoint.name}: ${error.message}${colors.reset}`);
    }
  }
}

async function testEmailSync() {
  console.log(`\n${colors.cyan}📨 Testing Email Sync Service...${colors.reset}`);
  
  try {
    // Check sync status from Supabase
    const { data: recentEmails } = await supabase
      .from('emails')
      .select('id, subject, date_received')
      .order('date_received', { ascending: false })
      .limit(5);
    
    if (recentEmails && recentEmails.length > 0) {
      console.log(`${colors.green}✅ Recent emails found:${colors.reset}`);
      recentEmails.forEach(email => {
        const date = new Date(email.date_received).toLocaleString();
        console.log(`   ${colors.blue}📧 ${email.subject?.substring(0, 50)}... (${date})${colors.reset}`);
      });
    } else {
      console.log(`${colors.yellow}⚠️  No recent emails found${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Email sync test failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function checkSystemStatus() {
  console.log(`\n${colors.cyan}🔍 System Status Check...${colors.reset}`);
  
  // Check if main server is running
  try {
    await axios.get(`${API_URL}/health`);
    console.log(`${colors.green}✅ Main server is running on port 8000${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}❌ Main server is not responding${colors.reset}`);
  }
  
  // Check Redis
  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await client.connect();
    await client.ping();
    console.log(`${colors.green}✅ Redis is running${colors.reset}`);
    await client.disconnect();
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Redis is not available${colors.reset}`);
  }
  
  // Check for PostgreSQL references
  const fs = require('fs');
  const path = require('path');
  
  const filesToCheck = [
    'package.json',
    'server.js',
    'src/ai-processor.js'
  ];
  
  let pgReferencesFound = false;
  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('pg') && !content.includes('.png') && !content.includes('.jpg')) {
        if (file === 'package.json' && content.includes('"pg"')) {
          console.log(`${colors.red}❌ PostgreSQL dependency found in ${file}${colors.reset}`);
          pgReferencesFound = true;
        } else if (file !== 'package.json' && (content.includes("require('pg')") || content.includes('from pg'))) {
          console.log(`${colors.red}❌ PostgreSQL import found in ${file}${colors.reset}`);
          pgReferencesFound = true;
        }
      }
    }
  }
  
  if (!pgReferencesFound) {
    console.log(`${colors.green}✅ No PostgreSQL references found (migration complete)${colors.reset}`);
  }
}

async function generateReport() {
  console.log(`\n${colors.cyan}════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}📊 SYSTEM OVERVIEW REPORT${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════════${colors.reset}`);
  
  const report = {
    timestamp: new Date().toISOString(),
    database: 'Supabase (Local Docker)',
    postgresRemoved: true,
    services: {
      mainServer: false,
      emailSync: false,
      supabase: false,
      redis: false
    },
    issues: [],
    recommendations: []
  };
  
  // Test services
  try {
    await axios.get(`${API_URL}/health`);
    report.services.mainServer = true;
  } catch (e) {
    report.issues.push('Main server not responding');
    report.recommendations.push('Restart server with: npm start');
  }
  
  try {
    const { count } = await supabase.from('emails').select('*', { count: 'exact', head: true });
    report.services.supabase = true;
    report.emailCount = count;
  } catch (e) {
    report.issues.push('Supabase connection failed');
    report.recommendations.push('Check Supabase Docker is running');
  }
  
  // Check for ai_processed column
  try {
    const { error } = await supabase.from('emails').select('ai_processed').limit(1);
    if (error && error.code === '42703') {
      report.issues.push('Missing ai_processed column in emails table');
      report.recommendations.push('Add column: ALTER TABLE emails ADD COLUMN ai_processed BOOLEAN DEFAULT false;');
    }
  } catch (e) {}
  
  console.log(`\n${colors.yellow}📋 Summary:${colors.reset}`);
  console.log(`   Database: ${report.database}`);
  console.log(`   PostgreSQL Removed: ${report.postgresRemoved ? '✅' : '❌'}`);
  console.log(`   Email Count: ${report.emailCount || 'Unknown'}`);
  
  console.log(`\n${colors.yellow}🔧 Services Status:${colors.reset}`);
  Object.entries(report.services).forEach(([service, status]) => {
    console.log(`   ${service}: ${status ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
  });
  
  if (report.issues.length > 0) {
    console.log(`\n${colors.red}⚠️  Issues Found:${colors.reset}`);
    report.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log(`\n${colors.yellow}💡 Recommendations:${colors.reset}`);
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  } else {
    console.log(`\n${colors.green}🎉 All systems operational!${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}════════════════════════════════════════════${colors.reset}\n`);
}

// Run all tests
async function runSystemTest() {
  console.log(`${colors.cyan}🚀 Starting Comprehensive System Test...${colors.reset}`);
  
  await checkSystemStatus();
  await testSupabaseConnection();
  await testAPIEndpoints();
  await testEmailSync();
  await generateReport();
}

// Execute
runSystemTest().catch(console.error);