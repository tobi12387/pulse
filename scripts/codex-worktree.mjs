#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE = 'origin/main';
const DEFAULT_ROOT = '/tmp';

function usage() {
  return [
    'Usage: node scripts/codex-worktree.mjs <topic> [--base <ref>] [--root <dir>] [--dry-run]',
    '',
    'Creates a codex/<topic> branch in an isolated worktree so /root/pulse can stay',
    'as the clean server mirror on main.',
    'Internally runs git worktree add -b codex/<topic> <dir> <base> after a clean mirror check.',
    '',
    'Examples:',
    '  node scripts/codex-worktree.mjs fueling-capture-handoff',
    '  node scripts/codex-worktree.mjs ui-regression --root /tmp',
  ].join('\n');
}

export function slugifyTopic(topic) {
  const slug = String(topic ?? '')
    .trim()
    .toLowerCase()
    .replace(/^codex\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) {
    throw new Error('A non-empty topic is required.');
  }
  return slug;
}

export function worktreePlan(topic, options = {}) {
  const slug = slugifyTopic(topic);
  const base = options.base ?? DEFAULT_BASE;
  const root = options.root ?? DEFAULT_ROOT;
  const branch = `codex/${slug}`;
  const directory = path.join(root, `pulse-codex-${slug}`);
  return { slug, base, root, branch, directory };
}

function parseArgs(argv) {
  const args = [...argv];
  const options = { dryRun: false };
  let topic = null;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--base') {
      options.base = args.shift();
      continue;
    }
    if (arg === '--root') {
      options.root = args.shift();
      continue;
    }
    if (!topic) {
      topic = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!options.help && Object.hasOwn(options, 'base') && !options.base) {
    throw new Error('--base requires a value.');
  }
  if (!options.help && Object.hasOwn(options, 'root') && !options.root) {
    throw new Error('--root requires a value.');
  }

  return { topic, options };
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

function repoTopLevel(repoRoot) {
  return git(['-C', repoRoot, 'rev-parse', '--show-toplevel']).trim();
}

function ensureCleanMirror(repoRoot) {
  const status = git(['-C', repoRoot, 'status', '--porcelain']).trim();
  if (status) {
    throw new Error('Current checkout is dirty. Inspect it before creating a Codex worktree.');
  }

  const branch = git(['-C', repoRoot, 'branch', '--show-current']).trim();
  if (path.resolve(repoRoot) === '/root/pulse' && branch !== 'main') {
    throw new Error('/root/pulse is the server mirror and must stay on main. Switch it back before creating a worktree.');
  }
}

function printPlan(plan) {
  console.log(`branch=${plan.branch}`);
  console.log(`directory=${plan.directory}`);
  console.log(`base=${plan.base}`);
}

export function main(argv = process.argv.slice(2), repoRoot = process.cwd()) {
  const { topic, options } = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const plan = worktreePlan(topic, options);
  const topLevel = repoTopLevel(repoRoot);
  ensureCleanMirror(topLevel);

  printPlan(plan);
  if (options.dryRun) {
    console.log(`dry_run=git worktree add -b ${plan.branch} ${plan.directory} ${plan.base}`);
    return;
  }

  mkdirSync(plan.root, { recursive: true });
  git(['-C', topLevel, 'fetch', '--all', '--prune'], { stdio: 'inherit' });
  git(['-C', topLevel, 'worktree', 'add', '-b', plan.branch, plan.directory, plan.base], { stdio: 'inherit' });
  console.log(`next=cd ${plan.directory}`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.error(usage());
    process.exitCode = 1;
  }
}
