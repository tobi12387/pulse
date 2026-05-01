import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('./dev-services.sh', import.meta.url), 'utf8');

test('dev-services script manages local Postgres and Redis through docker compose', () => {
  assert.match(script, /Usage: scripts\/dev-services\.sh/);
  assert.match(script, /docker compose up -d postgres redis/);
  assert.match(script, /coaching_os_v2_test/);
  assert.match(script, /pg_isready/);
  assert.match(script, /redis-cli ping/);
});

test('dev-services script fails clearly when Docker is unavailable', () => {
  assert.match(script, /Docker is required/);
  assert.match(script, /Docker Desktop/);
});

test('dev-services script validates the configurable test database name before SQL use', () => {
  assert.match(script, /PULSE_TEST_DB_NAME must contain only letters, numbers, and underscores/);
  assert.match(script, /\^\[a-zA-Z0-9_\]\+\$/);
  assert.match(script, /validate_test_database_name/);
});
