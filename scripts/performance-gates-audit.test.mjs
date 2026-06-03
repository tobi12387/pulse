import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildPerformanceGateAudit,
  exitCodeForAudit,
  exitCodeForTargetUrl,
  exitCodeForTargetUrls,
  firstTargetUrl,
  firstTargetUrls,
  parseArgs,
  renderNextUnblock,
  renderPerformanceGatePacket,
  renderPerformanceManualChecklist,
  renderPerformanceSessionCard,
  renderPerformanceGateAudit,
  usage,
} from './performance-gates-audit.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function commandResult(status, stdout = '', stderr = '') {
  return { status, stdout, stderr };
}

function withPulseHost(host, fn) {
  const previous = process.env.PULSE_HOST;
  process.env.PULSE_HOST = host;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PULSE_HOST;
    } else {
      process.env.PULSE_HOST = previous;
    }
  }
}

function withPulseUrl(url, fn) {
  const previous = process.env.PULSE_URL;
  process.env.PULSE_URL = url;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PULSE_URL;
    } else {
      process.env.PULSE_URL = previous;
    }
  }
}

function makeRunner({ fueling, iphone, server, commit = 'abc1234', mainCommit = commit, branch = 'main', runtimeCommits = {} }) {
  return (command, args) => {
    if (command === 'git' && args.join(' ') === 'rev-parse --short HEAD') {
      return commandResult(0, `${commit}\n`);
    }
    if (command === 'git' && args.join(' ') === 'rev-parse --short origin/main') {
      return commandResult(0, `${mainCommit}\n`);
    }
    if (command === 'git' && args.join(' ') === 'rev-parse --abbrev-ref HEAD') {
      return commandResult(0, `${branch}\n`);
    }
    if (command === 'git' && args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%h') {
      const ref = args[3];
      const runtimeCommit = runtimeCommits[ref];
      return runtimeCommit ? commandResult(0, `${runtimeCommit}\n`) : commandResult(1, '', `unknown ref ${ref}`);
    }
    if (args[0] === 'scripts/fueling-gate-audit.mjs') return fueling;
    if (args[0] === 'scripts/iphone-pwa-gate-audit.mjs') return iphone;
    if (command === 'bash' && args[0] === 'scripts/verify-server.sh') return server;
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };
}

const GATED_FUELING = commandResult(0, JSON.stringify({
  users: [
    {
      userId: 'user-a',
      gate: 'gated',
      comparableCompleteLogs: 0,
      requiredComparableCompleteLogs: 3,
      duringLogs: 4,
      comparableLongLogs: 2,
      completableNow: 2,
      newLogsStillNeeded: 1,
      completionCandidates: [
        {
          date: '2026-05-09',
          activityName: 'Datteln Graveln',
          activityType: 'bike',
          durationMin: 398,
          carbsG: 356,
          carbsPerHour: 54,
          summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-a#activity-fueling-log',
          missing: ['GI comfort'],
        },
        {
          date: '2026-05-04',
          activityName: 'Datteln - Radfahren - Z2',
          activityType: 'bike',
          durationMin: 80,
          carbsG: 30,
          carbsPerHour: 23,
          summary: '2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs (23 g/h)',
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-b#activity-fueling-log',
          missing: ['GI comfort'],
        },
      ],
      nextAction: {
        kind: 'complete_gi_comfort',
        label: 'GI-Komfort ergaenzen',
        detail: 'Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g/h oder Ergebnis ableiten.',
        targetPath: '/plan/activity/activity-a#activity-fueling-log',
        date: '2026-05-09',
        evidenceChecklist: 'docs/ai/checklists/fueling-evidence-capture.md',
        targetLog: {
          date: '2026-05-09',
          activityName: 'Datteln Graveln',
          activityType: 'bike',
          durationMin: 398,
          carbsG: 356,
          carbsPerHour: 54,
          targetPath: '/plan/activity/activity-a#activity-fueling-log',
          summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
        },
        options: [
          { value: 'ok', label: 'Magen ok' },
          { value: 'mild_issue', label: 'Magen leicht unruhig' },
          { value: 'issue', label: 'Magenprobleme' },
        ],
      },
    },
  ],
}));

const READY_FUELING = commandResult(0, JSON.stringify({
  users: [
    {
      userId: 'user-a',
      gate: 'ready',
      comparableCompleteLogs: 3,
      requiredComparableCompleteLogs: 3,
      duringLogs: 5,
      comparableLongLogs: 3,
      completableNow: 0,
      newLogsStillNeeded: 0,
      nextAction: null,
    },
  ],
}));

const GATED_IPHONE = commandResult(0, JSON.stringify({
  evidenceFile: 'docs/qa/field.md',
  fieldChecklist: 'docs/ai/checklists/iphone-pwa-qa.md',
  gate: 'gated',
  expectedCommit: 'abc1234',
  expectedRuntimeCommit: 'runtime1',
  fieldRuntimeCommit: 'oldruntime',
  commitStatus: 'stale',
  scope: { serverCommit: '9e05189' },
  gaps: [
    {
      kind: 'current_commit_evidence',
      label: 'Current main field evidence',
      status: 'stale',
      nextAction: 'Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234.',
    },
    {
      kind: 'certificate_trust',
      label: 'Warning-free certificate trust',
      status: 'needs_followup',
      nextAction: 'Install and trust only frontend/certs/rootCA.pem on the iPhone.',
    },
    { kind: 'push_activation', label: 'Push activation and test push', status: 'partial' },
  ],
  nextAction: 'Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234.',
  serverVerifyCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server',
  serverRecoveryPacketCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet',
  settingsFieldUrl: 'https://192.168.178.46:5175/settings?section=device',
}));

const READY_IPHONE = commandResult(0, JSON.stringify({
  evidenceFile: 'docs/qa/field.md',
  fieldChecklist: 'docs/ai/checklists/iphone-pwa-qa.md',
  gate: 'ready',
  expectedCommit: 'abc1234',
  commitStatus: 'current',
  scope: { serverCommit: 'abc1234' },
  gaps: [],
  nextAction: null,
}));

test('performance gate audit summarizes current gated blockers', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: GATED_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(1, '', [
      'Permission denied (publickey,password).',
      'expected_commit=abc1234',
      'recovery_runbook=docs/ai/checklists/deploy-auth-recovery.md',
      'ERROR: SSH access to root@192.168.178.46 failed before server checks.',
    ].join('\n')),
  }));

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.openGates, 3);
  assert.deepEqual(audit.gates.map(gate => gate.gate), ['gated', 'gated', 'gated']);
  assert.deepEqual(audit.nextUnblock, {
    key: 'fueling',
    label: 'Fueling learning',
    command: 'npm run audit:fueling-gate -- --today 2026-05-21',
    action: 'GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g/h oder Ergebnis ableiten.',
    detail: '0/3 comparable complete logs; 2 existing logs completable now: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h) -> /plan/activity/activity-a#activity-fueling-log, 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs (23 g/h) -> /plan/activity/activity-b#activity-fueling-log; 1 new complete long-session log still needed after candidates.',
    metadata: {
      kind: 'complete_gi_comfort',
      targetPath: '/plan/activity/activity-a#activity-fueling-log',
      targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log',
      date: '2026-05-09',
      evidenceChecklist: 'docs/ai/checklists/fueling-evidence-capture.md',
      capturePacketCommand: 'npm run audit:fueling-gate -- --today 2026-05-21 --packet',
      nextPromptCommand: 'npm run audit:fueling-gate -- --today 2026-05-21 --next-prompt',
      newLogChecklistCommand: 'npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist',
      options: [
        { value: 'ok', label: 'Magen ok' },
        { value: 'mild_issue', label: 'Magen leicht unruhig' },
        { value: 'issue', label: 'Magenprobleme' },
      ],
      status: {
        comparableCompleteLogs: 0,
        requiredComparableCompleteLogs: 3,
        completableNow: 2,
        newLogsStillNeeded: 1,
      },
      targetLog: {
        date: '2026-05-09',
        activityName: 'Datteln Graveln',
        activityType: 'bike',
        durationMin: 398,
        carbsG: 356,
        carbsPerHour: 54,
        targetPath: '/plan/activity/activity-a#activity-fueling-log',
        targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log',
        summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
      },
      completionCandidates: [
        {
          date: '2026-05-09',
          activityName: 'Datteln Graveln',
          activityType: 'bike',
          durationMin: 398,
          carbsG: 356,
          carbsPerHour: 54,
          summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-a#activity-fueling-log',
          targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log',
          missing: ['GI comfort'],
        },
        {
          date: '2026-05-04',
          activityName: 'Datteln - Radfahren - Z2',
          activityType: 'bike',
          durationMin: 80,
          carbsG: 30,
          carbsPerHour: 23,
          summary: '2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs (23 g/h)',
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-b#activity-fueling-log',
          targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-b#activity-fueling-log',
          missing: ['GI comfort'],
        },
      ],
    },
  });
  assert.equal(audit.gates[0].nextAction, 'GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g/h oder Ergebnis ableiten.');
  assert.equal(audit.gates[0].newLogChecklistCommand, 'npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist');
  assert.deepEqual(audit.gates[0].completionCandidates, [
    {
      date: '2026-05-09',
      activityName: 'Datteln Graveln',
      activityType: 'bike',
      durationMin: 398,
      carbsG: 356,
      carbsPerHour: 54,
      summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
      status: 'can count after GI comfort',
      targetPath: '/plan/activity/activity-a#activity-fueling-log',
      targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log',
      missing: ['GI comfort'],
    },
    {
      date: '2026-05-04',
      activityName: 'Datteln - Radfahren - Z2',
      activityType: 'bike',
      durationMin: 80,
      carbsG: 30,
      carbsPerHour: 23,
      summary: '2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs (23 g/h)',
      status: 'can count after GI comfort',
      targetPath: '/plan/activity/activity-b#activity-fueling-log',
      targetUrl: 'https://192.168.178.46:5175/plan/activity/activity-b#activity-fueling-log',
      missing: ['GI comfort'],
    },
  ]);
  assert.equal(audit.gates[2].expectedCommit, 'abc1234');
  assert.equal(audit.gates[2].recoveryRunbook, 'docs/ai/checklists/deploy-auth-recovery.md');
  assert.equal(audit.gates[2].recoveryPacketCommand, 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');

  const rendered = renderPerformanceGateAudit(audit);
  assert.match(rendered, /# Performance-OS Gate Audit/);
  assert.match(rendered, /Open gates: 3/);
  assert.match(rendered, /Next unblock: Fueling learning/);
  assert.match(rendered, /Next action: GI-Komfort ergaenzen/);
  assert.doesNotMatch(rendered, /Next: .*Path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(rendered, /Next target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(rendered, /Next target URL: https?:\/\/[^\s]+\/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(rendered, /Next GI-Komfort-Optionen: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(rendered, /Fueling learning/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(rendered, /Evidence packet: `npm run audit:fueling-gate -- --today 2026-05-21 --packet`/);
  assert.match(rendered, /Next prompt: `npm run audit:fueling-gate -- --today 2026-05-21 --next-prompt`/);
  assert.match(rendered, /New log checklist: `npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist`/);
  assert.match(rendered, /0\/3 comparable complete logs/);
  assert.match(rendered, /Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\) -> \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(rendered, /Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> \/plan\/activity\/activity-b#activity-fueling-log/);
  assert.match(rendered, /iPhone\/PWA field/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(rendered, /Command: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234`/);
  assert.match(rendered, /Field packet: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet`/);
  assert.match(rendered, /Field scaffold: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold`/);
  assert.match(rendered, /Server recovery packet: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet`/);
  assert.match(rendered, /3 open gaps/);
  assert.match(rendered, /Server deploy mirror/);
  assert.match(rendered, /PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(rendered, /Recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
  assert.match(rendered, /Recovery packet: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet`/);

  const nextRendered = renderNextUnblock(audit);
  assert.match(nextRendered, /# Performance-OS Next Unblock/);
  assert.match(nextRendered, /Next unblock: Fueling learning/);
  assert.match(nextRendered, /Command: npm run audit:fueling-gate -- --today 2026-05-21/);
  assert.match(nextRendered, /Detail: 0\/3 comparable complete logs; 2 existing logs completable now; 1 new complete long-session log still needed after candidates\./);
  assert.match(nextRendered, /Action: GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log/);
  assert.doesNotMatch(nextRendered, /Action: .*Path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(nextRendered, /Target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(nextRendered, /Target path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(nextRendered, /Target URL: https?:\/\/[^\s]+\/plan\/activity\/activity-a#activity-fueling-log/);
  assert.equal(firstTargetUrl(audit), 'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log');
  assert.deepEqual(firstTargetUrls(audit), [
    'https://192.168.178.46:5175/plan/activity/activity-a#activity-fueling-log',
    'https://192.168.178.46:5175/plan/activity/activity-b#activity-fueling-log',
  ]);
  assert.equal(exitCodeForTargetUrl(audit), 0);
  assert.equal(exitCodeForTargetUrls(audit), 0);
  assert.match(nextRendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(nextRendered, /Evidence packet: npm run audit:fueling-gate -- --today 2026-05-21 --packet/);
  assert.match(nextRendered, /Next prompt: npm run audit:fueling-gate -- --today 2026-05-21 --next-prompt/);
  assert.match(nextRendered, /New log checklist: npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist/);
  assert.match(nextRendered, /GI-Komfort-Optionen: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(nextRendered, /Completion candidates:/);
  assert.match(nextRendered, /- 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\) -> \/plan\/activity\/activity-a#activity-fueling-log \| Target URL: https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-a#activity-fueling-log \(missing: GI comfort\)/);
  assert.match(nextRendered, /- 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> \/plan\/activity\/activity-b#activity-fueling-log \| Target URL: https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-b#activity-fueling-log \(missing: GI comfort\)/);
  assert.match(nextRendered, /Manual safety:/);
  assert.match(nextRendered, /GI comfort must come from the real stomach response/);
  assert.match(nextRendered, /Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly/);
  assert.doesNotMatch(nextRendered, /## iPhone\/PWA field/);

  const packet = renderPerformanceGatePacket(audit);
  assert.match(packet, /# Performance-OS Gate Handoff Packet/);
  assert.match(packet, /First Unblock/);
  assert.match(packet, /Gate: Fueling learning/);
  assert.match(packet, /Detail: 0\/3 comparable complete logs; 2 existing logs completable now; 1 new complete long-session log still needed after candidates\./);
  assert.match(packet, /Action: GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log/);
  assert.match(packet, /Target path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(packet, /Target URL: https?:\/\/[^\s]+\/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(packet, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(packet, /Evidence packet: npm run audit:fueling-gate -- --today 2026-05-21 --packet/);
  assert.match(packet, /Next prompt: npm run audit:fueling-gate -- --today 2026-05-21 --next-prompt/);
  assert.match(packet, /New log checklist: npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist/);
  assert.match(packet, /Completion candidates:/);
  assert.match(packet, /- 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> \/plan\/activity\/activity-b#activity-fueling-log \| Target URL: https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-b#activity-fueling-log \(missing: GI comfort\)/);
  assert.match(packet, /1\. Fueling learning/);
  assert.match(packet, /Status: gated\n   Detail: 0\/3 comparable complete logs; 2 existing logs completable now; 1 new complete long-session log still needed after candidates\./);
  assert.match(packet, /2\. iPhone\/PWA field/);
  assert.match(packet, /Detail: 3 open gaps: Current main field evidence: stale, Warning-free certificate trust: needs_followup, Push activation and test push: partial/);
  assert.match(packet, /Field packet: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
  assert.match(packet, /Field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.match(packet, /3\. Server deploy mirror/);
  assert.match(packet, /Detail: ERROR: SSH access to root@192\.168\.178\.46 failed before server checks\./);
  assert.match(packet, /Recovery packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(packet, /Fueling GI comfort must come from the real stomach response/);
  assert.match(packet, /Real iPhone\/PWA field evidence must record the expected server commit and the observed Settings App-Stand for this run/);
  assert.match(packet, /If the run is intentionally pinned to a known deployed\/runtime commit, pass --expected-commit <short> so server and iPhone checks use that commit/);
  assert.match(packet, /Rerun after any manual save or deploy: npm run audit:performance-gates -- --today 2026-05-21/);

  const checklist = renderPerformanceManualChecklist(audit);
  assert.match(checklist, /# Performance-OS Manual Checklist/);
  assert.match(checklist, /## 1\. Fueling learning/);
  assert.match(checklist, /- \[ \] Open https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-a#activity-fueling-log for 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)\./);
  assert.match(checklist, /- \[ \] Open https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-b#activity-fueling-log for 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\)\./);
  assert.match(checklist, /Choose exactly one real GI comfort value: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(checklist, /After existing candidates, capture 1 new complete long-session log with activity\/duration, during carbs and structured GI comfort together/);
  assert.match(checklist, /Use the future-log scaffold when ready: `npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist`/);
  assert.match(checklist, /Use the short first-target prompt for a manual UI capture handoff: `npm run audit:fueling-gate -- --today 2026-05-21 --next-prompt`/);
  assert.match(checklist, /## 2\. iPhone\/PWA field/);
  assert.match(checklist, /Verify the server mirror before recording current field evidence: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server`/);
  assert.match(checklist, /Open the Settings field proof on the real iPhone\/PWA: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(checklist, /Print the self-contained field scaffold with server preflight, open gaps and paste-ready evidence record: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold`/);
  assert.match(checklist, /Print the short first-gap field prompt for a manual field handoff: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --next-prompt`/);
  assert.match(checklist, /Current main field evidence \(stale\)\. Verify the server mirror is on abc1234/);
  assert.match(checklist, /## 3\. Server deploy mirror/);
  assert.match(checklist, /read-only recovery packet: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet`/);
  assert.match(checklist, /## Manual Safety/);

  const sessionCard = renderPerformanceSessionCard(audit);
  assert.match(sessionCard, /# Performance-OS Session Card/);
  assert.match(sessionCard, /Gate: Fueling learning/);
  assert.match(sessionCard, /Status: 0\/3 comparable complete logs; 2 existing logs completable now; 1 new complete long-session log still needed after candidates\./);
  assert.match(sessionCard, /Oeffnen: https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(sessionCard, /Eintragen: GI-Komfort aus der echten Magenreaktion waehlen/);
  assert.match(sessionCard, /Optionen: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(sessionCard, /Nicht ableiten aus: Notizen, Route, RPE, g\/h, Ergebnis oder Pace/);
  assert.match(sessionCard, /Direkt schliessbare Logs:/);
  assert.match(sessionCard, /2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> https:\/\/192\.168\.178\.46:5175\/plan\/activity\/activity-b#activity-fueling-log; fehlt: GI-Komfort/);
  assert.match(sessionCard, /Danach: 1 neues vollstaendiges Long-Session-Log mit Aktivitaet\/Dauer, During-Carbs und strukturiertem GI-Komfort erfassen/);
  assert.match(sessionCard, /Vollstaendige Checkliste: npm run audit:performance-checklist -- --today 2026-05-21/);

  const iphoneSessionCard = renderPerformanceSessionCard(audit, { sessionGate: 'iphone_pwa' });
  assert.match(iphoneSessionCard, /Auswahl: iphone_pwa/);
  assert.match(iphoneSessionCard, /Gate: iPhone\/PWA field/);
  assert.match(iphoneSessionCard, /Erste Luecke: Current main field evidence \(stale\)/);
  assert.match(iphoneSessionCard, /Vorher Server pruefen: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(iphoneSessionCard, /Settings oeffnen: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(iphoneSessionCard, /Feld-Scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.doesNotMatch(iphoneSessionCard, /Gate: Fueling learning/);

  const allSessionCards = renderPerformanceSessionCard(audit, { sessionAll: true });
  assert.match(allSessionCards, /Auswahl: alle offenen Gates/);
  assert.match(allSessionCards, /## Jetzt 1\/3/);
  assert.match(allSessionCards, /Gate: Fueling learning/);
  assert.match(allSessionCards, /## Danach 2\/3/);
  assert.match(allSessionCards, /Gate: iPhone\/PWA field/);
  assert.match(allSessionCards, /## Danach 3\/3/);
  assert.match(allSessionCards, /Gate: Server deploy mirror/);
  assert.match(allSessionCards, /Recovery-Packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
});

test('performance gate packet respects a configured Pulse URL for Fueling targets', () => {
  withPulseUrl('https://pulse.local:5175/', () => {
    const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
      fueling: GATED_FUELING,
      iphone: READY_IPHONE,
      server: commandResult(0, '==> server verification complete: abc1234\n'),
    }));

    const packet = renderPerformanceGatePacket(audit);
    assert.equal(
      audit.nextUnblock.metadata.targetUrl,
      'https://pulse.local:5175/plan/activity/activity-a#activity-fueling-log',
    );
    assert.equal(
      audit.nextUnblock.metadata.targetLog.targetUrl,
      'https://pulse.local:5175/plan/activity/activity-a#activity-fueling-log',
    );
    assert.equal(
      audit.nextUnblock.metadata.completionCandidates[1].targetUrl,
      'https://pulse.local:5175/plan/activity/activity-b#activity-fueling-log',
    );
    assert.match(packet, /Target URL: https:\/\/pulse\.local:5175\/plan\/activity\/activity-a#activity-fueling-log/);
    assert.match(packet, /Target URL: https:\/\/pulse\.local:5175\/plan\/activity\/activity-b#activity-fueling-log/);
  });
});

test('performance gate audit reports ready when all required gates are ready', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.openGates, 0);
  assert.equal(audit.nextUnblock, null);
  assert.deepEqual(audit.gates.map(gate => gate.gate), ['ready', 'ready', 'ready']);
  assert.match(renderPerformanceGateAudit(audit), /Gate: ready/);
  assert.match(renderPerformanceGateAudit(audit), /Next unblock: none/);
  assert.match(renderNextUnblock(audit), /Next unblock: none/);
  assert.match(renderPerformanceGatePacket(audit), /No open Performance-OS gates/);
  assert.match(renderPerformanceManualChecklist(audit), /No open Performance-OS gates/);

  const serverSessionCard = renderPerformanceSessionCard(audit, { sessionGate: 'server' });
  assert.match(serverSessionCard, /Kein offenes Gate fuer: server/);
  assert.match(serverSessionCard, /Offene Gates: keine/);
  assert.match(serverSessionCard, /Fuer die Standard-Prioritaet ohne --gate erneut ausfuehren/);
});

test('performance session card keeps audit command failures actionable', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: commandResult(1, '', [
      'node:internal/modules/package_json_reader:314',
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pg'",
      'Node.js v22.22.1',
    ].join('\n')),
    iphone: READY_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(audit.nextUnblock.key, 'fueling');
  assert.match(audit.nextUnblock.detail, /Cannot find package 'pg'/);
  const sessionCard = renderPerformanceSessionCard(audit);
  assert.match(sessionCard, /Aktion: Restore local DB access or pass the expected database env/);
  assert.match(sessionCard, /Detail: Error \[ERR_MODULE_NOT_FOUND\]: Cannot find package 'pg'/);
  assert.match(sessionCard, /Ausfuehren: npm run audit:fueling-gate -- --today 2026-05-21/);
  assert.doesNotMatch(sessionCard, /Eintragen: GI-Komfort/);
});

test('performance gate audit exposes structured next-unblock metadata for iPhone field gates', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(audit.gate, 'gated');
  assert.equal(firstTargetUrl(audit), null);
  assert.deepEqual(firstTargetUrls(audit), []);
  assert.equal(exitCodeForTargetUrl(audit), 1);
  assert.equal(exitCodeForTargetUrls(audit), 1);
  assert.deepEqual(audit.nextUnblock, {
    key: 'iphone_pwa',
    label: 'iPhone/PWA field',
    command: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234',
    action: 'Rerun the real iPhone checklist, record Server commit under test: abc1234, and copy the observed Settings App-Stand as App runtime commit under test.',
    detail: '3 open gaps: Current main field evidence: stale, Warning-free certificate trust: needs_followup, Push activation and test push: partial',
    metadata: {
      evidenceChecklist: 'docs/ai/checklists/iphone-pwa-qa.md',
      evidenceFile: 'docs/qa/field.md',
      expectedCommit: 'abc1234',
      expectedRuntimeCommit: 'runtime1',
      fieldRuntimeCommit: 'oldruntime',
      commitStatus: 'stale',
      serverCommitUnderTest: '9e05189',
      fieldPacketCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet',
      fieldPromptCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --next-prompt',
      fieldScaffoldCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold',
      settingsFieldUrl: 'https://192.168.178.46:5175/settings?section=device',
      serverVerifyCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server',
      serverRecoveryPacketCommand: null,
      firstGap: {
        kind: 'current_commit_evidence',
        label: 'Current main field evidence',
        status: 'stale',
        nextAction: 'Rerun the real iPhone checklist, record Server commit under test: abc1234, and copy the observed Settings App-Stand as App runtime commit under test.',
      },
    },
  });
  assert.match(renderNextUnblock(audit), /Command: npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
  assert.match(renderNextUnblock(audit), /Evidence checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(renderNextUnblock(audit), /Field packet: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
  assert.match(renderNextUnblock(audit), /Field prompt: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --next-prompt/);
  assert.match(renderNextUnblock(audit), /Field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.match(renderNextUnblock(audit), /Settings field URL: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.doesNotMatch(renderNextUnblock(audit), /Server recovery packet:/);
  assert.match(renderNextUnblock(audit), /Manual safety:/);
  assert.match(renderNextUnblock(audit), /Real iPhone\/PWA field evidence must record the expected server commit and the observed Settings App-Stand for this run/);
  assert.match(renderNextUnblock(audit), /The server is a GitHub main mirror; do not edit, branch or commit on the server/);

  const sessionCard = renderPerformanceSessionCard(audit);
  assert.match(sessionCard, /# Performance-OS Session Card/);
  assert.match(sessionCard, /Gate: iPhone\/PWA field/);
  assert.match(sessionCard, /Erste Luecke: Current main field evidence \(stale\)/);
  assert.match(sessionCard, /Vorher Server pruefen: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(sessionCard, /Settings oeffnen: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(sessionCard, /Aufnahmeziel: Server commit under test = abc1234\./);
  assert.match(sessionCard, /App-Stand erfassen: beobachteten Settings App-Stand als App runtime commit under test kopieren/);
  assert.match(sessionCard, /Runtime-Vergleich: erwarteter App runtime commit runtime1 ist nur Vergleichsziel; nicht blind eintragen\./);
  assert.match(sessionCard, /Alte Field-Werte: Server 9e05189, App-Stand oldruntime nur als vorherige Evidence behandeln\./);
  assert.match(sessionCard, /Feld-Scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.match(sessionCard, /Dokumentieren in: docs\/qa\/field\.md/);
  assert.match(sessionCard, /Aktion: Rerun the real iPhone checklist, record Server commit under test: abc1234, and copy the observed Settings App-Stand as App runtime commit under test\./);
  assert.match(sessionCard, /Sicherheit: echte iPhone\/PWA-Feldbeobachtung mit Server-Commit und beobachtetem Settings App-Stand dokumentieren/);
});

test('performance gate audit preserves configured server SSH host in gate handoffs', () => {
  withPulseHost('pulse-server', () => {
    const iphoneAudit = JSON.parse(GATED_IPHONE.stdout);
    delete iphoneAudit.serverVerifyCommand;
    delete iphoneAudit.serverRecoveryPacketCommand;

    const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
      fueling: READY_FUELING,
      iphone: commandResult(0, JSON.stringify(iphoneAudit)),
      server: commandResult(1, '', [
        'Permission denied (publickey,password).',
        'expected_commit=abc1234',
        'recovery_runbook=docs/ai/checklists/deploy-auth-recovery.md',
        'ERROR: SSH access to pulse-server failed before server checks.',
      ].join('\n')),
    }));

    assert.equal(audit.gates[1].fieldPacketCommand, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet');
    assert.equal(audit.gates[1].fieldPromptCommand, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --next-prompt');
    assert.equal(audit.gates[1].fieldScaffoldCommand, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold');
    assert.equal(audit.gates[1].command, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234');
    assert.equal(audit.gates[1].serverVerifyCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
    assert.equal(audit.gates[1].serverRecoveryPacketCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');
    assert.equal(audit.gates[2].command, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
    assert.equal(audit.gates[2].recoveryPacketCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');

    const packet = renderPerformanceGatePacket(audit);
    assert.match(packet, /Command: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
    assert.match(packet, /Field packet: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
    assert.match(packet, /Field prompt: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --next-prompt/);
    assert.match(packet, /Field scaffold: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
    assert.match(packet, /Server verify: PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
    assert.match(packet, /Recovery packet: PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
    assert.match(packet, /Rerun after any manual save or deploy: PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21/);
  });
});

test('performance gate audit can pin an expected server commit for manual field runs', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', expectedCommit: 'def5678' }, makeRunner({
    fueling: READY_FUELING,
    iphone: commandResult(0, JSON.stringify({
      ...JSON.parse(GATED_IPHONE.stdout),
      expectedCommit: 'def5678',
      nextAction: 'Verify the server mirror is on def5678, rerun the real iPhone checklist and record Server commit under test: def5678.',
      serverVerifyCommand: 'PULSE_EXPECTED_COMMIT=def5678 npm run verify:server',
      serverRecoveryPacketCommand: 'PULSE_EXPECTED_COMMIT=def5678 npm run verify:server -- --packet',
    })),
    server: commandResult(1, '', [
      'Permission denied (publickey,password).',
      'expected_commit=def5678',
      'recovery_runbook=docs/ai/checklists/deploy-auth-recovery.md',
      'ERROR: SSH access to root@192.168.178.46 failed before server checks.',
    ].join('\n')),
  }));

  assert.equal(audit.expectedCommit, 'def5678');
  assert.equal(audit.gates[1].command, 'npm run audit:iphone-pwa-gate -- --expected-commit def5678');
  assert.equal(audit.gates[1].fieldPacketCommand, 'npm run audit:iphone-pwa-gate -- --expected-commit def5678 --packet');
  assert.equal(audit.gates[1].fieldPromptCommand, 'npm run audit:iphone-pwa-gate -- --expected-commit def5678 --next-prompt');
  assert.equal(audit.gates[1].fieldScaffoldCommand, 'npm run audit:iphone-pwa-gate -- --expected-commit def5678 --scaffold');
  assert.equal(audit.gates[1].serverVerifyCommand, 'PULSE_EXPECTED_COMMIT=def5678 npm run verify:server');
  assert.equal(audit.gates[2].expectedCommit, 'def5678');
  assert.match(renderPerformanceGatePacket(audit), /Expected server commit: def5678/);
  assert.match(renderPerformanceGatePacket(audit), /Field packet: npm run audit:iphone-pwa-gate -- --expected-commit def5678 --packet/);
  assert.match(renderPerformanceGatePacket(audit), /Field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit def5678 --scaffold/);
  assert.match(renderPerformanceGatePacket(audit), /Recovery packet: PULSE_EXPECTED_COMMIT=def5678 npm run verify:server -- --packet/);
});

test('performance gate audit distinguishes server mirror state failures from SSH recovery', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(1, [
      '==> ssh access',
      'ssh=ok',
      'ssh_target=pulse-server',
      '==> server git status',
      'branch=codex/example commit=abc1234 dirty=1',
    ].join('\n'), 'ERROR: server branch is \'codex/example\', expected main\n'),
  }));

  assert.equal(audit.openGates, 1);
  assert.equal(audit.nextUnblock.key, 'server');
  assert.match(audit.gates[2].detail, /server branch is 'codex\/example'/);
  assert.match(audit.gates[2].nextAction, /Restore the server mirror to clean GitHub main at abc1234/);
  assert.match(audit.gates[2].nextAction, /docs\/ai\/checklists\/server-mirror-recovery\.md/);
  assert.match(audit.gates[2].nextAction, /if dirty, inspect before changing state/i);
  assert.match(audit.gates[2].nextAction, /Do not edit server files directly/);
  assert.equal(audit.gates[2].recoveryRunbook, null);
  assert.equal(audit.gates[2].recoveryPacketCommand, null);
  assert.doesNotMatch(renderNextUnblock(audit), /deploy-auth-recovery/);
  assert.match(renderNextUnblock(audit), /server-mirror-recovery/);
});

test('performance gate audit accepts docs-only server drift when app runtime matches', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', expectedCommit: 'abc1234' }, makeRunner({
    fueling: READY_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(1, [
      '==> ssh access',
      'ssh=ok',
      'ssh_target=pulse-server',
      '==> server git status',
      'branch=main commit=docsnew dirty=0',
    ].join('\n'), 'ERROR: server commit docsnew != expected abc1234\n'),
    runtimeCommits: {
      abc1234: 'runtime1',
      docsnew: 'runtime1',
    },
  }));

  assert.equal(audit.openGates, 1);
  assert.equal(audit.nextUnblock.key, 'iphone_pwa');
  assert.equal(audit.gates[1].serverRecoveryPacketCommand, null);
  assert.equal(audit.gates[1].nextAction, 'Rerun the real iPhone checklist, record Server commit under test: abc1234, and copy the observed Settings App-Stand as App runtime commit under test.');
  assert.equal(audit.gates[2].gate, 'ready');
  assert.equal(audit.gates[2].commitStatus, 'current_runtime');
  assert.equal(audit.gates[2].serverCommit, 'docsnew');
  assert.equal(audit.gates[2].expectedRuntimeCommit, 'runtime1');
  assert.equal(audit.gates[2].serverRuntimeCommit, 'runtime1');
  assert.match(audit.gates[2].detail, /app runtime matches expected abc1234 via runtime commit runtime1/);
  assert.match(renderPerformanceGateAudit(audit), /docs\/tooling-only drift does not change the deployed app runtime/);
});

test('performance gate audit CLI args accept an explicit expected commit', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--today',
    '2026-05-21',
    '--expected-commit',
    'def5678',
    '--packet',
  ]), {
    today: '2026-05-21',
    expectedCommit: 'def5678',
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: true,
    manualChecklist: false,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
    json: false,
  });

  assert.throws(
    () => parseArgs(['node', 'scripts/performance-gates-audit.mjs', '--expected-commit', 'not-a-hash']),
    /--expected-commit must be a 7-40 character git commit hash/,
  );
});

test('performance gate audit CLI args accept target-url mode', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--next-unblock',
    '--target-url',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: true,
    targetUrl: true,
    targetUrls: false,
    packet: false,
    manualChecklist: false,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
    json: false,
  });
});

test('performance gate audit CLI args accept target-urls mode', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--target-urls',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: true,
    packet: false,
    manualChecklist: false,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
    json: false,
  });
});

test('performance gate audit CLI args accept manual checklist mode', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--manual-checklist',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: false,
    manualChecklist: true,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
    json: false,
  });
});

test('performance gate audit CLI args accept targeted and all session card modes', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--session-card',
    '--gate',
    'iphone',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: false,
    manualChecklist: false,
    sessionCard: true,
    sessionAll: false,
    sessionGate: 'iphone_pwa',
    json: false,
  });

  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--session-card',
    '--all',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: false,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: false,
    manualChecklist: false,
    sessionCard: true,
    sessionAll: true,
    sessionGate: null,
    json: false,
  });

  assert.throws(
    () => parseArgs(['node', 'scripts/performance-gates-audit.mjs', '--session-card', '--gate', 'unknown']),
    /--gate must be one of: fueling, iphone_pwa, server/,
  );
  assert.throws(
    () => parseArgs(['node', 'scripts/performance-gates-audit.mjs', '--session-card', '--all', '--gate', 'fueling']),
    /--all and --gate cannot be combined/,
  );
});

test('performance gate audit CLI args accept local planning mode', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/performance-gates-audit.mjs',
    '--local-planning',
    '--packet',
    '--today',
    '2026-05-21',
  ]), {
    today: '2026-05-21',
    expectedCommit: null,
    skipServer: false,
    localPlanning: true,
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: true,
    manualChecklist: false,
    sessionCard: false,
    sessionAll: false,
    sessionGate: null,
    json: false,
  });
});

test('performance gate audit help documents feature-branch auto planning for handoffs', () => {
  const text = usage();
  assert.match(text, /--local-planning/);
  assert.match(text, /--session-card/);
  assert.match(text, /--gate <key>/);
  assert.match(text, /--all/);
  assert.match(text, /Handoff modes auto-apply this behavior on feature branches/);
  assert.match(text, /unless --expected-commit or --skip-server is passed/);
});

test('performance gate audit can defer server verification for local planning', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', localPlanning: true }, makeRunner({
    fueling: READY_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(1, '', 'should not run'),
    commit: 'branch1',
    mainCommit: 'abc1234',
  }));

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.expectedCommit, 'abc1234');
  assert.equal(audit.localPlanning, true);
  assert.equal(audit.openGates, 1);
  assert.equal(audit.deferredGates, 1);
  assert.equal(audit.gates[2].gate, 'deferred');
  assert.equal(audit.gates[2].ready, false);
  assert.equal(audit.gates[2].deferred, true);
  assert.equal(audit.nextUnblock.key, 'iphone_pwa');
  assert.match(renderPerformanceGateAudit(audit), /Deferred gates: 1/);
  assert.match(renderPerformanceGateAudit(audit), /Deferred by --local-planning/);
  const packet = renderPerformanceGatePacket(audit);
  assert.match(packet, /Open gates: 1/);
  assert.match(packet, /Deferred gates: 1/);
  assert.match(packet, /## Ordered Open Gates/);
  assert.match(packet, /1\. iPhone\/PWA field/);
  assert.match(packet, /## Deferred Gates/);
  assert.match(packet, /1\. Server deploy mirror/);
  assert.doesNotMatch(packet, /2\. Server deploy mirror/);
  assert.match(packet, /Rerun after any manual save or deploy: npm run audit:performance-gates -- --today 2026-05-21 --local-planning/);
  assert.equal(exitCodeForAudit(audit, { failOnGated: true }), 1);
});

test('performance gate manual handoffs auto-defer server verification on feature branches', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', manualChecklist: true }, makeRunner({
    fueling: READY_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(1, '', 'should not run'),
    commit: 'branch1',
    mainCommit: 'abc1234',
    branch: 'codex/manual-evidence-handoff',
  }));

  assert.equal(audit.localPlanning, true);
  assert.equal(audit.autoLocalPlanning, true);
  assert.equal(audit.localBranch, 'codex/manual-evidence-handoff');
  assert.equal(audit.expectedCommit, 'abc1234');
  assert.equal(audit.openGates, 1);
  assert.equal(audit.deferredGates, 1);
  assert.equal(audit.gates[2].gate, 'deferred');
  assert.equal(audit.nextUnblock.key, 'iphone_pwa');

  const checklist = renderPerformanceManualChecklist(audit);
  assert.match(checklist, /Planning mode: auto-local from feature branch codex\/manual-evidence-handoff/);
  assert.match(checklist, /## Deferred Gates/);
  assert.doesNotMatch(checklist, /## 2\. Server deploy mirror/);
  const sessionCard = renderPerformanceSessionCard(audit);
  assert.match(sessionCard, /Planning mode: auto-local from feature branch codex\/manual-evidence-handoff/);
  assert.match(sessionCard, /Vollstaendige Checkliste: npm run audit:performance-checklist -- --today 2026-05-21 --local-planning/);
});

test('performance gate audit local planning can finish manual gates while server stays deferred', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', localPlanning: true }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(1, '', 'should not run'),
    commit: 'branch1',
    mainCommit: 'abc1234',
  }));

  assert.equal(audit.gate, 'planning_ready');
  assert.equal(audit.expectedCommit, 'abc1234');
  assert.equal(audit.localPlanning, true);
  assert.equal(audit.openGates, 0);
  assert.equal(audit.deferredGates, 1);
  assert.equal(audit.nextUnblock, null);
  assert.equal(exitCodeForAudit(audit, { failOnGated: true }), 0);
  const packet = renderPerformanceGatePacket(audit);
  assert.match(packet, /No open manual Performance-OS gates in this local-planning snapshot\. Rerun npm run audit:performance-gates -- --today 2026-05-21 --local-planning after manual saves/);
  assert.match(packet, /## Deferred Gates/);
  assert.match(packet, /Server deploy mirror/);
  const checklist = renderPerformanceManualChecklist(audit);
  assert.match(checklist, /No open manual Performance-OS gates in this local-planning snapshot/);
  assert.match(checklist, /Rerun after manual saves: `npm run audit:performance-gates -- --today 2026-05-21 --local-planning`/);
});

test('performance gate audit keeps skipped server verification unready', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21', skipServer: true }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(1, '', 'should not run'),
  }));

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.openGates, 1);
  assert.equal(audit.gates[2].gate, 'skipped');
  assert.equal(audit.gates[2].ready, false);
  assert.deepEqual(audit.nextUnblock?.metadata, {
    expectedCommit: 'abc1234',
    recoveryRunbook: 'docs/ai/checklists/deploy-auth-recovery.md',
    recoveryPacketCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet',
  });
  assert.match(renderNextUnblock(audit), /Recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
  assert.match(renderNextUnblock(audit), /Recovery packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(renderPerformanceGateAudit(audit), /Recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
  assert.match(renderPerformanceGateAudit(audit), /Recovery packet: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet`/);
  assert.match(renderPerformanceGateAudit(audit), /Skipped by --skip-server/);
  assert.match(renderPerformanceGateAudit(audit), /Gate: gated/);
});

test('performance gate audit can fail automation when gates are open', () => {
  const gatedAudit = buildPerformanceGateAudit({ today: '2026-05-21', skipServer: true }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(1, '', 'should not run'),
  }));
  const readyAudit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(exitCodeForAudit(gatedAudit), 0);
  assert.equal(exitCodeForAudit(gatedAudit, { failOnGated: true }), 1);
  assert.equal(exitCodeForAudit(readyAudit, { failOnGated: true }), 0);
});

test('package exposes performance gate audit as the standard command', () => {
  assert.equal(packageJson.scripts['audit:performance-gates'], 'node scripts/performance-gates-audit.mjs');
  assert.equal(packageJson.scripts['audit:performance-checklist'], 'node scripts/performance-gates-audit.mjs --manual-checklist');
  assert.equal(packageJson.scripts['audit:performance-session'], 'node scripts/performance-gates-audit.mjs --session-card');
  assert.equal(packageJson.scripts['audit:performance-next'], 'node scripts/performance-gates-audit.mjs --next-unblock');
});
