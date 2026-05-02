module.exports = {
  apps: [
    {
      name: 'pulse',
      script: 'node',
      args: '--env-file=/root/pulse/.env /root/pulse/backend/dist/server.js',
      cwd: '/root/pulse/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/root/.pm2/logs/pulse-error.log',
      out_file: '/root/.pm2/logs/pulse-out.log',
    },
    {
      name: 'pulse-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5175',
      cwd: '/root/pulse/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/root/.pm2/logs/pulse-frontend-error.log',
      out_file: '/root/.pm2/logs/pulse-frontend-out.log',
    },
  ],
};
