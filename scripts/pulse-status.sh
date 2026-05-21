#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

local_status=0
server_status=0

section() {
  printf '\n==> %s\n' "$1"
}

check_direct_local_endpoints() {
  local env_file="${PULSE_TEST_ENV_FILE:-.env.test}"
  if [[ ! -f "$env_file" ]]; then
    env_file=".env.test.example"
  fi
  if [[ ! -f "$env_file" ]]; then
    echo "direct local endpoints: unavailable (missing .env.test or .env.test.example)"
    return 1
  fi

  echo "==> direct local endpoints from $env_file"
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  node --input-type=module <<'NODE'
import net from 'node:net';
import pg from 'pg';

let ok = true;

const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('database: unavailable (DATABASE_URL_TEST or DATABASE_URL missing)');
  ok = false;
} else {
  const parsed = new URL(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  try {
    await pool.query('select 1');
    console.log(`database: ok ${parsed.host}${parsed.pathname}`);
  } catch (error) {
    console.log(`database: unavailable ${parsed.host}${parsed.pathname} (${error.code ?? error.message})`);
    ok = false;
  } finally {
    await pool.end();
  }
}

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
await new Promise((resolve) => {
  const socket = net.createConnection({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    timeout: 2000,
  });
  socket.once('connect', () => {
    console.log(`redis: ok ${redisUrl.host}`);
    socket.end();
    resolve();
  });
  socket.once('timeout', () => {
    console.log(`redis: unavailable ${redisUrl.host} (timeout)`);
    socket.destroy();
    ok = false;
    resolve();
  });
  socket.once('error', (error) => {
    console.log(`redis: unavailable ${redisUrl.host} (${error.code ?? error.message})`);
    ok = false;
    resolve();
  });
});

process.exit(ok ? 0 : 1);
NODE
}

section "Local test services"
if bash scripts/dev-services.sh status; then
  echo "local services: ok"
else
  if check_direct_local_endpoints; then
    echo "local services: reachable via configured endpoints"
    echo "Docker Compose services are not running; use npm run verify:local -- --no-services for this setup."
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
fi

section "Server deploy mirror"
if bash scripts/verify-server.sh; then
  echo "server mirror: ok"
else
  server_status=1
  cat <<'SERVER_HELP'
server mirror: unavailable or out of sync
Check VPN/network access, non-interactive SSH credentials, server PM2 status, and whether the server is on GitHub main.
If the failure is SSH auth, follow docs/ai/checklists/deploy-auth-recovery.md before retrying deploy or server verification.
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
