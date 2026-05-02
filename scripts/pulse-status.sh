#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

local_status=0
server_status=0

section() {
  printf '\n==> %s\n' "$1"
}

section "Local test services"
if bash scripts/dev-services.sh status; then
  echo "local services: ok"
else
  local_status=1
  cat <<'LOCAL_HELP'
local services: unavailable
To run DB/Redis-bound tests locally:
  1. Start Docker Desktop.
  2. Run npm run services:up.
  3. Re-run npm run pulse:status or npm run verify:local.

When Docker is intentionally unavailable, use CI/server verification for DB-bound behavior and state this in the PR.
LOCAL_HELP
fi

section "Server deploy mirror"
if bash scripts/verify-server.sh; then
  echo "server mirror: ok"
else
  server_status=1
  cat <<'SERVER_HELP'
server mirror: unavailable or out of sync
Check VPN/network access, SSH credentials, server PM2 status, and whether the server is on GitHub main.
SERVER_HELP
fi

section "Pulse status summary"
echo "local_status=$local_status"
echo "server_status=$server_status"

if [[ "$local_status" -eq 0 && "$server_status" -eq 0 ]]; then
  echo "pulse status: ok"
  exit 0
fi

echo "pulse status: attention required"
exit 1
