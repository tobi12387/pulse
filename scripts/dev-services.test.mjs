import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('./dev-services.sh', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const verifyLocalScript = readFileSync(new URL('./verify-local.sh', import.meta.url), 'utf8');
const verifyServerScript = readFileSync(new URL('./verify-server.sh', import.meta.url), 'utf8');
const pulseStatusScript = readFileSync(new URL('./pulse-status.sh', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('./deploy.sh', import.meta.url), 'utf8');
const pulseOpsScript = readFileSync(new URL('../plugins/pulse-ops/scripts/pulse_ops.sh', import.meta.url), 'utf8');
const pulseOpsSkill = readFileSync(new URL('../plugins/pulse-ops/skills/pulse-ops/SKILL.md', import.meta.url), 'utf8');
const pm2Config = readFileSync(new URL('../pm2.config.js', import.meta.url), 'utf8');

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
  assert.equal(packageJson.name, 'pulse');
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

test('verify-server surfaces PM2 restart and recent log attention signals', () => {
  assert.match(verifyServerScript, /restarts=\$\{restarts\}/);
  assert.match(verifyServerScript, /unstable_restarts=\$\{unstableRestarts\}/);
  assert.match(verifyServerScript, /recent server log signals/);
  assert.match(verifyServerScript, /recent_attention=/);
  assert.match(verifyServerScript, /Too Many Requests\|Cloudflare\|ClientAuthorizationException\|ECONNREFUSED\|ECONNRESET\|\/api\/garmin\/status/);
});

test('verify-local prints local service remediation before DB checks', () => {
  assert.match(verifyLocalScript, /env file:/);
  assert.match(verifyLocalScript, /start services:/);
  assert.match(verifyLocalScript, /npm run services:up/);
  assert.match(verifyLocalScript, /Docker Desktop/);
});

test('deploy preserves HTTPS by provisioning frontend certs after git pull', () => {
  assert.match(deployScript, /ensure_frontend_tls_certs/);
  assert.match(deployScript, /FRONTEND_CERT_DIR/);
  assert.match(deployScript, /192\.168\.178\.46\+2-key\.pem/);
  assert.match(deployScript, /openssl/);
  assert.match(deployScript, /backup_frontend_tls_ca/);
  assert.match(deployScript, /generate_frontend_leaf_cert/);
  assert.match(deployScript, /Pulse Local Root CA/);
  assert.match(deployScript, /git pull --ff-only origin "\$BRANCH"/);
  assert.match(deployScript, /ensure_frontend_tls_certs/);
});

test('pulse ops checks the active LAN frontend and Pulse health endpoint', () => {
  assert.match(pulseOpsScript, /https:\/\/192\.168\.178\.46:5175/);
  assert.match(pulseOpsScript, /HEALTH_PATH="\$\{PULSE_HEALTH_PATH:-\/api\/pulse\/health\}"/);
  assert.match(pulseOpsScript, /http:\/\/127\.0\.0\.1:3000\$HEALTH_PATH/);
  assert.match(pulseOpsSkill, /https:\/\/192\.168\.178\.46:5175/);
  assert.match(pulseOpsSkill, /\/api\/pulse\/health/);
});

test('pm2 config manages backend and frontend Pulse processes', () => {
  assert.match(pm2Config, /name: 'pulse'/);
  assert.match(pm2Config, /name: 'pulse-frontend'/);
  assert.match(pm2Config, /run preview -- --host 0\.0\.0\.0 --port 5175/);
  assert.match(deployScript, /pm2 startOrReload pm2\.config\.js --only "\$PM2_PROC"/);
  assert.match(deployScript, /pm2 startOrReload pm2\.config\.js --only "\$PM2_FRONTEND_PROC"/);
});
