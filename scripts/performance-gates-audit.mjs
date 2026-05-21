#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const FUELING_EVIDENCE_CHECKLIST = 'docs/ai/checklists/fueling-evidence-capture.md';
const IPHONE_FIELD_CHECKLIST = 'docs/ai/checklists/iphone-pwa-qa.md';
const DEFAULT_PULSE_URL = 'https://192.168.178.46:5175';

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

function serverVerifyCommand(expectedCommit) {
  return `${serverEnvPrefix()}PULSE_EXPECTED_COMMIT=${expectedCommit} npm run verify:server`;
}

function serverRecoveryPacketCommand(expectedCommit) {
  return `${serverVerifyCommand(expectedCommit)} -- --packet`;
}

function commandWithServerEnv(command) {
  return `${serverEnvPrefix()}${command}`;
}

function pulseTargetUrl(targetPath) {
  const cleanPath = String(targetPath ?? '').trim();
  if (!cleanPath) return null;
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  const baseUrl = String(process.env.PULSE_URL ?? DEFAULT_PULSE_URL).trim() || DEFAULT_PULSE_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${cleanPath.replace(/^\/+/, '')}`;
}

function usage() {
  return [
    'Usage: node scripts/performance-gates-audit.mjs [options]',
    '',
    'Runs the current read-only Performance-OS gate audits in one snapshot.',
    '',
    'Options:',
    '  --today YYYY-MM-DD   Anchor date for the Fueling gate audit.',
    '  --skip-server        Do not run the SSH-backed server mirror verification; leaves that gate unverified.',
    '  --expected-commit <short>',
    '                       Expected deployed/server commit; default local git HEAD.',
    '  --fail-on-gated      Exit 1 when any Performance-OS gate is not ready.',
    '  --next-unblock       Print only the first open gate unblock; with --json prints that object.',
    '  --packet             Print one manual handoff packet for all open gates.',
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

function fuelingActionText(nextAction) {
  const action = [
    nextAction?.label,
    nextAction?.detail,
  ].filter(Boolean).join(' - ');
  if (action) return action;
  if (nextAction?.targetPath) return `Complete the Fueling evidence at ${nextAction.targetPath}.`;
  return 'Capture comparable during Fueling logs with activity/duration context, carbs and GI comfort.';
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
    : fuelingActionText(blockingUser.nextAction);

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
  const fieldPacketCommand = commandWithServerEnv(`${command} -- --expected-commit ${expectedCommit} --packet`);
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
    serverVerifyCommand: audit.serverVerifyCommand ?? serverVerifyCommand(expectedCommit),
    serverRecoveryPacketCommand: ready ? null : (audit.serverRecoveryPacketCommand ?? serverRecoveryPacketCommand(expectedCommit)),
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
  const command = serverVerifyCommand(expectedCommit);
  const recoveryPacketCommand = serverRecoveryPacketCommand(expectedCommit);
  const result = runner('bash', ['scripts/verify-server.sh'], {
    env: {
      ...(process.env.PULSE_HOST ? { PULSE_HOST: process.env.PULSE_HOST } : {}),
      PULSE_EXPECTED_COMMIT: expectedCommit,
    },
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
  const recoveryPacketCommand = serverRecoveryPacketCommand(expectedCommit);
  return {
    key: 'server',
    label: 'Server deploy mirror',
    gate: 'skipped',
    ready: false,
    skipped: true,
    command: serverVerifyCommand(expectedCommit),
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
      serverVerifyCommand: gate.serverVerifyCommand ?? null,
      serverRecoveryPacketCommand: gate.serverRecoveryPacketCommand ?? null,
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
  const metadata = nextUnblockMetadata(gate);
  return {
    key: gate.key,
    label: gate.label,
    command: gate.command,
    action: nextUnblockAction(gate, metadata),
    detail: gate.detail,
    metadata,
  };
}

function nextUnblockAction(gate, metadata) {
  if (gate.key !== 'fueling' || !metadata?.targetPath || typeof gate.nextAction !== 'string') {
    return gate.nextAction;
  }
  return gate.nextAction
    .replace(new RegExp(`\\s+-\\s+Path:\\s+${escapeRegExp(metadata.targetPath)}\\s*$`), '')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    if (gate.serverRecoveryPacketCommand) lines.push(`- Server recovery packet: \`${gate.serverRecoveryPacketCommand}\``);
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

function targetUrlLine(metadata) {
  const url = pulseTargetUrl(metadata?.targetPath);
  return url ? `Target URL: ${url}` : null;
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

function serverRecoveryPacketLine(metadata) {
  return metadata?.serverRecoveryPacketCommand ? `Server recovery packet: ${metadata.serverRecoveryPacketCommand}` : null;
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
  return `GI-Komfort-Optionen: ${options.map(option => `${option.value}=${option.label}`).join(', ')}`;
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
  const targetUrl = targetUrlLine(next.metadata);
  if (targetUrl) lines.push(targetUrl);
  const checklist = checklistLine(next.metadata);
  if (checklist) lines.push(checklist);
  const packet = packetLine(next.metadata);
  if (packet) lines.push(packet);
  const fieldPacket = fieldPacketLine(next.metadata);
  if (fieldPacket) lines.push(fieldPacket);
  const serverRecoveryPacket = serverRecoveryPacketLine(next.metadata);
  if (serverRecoveryPacket) lines.push(serverRecoveryPacket);
  const recoveryPacket = recoveryPacketLine(next.metadata);
  if (recoveryPacket) lines.push(recoveryPacket);
  const optionSummary = optionsLine(next.metadata);
  if (optionSummary) lines.push(optionSummary);
  lines.push(...completionCandidateLines(next.metadata));

  return lines.join('\n');
}

function packetGateLines(gate, index) {
  const metadata = nextUnblockMetadata(gate);
  const lines = [
    `${index + 1}. ${gate.label}`,
    `   Status: ${gate.gate}`,
    `   Detail: ${nextDetailText({ key: gate.key, detail: gate.detail, metadata })}`,
    `   Command: ${gate.command}`,
  ];
  if (gate.nextAction) lines.push(`   Action: ${nextUnblockAction(gate, metadata)}`);
  const target = targetSummary(metadata);
  if (target) lines.push(`   Target: ${target}`);
  if (metadata?.targetPath) lines.push(`   Target path: ${metadata.targetPath}`);
  const targetUrl = targetUrlLine(metadata);
  if (targetUrl) lines.push(`   ${targetUrl}`);
  if (metadata?.evidenceChecklist) lines.push(`   Evidence checklist: ${metadata.evidenceChecklist}`);
  if (metadata?.capturePacketCommand) lines.push(`   Evidence packet: ${metadata.capturePacketCommand}`);
  if (metadata?.fieldPacketCommand) lines.push(`   Field packet: ${metadata.fieldPacketCommand}`);
  if (metadata?.serverVerifyCommand) lines.push(`   Server verify: ${metadata.serverVerifyCommand}`);
  if (metadata?.serverRecoveryPacketCommand) lines.push(`   Server recovery packet: ${metadata.serverRecoveryPacketCommand}`);
  if (metadata?.recoveryRunbook) lines.push(`   Recovery runbook: ${metadata.recoveryRunbook}`);
  if (metadata?.recoveryPacketCommand) lines.push(`   Recovery packet: ${metadata.recoveryPacketCommand}`);
  const optionSummary = optionsLine(metadata);
  if (optionSummary) lines.push(`   ${optionSummary}`);
  return lines;
}

export function renderPerformanceGatePacket(audit) {
  const lines = [
    '# Performance-OS Gate Handoff Packet',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
    `Expected server commit: ${audit.expectedCommit}`,
    '',
  ];

  if (!audit.nextUnblock) {
    lines.push('No open Performance-OS gates. Rerun the normal audit before starting a new product package.');
    return lines.join('\n');
  }

  lines.push('## First Unblock');
  lines.push(`Gate: ${audit.nextUnblock.label}`);
  lines.push(`Detail: ${nextDetailText(audit.nextUnblock)}`);
  lines.push(`Action: ${audit.nextUnblock.action}`);
  const target = targetLine(audit.nextUnblock.metadata);
  if (target) lines.push(target);
  const pathOrRunbook = metadataLine(audit.nextUnblock.metadata);
  if (pathOrRunbook) lines.push(pathOrRunbook);
  const targetUrl = targetUrlLine(audit.nextUnblock.metadata);
  if (targetUrl) lines.push(targetUrl);
  const checklist = checklistLine(audit.nextUnblock.metadata);
  if (checklist) lines.push(checklist);
  const packet = packetLine(audit.nextUnblock.metadata);
  if (packet) lines.push(packet);
  const fieldPacket = fieldPacketLine(audit.nextUnblock.metadata);
  if (fieldPacket) lines.push(fieldPacket);
  const serverRecoveryPacket = serverRecoveryPacketLine(audit.nextUnblock.metadata);
  if (serverRecoveryPacket) lines.push(serverRecoveryPacket);
  const recoveryPacket = recoveryPacketLine(audit.nextUnblock.metadata);
  if (recoveryPacket) lines.push(recoveryPacket);
  const optionSummary = optionsLine(audit.nextUnblock.metadata);
  if (optionSummary) lines.push(optionSummary);
  lines.push(...completionCandidateLines(audit.nextUnblock.metadata));
  lines.push('');

  lines.push('## Ordered Open Gates');
  const openGates = audit.gates.filter(gate => !gate.ready);
  openGates.forEach((gate, index) => {
    lines.push(...packetGateLines(gate, index));
  });
  lines.push('');

  lines.push('## Manual Safety');
  lines.push('- Fueling GI comfort must come from the real stomach response; do not infer it from notes, route, RPE, g/h, result or pace.');
  lines.push('- Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly.');
  lines.push('- Real iPhone/PWA field evidence must be recorded against the expected commit for this run.');
  lines.push('- If the run is intentionally pinned to a known deployed/runtime commit, pass --expected-commit <short> so server and iPhone checks use that commit.');
  lines.push('- The server is a GitHub main mirror; do not edit, branch or commit on the server.');
  lines.push(`- Rerun after any manual save or deploy: npm run audit:performance-gates -- --today ${audit.date}`);

  return lines.join('\n');
}

export function exitCodeForAudit(audit, options = {}) {
  return options.failOnGated && audit.gate !== 'ready' ? 1 : 0;
}

function assertCommitish(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[0-9a-f]{7,40}$/i.test(text)) {
    throw new Error(`${label} must be a 7-40 character git commit hash`);
  }
  return text;
}

export function parseArgs(argv) {
  const result = {
    today: isoDate(new Date()),
    expectedCommit: null,
    skipServer: false,
    failOnGated: false,
    nextUnblock: false,
    packet: false,
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
    if (arg === '--expected-commit') {
      result.expectedCommit = assertCommitish(args[index + 1], '--expected-commit');
      index += 1;
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
    if (arg === '--packet') {
      result.packet = true;
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
  console.log(args.packet
    ? renderPerformanceGatePacket(audit)
    : args.nextUnblock ? renderNextUnblock(audit) : renderPerformanceGateAudit(audit));
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
