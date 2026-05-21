#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_EVIDENCE_FILE = 'docs/qa/2026-05-02-iphone-pwa-real-device.md';
const FIELD_CHECKLIST = 'docs/ai/checklists/iphone-pwa-qa.md';
const APP_RUNTIME_PATHS = [
  'frontend',
  'backend',
  'shared',
  'package.json',
  'package-lock.json',
];
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
const FIELD_RESULT_ROWS = [
  ['Network', 'URL opens via VPN on local origin'],
  ['Certificate', 'No unexpected warning for the address in use'],
  ['Login', 'Auth succeeds and stays on local origin, if an auth gate appears'],
  ['Settings readiness', 'iPhone/PWA block shows secure context, service worker and push capability truthfully'],
  ['Add to Home Screen', 'Pulse launches from Home Screen'],
  ['Standalone mode', 'Settings shows standalone after Home Screen launch'],
  ['Home', 'Daily action fits without horizontal overflow'],
  ['Coach', 'Input remains usable before/after keyboard focus'],
  ['Plan', 'Bottom nav does not overlap final controls'],
  ['Insights', 'Evidence/missing-data states remain readable'],
  ['Push support', 'Permission and subscription state recorded when deliberately triggered'],
  ['Offline fallback', 'Disconnecting VPN/network shows local server/VPN unavailable fallback'],
];

function usage() {
  return [
    'Usage: node scripts/iphone-pwa-gate-audit.mjs [options]',
    '',
    'Audits the manual iPhone/VPN/PWA field evidence record for remaining real-device gates.',
    '',
    'Options:',
    `  --file <path>              Evidence markdown file, default ${DEFAULT_EVIDENCE_FILE}.`,
    '  --expected-commit <short>  Expected current server commit; default PULSE_EXPECTED_COMMIT or local git HEAD.',
    '                             Docs-only drift is accepted when both server commits resolve to the same app runtime commit.',
    '  --packet                   Print a manual field-evidence packet instead of the audit summary.',
    '  --next-prompt              Print a short first-gap prompt for manual field evidence; exits 1 if no prompt is available.',
    '  --scaffold                 Print only a paste-ready Markdown field-run scaffold.',
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

function shellEnvValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function serverEnvPrefix() {
  const host = shellEnvValue(process.env.PULSE_HOST);
  return host ? `PULSE_HOST=${host} ` : '';
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

function commitStatus(serverCommit, expectedCommit, runtime = {}) {
  if (!expectedCommit) return 'unknown';
  if (!serverCommit) return 'missing';
  if (commitsMatch(serverCommit, expectedCommit)) return 'current';
  if (
    runtime.fieldRuntimeCommit
    && runtime.expectedRuntimeCommit
    && commitsMatch(runtime.fieldRuntimeCommit, runtime.expectedRuntimeCommit)
  ) {
    return 'current_runtime';
  }
  return 'stale';
}

function latestEvidenceRecord(markdown) {
  const lines = markdown.split(/\r?\n/);
  const scopeIndexes = lines
    .map((line, index) => line.trim() === '## Scope' ? index : -1)
    .filter(index => index >= 0);

  if (scopeIndexes.length === 0) return markdown;

  const start = scopeIndexes.at(-1);
  const end = lines.findIndex((line, index) => index > start && line.trim() === '## Scope');
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function headingSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim() === heading);
  if (headingIndex === -1) return '';
  const end = lines.findIndex((line, index) =>
    index > headingIndex
    && /^##\s+/.test(line.trim())
    && line.trim() !== heading
  );
  return lines.slice(headingIndex + 1, end === -1 ? undefined : end).join('\n');
}

function parseScope(markdown) {
  const scope = {};
  for (const line of headingSection(markdown, '## Scope').split(/\r?\n/)) {
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
  const evidenceRecord = latestEvidenceRecord(markdown);
  const scope = parseScope(evidenceRecord);
  const expectedRuntimeCommit = cleanInlineCode(options.expectedRuntimeCommit)
    ?? cleanInlineCode(options.runtimeCommitFor?.(expectedCommit));
  const fieldRuntimeCommit = cleanInlineCode(options.fieldRuntimeCommit)
    ?? cleanInlineCode(options.runtimeCommitFor?.(scope.serverCommit));
  const fieldCommitStatus = commitStatus(scope.serverCommit, expectedCommit, {
    expectedRuntimeCommit,
    fieldRuntimeCommit,
  });
  const results = parseMarkdownTable(evidenceRecord, '## Results').map(row => ({
    ...row,
    status: parseStatus(row.result),
  }));
  const issues = parseMarkdownTable(evidenceRecord, '## Issues Found');
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
    expectedRuntimeCommit,
    fieldRuntimeCommit,
    commitStatus: fieldCommitStatus,
    serverVerifyCommand: serverVerifyCommand(expectedCommit),
    serverRecoveryPacketCommand: serverRecoveryPacketCommand(expectedCommit),
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
    audit.expectedRuntimeCommit ? `Expected app runtime commit: ${audit.expectedRuntimeCommit}` : null,
    audit.fieldRuntimeCommit ? `Field app runtime commit: ${audit.fieldRuntimeCommit}` : null,
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

function statusText(status) {
  return String(status ?? 'missing').replaceAll('_', ' ');
}

function serverVerifyCommand(expectedCommit) {
  return `${serverEnvPrefix()}PULSE_EXPECTED_COMMIT=${expectedCommit ?? '<commit>'} npm run verify:server`;
}

function serverRecoveryPacketCommand(expectedCommit) {
  return `${serverVerifyCommand(expectedCommit)} -- --packet`;
}

function iphonePwaGateAuditCommand(expectedCommit) {
  return `${serverEnvPrefix()}npm run audit:iphone-pwa-gate -- --expected-commit ${expectedCommit ?? '<commit>'}`;
}

function scaffoldValue(value, fallback) {
  return value ?? fallback;
}

function scaffoldGapLines(audit) {
  if (audit.gaps.length === 0) {
    return ['- Current audit has no open field gaps for the expected commit.'];
  }
  return audit.gaps.map((gap, index) =>
    `- ${index + 1}. ${gap.label} (${statusText(gap.status)}): ${gap.nextAction}`
  );
}

export function renderIphonePwaFieldScaffold(audit) {
  const expectedCommit = audit.expectedCommit ?? '<commit>';
  const lines = [
    '## Field Run Checklist',
    '',
    `- Verify server mirror first: \`${serverVerifyCommand(audit.expectedCommit)}\`.`,
    `- If SSH fails before server checks: \`${serverRecoveryPacketCommand(audit.expectedCommit)}\`.`,
    '- Use a real iPhone over the VPN/local network path; simulated WebKit or Chromium evidence does not close this gate.',
    '- Open Settings first and record Device, iOS version, PWA mode, Push state and certificate state.',
    '- Install and trust only `frontend/certs/rootCA.pem` if warning-free certificate behavior is required; never transfer `rootCA-key.pem` or any `*-key.pem` file.',
    '- Deliberately enable Push and send a test push only when testing notifications.',
    '- Disconnect VPN or network for the offline fallback check, then reopen the Home Screen PWA.',
    `- Append this field run to ${scaffoldValue(audit.evidenceFile, 'docs/qa/2026-05-02-iphone-pwa-real-device.md')}.`,
    `- After recording, rerun: \`${iphonePwaGateAuditCommand(audit.expectedCommit)}\`.`,
    '',
    'Open field gaps to resolve:',
    ...scaffoldGapLines(audit),
    '',
    '## Scope',
    '',
    `- Device: ${scaffoldValue(audit.scope.device, '<iPhone model>')}`,
    `- iOS version: ${scaffoldValue(audit.scope.iosVersion, '<iOS version>')}`,
    `- Browser / launch mode: ${scaffoldValue(audit.scope.launchMode, 'Safari, then Home Screen PWA launch')}`,
    `- VPN profile: ${scaffoldValue(audit.scope.vpnProfile, '<VPN profile/name>')}`,
    `- Pulse URL: \`${scaffoldValue(audit.scope.pulseUrl, 'https://192.168.178.46:5175')}\``,
    `- Server commit under test: \`${expectedCommit}\``,
    '',
    '## Results',
    '',
    '| Area | Expected | Result | Notes |',
    '|---|---|---|---|',
  ];
  for (const [area, expected] of FIELD_RESULT_ROWS) {
    lines.push(`| ${area} | ${expected} | <Pass/Partial/Pending/Needs follow-up/Fail/Not applicable> | <observed result> |`);
  }
  return lines.join('\n');
}

function renderEvidenceRecordScaffold(audit) {
  return [
    '```markdown',
    renderIphonePwaFieldScaffold(audit),
    '```',
  ].join('\n');
}

export function renderIphonePwaFieldPacket(audit) {
  const lines = [
    '# iPhone / PWA Field Evidence Packet',
    '',
    `Evidence file: ${audit.evidenceFile}`,
    `Field checklist: ${audit.fieldChecklist}`,
    `Expected current commit: ${audit.expectedCommit ?? 'missing'}`,
    audit.expectedRuntimeCommit ? `Expected app runtime commit: ${audit.expectedRuntimeCommit}` : null,
    audit.fieldRuntimeCommit ? `Field app runtime commit: ${audit.fieldRuntimeCommit}` : null,
    `Server commit under test: ${audit.scope.serverCommit ?? 'missing'}`,
    `Field commit status: ${audit.commitStatus}`,
    `Server verify command: ${serverVerifyCommand(audit.expectedCommit)}`,
    `Server recovery packet: ${serverRecoveryPacketCommand(audit.expectedCommit)}`,
    'Server recovery runbook: docs/ai/checklists/deploy-auth-recovery.md',
    `Device: ${audit.scope.device ?? 'missing'}`,
    `iOS version: ${audit.scope.iosVersion ?? 'missing'}`,
    '',
  ].filter(line => line !== null);

  if (audit.gaps.length === 0) {
    lines.push('All manual iPhone/PWA field gates are recorded as pass for the expected commit.');
    return lines.join('\n');
  }

  lines.push(`Open field gaps: ${audit.gaps.length}`);
  audit.gaps.forEach((gap, index) => {
    lines.push(`${index + 1}. ${gap.label} (${statusText(gap.status)})`);
    lines.push(`   Detail: ${gap.detail}`);
    lines.push(`   Next: ${gap.nextAction}`);
  });

  lines.push('');
  lines.push('Manual field run:');
  lines.push(`- Verify the server mirror before recording new current evidence: ${serverVerifyCommand(audit.expectedCommit)}.`);
  lines.push('- If this field run is intentionally pinned to a known deployed/runtime commit, rerun this packet with `--expected-commit <short>` before recording evidence.');
  lines.push(`- If SSH fails before server Git/PM2/health checks, run the read-only recovery packet first: ${serverRecoveryPacketCommand(audit.expectedCommit)}.`);
  lines.push('- Follow docs/ai/checklists/deploy-auth-recovery.md before continuing the iPhone field run.');
  lines.push('- Use a real iPhone over the VPN/local network path; simulated WebKit or Chromium evidence does not close this gate.');
  lines.push('- Open Settings first and record Device, iOS version, PWA mode, Push state and certificate state.');
  lines.push('- Install and trust only frontend/certs/rootCA.pem if warning-free certificate behavior is required; never transfer rootCA-key.pem or any *-key.pem file.');
  lines.push('- Deliberately enable Push and send a test push only when testing notifications.');
  lines.push('- Disconnect VPN or network for the offline fallback check, then reopen the Home Screen PWA.');
  lines.push(`- Record the run in ${audit.evidenceFile}, including Server commit under test: ${audit.expectedCommit ?? '<commit>'}.`);
  lines.push(`- Rerun after recording: ${iphonePwaGateAuditCommand(audit.expectedCommit)}`);
  lines.push('');
  lines.push('Evidence record scaffold:');
  lines.push(renderEvidenceRecordScaffold(audit));

  return lines.join('\n');
}

export function renderIphonePwaNextPrompt(audit) {
  const firstGap = audit.gaps[0] ?? null;
  const expectedCommit = audit.expectedCommit ?? '<commit>';
  const lines = [
    '# iPhone / PWA Next Field Prompt',
    '',
    `Evidence file: ${audit.evidenceFile}`,
    `Field checklist: ${audit.fieldChecklist}`,
    `Expected current commit: ${expectedCommit}`,
    `Server commit under test: ${audit.scope.serverCommit ?? 'missing'}`,
    '',
  ];

  if (!firstGap) {
    lines.push('All manual iPhone/PWA field gates are recorded as pass for the expected commit.');
    lines.push(`Rerun: ${iphonePwaGateAuditCommand(audit.expectedCommit)}`);
    return lines.join('\n');
  }

  lines.push(`First open gap: ${firstGap.label} (${statusText(firstGap.status)})`);
  lines.push(`Next action: ${firstGap.nextAction}`);
  lines.push('');
  lines.push('Prompt:');
  lines.push(`Run a real iPhone/PWA field check for Server commit under test: ${expectedCommit}. Start with the first open gap above, then use the scaffold if the run needs a full evidence record.`);
  lines.push('');
  lines.push('Commands:');
  lines.push(`- Verify server mirror first: ${serverVerifyCommand(audit.expectedCommit)}`);
  lines.push(`- If SSH fails before server checks: ${serverRecoveryPacketCommand(audit.expectedCommit)}`);
  lines.push(`- Full field scaffold: ${iphonePwaGateAuditCommand(audit.expectedCommit)} --scaffold`);
  lines.push(`- Rerun after recording: ${iphonePwaGateAuditCommand(audit.expectedCommit)}`);
  lines.push('');
  lines.push('Rules:');
  lines.push('- Use a real iPhone over the VPN/local network path; simulated WebKit or Chromium evidence does not close this gate.');
  lines.push('- Record Device, iOS version and Server commit under test in the Scope section.');
  lines.push('- Never transfer rootCA-key.pem or any *-key.pem file to the phone.');
  lines.push(`- Append the field run to ${audit.evidenceFile}.`);

  return lines.join('\n');
}

export function exitCodeForIphonePwaNextPrompt(audit) {
  return audit.gaps.length > 0 ? 0 : 1;
}

export function parseArgs(argv) {
  const result = {
    file: DEFAULT_EVIDENCE_FILE,
    expectedCommit: null,
    packet: false,
    nextPrompt: false,
    scaffold: false,
    json: false,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '--packet') {
      result.packet = true;
      continue;
    }
    if (arg === '--next-prompt') {
      result.nextPrompt = true;
      continue;
    }
    if (arg === '--scaffold') {
      result.scaffold = true;
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

function resolveAppRuntimeCommit(ref) {
  const commit = cleanInlineCode(ref);
  if (!commit) return null;
  try {
    return cleanInlineCode(execFileSync('git', [
      'log',
      '-1',
      '--format=%h',
      commit,
      '--',
      ...APP_RUNTIME_PATHS,
    ], { encoding: 'utf8' }));
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
    runtimeCommitFor: resolveAppRuntimeCommit,
  });
  if (args.scaffold) {
    console.log(renderIphonePwaFieldScaffold(audit));
    return;
  }
  if (args.nextPrompt) {
    console.log(renderIphonePwaNextPrompt(audit));
    process.exitCode = exitCodeForIphonePwaNextPrompt(audit);
    return;
  }
  if (args.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  console.log(args.packet ? renderIphonePwaFieldPacket(audit) : renderIphonePwaGateAudit(audit));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
