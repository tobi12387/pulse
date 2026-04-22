module.exports = {
  apps: [{
    name: 'coaching-os-v2',
    script: './backend/dist/server.js',
    cwd: '/root/coaching-os-v2',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/root/.pm2/logs/coaching-os-v2-error.log',
    out_file: '/root/.pm2/logs/coaching-os-v2-out.log',
  }]
};
