#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PULSE_TEST_ENV_FILE:-.env.test}"
WITH_E2E=false

for arg in "$@"; do
  case "$arg" in
    --with-e2e)
      WITH_E2E=true
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/verify-local.sh [--with-e2e]

Runs the local Pulse verification path:
  1. load .env.test, or .env.test.example if .env.test does not exist
  2. verify DATABASE_URL_TEST is separate and reachable
  3. run migration guard
  4. migrate the test database
  5. run backend tests
  6. run typecheck/build
  7. optionally run Playwright smoke tests with --with-e2e

Requirements:
  - npm dependencies installed
  - PostgreSQL reachable at DATABASE_URL_TEST
  - Redis reachable at REDIS_URL for integration tests that need it
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE=".env.test.example"
fi

echo "==> loading $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export NODE_ENV="${NODE_ENV:-test}"

node --input-type=module <<'NODE'
import net from 'node:net';
import pg from 'pg';

const { DATABASE_URL, DATABASE_URL_TEST } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!DATABASE_URL_TEST) throw new Error('DATABASE_URL_TEST is required');

const prod = new URL(DATABASE_URL);
const test = new URL(DATABASE_URL_TEST);
if (prod.pathname === test.pathname) {
  throw new Error('DATABASE_URL_TEST must not point at the same database as DATABASE_URL');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL_TEST, connectionTimeoutMillis: 3000 });
try {
  await pool.query('select 1');
} catch (error) {
  console.error(`Cannot connect to DATABASE_URL_TEST (${test.host}${test.pathname}).`);
  console.error('Start the local Postgres test database or adjust .env.test.');
  process.exitCode = 1;
} finally {
  await pool.end();
}

if (process.exitCode) process.exit(process.exitCode);

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
await new Promise((resolve, reject) => {
  const socket = net.createConnection({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    timeout: 3000,
  });
  socket.once('connect', () => {
    socket.end();
    resolve(undefined);
  });
  socket.once('timeout', () => {
    socket.destroy();
    reject(new Error('timeout'));
  });
  socket.once('error', reject);
}).catch(() => {
  console.error(`Cannot connect to REDIS_URL (${redisUrl.host}).`);
  console.error('Start local Redis or adjust .env.test.');
  process.exit(1);
});
NODE

echo "==> migration guard"
npm run check:migrations

echo "==> test database migrations"
DATABASE_URL="$DATABASE_URL_TEST" npm run db:migrate -w backend

echo "==> backend tests"
npm test

echo "==> typecheck/build"
npm run typecheck

if [[ "$WITH_E2E" == "true" ]]; then
  echo "==> browser smoke tests"
  npm run test:e2e
fi

echo "==> local verification complete"
