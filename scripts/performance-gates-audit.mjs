#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const FUELING_EVIDENCE_CHECKLIST = 'docs/ai/checklists/fueling-evidence-capture.md';
const IPHONE_FIELD_CHECKLIST = 'docs/ai/checklists/iphone-pwa-qa.md';

function usage() {
  return [
    'Usage: node scripts/performance-gates-audit.mjs [options]',
    '',
    'Runs the current read-only Performance-OS gate audits in one snapshot.',
    '',
    'Options:',
    '  --today YYYY-MM-DD   Anchor date for the Fueling gate audit.',
    '  --skip-server        Do not run the SSH-backed server mirror verification; leaves that gate unverified.',
    '  --fail-on-gated      Exit 1 when any Performance-OS gate is not ready.',
    '  --next-unblock       Print only the first open gate unblock; with --json prints that object.',
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

function formatCandidateSummary(candidate) {
  if (candidate.summary) return candidate.summary;
  const carbs = candidate.carbsG == null
    ? null
    : `${Math.round(Number(candidate.carbsG))} g carbs${candidate.carbsPerHour == null ? '' : ` (${Math.round(Number(candidate.carbsPerHour))} g/h)`}`;
  return [
    candidate.date ?? null,
    candidate.activityName ?? null,
    candidate.activityType ?? null,
    candidate.durationMin == null ? null : `${Math.round(Number(candidate.durationMin))} min`,
    carbs,
  ].filter(Boolean).join(' - ') || null;
}

function summarizeCompletionCandidate(candidate) {
  return {
    date: candidate.date ?? null,
    activityName: candidate.activityName ?? null,
    activityType: candidate.activityType ?? null,
    durationMin: candidate.durationMin ?? null,
    carbsG: candidate.carbsG ?? null,
    carbsPerHour: candidate.carbsPerHour ?? null,
    summary: formatCandidateSummary(candidate),
    status: candidate.status ?? null,
    targetPath: candidate.targetPath ?? null,
    missing: candidate.missing ?? [],
  };
}

function completionCandidateText(candidate) {
  const summary = formatCandidateSummary(candidate);
  if (summary && candidate.targetPath) return `${summary} -> ${candidate.targetPath}`;
  return summary ?? candidate.targetPath ?? null;
}

function completionCandidatesText(candidates) {
  const items = candidates
    .map(completionCandidateText)
    .filter(Boolean);
  return items.length > 0 ? `: ${items.join(', ')}` : '';
}

function fuelingBlockingUser(gate) {
  return gate.users?.find(user => user.gate !== 'ready')
    ?? gate.users?.[0]
    ?? null;
}

function summarizeFueling(today, runner) {
  const command = 'npm run audit:fueling-gate -- --today';
  const result = runner(process.execPath, ['scripts/fueling-gate-audit.mjs', '--today', today, '--json']);
  const parsed = parseJsonOutput(result);
  const commandText = `${command} ${today}`;
  const capturePacketCommand = `${commandText} --packet`;

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
      capturePacketCommand,
      detail: 'No during nutrition logs were found in the audit window.',
      nextAction: 'Capture comparable during Fueling logs with activity/duration context, carbs and GI comfort.',
      evidenceChecklist: FUELING_EVIDENCE_CHECKLIST,
      users: summaryUsers,
    };
  }

  const complete = `${blockingUser.comparableCompleteLogs}/${blockingUser.requiredComparableCompleteLogs}`;
  const completionCandidates = (blockingUser.completionCandidates ?? []).map(summarizeCompletionCandidate);
  const detail = ready
    ? `${complete} comparable complete logs; nutrition trend summaries can be enabled from current evidence.`
    : [
        `${complete} comparable complete logs`,
        `${countText(blockingUser.completableNow, 'existing log')} completable now${completionCandidatesText(completionCandidates)}`,
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
    evidenceChecklist: blockingUser.nextAction?.evidenceChecklist ?? FUELING_EVIDENCE_CHECKLIST,
    capturePacketCommand: ready ? null : capturePacketCommand,
    users: summaryUsers,
    completionCandidates,
  };
}

function summarizeIphone(expectedCommit, runner) {
  const command = 'npm run audit:iphone-pwa-gate';
  const fieldPacketCommand = `${command} -- --expected-commit ${expectedCommit} --packet`;
  const result = runner(process.execPath, [
    'scripts/iphone-pwa-gate-audit.mjs',
    '--json',
    '--expected-commit',
    expectedCommit,
  ]);
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
      evidenceChecklist: IPHONE_FIELD_CHECKLIST,
      fieldPacketCommand,
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
    evidenceChecklist: audit.fieldChecklist ?? IPHONE_FIELD_CHECKLIST,
    fieldPacketCommand: ready ? null : fieldPacketCommand,
    evidenceFile: audit.evidenceFile,
    expectedCommit: audit.expectedCommit ?? null,
    commitStatus: audit.commitStatus ?? null,
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
  const recoveryPacketCommand = `PULSE_EXPECTED_COMMIT=${expectedCommit} npm run verify:server -- --packet`;
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
    recoveryPacketCommand: ready ? null : recoveryPacketCommand,
  };
}

function skippedServer(expectedCommit) {
  const recoveryPacketCommand = `PULSE_EXPECTED_COMMIT=${expectedCommit} npm run verify:server -- --packet`;
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
    recoveryPacketCommand,
  };
}

function fuelingNextAction(gate) {
  return fuelingBlockingUser(gate)?.nextAction ?? null;
}

function nextUnblockMetadata(gate) {
  if (gate.key === 'fueling') {
    const user = fuelingBlockingUser(gate);
    const nextAction = fuelingNextAction(gate);
    return {
      kind: nextAction?.kind ?? null,
      targetPath: nextAction?.targetPath ?? gate.completionCandidates?.find(candidate => candidate.targetPath)?.targetPath ?? null,
      date: nextAction?.date ?? null,
      evidenceChecklist: nextAction?.evidenceChecklist ?? gate.evidenceChecklist ?? FUELING_EVIDENCE_CHECKLIST,
      capturePacketCommand: gate.capturePacketCommand ?? null,
      options: nextAction?.options ?? [],
      status: user ? {
        comparableCompleteLogs: user.comparableCompleteLogs ?? null,
        requiredComparableCompleteLogs: user.requiredComparableCompleteLogs ?? null,
        completableNow: user.completableNow ?? null,
        newLogsStillNeeded: user.newLogsStillNeeded ?? null,
      } : null,
      targetLog: nextAction?.targetLog ?? gate.completionCandidates?.find(candidate => candidate.targetPath) ?? null,
      completionCandidates: gate.completionCandidates ?? [],
    };
  }
  if (gate.key === 'iphone_pwa') {
    const firstGap = gate.gaps?.[0] ?? null;
    return {
      evidenceChecklist: gate.evidenceChecklist ?? IPHONE_FIELD_CHECKLIST,
      evidenceFile: gate.evidenceFile ?? null,
      expectedCommit: gate.expectedCommit ?? null,
      commitStatus: gate.commitStatus ?? null,
      serverCommitUnderTest: gate.serverCommitUnderTest ?? null,
      fieldPacketCommand: gate.fieldPacketCommand ?? null,
      firstGap: firstGap ? {
        kind: firstGap.kind ?? null,
        label: firstGap.label ?? null,
        status: firstGap.status ?? null,
        nextAction: firstGap.nextAction ?? null,
      } : null,
    };
  }
  if (gate.key === 'server') {
    return {
      expectedCommit: gate.expectedCommit ?? null,
      recoveryRunbook: gate.recoveryRunbook ?? null,
      recoveryPacketCommand: gate.recoveryPacketCommand ?? null,
    };
  }
  return {};
}

function nextUnblockFrom(openGates) {
  const gate = openGates[0] ?? null;
  if (!gate) return null;
  return {
    key: gate.key,
    label: gate.label,
    command: gate.command,
    action: gate.nextAction,
    detail: gate.detail,
    metadata: nextUnblockMetadata(gate),
  };
}

export function buildPerformanceGateAudit(options = {}, runner = defaultRunner) {
  const today = assertIsoDate(options.today ?? isoDate(new Date()), '--today');
  const expectedCommit = options.expectedCommit ?? resolveExpectedCommit(runner);
  const gates = [
    summarizeFueling(today, runner),
    summarizeIphone(expectedCommit, runner),
    options.skipServer ? skippedServer(expectedCommit) : summarizeServer(expectedCommit, runner),
  ];
  const openGateList = gates.filter(gate => !gate.ready);

  return {
    date: today,
    gate: openGateList.length === 0 ? 'ready' : 'gated',
    openGates: openGateList.length,
    expectedCommit,
    nextUnblock: nextUnblockFrom(openGateList),
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
    `Next unblock: ${audit.nextUnblock ? audit.nextUnblock.label : 'none'}`,
  ];
  if (audit.nextUnblock) lines.push(`Next action: ${audit.nextUnblock.action}`);
  const nextTarget = targetSummary(audit.nextUnblock?.metadata);
  if (nextTarget) lines.push(`Next target: ${nextTarget}`);
  lines.push('');

  for (const gate of audit.gates) {
    lines.push(`## ${gate.label}`);
    lines.push(`- Status: ${gate.gate}`);
    lines.push(`- Command: \`${gate.command}\``);
    lines.push(`- Detail: ${gate.detail}`);
    lines.push(`- Next: ${gate.nextAction}`);
    if (gate.evidenceChecklist) lines.push(`- Evidence checklist: ${gate.evidenceChecklist}`);
    if (gate.capturePacketCommand) lines.push(`- Evidence packet: \`${gate.capturePacketCommand}\``);
    if (gate.fieldPacketCommand) lines.push(`- Field packet: \`${gate.fieldPacketCommand}\``);
    if (gate.recoveryRunbook) lines.push(`- Recovery runbook: ${gate.recoveryRunbook}`);
    if (gate.recoveryPacketCommand) lines.push(`- Recovery packet: \`${gate.recoveryPacketCommand}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function metadataLine(metadata) {
  if (!metadata) return null;
  if (metadata.targetPath) return `Target path: ${metadata.targetPath}`;
  if (metadata.firstGap?.label) return `First gap: ${metadata.firstGap.label} (${metadata.firstGap.status ?? 'unknown'})`;
  if (metadata.recoveryRunbook) return `Recovery runbook: ${metadata.recoveryRunbook}`;
  return null;
}

function checklistLine(metadata) {
  return metadata?.evidenceChecklist ? `Evidence checklist: ${metadata.evidenceChecklist}` : null;
}

function packetLine(metadata) {
  return metadata?.capturePacketCommand ? `Evidence packet: ${metadata.capturePacketCommand}` : null;
}

function fieldPacketLine(metadata) {
  return metadata?.fieldPacketCommand ? `Field packet: ${metadata.fieldPacketCommand}` : null;
}

function recoveryPacketLine(metadata) {
  return metadata?.recoveryPacketCommand ? `Recovery packet: ${metadata.recoveryPacketCommand}` : null;
}

function targetSummary(metadata) {
  return metadata?.targetLog?.summary ?? null;
}

function targetLine(metadata) {
  const summary = targetSummary(metadata);
  return summary ? `Target: ${summary}` : null;
}

function optionsLine(metadata) {
  const options = metadata?.options ?? [];
  if (!options.length) return null;
  return `Options: ${options.map(option => `${option.value}=${option.label}`).join(', ')}`;
}

function nextDetailText(next) {
  const status = next.metadata?.status;
  const hasCompletionCandidates = (next.metadata?.completionCandidates ?? []).length > 0;
  if (next.key === 'fueling' && status && hasCompletionCandidates) {
    const complete = `${status.comparableCompleteLogs}/${status.requiredComparableCompleteLogs}`;
    return [
      `${complete} comparable complete logs`,
      `${countText(status.completableNow, 'existing log')} completable now`,
      `${countText(status.newLogsStillNeeded, 'new complete long-session log')} still needed after candidates`,
    ].join('; ') + '.';
  }
  return next.detail;
}

function completionCandidateLines(metadata) {
  const candidates = metadata?.completionCandidates ?? [];
  if (!candidates.length) return [];
  return [
    'Completion candidates:',
    ...candidates
      .map(candidate => {
        const text = completionCandidateText(candidate);
        if (!text) return null;
        const missing = (candidate.missing ?? []).length > 0
          ? ` (missing: ${candidate.missing.join(', ')})`
          : '';
        return `- ${text}${missing}`;
      })
      .filter(Boolean),
  ];
}

export function renderNextUnblock(audit) {
  const next = audit.nextUnblock;
  const lines = [
    '# Performance-OS Next Unblock',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
  ];

  if (!next) {
    lines.push('Next unblock: none');
    return lines.join('\n');
  }

  lines.push(`Next unblock: ${next.label}`);
  lines.push(`Command: ${next.command}`);
  lines.push(`Detail: ${nextDetailText(next)}`);
  lines.push(`Action: ${next.action}`);

  const targetSummary = targetLine(next.metadata);
  if (targetSummary) lines.push(targetSummary);
  const pathOrRunbook = metadataLine(next.metadata);
  if (pathOrRunbook) lines.push(pathOrRunbook);
  const checklist = checklistLine(next.metadata);
  if (checklist) lines.push(checklist);
  const packet = packetLine(next.metadata);
  if (packet) lines.push(packet);
  const fieldPacket = fieldPacketLine(next.metadata);
  if (fieldPacket) lines.push(fieldPacket);
  const recoveryPacket = recoveryPacketLine(next.metadata);
  if (recoveryPacket) lines.push(recoveryPacket);
  const optionSummary = optionsLine(next.metadata);
  if (optionSummary) lines.push(optionSummary);
  lines.push(...completionCandidateLines(next.metadata));

  return lines.join('\n');
}

export function exitCodeForAudit(audit, options = {}) {
  return options.failOnGated && audit.gate !== 'ready' ? 1 : 0;
}

function parseArgs(argv) {
  const result = {
    today: isoDate(new Date()),
    skipServer: false,
    failOnGated: false,
    nextUnblock: false,
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
    if (arg === '--fail-on-gated') {
      result.failOnGated = true;
      continue;
    }
    if (arg === '--next-unblock') {
      result.nextUnblock = true;
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
    console.log(JSON.stringify(args.nextUnblock ? audit.nextUnblock : audit, null, 2));
    process.exitCode = exitCodeForAudit(audit, args);
    return;
  }
  console.log(args.nextUnblock ? renderNextUnblock(audit) : renderPerformanceGateAudit(audit));
  process.exitCode = exitCodeForAudit(audit, args);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
