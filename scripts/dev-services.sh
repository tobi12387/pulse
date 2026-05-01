#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TEST_DB="${PULSE_TEST_DB_NAME:-coaching_os_v2_test}"

usage() {
  cat <<'USAGE'
Usage: scripts/dev-services.sh <up|down|restart|status>

Manages the local Pulse test services through docker compose:
  up       start Postgres and Redis, wait for health, create coaching_os_v2_test
  down     stop local compose services
  restart  down then up
  status   show compose status and service health checks

Requirements:
  - Docker Desktop or a compatible Docker CLI with `docker compose`
USAGE
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is required for local Pulse test services. Install/start Docker Desktop, then rerun this command."
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose is required. Docker Desktop normally includes it; verify that 'docker compose version' works."
  fi
}

validate_test_database_name() {
  if [[ ! "$TEST_DB" =~ ^[a-zA-Z0-9_]+$ ]]; then
    fail "PULSE_TEST_DB_NAME must contain only letters, numbers, and underscores."
  fi
}

wait_for_postgres() {
  echo "==> waiting for postgres"
  for _ in {1..60}; do
    if docker compose exec -T postgres pg_isready -U postgres -d coaching_os_v2 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "Postgres did not become ready on localhost:5433."
}

wait_for_redis() {
  echo "==> waiting for redis"
  for _ in {1..60}; do
    if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "Redis did not become ready on localhost:6380."
}

ensure_test_database() {
  validate_test_database_name
  echo "==> ensuring test database: $TEST_DB"
  if docker compose exec -T postgres psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB'" | grep -q 1; then
    return 0
  fi
  docker compose exec -T postgres createdb -U postgres "$TEST_DB"
}

cmd="${1:-}"
case "$cmd" in
  up)
    require_docker
    echo "==> starting postgres and redis"
    docker compose up -d postgres redis
    wait_for_postgres
    wait_for_redis
    ensure_test_database
    echo "==> local Pulse test services ready"
    ;;
  down)
    require_docker
    docker compose down
    ;;
  restart)
    require_docker
    docker compose down
    "$0" up
    ;;
  status)
    require_docker
    docker compose ps postgres redis
    docker compose exec -T postgres pg_isready -U postgres -d coaching_os_v2
    docker compose exec -T redis redis-cli ping
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
