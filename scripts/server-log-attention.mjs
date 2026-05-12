#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const ATTENTION_PATTERN = /Too Many Requests|Cloudflare|ClientAuthorizationException|ECONNREFUSED|ECONNRESET|\/api\/garmin\/status/i;
const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;

function parseArgs(argv) {
  const args = { since: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--since') {
      args.since = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      console.log('Usage: server-log-attention.mjs --since <ISO timestamp>');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function parseTimestamp(line) {
  const match = line.match(ISO_TIMESTAMP_PATTERN);
  if (!match) return null;
  const timestamp = Date.parse(match[0]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function summarizeLog(input, sinceIso) {
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) {
    throw new Error(`Invalid --since timestamp: ${sinceIso}`);
  }

  let recent = 0;
  let stale = 0;
  let undated = 0;

  for (const line of input.split(/\r?\n/)) {
    if (!ATTENTION_PATTERN.test(line)) continue;
    const timestamp = parseTimestamp(line);
    if (timestamp == null) {
      undated += 1;
    } else if (timestamp >= since) {
      recent += 1;
    } else {
      stale += 1;
    }
  }

  return { recent, stale, undated };
}

try {
  const { since } = parseArgs(process.argv.slice(2));
  if (!since) throw new Error('Missing required --since <ISO timestamp>');
  const input = readFileSync(0, 'utf8');
  const summary = summarizeLog(input, since);
  console.log(`recent_attention=${summary.recent} stale_attention=${summary.stale} undated_attention=${summary.undated}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
