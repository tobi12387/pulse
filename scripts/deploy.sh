#!/usr/bin/env bash
# Pulse — server deploy script.
# Run on the server (root@192.168.178.46) inside /root/pulse.
# Pulls latest main, rebuilds shared/backend/frontend, restarts PM2 processes.

set -euo pipefail

REPO_DIR="/root/pulse"
BRANCH="main"
PM2_PROC="pulse"
PM2_FRONTEND_PROC="pulse-frontend"

cd "$REPO_DIR"

echo "==> fetching"
git fetch --prune origin

echo "==> verifying clean tree on $BRANCH"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree dirty. Server must be a read-only mirror of origin/$BRANCH." >&2
  git status --short >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "ERROR: server is on '$current_branch', expected '$BRANCH'." >&2
  exit 1
fi

echo "==> fast-forward pull"
git pull --ff-only origin "$BRANCH"

echo "==> install workspace dependencies"
cd "$REPO_DIR"
npm ci --no-audit --no-fund

echo "==> shared build"
npm run build -w shared

echo "==> backend build"
npm run build -w backend

echo "==> frontend build"
npm run build -w frontend

echo "==> database migrations"
npm run db:migrate -w backend

echo "==> pm2 restart $PM2_PROC"
pm2 restart "$PM2_PROC" --update-env

if pm2 describe "$PM2_FRONTEND_PROC" >/dev/null 2>&1; then
  echo "==> pm2 restart $PM2_FRONTEND_PROC"
  pm2 restart "$PM2_FRONTEND_PROC" --update-env
else
  echo "==> pm2 process $PM2_FRONTEND_PROC not found; skipping frontend restart"
fi

echo "==> deploy done: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
