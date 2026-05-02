import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('./dev-services.sh', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const verifyLocalScript = readFileSync(new URL('./verify-local.sh', import.meta.url), 'utf8');
const pulseStatusScript = readFileSync(new URL('./pulse-status.sh', import.meta.url), 'utf8');

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

test('package exposes one Pulse status command', () => {
  assert.equal(packageJson.scripts['pulse:status'], 'bash scripts/pulse-status.sh');
});

test('pulse-status checks local services and server health independently', () => {
  assert.match(pulseStatusScript, /Local test services/);
  assert.match(pulseStatusScript, /Server deploy mirror/);
  assert.match(pulseStatusScript, /bash scripts\/dev-services\.sh status/);
  assert.match(pulseStatusScript, /bash scripts\/verify-server\.sh/);
  assert.match(pulseStatusScript, /local_status=0/);
  assert.match(pulseStatusScript, /server_status=0/);
});

test('verify-local prints local service remediation before DB checks', () => {
  assert.match(verifyLocalScript, /env file:/);
  assert.match(verifyLocalScript, /start services:/);
  assert.match(verifyLocalScript, /npm run services:up/);
  assert.match(verifyLocalScript, /Docker Desktop/);
});
