#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function usage() {
  return [
    'Usage: node scripts/performance-gates-audit.mjs [options]',
    '',
    'Runs the current read-only Performance-OS gate audits in one snapshot.',
    '',
    'Options:',
    '  --today YYYY-MM-DD   Anchor date for the Fueling gate audit.',
    '  --skip-server        Do not run the SSH-backed server mirror verification; leaves that gate unverified.',
    '  --json               Print machine-readable JSON.',
    '  -h, --help           Show this help.',
  ].join('\n');
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function normalizeCommandResult(result) {
  return {
    status: Number.isInteger(result?.status) ? result.status : 1,
    stdout: String(result?.stdout ?? ''),
    stderr: String(result?.stderr ?? ''),
    error: result?.error ? String(result.error.message ?? result.error) : null,
  };
}

export function defaultRunner(command, args = [], options = {}) {
  return normalizeCommandResult(spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  }));
}

function firstMatch(text, pattern) {
  return pattern.exec(text)?.[1] ?? null;
}

function compactCommandError(result) {
  if (result.error) return result.error;
  const stderrLines = result.stderr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const stdoutLines = result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return stderrLines.find(line => line.startsWith('ERROR:'))
    ?? stderrLines.find(line => /Permission denied|denied|failed/i.test(line))
    ?? stderrLines.at(-1)
    ?? stdoutLines.at(-1)
    ?? `command exited with status ${result.status}`;
}

function parseJsonOutput(result) {
  if (result.status !== 0) return { value: null, error: compactCommandError(result) };
  try {
    return { value: JSON.parse(result.stdout), error: null };
  } catch (error) {
    return {
      value: null,
      error: `Could not parse JSON output: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function countText(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizeCompletionCandidate(candidate) {
  return {
    date: candidate.date ?? null,
    status: candidate.status ?? null,
    targetPath: candidate.targetPath ?? null,
    missing: candidate.missing ?? [],
  };
}

function completionCandidatePathsText(candidates) {
  const paths = candidates
    .map(candidate => candidate.targetPath)
    .filter(Boolean);
  return paths.length > 0 ? `: ${paths.join(', ')}` : '';
}

function summarizeFueling(today, runner) {
  const command = 'npm run audit:fueling-gate -- --today';
  const result = runner(process.execPath, ['scripts/fueling-gate-audit.mjs', '--today', today, '--json']);
  const parsed = parseJsonOutput(result);
  const commandText = `${command} ${today}`;

  if (!parsed.value) {
    return {
      key: 'fueling',
      label: 'Fueling learning',
      gate: 'error',
      ready: false,
      command: commandText,
      detail: parsed.error,
      nextAction: 'Restore local DB access or pass the expected database env, then rerun the Fueling gate audit.',
    };
  }

  const users = parsed.value.users ?? [];
  const blockingUser = users.find(user => user.gate !== 'ready') ?? users[0] ?? null;
  const ready = users.length > 0 && users.every(user => user.gate === 'ready');
  const summaryUsers = users.map(user => {
    const completionCandidates = (user.completionCandidates ?? []).map(summarizeCompletionCandidate);
    return {
      userId: user.userId,
      gate: user.gate,
      comparableCompleteLogs: user.comparableCompleteLogs,
      requiredComparableCompleteLogs: user.requiredComparableCompleteLogs,
      duringLogs: user.duringLogs,
      comparableLongLogs: user.comparableLongLogs,
      completableNow: user.completableNow,
      newLogsStillNeeded: user.newLogsStillNeeded,
      nextAction: user.nextAction ?? null,
      completionCandidates,
    };
  });

  if (!blockingUser) {
    return {
      key: 'fueling',
      label: 'Fueling learning',
      gate: 'gated',
      ready: false,
      command: commandText,
      detail: 'No during nutrition logs were found in the audit window.',
      nextAction: 'Capture comparable during Fueling logs with activity/duration context, carbs and GI comfort.',
      users: summaryUsers,
    };
  }

  const complete = `${blockingUser.comparableCompleteLogs}/${blockingUser.requiredComparableCompleteLogs}`;
  const completionCandidates = (blockingUser.completionCandidates ?? []).map(summarizeCompletionCandidate);
  const detail = ready
    ? `${complete} comparable complete logs; nutrition trend summaries can be enabled from current evidence.`
    : [
        `${complete} comparable complete logs`,
        `${countText(blockingUser.completableNow, 'existing log')} completable now${completionCandidatePathsText(completionCandidates)}`,
        `${countText(blockingUser.newLogsStillNeeded, 'new complete long-session log')} still needed after candidates`,
      ].join('; ') + '.';
  const nextAction = ready
    ? 'No Fueling gate action needed.'
    : [
        blockingUser.nextAction?.label,
        blockingUser.nextAction?.detail,
        blockingUser.nextAction?.targetPath ? `Path: ${blockingUser.nextAction.targetPath}` : null,
      ].filter(Boolean).join(' - ');

  return {
    key: 'fueling',
    label: 'Fueling learning',
    gate: ready ? 'ready' : 'gated',
    ready,
    command: commandText,
    detail,
    nextAction,
    users: summaryUsers,
    completionCandidates,
  };
}

function summarizeIphone(runner) {
  const command = 'npm run audit:iphone-pwa-gate';
  const result = runner(process.execPath, ['scripts/iphone-pwa-gate-audit.mjs', '--json']);
  const parsed = parseJsonOutput(result);

  if (!parsed.value) {
    return {
      key: 'iphone_pwa',
      label: 'iPhone/PWA field',
      gate: 'error',
      ready: false,
      command,
      detail: parsed.error,
      nextAction: 'Restore the iPhone/PWA evidence file or pass a valid audit input, then rerun the field gate audit.',
    };
  }

  const audit = parsed.value;
  const ready = audit.gate === 'ready';
  const gapLabels = (audit.gaps ?? []).map(gap => `${gap.label}: ${gap.status}`);
  return {
    key: 'iphone_pwa',
    label: 'iPhone/PWA field',
    gate: ready ? 'ready' : 'gated',
    ready,
    command,
    detail: ready
      ? 'All manual iPhone/PWA field gates are recorded as pass.'
      : `${gapLabels.length} open gaps: ${gapLabels.join(', ')}`,
    nextAction: audit.nextAction ?? 'No iPhone/PWA gate action needed.',
    evidenceFile: audit.evidenceFile,
    serverCommitUnderTest: audit.scope?.serverCommit ?? null,
    gaps: audit.gaps ?? [],
  };
}

function resolveExpectedCommit(runner) {
  const result = runner('git', ['rev-parse', '--short', 'HEAD']);
  if (result.status !== 0) return 'unknown';
  return result.stdout.trim() || 'unknown';
}

function summarizeServer(expectedCommit, runner) {
  const command = `PULSE_EXPECTED_COMMIT=${expectedCommit} npm run verify:server`;
  const result = runner('bash', ['scripts/verify-server.sh'], {
    env: { PULSE_EXPECTED_COMMIT: expectedCommit },
  });
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const outputCommit = firstMatch(combinedOutput, /expected_commit=([^\s]+)/) ?? expectedCommit;
  const recoveryRunbook = firstMatch(combinedOutput, /recovery_runbook=([^\s]+)/)
    ?? 'docs/ai/checklists/deploy-auth-recovery.md';
  const ready = result.status === 0;

  return {
    key: 'server',
    label: 'Server deploy mirror',
    gate: ready ? 'ready' : 'gated',
    ready,
    command,
    detail: ready
      ? `Server mirror verified against expected commit ${expectedCommit}.`
      : compactCommandError(result),
    nextAction: ready
      ? 'No server mirror action needed.'
      : `Restore non-interactive SSH auth using ${recoveryRunbook}, then rerun ${command}.`,
    expectedCommit: outputCommit,
    recoveryRunbook,
  };
}

function skippedServer(expectedCommit) {
  return {
    key: 'server',
    label: 'Server deploy mirror',
    gate: 'skipped',
    ready: false,
    skipped: true,
    command: `PULSE_EXPECTED_COMMIT=${expectedCommit} npm run verify:server`,
    detail: 'Skipped by --skip-server; server mirror readiness is unverified.',
    nextAction: 'Run the server mirror verification before deploy-sensitive decisions.',
    expectedCommit,
    recoveryRunbook: 'docs/ai/checklists/deploy-auth-recovery.md',
  };
}

export function buildPerformanceGateAudit(options = {}, runner = defaultRunner) {
  const today = assertIsoDate(options.today ?? isoDate(new Date()), '--today');
  const expectedCommit = options.expectedCommit ?? resolveExpectedCommit(runner);
  const gates = [
    summarizeFueling(today, runner),
    summarizeIphone(runner),
    options.skipServer ? skippedServer(expectedCommit) : summarizeServer(expectedCommit, runner),
  ];
  const openGates = gates.filter(gate => !gate.ready);

  return {
    date: today,
    gate: openGates.length === 0 ? 'ready' : 'gated',
    openGates: openGates.length,
    expectedCommit,
    gates,
  };
}

export function renderPerformanceGateAudit(audit) {
  const lines = [
    '# Performance-OS Gate Audit',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
    `Expected server commit: ${audit.expectedCommit}`,
    '',
  ];

  for (const gate of audit.gates) {
    lines.push(`## ${gate.label}`);
    lines.push(`- Status: ${gate.gate}`);
    lines.push(`- Command: \`${gate.command}\``);
    lines.push(`- Detail: ${gate.detail}`);
    lines.push(`- Next: ${gate.nextAction}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function parseArgs(argv) {
  const result = {
    today: isoDate(new Date()),
    skipServer: false,
    json: false,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '--skip-server') {
      result.skipServer = true;
      continue;
    }
    if (arg === '--today') {
      result.today = assertIsoDate(args[index + 1], '--today');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(usage());
    return;
  }
  const args = parseArgs(argv);
  const audit = buildPerformanceGateAudit(args);
  if (args.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  console.log(renderPerformanceGateAudit(audit));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
