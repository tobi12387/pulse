#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_EVIDENCE_FILE = 'docs/qa/2026-05-02-iphone-pwa-real-device.md';
const FIELD_CHECKLIST = 'docs/ai/checklists/iphone-pwa-qa.md';
const CORE_PASS_AREAS = [
  'Network',
  'Settings readiness',
  'Add to Home Screen',
  'Standalone mode',
  'Home',
  'Coach',
  'Plan',
  'Insights',
];

function usage() {
  return [
    'Usage: node scripts/iphone-pwa-gate-audit.mjs [options]',
    '',
    'Audits the manual iPhone/VPN/PWA field evidence record for remaining real-device gates.',
    '',
    'Options:',
    `  --file <path>              Evidence markdown file, default ${DEFAULT_EVIDENCE_FILE}.`,
    '  --expected-commit <short>  Expected current commit; default PULSE_EXPECTED_COMMIT or local git HEAD.',
    '  --json                     Print machine-readable JSON.',
    '  -h, --help                 Show this help.',
  ].join('\n');
}

function clean(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function cleanInlineCode(value) {
  return clean(value)?.replace(/^`|`$/g, '') ?? null;
}

function parseStatus(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'pass') return 'pass';
  if (text === 'not applicable') return 'not_applicable';
  if (text === 'partial') return 'partial';
  if (text === 'pending') return 'pending';
  if (text === 'needs follow-up') return 'needs_followup';
  if (text === 'fail') return 'fail';
  return text ? 'unknown' : 'missing';
}

function commitsMatch(left, right) {
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function commitStatus(serverCommit, expectedCommit) {
  if (!expectedCommit) return 'unknown';
  if (!serverCommit) return 'missing';
  return commitsMatch(serverCommit, expectedCommit) ? 'current' : 'stale';
}

function parseScope(markdown) {
  const scope = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^- ([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    scope[key.trim()] = clean(rawValue);
  }
  return {
    device: scope.Device ?? null,
    iosVersion: scope['iOS version'] ?? null,
    launchMode: scope['Browser / launch mode'] ?? null,
    vpnProfile: scope['VPN profile'] ?? null,
    pulseUrl: cleanInlineCode(scope['Pulse URL']),
    serverCommit: cleanInlineCode(scope['Server commit under test']),
  };
}

function parseMarkdownTable(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim() === heading);
  if (headingIndex === -1) return [];
  const rows = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      if (rows.length > 0) break;
      continue;
    }
    if (!line.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
    if (cells.every(cell => /^-+$/.test(cell))) continue;
    rows.push(cells);
  }
  if (rows.length === 0) return [];
  const headers = rows.shift().map(header => header.toLowerCase().replaceAll(' ', '_'));
  return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, clean(cells[index])])));
}

function resultByArea(results, area) {
  return results.find(row => row.area === area) ?? null;
}

function resultStatus(results, area) {
  return parseStatus(resultByArea(results, area)?.result);
}

function buildGap(kind, label, status, detail, nextAction) {
  return { kind, label, status, detail, nextAction };
}

export function buildIphonePwaGateAudit(markdown, options = {}) {
  const evidenceFile = options.evidenceFile ?? DEFAULT_EVIDENCE_FILE;
  const expectedCommit = cleanInlineCode(options.expectedCommit);
  const scope = parseScope(markdown);
  const fieldCommitStatus = commitStatus(scope.serverCommit, expectedCommit);
  const results = parseMarkdownTable(markdown, '## Results').map(row => ({
    ...row,
    status: parseStatus(row.result),
  }));
  const issues = parseMarkdownTable(markdown, '## Issues Found');
  const missingMetadata = [
    scope.device ? null : 'Device',
    scope.iosVersion ? null : 'iOS version',
  ].filter(Boolean);

  const coreMissing = CORE_PASS_AREAS
    .map(area => ({ area, status: resultStatus(results, area) }))
    .filter(item => item.status !== 'pass');
  const gaps = [];
  if (fieldCommitStatus === 'missing' || fieldCommitStatus === 'stale') {
    gaps.push(buildGap(
      'current_commit_evidence',
      'Current main field evidence',
      fieldCommitStatus,
      fieldCommitStatus === 'missing'
        ? `Missing Server commit under test; expected ${expectedCommit}.`
        : `Field record tested ${scope.serverCommit}, expected ${expectedCommit}.`,
      `Verify the server mirror is on ${expectedCommit}, rerun the real iPhone checklist and record Server commit under test: ${expectedCommit}.`,
    ));
  }
  if (coreMissing.length > 0) {
    gaps.push(buildGap(
      'core_pwa_reachability',
      'Core iPhone/PWA route proof',
      'gated',
      `Missing pass results: ${coreMissing.map(item => `${item.area}=${item.status}`).join(', ')}`,
      'Run the real iPhone checklist for Network, Settings, Home Screen launch and core routes.',
    ));
  }

  const certificateStatus = resultStatus(results, 'Certificate');
  if (certificateStatus !== 'pass') {
    gaps.push(buildGap(
      'certificate_trust',
      'Warning-free certificate trust',
      certificateStatus,
      `Certificate result is ${certificateStatus}.`,
      'Install and trust only frontend/certs/rootCA.pem on the iPhone, then record a warning-free Safari/PWA launch.',
    ));
  }

  const pushStatus = resultStatus(results, 'Push support');
  if (pushStatus !== 'pass') {
    gaps.push(buildGap(
      'push_activation',
      'Push activation and test push',
      pushStatus,
      `Push result is ${pushStatus}.`,
      'In Settings on the target iPhone/PWA, deliberately enable Push and record permission, subscription and test-push result.',
    ));
  }

  const offlineStatus = resultStatus(results, 'Offline fallback');
  if (offlineStatus !== 'pass') {
    gaps.push(buildGap(
      'offline_fallback',
      'Real iPhone VPN/network offline fallback',
      offlineStatus,
      `Offline fallback result is ${offlineStatus}.`,
      'Disconnect VPN or network on the real iPhone, reopen the Home Screen PWA and record the local server/VPN unavailable fallback.',
    ));
  }

  if (missingMetadata.length > 0) {
    gaps.push(buildGap(
      'device_metadata',
      'Device and iOS metadata',
      'missing',
      `Missing metadata: ${missingMetadata.join(', ')}.`,
      'Record the iPhone model and iOS version in the evidence Scope section during the next field run.',
    ));
  }

  return {
    evidenceFile,
    fieldChecklist: FIELD_CHECKLIST,
    gate: gaps.length === 0 ? 'ready' : 'gated',
    expectedCommit,
    commitStatus: fieldCommitStatus,
    scope,
    results,
    issues,
    gaps,
    nextAction: gaps[0]?.nextAction ?? null,
  };
}

export function renderIphonePwaGateAudit(audit) {
  const lines = [
    '# iPhone / PWA Field Gate Audit',
    '',
    `Evidence file: ${audit.evidenceFile}`,
    `Field checklist: ${audit.fieldChecklist}`,
    `Gate: ${audit.gate}`,
    `Server commit under test: ${audit.scope.serverCommit ?? 'missing'}`,
    audit.expectedCommit ? `Expected current commit: ${audit.expectedCommit}` : null,
    audit.expectedCommit ? `Field commit status: ${audit.commitStatus}` : null,
    `Device: ${audit.scope.device ?? 'missing'}`,
    `iOS version: ${audit.scope.iosVersion ?? 'missing'}`,
    '',
  ].filter(line => line !== null);

  if (audit.gaps.length === 0) {
    lines.push('All manual iPhone/PWA field gates are recorded as pass.');
    return lines.join('\n');
  }

  lines.push(`Open gaps: ${audit.gaps.length}`);
  for (const gap of audit.gaps) {
    lines.push(`- ${gap.label}: ${gap.status} (${gap.detail})`);
    lines.push(`  Next: ${gap.nextAction}`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const result = {
    file: DEFAULT_EVIDENCE_FILE,
    expectedCommit: null,
    json: false,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '--file') {
      result.file = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--expected-commit') {
      result.expectedCommit = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function resolveExpectedCommit() {
  const envCommit = cleanInlineCode(process.env.PULSE_EXPECTED_COMMIT);
  if (envCommit) return envCommit;
  try {
    return cleanInlineCode(execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

async function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  if (!existsSync(args.file)) throw new Error(`Evidence file not found: ${args.file}`);
  const audit = buildIphonePwaGateAudit(readFileSync(args.file, 'utf8'), {
    evidenceFile: args.file,
    expectedCommit: args.expectedCommit ?? resolveExpectedCommit(),
  });
  if (args.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  console.log(renderIphonePwaGateAudit(audit));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
