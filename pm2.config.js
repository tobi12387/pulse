module.exports = {
  apps: [{
    name: 'coaching-os-v2',
    script: 'node',
    args: '--env-file=/root/coaching-os-v2/.env /root/coaching-os-v2/backend/dist/server.js',
    cwd: '/root/coaching-os-v2',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/root/.pm2/logs/coaching-os-v2-error.log',
    out_file: '/root/.pm2/logs/coaching-os-v2-out.log',
  }]
};
