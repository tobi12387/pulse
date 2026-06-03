#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const FUELING_EVIDENCE_CHECKLIST = 'docs/ai/checklists/fueling-evidence-capture.md';
const IPHONE_FIELD_CHECKLIST = 'docs/ai/checklists/iphone-pwa-qa.md';
const DEFAULT_PULSE_URL = 'https://192.168.178.46:5175';
const SESSION_GATE_ALIASES = new Map([
  ['fueling', 'fueling'],
  ['fuel', 'fueling'],
  ['nutrition', 'fueling'],
  ['iphone_pwa', 'iphone_pwa'],
  ['iphone-pwa', 'iphone_pwa'],
  ['iphone', 'iphone_pwa'],
  ['pwa', 'iphone_pwa'],
  ['field', 'iphone_pwa'],
  ['server', 'server'],
  ['deploy', 'server'],
]);
const SESSION_GATE_KEYS = [...new Set(SESSION_GATE_ALIASES.values())];
const APP_RUNTIME_PATHS = [
  'frontend',
  'backend',
  'shared',
  'package.json',
  'package-lock.json',
];

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

function iphoneGateCommand(expectedCommit) {
  return commandWithServerEnv(`npm run audit:iphone-pwa-gate -- --expected-commit ${expectedCommit}`);
}

function pulseTargetUrl(targetPath) {
  const cleanPath = String(targetPath ?? '').trim();
  if (!cleanPath) return null;
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  const baseUrl = String(process.env.PULSE_URL ?? DEFAULT_PULSE_URL).trim() || DEFAULT_PULSE_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${cleanPath.replace(/^\/+/, '')}`;
}

export function usage() {
  return [
    'Usage: node scripts/performance-gates-audit.mjs [options]',
    '',
    'Runs the current read-only Performance-OS gate audits in one snapshot.',
    '',
    'Options:',
    '  --today YYYY-MM-DD   Anchor date for the Fueling gate audit.',
    '  --skip-server        Do not run the SSH-backed server mirror verification; leaves that gate unverified.',
    '  --local-planning     Defer server mirror verification for feature-branch planning; do not count it as the next open gate. Defaults expected commit to origin/main.',
    '                       Handoff modes auto-apply this behavior on feature branches unless --expected-commit or --skip-server is passed.',
    '  --expected-commit <short>',
    '                       Expected deployed/server commit; default local git HEAD.',
    '  --fail-on-gated      Exit 1 when any Performance-OS gate is not ready.',
    '  --next-unblock       Print only the first open gate unblock; with --json prints that object.',
    '  --target-url         Print only the first open gate target URL; exits 1 if unavailable.',
    '  --target-urls        Print all first open gate target URLs, one per line; exits 1 if unavailable.',
    '  --packet             Print one manual handoff packet for all open gates.',
    '  --manual-checklist   Print a concise checkbox checklist for the manual gate session.',
    '  --session-card       Print a compact copyable card for the next manual gate session.',
    '  --gate <key>         With --session-card, choose a specific open gate: fueling, iphone_pwa, server.',
    '  --all                With --session-card, print compact cards for all open gates in audit order.',
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
    ?? stderrLines.find(line => /^Error \[|Cannot find package|ERR_/i.test(line))
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
  const targetPath = candidate.targetPath ?? null;
  return {
    date: candidate.date ?? null,
    activityName: candidate.activityName ?? null,
    activityType: candidate.activityType ?? null,
    durationMin: candidate.durationMin ?? null,
    carbsG: candidate.carbsG ?? null,
    carbsPerHour: candidate.carbsPerHour ?? null,
    summary: formatCandidateSummary(candidate),
    status: candidate.status ?? null,
    targetPath,
    targetUrl: candidate.targetUrl ?? pulseTargetUrl(targetPath),
    missing: candidate.missing ?? [],
  };
}

function summarizeFuelingTargetLog(targetLog, fallbackPath = null) {
  if (!targetLog) return null;
  const targetPath = targetLog.targetPath ?? fallbackPath;
  return {
    date: targetLog.date ?? null,
    activityName: targetLog.activityName ?? null,
    activityType: targetLog.activityType ?? null,
    durationMin: targetLog.durationMin ?? null,
    carbsG: targetLog.carbsG ?? null,
    carbsPerHour: targetLog.carbsPerHour ?? null,
    targetPath,
    targetUrl: targetLog.targetUrl ?? pulseTargetUrl(targetPath),
    summary: formatCandidateSummary(targetLog),
  };
}

function summarizeFuelingNextAction(nextAction) {
  if (!nextAction) return null;
  const targetPath = nextAction.targetPath ?? null;
  const targetLog = nextAction.targetLog
    ? summarizeFuelingTargetLog(nextAction.targetLog, targetPath)
    : null;
  return {
    ...nextAction,
    targetPath,
    targetUrl: nextAction.targetUrl ?? targetLog?.targetUrl ?? pulseTargetUrl(targetPath),
    targetLog,
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
  const nextPromptCommand = `${commandText} --next-prompt`;
  const checklistCommandFor = user => Number(user?.newLogsStillNeeded ?? 0) > 0
    ? `${commandText} --new-log-checklist`
    : null;

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
      nextAction: summarizeFuelingNextAction(user.nextAction),
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
    nextPromptCommand: ready ? null : nextPromptCommand,
    newLogChecklistCommand: ready ? null : checklistCommandFor(blockingUser),
    users: summaryUsers,
    completionCandidates,
  };
}

function summarizeIphone(expectedCommit, runner) {
  const command = iphoneGateCommand(expectedCommit);
  const fieldPacketCommand = `${command} --packet`;
  const fieldPromptCommand = `${command} --next-prompt`;
  const fieldScaffoldCommand = `${command} --scaffold`;
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
      fieldPromptCommand,
      fieldScaffoldCommand,
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
    fieldPromptCommand: ready ? null : fieldPromptCommand,
    fieldScaffoldCommand: ready ? null : fieldScaffoldCommand,
    serverVerifyCommand: audit.serverVerifyCommand ?? serverVerifyCommand(expectedCommit),
    serverRecoveryPacketCommand: ready ? null : (audit.serverRecoveryPacketCommand ?? serverRecoveryPacketCommand(expectedCommit)),
    settingsFieldUrl: audit.settingsFieldUrl ?? null,
    evidenceFile: audit.evidenceFile,
    expectedCommit: audit.expectedCommit ?? null,
    expectedRuntimeCommit: audit.expectedRuntimeCommit ?? null,
    fieldRuntimeCommit: audit.fieldRuntimeCommit ?? null,
    commitStatus: audit.commitStatus ?? null,
    serverCommitUnderTest: audit.scope?.serverCommit ?? null,
    gaps: audit.gaps ?? [],
  };
}

function iphoneServerReadyAction(expectedCommit) {
  return `Rerun the real iPhone checklist, record Server commit under test: ${expectedCommit}, and copy the observed Settings App-Stand as App runtime commit under test.`;
}

function refineIphoneGateForServer(gate, serverGate, expectedCommit) {
  if (gate.key !== 'iphone_pwa' || gate.ready || !serverGate?.ready) return gate;

  const verifyAction = `Verify the server mirror is on ${expectedCommit}, rerun the real iPhone checklist and record Server commit under test: ${expectedCommit}.`;
  const action = iphoneServerReadyAction(expectedCommit);
  const refineGap = gap => {
    if (gap?.kind !== 'current_commit_evidence' || gap.nextAction !== verifyAction) return gap;
    return { ...gap, nextAction: action };
  };

  return {
    ...gate,
    nextAction: gate.nextAction === verifyAction ? action : gate.nextAction,
    serverRecoveryPacketCommand: null,
    gaps: (gate.gaps ?? []).map(refineGap),
  };
}

function resolveGitCommit(runner, ref) {
  const result = runner('git', ['rev-parse', '--short', ref]);
  if (result.status !== 0) return 'unknown';
  return result.stdout.trim() || 'unknown';
}

function commitsMatch(left, right) {
  if (!left || !right || left === 'unknown' || right === 'unknown') return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function resolveAppRuntimeCommit(runner, ref) {
  if (!ref || ref === 'unknown') return null;
  const result = runner('git', [
    'log',
    '-1',
    '--format=%h',
    ref,
    '--',
    ...APP_RUNTIME_PATHS,
  ]);
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function resolveExpectedCommit(runner) {
  return resolveGitCommit(runner, 'HEAD');
}

function resolveLocalPlanningCommit(runner) {
  const mainCommit = resolveGitCommit(runner, 'origin/main');
  return mainCommit === 'unknown' ? resolveExpectedCommit(runner) : mainCommit;
}

function resolveLocalBranch(runner) {
  const result = runner('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (result.status !== 0) return 'unknown';
  return result.stdout.trim() || 'unknown';
}

function wantsManualHandoff(options) {
  return Boolean(options.packet
    || options.manualChecklist
    || options.sessionCard
    || options.nextUnblock
    || options.targetUrl
    || options.targetUrls);
}

function shouldAutoLocalPlanning(options, localBranch) {
  return wantsManualHandoff(options)
    && !options.localPlanning
    && !options.skipServer
    && !options.expectedCommit
    && localBranch !== 'main'
    && localBranch !== 'unknown';
}

function serverIssueKind(detail) {
  if (/server branch is|server worktree is dirty|server commit .* != expected/i.test(detail)) {
    return 'mirror_state';
  }
  if (/ssh access|permission denied|publickey|non-interactive ssh/i.test(detail)) {
    return 'ssh_auth';
  }
  return 'unknown';
}

function serverNextAction(issueKind, recoveryRunbook, command, expectedCommit) {
  if (issueKind === 'mirror_state') {
    return `Restore the server mirror to clean GitHub main at ${expectedCommit} using docs/ai/checklists/server-mirror-recovery.md, then rerun ${command}. If the server is clean, switch/pull main and deploy from main; if dirty, inspect before changing state. Do not edit server files directly.`;
  }
  return `Restore non-interactive SSH auth using ${recoveryRunbook}, then rerun ${command}.`;
}

function cleanMainServerCommit(output) {
  return firstMatch(output, /branch=main\s+commit=([^\s]+)\s+dirty=0/);
}

function runtimeEquivalentServer(expectedCommit, serverCommit, runner) {
  const expectedRuntimeCommit = resolveAppRuntimeCommit(runner, expectedCommit);
  const serverRuntimeCommit = resolveAppRuntimeCommit(runner, serverCommit);
  if (!commitsMatch(expectedRuntimeCommit, serverRuntimeCommit)) return null;
  return {
    expectedRuntimeCommit,
    serverRuntimeCommit,
  };
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
  const detail = ready
    ? `Server mirror verified against expected commit ${expectedCommit}.`
    : compactCommandError(result);
  const issueKind = ready ? null : serverIssueKind(detail);
  const serverCommit = ready ? expectedCommit : cleanMainServerCommit(combinedOutput);
  const runtimeEquivalence = !ready && issueKind === 'mirror_state' && /server commit .* != expected/i.test(detail)
    ? runtimeEquivalentServer(expectedCommit, serverCommit, runner)
    : null;

  if (runtimeEquivalence) {
    return {
      key: 'server',
      label: 'Server deploy mirror',
      gate: 'ready',
      ready: true,
      command,
      detail: `Server mirror is clean main at ${serverCommit}; app runtime matches expected ${expectedCommit} via runtime commit ${runtimeEquivalence.expectedRuntimeCommit}.`,
      nextAction: 'No server mirror action needed; docs/tooling-only drift does not change the deployed app runtime.',
      expectedCommit: outputCommit,
      serverCommit,
      commitStatus: 'current_runtime',
      expectedRuntimeCommit: runtimeEquivalence.expectedRuntimeCommit,
      serverRuntimeCommit: runtimeEquivalence.serverRuntimeCommit,
      recoveryRunbook: null,
      recoveryPacketCommand: null,
    };
  }

  return {
    key: 'server',
    label: 'Server deploy mirror',
    gate: ready ? 'ready' : 'gated',
    ready,
    command,
    detail,
    nextAction: ready
      ? 'No server mirror action needed.'
      : serverNextAction(issueKind, recoveryRunbook, command, expectedCommit),
    expectedCommit: outputCommit,
    recoveryRunbook: !ready && issueKind === 'ssh_auth' ? recoveryRunbook : null,
    recoveryPacketCommand: !ready && issueKind === 'ssh_auth' ? recoveryPacketCommand : null,
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

function deferredServer(expectedCommit) {
  return {
    key: 'server',
    label: 'Server deploy mirror',
    gate: 'deferred',
    ready: false,
    deferred: true,
    command: serverVerifyCommand(expectedCommit),
    detail: 'Deferred by --local-planning; server mirror readiness is intentionally outside this feature-branch planning snapshot.',
    nextAction: 'Run the normal server mirror verification from clean main before deploy-sensitive decisions or current iPhone field evidence.',
    expectedCommit,
    recoveryRunbook: null,
    recoveryPacketCommand: null,
  };
}

function fuelingNextAction(gate) {
  return fuelingBlockingUser(gate)?.nextAction ?? null;
}

function nextUnblockMetadata(gate) {
  if (gate.key === 'fueling') {
    const user = fuelingBlockingUser(gate);
    const nextAction = fuelingNextAction(gate);
    const fallbackCandidate = gate.completionCandidates?.find(candidate => candidate.targetPath) ?? null;
    const targetPath = nextAction?.targetPath ?? fallbackCandidate?.targetPath ?? null;
    const targetLog = nextAction?.targetLog ?? fallbackCandidate;
    return {
      kind: nextAction?.kind ?? null,
      targetPath,
      targetUrl: nextAction?.targetUrl ?? targetLog?.targetUrl ?? pulseTargetUrl(targetPath),
      date: nextAction?.date ?? null,
      evidenceChecklist: nextAction?.evidenceChecklist ?? gate.evidenceChecklist ?? FUELING_EVIDENCE_CHECKLIST,
      capturePacketCommand: gate.capturePacketCommand ?? null,
      nextPromptCommand: gate.nextPromptCommand ?? null,
      newLogChecklistCommand: gate.newLogChecklistCommand ?? null,
      options: nextAction?.options ?? [],
      status: user ? {
        comparableCompleteLogs: user.comparableCompleteLogs ?? null,
        requiredComparableCompleteLogs: user.requiredComparableCompleteLogs ?? null,
        completableNow: user.completableNow ?? null,
        newLogsStillNeeded: user.newLogsStillNeeded ?? null,
      } : null,
      targetLog,
      completionCandidates: gate.completionCandidates ?? [],
    };
  }
  if (gate.key === 'iphone_pwa') {
    const firstGap = gate.gaps?.[0] ?? null;
    return {
      evidenceChecklist: gate.evidenceChecklist ?? IPHONE_FIELD_CHECKLIST,
      evidenceFile: gate.evidenceFile ?? null,
      expectedCommit: gate.expectedCommit ?? null,
      expectedRuntimeCommit: gate.expectedRuntimeCommit ?? null,
      fieldRuntimeCommit: gate.fieldRuntimeCommit ?? null,
      commitStatus: gate.commitStatus ?? null,
      serverCommitUnderTest: gate.serverCommitUnderTest ?? null,
      fieldPacketCommand: gate.fieldPacketCommand ?? null,
      fieldPromptCommand: gate.fieldPromptCommand ?? null,
      fieldScaffoldCommand: gate.fieldScaffoldCommand ?? null,
      settingsFieldUrl: gate.settingsFieldUrl ?? null,
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

function isOpenGate(gate) {
  return !gate.ready && !gate.deferred;
}

function deferredGates(gates) {
  return gates.filter(gate => gate.deferred);
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
  const localBranch = resolveLocalBranch(runner);
  const autoLocalPlanning = shouldAutoLocalPlanning(options, localBranch);
  const localPlanning = Boolean(options.localPlanning || autoLocalPlanning);
  const expectedCommit = options.expectedCommit
    ?? (localPlanning ? resolveLocalPlanningCommit(runner) : resolveExpectedCommit(runner));
  const fuelingGate = summarizeFueling(today, runner);
  const rawIphoneGate = summarizeIphone(expectedCommit, runner);
  const serverGate = localPlanning
    ? deferredServer(expectedCommit)
    : options.skipServer ? skippedServer(expectedCommit) : summarizeServer(expectedCommit, runner);
  const iphoneGate = refineIphoneGateForServer(rawIphoneGate, serverGate, expectedCommit);
  const gates = [
    fuelingGate,
    iphoneGate,
    serverGate,
  ];
  const openGateList = gates.filter(isOpenGate);
  const deferredGateList = deferredGates(gates);

  return {
    date: today,
    localPlanning,
    autoLocalPlanning,
    localBranch,
    gate: openGateList.length === 0
      ? deferredGateList.length > 0 ? 'planning_ready' : 'ready'
      : 'gated',
    openGates: openGateList.length,
    deferredGates: deferredGateList.length,
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
    ...(audit.deferredGates ? [`Deferred gates: ${audit.deferredGates}`] : []),
    `Expected server commit: ${audit.expectedCommit}`,
    ...planningModeLines(audit),
    `Next unblock: ${audit.nextUnblock ? audit.nextUnblock.label : 'none'}`,
  ];
  if (audit.nextUnblock) lines.push(`Next action: ${audit.nextUnblock.action}`);
  const nextTarget = targetSummary(audit.nextUnblock?.metadata);
  if (nextTarget) lines.push(`Next target: ${nextTarget}`);
  const nextTargetUrl = targetUrlValue(audit.nextUnblock?.metadata);
  if (nextTargetUrl) lines.push(`Next target URL: ${nextTargetUrl}`);
  const nextOptions = optionsLine(audit.nextUnblock?.metadata);
  if (nextOptions) lines.push(`Next ${nextOptions}`);
  lines.push('');

  for (const gate of audit.gates) {
    lines.push(`## ${gate.label}`);
    lines.push(`- Status: ${gate.gate}`);
    lines.push(`- Command: \`${gate.command}\``);
    lines.push(`- Detail: ${gate.detail}`);
    lines.push(`- Next: ${gate.nextAction}`);
    if (gate.evidenceChecklist) lines.push(`- Evidence checklist: ${gate.evidenceChecklist}`);
    if (gate.capturePacketCommand) lines.push(`- Evidence packet: \`${gate.capturePacketCommand}\``);
    if (gate.nextPromptCommand) lines.push(`- Next prompt: \`${gate.nextPromptCommand}\``);
    if (gate.newLogChecklistCommand) lines.push(`- New log checklist: \`${gate.newLogChecklistCommand}\``);
    if (gate.fieldPacketCommand) lines.push(`- Field packet: \`${gate.fieldPacketCommand}\``);
    if (gate.fieldPromptCommand) lines.push(`- Field prompt: \`${gate.fieldPromptCommand}\``);
    if (gate.fieldScaffoldCommand) lines.push(`- Field scaffold: \`${gate.fieldScaffoldCommand}\``);
    if (gate.settingsFieldUrl) lines.push(`- Settings field URL: ${gate.settingsFieldUrl}`);
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
  const url = targetUrlValue(metadata);
  return url ? `Target URL: ${url}` : null;
}

function targetUrlValue(metadata) {
  return metadata?.targetUrl ?? pulseTargetUrl(metadata?.targetPath);
}

function checklistLine(metadata) {
  return metadata?.evidenceChecklist ? `Evidence checklist: ${metadata.evidenceChecklist}` : null;
}

function packetLine(metadata) {
  return metadata?.capturePacketCommand ? `Evidence packet: ${metadata.capturePacketCommand}` : null;
}

function nextPromptLine(metadata) {
  return metadata?.nextPromptCommand ? `Next prompt: ${metadata.nextPromptCommand}` : null;
}

function newLogChecklistLine(metadata) {
  return metadata?.newLogChecklistCommand ? `New log checklist: ${metadata.newLogChecklistCommand}` : null;
}

function fieldPacketLine(metadata) {
  return metadata?.fieldPacketCommand ? `Field packet: ${metadata.fieldPacketCommand}` : null;
}

function fieldPromptLine(metadata) {
  return metadata?.fieldPromptCommand ? `Field prompt: ${metadata.fieldPromptCommand}` : null;
}

function fieldScaffoldLine(metadata) {
  return metadata?.fieldScaffoldCommand ? `Field scaffold: ${metadata.fieldScaffoldCommand}` : null;
}

function settingsFieldLine(metadata) {
  return metadata?.settingsFieldUrl ? `Settings field URL: ${metadata.settingsFieldUrl}` : null;
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
        const targetUrl = candidate.targetUrl ? ` | Target URL: ${candidate.targetUrl}` : '';
        const missing = (candidate.missing ?? []).length > 0
          ? ` (missing: ${candidate.missing.join(', ')})`
          : '';
        return `- ${text}${targetUrl}${missing}`;
      })
      .filter(Boolean),
  ];
}

function manualSafetyLinesForNext(next) {
  if (!next) return [];
  if (next.key === 'fueling') {
    return [
      'Manual safety:',
      '- GI comfort must come from the real stomach response; do not infer it from notes, route, RPE, g/h, result or pace.',
      '- Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly.',
    ];
  }
  if (next.key === 'iphone_pwa') {
    return [
      'Manual safety:',
      '- Real iPhone/PWA field evidence must record the expected server commit and the observed Settings App-Stand for this run.',
      '- The server is a GitHub main mirror; do not edit, branch or commit on the server.',
    ];
  }
  if (next.key === 'server') {
    return [
      'Manual safety:',
      '- The server is a GitHub main mirror; do not edit, branch or commit on the server.',
    ];
  }
  return [];
}

export function renderNextUnblock(audit) {
  const next = audit.nextUnblock;
  const lines = [
    '# Performance-OS Next Unblock',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
    ...(audit.deferredGates ? [`Deferred gates: ${audit.deferredGates}`] : []),
    ...planningModeLines(audit),
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
  const settingsField = settingsFieldLine(next.metadata);
  if (settingsField) lines.push(settingsField);
  const checklist = checklistLine(next.metadata);
  if (checklist) lines.push(checklist);
  const packet = packetLine(next.metadata);
  if (packet) lines.push(packet);
  const nextPrompt = nextPromptLine(next.metadata);
  if (nextPrompt) lines.push(nextPrompt);
  const newLogChecklist = newLogChecklistLine(next.metadata);
  if (newLogChecklist) lines.push(newLogChecklist);
  const fieldPacket = fieldPacketLine(next.metadata);
  if (fieldPacket) lines.push(fieldPacket);
  const fieldPrompt = fieldPromptLine(next.metadata);
  if (fieldPrompt) lines.push(fieldPrompt);
  const fieldScaffold = fieldScaffoldLine(next.metadata);
  if (fieldScaffold) lines.push(fieldScaffold);
  const serverRecoveryPacket = serverRecoveryPacketLine(next.metadata);
  if (serverRecoveryPacket) lines.push(serverRecoveryPacket);
  const recoveryPacket = recoveryPacketLine(next.metadata);
  if (recoveryPacket) lines.push(recoveryPacket);
  const optionSummary = optionsLine(next.metadata);
  if (optionSummary) lines.push(optionSummary);
  lines.push(...completionCandidateLines(next.metadata));
  lines.push(...manualSafetyLinesForNext(next));

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
  if (metadata?.settingsFieldUrl) lines.push(`   Settings field URL: ${metadata.settingsFieldUrl}`);
  if (metadata?.evidenceChecklist) lines.push(`   Evidence checklist: ${metadata.evidenceChecklist}`);
  if (metadata?.capturePacketCommand) lines.push(`   Evidence packet: ${metadata.capturePacketCommand}`);
  if (metadata?.nextPromptCommand) lines.push(`   Next prompt: ${metadata.nextPromptCommand}`);
  if (metadata?.newLogChecklistCommand) lines.push(`   New log checklist: ${metadata.newLogChecklistCommand}`);
  if (metadata?.fieldPacketCommand) lines.push(`   Field packet: ${metadata.fieldPacketCommand}`);
  if (metadata?.fieldPromptCommand) lines.push(`   Field prompt: ${metadata.fieldPromptCommand}`);
  if (metadata?.fieldScaffoldCommand) lines.push(`   Field scaffold: ${metadata.fieldScaffoldCommand}`);
  if (metadata?.serverVerifyCommand) lines.push(`   Server verify: ${metadata.serverVerifyCommand}`);
  if (metadata?.serverRecoveryPacketCommand) lines.push(`   Server recovery packet: ${metadata.serverRecoveryPacketCommand}`);
  if (metadata?.recoveryRunbook) lines.push(`   Recovery runbook: ${metadata.recoveryRunbook}`);
  if (metadata?.recoveryPacketCommand) lines.push(`   Recovery packet: ${metadata.recoveryPacketCommand}`);
  const optionSummary = optionsLine(metadata);
  if (optionSummary) lines.push(`   ${optionSummary}`);
  return lines;
}

function rerunPerformanceGateCommand(audit) {
  const modeFlag = audit.localPlanning ? ' --local-planning' : '';
  return commandWithServerEnv(`npm run audit:performance-gates -- --today ${audit.date}${modeFlag}`);
}

export function renderPerformanceGatePacket(audit) {
  const lines = [
    '# Performance-OS Gate Handoff Packet',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
    ...(audit.deferredGates ? [`Deferred gates: ${audit.deferredGates}`] : []),
    `Expected server commit: ${audit.expectedCommit}`,
    ...planningModeLines(audit),
    '',
  ];

  if (!audit.nextUnblock) {
    if (audit.deferredGates) {
      lines.push(`No open manual Performance-OS gates in this local-planning snapshot. Rerun ${rerunPerformanceGateCommand(audit)} after manual saves, and rerun the normal audit before deploy-sensitive decisions.`);
      lines.push('');
      lines.push('## Deferred Gates');
      deferredGates(audit.gates).forEach((gate, index) => {
        lines.push(...packetGateLines(gate, index));
      });
      return lines.join('\n');
    }
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
  const nextPrompt = nextPromptLine(audit.nextUnblock.metadata);
  if (nextPrompt) lines.push(nextPrompt);
  const newLogChecklist = newLogChecklistLine(audit.nextUnblock.metadata);
  if (newLogChecklist) lines.push(newLogChecklist);
  const fieldPacket = fieldPacketLine(audit.nextUnblock.metadata);
  if (fieldPacket) lines.push(fieldPacket);
  const fieldPrompt = fieldPromptLine(audit.nextUnblock.metadata);
  if (fieldPrompt) lines.push(fieldPrompt);
  const fieldScaffold = fieldScaffoldLine(audit.nextUnblock.metadata);
  if (fieldScaffold) lines.push(fieldScaffold);
  const serverRecoveryPacket = serverRecoveryPacketLine(audit.nextUnblock.metadata);
  if (serverRecoveryPacket) lines.push(serverRecoveryPacket);
  const recoveryPacket = recoveryPacketLine(audit.nextUnblock.metadata);
  if (recoveryPacket) lines.push(recoveryPacket);
  const optionSummary = optionsLine(audit.nextUnblock.metadata);
  if (optionSummary) lines.push(optionSummary);
  lines.push(...completionCandidateLines(audit.nextUnblock.metadata));
  lines.push('');

  lines.push('## Ordered Open Gates');
  const openGates = audit.gates.filter(isOpenGate);
  openGates.forEach((gate, index) => {
    lines.push(...packetGateLines(gate, index));
  });
  const deferred = deferredGates(audit.gates);
  if (deferred.length > 0) {
    lines.push('');
    lines.push('## Deferred Gates');
    deferred.forEach((gate, index) => {
      lines.push(...packetGateLines(gate, index));
    });
  }
  lines.push('');

  lines.push('## Manual Safety');
  lines.push('- Fueling GI comfort must come from the real stomach response; do not infer it from notes, route, RPE, g/h, result or pace.');
  lines.push('- Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly.');
  lines.push('- Real iPhone/PWA field evidence must record the expected server commit and the observed Settings App-Stand for this run.');
  lines.push('- If the run is intentionally pinned to a known deployed/runtime commit, pass --expected-commit <short> so server and iPhone checks use that commit.');
  lines.push('- The server is a GitHub main mirror; do not edit, branch or commit on the server.');
  lines.push(`- Rerun after any manual save or deploy: ${rerunPerformanceGateCommand(audit)}`);

  return lines.join('\n');
}

function manualChecklistHeader(audit) {
  return [
    '# Performance-OS Manual Checklist',
    '',
    `Date: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Open gates: ${audit.openGates}`,
    ...(audit.deferredGates ? [`Deferred gates: ${audit.deferredGates}`] : []),
    `Expected server commit: ${audit.expectedCommit}`,
    ...planningModeLines(audit),
    '',
  ];
}

function planningModeLines(audit) {
  if (!audit.autoLocalPlanning) return [];
  return [
    `Planning mode: auto-local from feature branch ${audit.localBranch}; server mirror verification is deferred until clean main.`,
  ];
}

function checkbox(text) {
  return `- [ ] ${text}`;
}

function commandText(command) {
  return `\`${command}\``;
}

function compactOptionsText(metadata) {
  const options = metadata?.options ?? [];
  return options.length
    ? options.map(option => `${option.value}=${option.label}`).join(', ')
    : 'ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme';
}

function manualGateHeading(gate, index) {
  return [
    `## ${index + 1}. ${gate.label}`,
    '',
    `Status: ${gate.gate}`,
    `Detail: ${nextDetailText({ key: gate.key, detail: gate.detail, metadata: nextUnblockMetadata(gate) })}`,
    '',
  ];
}

function renderFuelingManualChecklist(gate, index) {
  const metadata = nextUnblockMetadata(gate);
  const lines = manualGateHeading(gate, index);
  const candidates = metadata?.completionCandidates ?? [];
  const options = compactOptionsText(metadata);

  if (candidates.length > 0) {
    candidates.forEach((candidate, candidateIndex) => {
      const target = candidate.targetUrl ?? candidate.targetPath;
      const summary = candidate.summary ?? completionCandidateText(candidate) ?? `Candidate ${candidateIndex + 1}`;
      const missing = (candidate.missing ?? []).join(', ') || 'missing evidence';
      lines.push(checkbox(target ? `Open ${target} for ${summary}.` : `Open the Activity Fueling target for ${summary}.`));
      lines.push(checkbox(`Confirm activity/date/duration/carbs match, then capture only the real missing evidence (${missing}).`));
      if ((candidate.missing ?? []).includes('GI comfort')) {
        lines.push(checkbox(`Choose exactly one real GI comfort value: ${options}; do not infer it from notes, route, RPE, g/h, result or pace.`));
      }
    });
  } else {
    const target = metadata?.targetUrl ?? metadata?.targetPath;
    if (target) lines.push(checkbox(`Open ${target} and follow the current Fueling action.`));
  }

  const newLogsStillNeeded = Number(metadata?.status?.newLogsStillNeeded ?? 0);
  if (newLogsStillNeeded > 0) {
    lines.push(checkbox(`After existing candidates, capture ${countText(newLogsStillNeeded, 'new complete long-session log')} with activity/duration, during carbs and structured GI comfort together.`));
    if (metadata?.newLogChecklistCommand) {
      lines.push(checkbox(`Use the future-log scaffold when ready: ${commandText(metadata.newLogChecklistCommand)}.`));
    }
  }
  if (metadata?.capturePacketCommand) {
    lines.push(checkbox(`Use the detailed Fueling packet if anything changed: ${commandText(metadata.capturePacketCommand)}.`));
  }
  if (metadata?.nextPromptCommand) {
    lines.push(checkbox(`Use the short first-target prompt for a manual capture/chat handoff: ${commandText(metadata.nextPromptCommand)}.`));
  }
  lines.push(checkbox(`Rerun the Fueling gate after each save: ${commandText(gate.command)}.`));
  return lines;
}

function renderIphoneManualChecklist(gate, index) {
  const metadata = nextUnblockMetadata(gate);
  const lines = manualGateHeading(gate, index);
  if (metadata?.serverVerifyCommand) {
    lines.push(checkbox(`Verify the server mirror before recording current field evidence: ${commandText(metadata.serverVerifyCommand)}.`));
  }
  if (metadata?.serverRecoveryPacketCommand) {
    lines.push(checkbox(`If SSH fails before server checks, use the read-only recovery packet: ${commandText(metadata.serverRecoveryPacketCommand)}.`));
  }
  if (metadata?.settingsFieldUrl) {
    lines.push(checkbox(`Open the Settings field proof on the real iPhone/PWA: ${metadata.settingsFieldUrl}.`));
    lines.push(checkbox('Record Device, iOS, launch mode and observed Settings App-Stand as App runtime commit under test.'));
  }
  if (metadata?.fieldScaffoldCommand) {
    lines.push(checkbox(`Print the self-contained field scaffold with server preflight, open gaps and paste-ready evidence record: ${commandText(metadata.fieldScaffoldCommand)}.`));
  }
  if (metadata?.fieldPromptCommand) {
    lines.push(checkbox(`Print the short first-gap field prompt for a manual capture/chat handoff: ${commandText(metadata.fieldPromptCommand)}.`));
  }
  for (const gap of gate.gaps ?? []) {
    const nextAction = gap.nextAction ? ` ${gap.nextAction}` : '';
    lines.push(checkbox(`${gap.label} (${gap.status}).${nextAction}`));
  }
  if (metadata?.evidenceFile) {
    lines.push(checkbox(`Append the new real-device run to ${metadata.evidenceFile}.`));
  }
  lines.push(checkbox(`Rerun the iPhone/PWA gate after recording evidence: ${commandText(gate.command)}.`));
  return lines;
}

function renderServerManualChecklist(gate, index) {
  const metadata = nextUnblockMetadata(gate);
  const lines = manualGateHeading(gate, index);
  lines.push(checkbox(`Run the server mirror verification: ${commandText(gate.command)}.`));
  if (metadata?.recoveryPacketCommand) {
    lines.push(checkbox(`If SSH auth blocks verification, use the read-only recovery packet: ${commandText(metadata.recoveryPacketCommand)}.`));
  }
  if (metadata?.recoveryRunbook) {
    lines.push(checkbox(`Follow the recovery runbook before any deploy-sensitive decision: ${metadata.recoveryRunbook}.`));
  }
  return lines;
}

function renderManualChecklistGate(gate, index) {
  if (gate.key === 'fueling') return renderFuelingManualChecklist(gate, index);
  if (gate.key === 'iphone_pwa') return renderIphoneManualChecklist(gate, index);
  if (gate.key === 'server') return renderServerManualChecklist(gate, index);
  return [
    ...manualGateHeading(gate, index),
    checkbox(`Run the gate command: ${commandText(gate.command)}.`),
  ];
}

export function renderPerformanceManualChecklist(audit) {
  const lines = manualChecklistHeader(audit);
  const openGates = audit.gates.filter(isOpenGate);

  if (openGates.length === 0) {
    if (audit.deferredGates) {
      lines.push('No open manual Performance-OS gates in this local-planning snapshot.');
      lines.push(checkbox(`Rerun after manual saves: ${commandText(rerunPerformanceGateCommand(audit))}.`));
      lines.push(checkbox('Rerun the normal audit from clean main before deploy-sensitive decisions or current iPhone field evidence.'));
      return lines.join('\n');
    }
    lines.push('No open Performance-OS gates.');
    lines.push(checkbox('Rerun the normal audit before starting a new product package.'));
    return lines.join('\n');
  }

  openGates.forEach((gate, index) => {
    if (index > 0) lines.push('');
    lines.push(...renderManualChecklistGate(gate, index));
  });

  const deferred = deferredGates(audit.gates);
  if (deferred.length > 0) {
    lines.push('');
    lines.push('## Deferred Gates');
    deferred.forEach((gate, index) => {
      lines.push(checkbox(`${index + 1}. ${gate.label}: ${gate.detail} Run later with ${commandText(gate.command)}.`));
    });
  }

  lines.push('');
  lines.push('## Manual Safety');
  lines.push('- GI comfort must come from the real stomach response; do not infer it from notes, route, RPE, g/h, result or pace.');
  lines.push('- Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly.');
  lines.push('- Real iPhone/PWA field evidence must record the expected server commit and the observed Settings App-Stand for this run.');
  lines.push('- The server is a GitHub main mirror; do not edit, branch or commit on the server.');
  lines.push(`- Rerun after any manual save or deploy: ${rerunPerformanceGateCommand(audit)}`);

  return lines.join('\n');
}

function performanceChecklistCommand(audit) {
  const modeFlag = audit.localPlanning ? ' --local-planning' : '';
  return commandWithServerEnv(`npm run audit:performance-checklist -- --today ${audit.date}${modeFlag}`);
}

function renderFuelingSessionCard(next, audit) {
  const metadata = next.metadata ?? {};
  const lines = [];
  const target = targetSummary(metadata);
  const targetUrl = targetUrlValue(metadata);
  const options = compactOptionsText(metadata);
  const candidates = metadata.completionCandidates ?? [];
  const hasFuelingContext = Boolean(target || targetUrl || metadata.status || candidates.length > 0);

  if (!hasFuelingContext) {
    lines.push(`Aktion: ${next.action}`);
    if (next.detail) lines.push(`Detail: ${next.detail}`);
    lines.push(`Ausfuehren: ${next.command}`);
    lines.push(`Gesamt-Rerun: ${rerunPerformanceGateCommand(audit)}`);
    return lines;
  }

  if (target) lines.push(`Ziel: ${target}`);
  if (targetUrl) lines.push(`Oeffnen: ${targetUrl}`);
  lines.push('Eintragen: GI-Komfort aus der echten Magenreaktion waehlen.');
  lines.push(`Optionen: ${options}`);
  lines.push('Nicht ableiten aus: Notizen, Route, RPE, g/h, Ergebnis oder Pace.');
  lines.push('Speichern: Activity Fueling UI benutzen; keine Datenbankzeile direkt aendern.');
  lines.push(`Rerun: ${next.command}`);

  if (candidates.length > 0) {
    lines.push('');
    lines.push('Direkt schliessbare Logs:');
    for (const candidate of candidates) {
      const summary = candidate.summary ?? completionCandidateText(candidate);
      const candidateTarget = candidate.targetUrl ?? candidate.targetPath;
      const missing = (candidate.missing ?? []).length > 0 ? `; fehlt: ${sessionMissingText(candidate.missing)}` : '';
      lines.push(`- ${summary}${candidateTarget ? ` -> ${candidateTarget}` : ''}${missing}`);
    }
  }

  const newLogsStillNeeded = Number(metadata.status?.newLogsStillNeeded ?? 0);
  if (newLogsStillNeeded > 0) {
    lines.push('');
    lines.push(`Danach: ${germanLongSessionLogText(newLogsStillNeeded)} mit Aktivitaet/Dauer, During-Carbs und strukturiertem GI-Komfort erfassen.`);
    if (metadata.newLogChecklistCommand) lines.push(`Future-log scaffold: ${metadata.newLogChecklistCommand}`);
  }

  if (metadata.nextPromptCommand) lines.push(`Kurzprompt: ${metadata.nextPromptCommand}`);
  if (metadata.capturePacketCommand) lines.push(`Voller Fueling-Packet: ${metadata.capturePacketCommand}`);
  lines.push(`Gesamt-Rerun: ${rerunPerformanceGateCommand(audit)}`);
  return lines;
}

function sessionMissingText(missing) {
  return missing.map(item => item === 'GI comfort' ? 'GI-Komfort' : item).join(', ');
}

function germanLongSessionLogText(count) {
  return count === 1
    ? '1 neues vollstaendiges Long-Session-Log'
    : `${count} neue vollstaendige Long-Session-Logs`;
}

function renderIphoneSessionCard(next) {
  const metadata = next.metadata ?? {};
  const lines = [];
  if (metadata.firstGap?.label) {
    lines.push(`Erste Luecke: ${metadata.firstGap.label} (${metadata.firstGap.status ?? 'unknown'})`);
  }
  if (metadata.firstGap?.nextAction) lines.push(`Aktion: ${metadata.firstGap.nextAction}`);
  if (metadata.serverVerifyCommand) lines.push(`Vorher Server pruefen: ${metadata.serverVerifyCommand}`);
  if (metadata.settingsFieldUrl) lines.push(`Settings oeffnen: ${metadata.settingsFieldUrl}`);
  if (metadata.expectedCommit) lines.push(`Aufnahmeziel: Server commit under test = ${metadata.expectedCommit}.`);
  if (metadata.settingsFieldUrl) lines.push('App-Stand erfassen: beobachteten Settings App-Stand als App runtime commit under test kopieren.');
  if (metadata.expectedRuntimeCommit) {
    lines.push(`Runtime-Vergleich: erwarteter App runtime commit ${metadata.expectedRuntimeCommit} ist nur Vergleichsziel; nicht blind eintragen.`);
  }
  const previousEvidence = [
    metadata.serverCommitUnderTest ? `Server ${metadata.serverCommitUnderTest}` : null,
    metadata.fieldRuntimeCommit ? `App-Stand ${metadata.fieldRuntimeCommit}` : null,
  ].filter(Boolean).join(', ');
  if (previousEvidence) lines.push(`Alte Field-Werte: ${previousEvidence} nur als vorherige Evidence behandeln.`);
  if (metadata.fieldScaffoldCommand) lines.push(`Feld-Scaffold: ${metadata.fieldScaffoldCommand}`);
  if (metadata.fieldPromptCommand) lines.push(`Kurzprompt: ${metadata.fieldPromptCommand}`);
  if (metadata.evidenceFile) lines.push(`Dokumentieren in: ${metadata.evidenceFile}`);
  lines.push(`Rerun: ${next.command}`);
  lines.push('Sicherheit: echte iPhone/PWA-Feldbeobachtung mit Server-Commit und beobachtetem Settings App-Stand dokumentieren; Server bleibt GitHub-main-Mirror.');
  return lines;
}

function renderServerSessionCard(next) {
  const metadata = next.metadata ?? {};
  const lines = [
    `Aktion: ${next.action}`,
    `Ausfuehren: ${next.command}`,
  ];
  if (metadata.recoveryRunbook) lines.push(`Runbook: ${metadata.recoveryRunbook}`);
  if (metadata.recoveryPacketCommand) lines.push(`Recovery-Packet: ${metadata.recoveryPacketCommand}`);
  lines.push('Sicherheit: Server nicht direkt editieren, branchen oder committen.');
  return lines;
}

function renderGenericSessionCard(next) {
  return [
    `Aktion: ${next.action}`,
    `Ausfuehren: ${next.command}`,
  ];
}

function sessionTargetFromGate(gate) {
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

function sessionTargetFromAudit(audit, sessionGate) {
  if (!sessionGate) return audit.nextUnblock;
  const gate = audit.gates.find(candidate => candidate.key === sessionGate);
  if (!gate || !isOpenGate(gate)) return null;
  return sessionTargetFromGate(gate);
}

function sessionTargetsFromAudit(audit, options) {
  if (options.sessionAll) {
    return audit.gates.filter(isOpenGate).map(sessionTargetFromGate);
  }
  const target = sessionTargetFromAudit(audit, options.sessionGate ?? null);
  return target ? [target] : [];
}

function openGateKeyText(audit) {
  const keys = audit.gates.filter(isOpenGate).map(gate => gate.key);
  return keys.length > 0 ? keys.join(', ') : 'keine';
}

export function renderPerformanceSessionCard(audit, options = {}) {
  const sessionGate = options.sessionGate ?? null;
  const sessionAll = Boolean(options.sessionAll);
  const lines = [
    '# Performance-OS Session Card',
    '',
    `Stand: ${audit.date}`,
    `Gate: ${audit.gate}`,
    `Offen: ${audit.openGates}`,
    `Server-Commit: ${audit.expectedCommit}`,
    ...planningModeLines(audit),
  ];
  if (sessionAll) lines.push('Auswahl: alle offenen Gates');
  if (sessionGate) lines.push(`Auswahl: ${sessionGate}`);
  lines.push('');

  const targets = sessionTargetsFromAudit(audit, { sessionAll, sessionGate });

  if (targets.length === 0 && sessionGate) {
    lines.push(`Kein offenes Gate fuer: ${sessionGate}.`);
    lines.push(`Offene Gates: ${openGateKeyText(audit)}`);
    lines.push(`Nach manuellen Saves erneut pruefen: ${rerunPerformanceGateCommand(audit)}`);
    lines.push('Fuer die Standard-Prioritaet ohne --gate erneut ausfuehren.');
    return lines.join('\n');
  }

  if (targets.length === 0) {
    if (audit.deferredGates) {
      lines.push('Keine offenen manuellen Gates in diesem lokalen Planungssnapshot.');
      lines.push(`Nach manuellen Saves erneut pruefen: ${rerunPerformanceGateCommand(audit)}`);
      lines.push('Vor deploy- oder iPhone-relevanten Aussagen den normalen Audit von clean main rerunnen.');
      return lines.join('\n');
    }
    lines.push('Keine offenen Performance-OS Gates.');
    lines.push('Vor dem naechsten Produktpaket den normalen Audit erneut ausfuehren.');
    return lines.join('\n');
  }

  targets.forEach((next, index) => {
    if (targets.length > 1) {
      lines.push(index === 0 ? `## Jetzt ${index + 1}/${targets.length}` : `## Danach ${index + 1}/${targets.length}`);
    } else {
      lines.push('## Jetzt');
    }
    lines.push(`Gate: ${next.label}`);
    lines.push(`Status: ${nextDetailText(next)}`);
    lines.push('');

    if (next.key === 'fueling') {
      lines.push(...renderFuelingSessionCard(next, audit));
    } else if (next.key === 'iphone_pwa') {
      lines.push(...renderIphoneSessionCard(next));
    } else if (next.key === 'server') {
      lines.push(...renderServerSessionCard(next));
    } else {
      lines.push(...renderGenericSessionCard(next));
    }

    if (index < targets.length - 1) lines.push('');
  });

  lines.push('');
  lines.push('## Wenn unklar');
  lines.push(`Vollstaendige Checkliste: ${performanceChecklistCommand(audit)}`);
  lines.push('Keine Werte erfinden und keine versteckten Writes ausloesen.');

  return lines.join('\n');
}

export function exitCodeForAudit(audit, options = {}) {
  return options.failOnGated && audit.openGates > 0 ? 1 : 0;
}

export function firstTargetUrl(audit) {
  return audit.nextUnblock?.metadata?.targetUrl ?? null;
}

export function firstTargetUrls(audit) {
  const metadata = audit.nextUnblock?.metadata;
  const urls = [
    metadata?.targetUrl,
    ...(metadata?.completionCandidates ?? []).map(candidate => candidate.targetUrl),
  ].filter(Boolean);
  return [...new Set(urls)];
}

export function exitCodeForTargetUrl(audit, options = {}) {
  return firstTargetUrl(audit) ? exitCodeForAudit(audit, options) : 1;
}

export function exitCodeForTargetUrls(audit, options = {}) {
  return firstTargetUrls(audit).length > 0 ? exitCodeForAudit(audit, options) : 1;
}

function assertCommitish(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[0-9a-f]{7,40}$/i.test(text)) {
    throw new Error(`${label} must be a 7-40 character git commit hash`);
  }
  return text;
}

function assertSessionGate(value, label) {
  const text = String(value ?? '').trim().toLowerCase();
  const normalized = SESSION_GATE_ALIASES.get(text);
  if (!normalized) {
    throw new Error(`${label} must be one of: ${SESSION_GATE_KEYS.join(', ')}`);
  }
  return normalized;
}

export function parseArgs(argv) {
  const result = {
    today: isoDate(new Date()),
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: false,
    manualChecklist: false,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
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
    if (arg === '--local-planning') {
      result.localPlanning = true;
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
    if (arg === '--target-url') {
      result.targetUrl = true;
      continue;
    }
    if (arg === '--target-urls') {
      result.targetUrls = true;
      continue;
    }
    if (arg === '--packet') {
      result.packet = true;
      continue;
    }
    if (arg === '--manual-checklist') {
      result.manualChecklist = true;
      continue;
    }
    if (arg === '--session-card') {
      result.sessionCard = true;
      continue;
    }
    if (arg === '--all') {
      result.sessionAll = true;
      continue;
    }
    if (arg === '--gate') {
      result.sessionGate = assertSessionGate(args[index + 1], '--gate');
      index += 1;
      continue;
    }
    if (arg === '--today') {
      result.today = assertIsoDate(args[index + 1], '--today');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (result.sessionAll && result.sessionGate) {
    throw new Error('--all and --gate cannot be combined');
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
  if (args.targetUrls) {
    const urls = firstTargetUrls(audit);
    if (!urls.length) {
      console.error('No target URLs for the first Performance-OS unblock.');
      process.exitCode = exitCodeForTargetUrls(audit, args);
      return;
    }
    console.log(urls.join('\n'));
    process.exitCode = exitCodeForTargetUrls(audit, args);
    return;
  }
  if (args.targetUrl) {
    const url = firstTargetUrl(audit);
    if (!url) {
      console.error('No target URL for the first Performance-OS unblock.');
      process.exitCode = exitCodeForTargetUrl(audit, args);
      return;
    }
    console.log(url);
    process.exitCode = exitCodeForTargetUrl(audit, args);
    return;
  }
  if (args.json) {
    console.log(JSON.stringify(args.nextUnblock ? audit.nextUnblock : audit, null, 2));
    process.exitCode = exitCodeForAudit(audit, args);
    return;
  }
  const output = args.manualChecklist
    ? renderPerformanceManualChecklist(audit)
    : args.packet
      ? renderPerformanceGatePacket(audit)
      : args.sessionCard
        ? renderPerformanceSessionCard(audit, args)
        : args.nextUnblock ? renderNextUnblock(audit) : renderPerformanceGateAudit(audit);
  console.log(output);
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
