module.exports = {
  apps: [{
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
  }]
};
