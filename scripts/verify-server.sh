#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${PULSE_HOST:-root@192.168.178.46}"
APP_PATH="${PULSE_PATH:-/root/pulse}"
URL="${PULSE_URL:-https://192.168.178.46:5175}"
BACKEND_PROC="${PULSE_PM2_BACKEND:-pulse}"
FRONTEND_PROC="${PULSE_PM2_FRONTEND:-pulse-frontend}"
EXPECTED_COMMIT="${PULSE_EXPECTED_COMMIT:-$(git rev-parse --short HEAD)}"

usage() {
  cat <<'USAGE'
Usage: scripts/verify-server.sh

Environment overrides:
  PULSE_HOST             SSH target, default root@192.168.178.46
  PULSE_PATH             Server project path, default /root/pulse
  PULSE_URL              Public LAN URL, default https://192.168.178.46:5175
  PULSE_PM2_BACKEND      Backend PM2 process, default pulse
  PULSE_PM2_FRONTEND     Frontend PM2 process, default pulse-frontend
  PULSE_EXPECTED_COMMIT  Expected short commit, default local HEAD

Checks:
  - server worktree is clean on main
  - server commit matches PULSE_EXPECTED_COMMIT
  - backend and frontend PM2 processes are online
  - public HTTPS root returns 200
  - /api/ping returns status ok
  - /api/pulse/health returns status ok
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "==> server git status"
server_info="$(ssh "$HOST" "cd '$APP_PATH' && \
  branch=\$(git rev-parse --abbrev-ref HEAD) && \
  commit=\$(git rev-parse --short HEAD) && \
  dirty=\$(git status --porcelain | wc -l | tr -d ' ') && \
  printf '%s %s %s\n' \"\$branch\" \"\$commit\" \"\$dirty\"")"
read -r server_branch server_commit dirty_count <<<"$server_info"

echo "branch=$server_branch commit=$server_commit dirty=$dirty_count"
[[ "$server_branch" == "main" ]] || fail "server branch is '$server_branch', expected main"
[[ "$dirty_count" == "0" ]] || fail "server worktree is dirty"
[[ "$server_commit" == "$EXPECTED_COMMIT" ]] || fail "server commit $server_commit != expected $EXPECTED_COMMIT"

echo "==> pm2 status"
pm2_json="$(ssh "$HOST" "pm2 jlist")"
PM2_JSON="$pm2_json" node --input-type=module - "$BACKEND_PROC" "$FRONTEND_PROC" <<'NODE'
const apps = JSON.parse(process.env.PM2_JSON ?? '[]');
const required = process.argv.slice(2);
for (const name of required) {
  const app = apps.find(item => item.name === name);
  if (!app) {
    console.error(`Missing PM2 process: ${name}`);
    process.exit(1);
  }
  const status = app.pm2_env?.status;
  console.log(`${name}: ${status}`);
  if (status !== 'online') process.exit(1);
}
NODE

echo "==> public frontend"
http_code="$(curl -ksS -o /dev/null -w '%{http_code}' "$URL")"
echo "$URL -> $http_code"
[[ "$http_code" == "200" ]] || fail "frontend returned HTTP $http_code"

echo "==> api ping"
ping_body="$(curl -ksS "$URL/api/ping")"
echo "$ping_body"
node --input-type=module -e "const body = JSON.parse(process.argv[1]); if (body.status !== 'ok') process.exit(1)" "$ping_body" \
  || fail "/api/ping did not return status ok"

echo "==> pulse health"
health_body="$(curl -ksS "$URL/api/pulse/health")"
echo "$health_body"
node --input-type=module -e "const body = JSON.parse(process.argv[1]); if (body.status !== 'ok') process.exit(1)" "$health_body" \
  || fail "/api/pulse/health did not return status ok"

echo "==> server verification complete: $server_commit"
