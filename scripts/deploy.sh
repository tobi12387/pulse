#!/usr/bin/env bash
# Pulse — server deploy script.
# Run on the server (root@192.168.178.46) inside /root/pulse.
# Pulls latest main, rebuilds backend, restarts PM2. Frontend is served by Vite dev server (separate process).

set -euo pipefail

REPO_DIR="/root/pulse"
BRANCH="main"
PM2_PROC="pulse"

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
npm install --no-audit --no-fund

echo "==> shared build"
npm run build -w shared

echo "==> backend build"
npm run build -w backend

echo "==> pm2 restart $PM2_PROC"
pm2 restart "$PM2_PROC" --update-env

echo "==> deploy done: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
