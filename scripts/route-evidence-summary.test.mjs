import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'route-evidence-summary.mjs');

test('route-evidence-summary reports screenshots and overflow by project', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pulse-route-evidence-'));
  const projectDir = path.join(root, '2026-05-12-deadbee', 'mobile-chromium');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(path.join(projectDir, 'manifest.json'), `${JSON.stringify({
    date: '2026-05-12',
    commit: 'deadbee',
    project: 'mobile-chromium',
    baseURL: 'https://example.test',
    screenshots: [
      {
        label: 'home',
        route: '/',
        file: '/tmp/home.png',
        overflow: { horizontalOverflow: false, overflowingNodes: [] },
      },
      {
        label: 'plan',
        route: '/plan',
        file: '/tmp/plan.png',
        overflow: {
          horizontalOverflow: true,
          overflowingNodes: [{ tag: 'div', text: 'wide row', left: 0, right: 430, width: 430 }],
        },
      },
    ],
  }, null, 2)}\n`);

  const output = execFileSync(process.execPath, [scriptPath, root], { encoding: 'utf8' });

  assert.match(output, /Route Evidence Summary/);
  assert.match(output, /mobile-chromium/);
  assert.match(output, /screenshots: 2/);
  assert.match(output, /overflow: 1/);
  assert.match(output, /\/plan/);
});
