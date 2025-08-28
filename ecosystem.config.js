module.exports = {
  apps: [
    {
      name: 'apple-mail-backend',
      script: './server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      autorestart: true,
      restart_delay: 1000,
      min_uptime: '10s',
      max_restarts: 3
    },
    {
      name: 'apple-mail-frontend',
      script: 'npm',
      args: 'start',
      cwd: './dashboard/frontend',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        BROWSER: 'none'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        BROWSER: 'none'
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: '../../logs/frontend-error.log',
      out_file: '../../logs/frontend-out.log',
      log_file: '../../logs/frontend-combined.log',
      time: true,
      autorestart: true,
      restart_delay: 1000,
      min_uptime: '10s',
      max_restarts: 3
    },
    {
      name: 'apple-mail-sync',
      script: './start-sync-service.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/sync-error.log',
      out_file: './logs/sync-out.log',
      log_file: './logs/sync-combined.log',
      time: true,
      autorestart: true,
      restart_delay: 5000,
      min_uptime: '30s',
      max_restarts: 5,
      cron_restart: '0 */6 * * *'  // Restart every 6 hours to prevent memory leaks
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/apple-mail-task-manager.git',
      path: '/var/www/apple-mail-task-manager',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};