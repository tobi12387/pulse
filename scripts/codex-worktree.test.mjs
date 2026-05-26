import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { main, slugifyTopic, worktreePlan } from './codex-worktree.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'codex-worktree.mjs');

test('slugifyTopic normalizes Codex branch topics', () => {
  assert.equal(slugifyTopic('Fueling Capture Handoff'), 'fueling-capture-handoff');
  assert.equal(slugifyTopic('codex/Server Mirror Fix'), 'server-mirror-fix');
  assert.throws(() => slugifyTopic('   '), /non-empty topic/);
});

test('worktreePlan keeps /root/pulse on main by using an isolated directory', () => {
  assert.deepEqual(worktreePlan('Server Mirror Fix', { base: 'origin/main', root: '/tmp' }), {
    slug: 'server-mirror-fix',
    base: 'origin/main',
    root: '/tmp',
    branch: 'codex/server-mirror-fix',
    directory: '/tmp/pulse-codex-server-mirror-fix',
  });
});

test('codex-worktree help documents the isolated worktree workflow', () => {
  const output = execFileSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });

  assert.match(output, /git worktree/i);
  assert.match(output, /\/root\/pulse can stay/);
  assert.match(output, /node scripts\/codex-worktree\.mjs fueling-capture-handoff/);
});

test('codex-worktree dry run prints the branch and directory without adding a worktree', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'pulse-codex-worktree-repo-'));
  const root = mkdtempSync(path.join(tmpdir(), 'pulse-codex-worktree-root-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo, stdio: 'ignore' });

  const output = [];
  const originalLog = console.log;
  console.log = (line = '') => output.push(String(line));
  try {
    main(['Dry Run Topic', '--dry-run', '--root', root], repo);
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(output, [
    'branch=codex/dry-run-topic',
    `directory=${path.join(root, 'pulse-codex-dry-run-topic')}`,
    'base=origin/main',
    `dry_run=git worktree add -b codex/dry-run-topic ${path.join(root, 'pulse-codex-dry-run-topic')} origin/main`,
  ]);
});
