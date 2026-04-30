#!/usr/bin/env bash
set -euo pipefail

HOST="${PULSE_HOST:-root@192.168.178.46}"
APP_PATH="${PULSE_PATH:-/root/pulse}"
URL="${PULSE_URL:-https://192.168.178.46}"

usage() {
  cat <<USAGE
Usage: $0 <command>

Commands:
  status      Show server git, PM2, Docker, and Nginx site status
  health      Check server-local and LAN HTTPS health endpoints
  deploy      Run the canonical server deploy script, then check health
  build       Run npm run build on the server
  test        Run npm test on the server
  logs        Show recent PM2 and Nginx logs
  nginx       Validate Nginx and show enabled sites
  pm2         Show PM2 status
USAGE
}

ssh_pulse() {
  ssh "$HOST" "$@"
}

server_status() {
  ssh_pulse "cd '$APP_PATH' && \
    echo '--- git ---' && git status --short --branch && git log --oneline --decorate -3 && \
    echo '--- pm2 ---' && pm2 status --no-color && \
    echo '--- docker ---' && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' && \
    echo '--- nginx sites ---' && ls -l /etc/nginx/sites-enabled"
}

health() {
  ssh_pulse "echo '--- server local ---' && curl -sk https://127.0.0.1/api/ping && echo"
  echo "--- lan ---"
  curl -sk "$URL/api/ping"
  echo
}

deploy() {
  ssh_pulse "cd '$APP_PATH' && \
    bash scripts/deploy.sh && \
    curl -sk https://127.0.0.1/api/ping"
  echo
  curl -sk "$URL/api/ping"
  echo
}

logs() {
  ssh_pulse "echo '--- pm2 pulse error ---' && tail -120 /root/.pm2/logs/pulse-error.log 2>/dev/null || true; \
    echo '--- pm2 pulse out ---' && tail -80 /root/.pm2/logs/pulse-out.log 2>/dev/null || true; \
    echo '--- nginx error ---' && tail -80 /var/log/nginx/error.log 2>/dev/null || true"
}

case "${1:-}" in
  status) server_status ;;
  health) health ;;
  deploy) deploy ;;
  build) ssh_pulse "cd '$APP_PATH' && npm run build" ;;
  test) ssh_pulse "cd '$APP_PATH' && npm test" ;;
  logs) logs ;;
  nginx) ssh_pulse "nginx -t && ls -l /etc/nginx/sites-enabled && sed -n '1,220p' /etc/nginx/sites-available/pulse" ;;
  pm2) ssh_pulse "pm2 status --no-color" ;;
  ""|-h|--help|help) usage ;;
  *) usage; exit 2 ;;
esac
