module.exports = {
  apps: [{
    name: 'apple-mcp',
    script: 'server.js',
    instances: 1, // Single instance for Apple Mail access
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 10000,
    listen_timeout: 10000,
    // Health monitoring
    min_uptime: '10s',
    max_restarts: 5,
    // Resource monitoring
    monitoring: false, // Set to true if you have PM2 Plus
    // Advanced settings
    node_args: '--max-old-space-size=1024',
    exec_mode: 'fork', // Required for Apple Mail access
    // Environment file
    env_file: '.env',
    // Graceful shutdown
    wait_ready: true,
    shutdown_with_message: true
  }]
};
