import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'server-log-attention.mjs');

function run(input, args = ['--since', '2026-05-12T17:00:00.000Z']) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    input,
    encoding: 'utf8',
  });
}

test('server-log-attention counts only timestamped attention after the since time', () => {
  const input = [
    'ERROR: (429), Too Many Requests, {"timestamp":"2026-04-30T06:00:01.000Z","error":"Cloudflare"}',
    'ERROR: (500), Internal Server Error, {"timestamp":"2026-05-12T17:02:00.000Z","error":"ClientAuthorizationException"}',
    '5:12:15 AM [vite] http proxy error: /api/garmin/status',
    'plain healthy line',
  ].join('\n');

  assert.equal(
    run(input),
    'recent_attention=1 stale_attention=1 undated_attention=1\n',
  );
});

test('server-log-attention treats attention at the boundary as recent', () => {
  const input = [
    'ERROR: (404), Not Found, {"timestamp":"2026-05-12T17:00:00.000Z","path":"/api/garmin/status"}',
  ].join('\n');

  assert.equal(
    run(input),
    'recent_attention=1 stale_attention=0 undated_attention=0\n',
  );
});
