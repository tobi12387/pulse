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
  renderPerformanceGateAudit,
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

function makeRunner({ fueling, iphone, server, commit = 'abc1234' }) {
  return (command, args) => {
    if (command === 'git' && args.join(' ') === 'rev-parse --short HEAD') {
      return commandResult(0, `${commit}\n`);
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
  assert.match(rendered, /Fueling learning/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(rendered, /Evidence packet: `npm run audit:fueling-gate -- --today 2026-05-21 --packet`/);
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
  assert.match(packet, /Real iPhone\/PWA field evidence must be recorded against the expected commit for this run/);
  assert.match(packet, /If the run is intentionally pinned to a known deployed\/runtime commit, pass --expected-commit <short> so server and iPhone checks use that commit/);
  assert.match(packet, /Rerun after any manual save or deploy: npm run audit:performance-gates -- --today 2026-05-21/);
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
    action: 'Rerun the real iPhone checklist and record Server commit under test: abc1234.',
    detail: '3 open gaps: Current main field evidence: stale, Warning-free certificate trust: needs_followup, Push activation and test push: partial',
    metadata: {
      evidenceChecklist: 'docs/ai/checklists/iphone-pwa-qa.md',
      evidenceFile: 'docs/qa/field.md',
      expectedCommit: 'abc1234',
      commitStatus: 'stale',
      serverCommitUnderTest: '9e05189',
      fieldPacketCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet',
      fieldScaffoldCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold',
      serverVerifyCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server',
      serverRecoveryPacketCommand: null,
      firstGap: {
        kind: 'current_commit_evidence',
        label: 'Current main field evidence',
        status: 'stale',
        nextAction: 'Rerun the real iPhone checklist and record Server commit under test: abc1234.',
      },
    },
  });
  assert.match(renderNextUnblock(audit), /Command: npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
  assert.match(renderNextUnblock(audit), /Evidence checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(renderNextUnblock(audit), /Field packet: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
  assert.match(renderNextUnblock(audit), /Field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.doesNotMatch(renderNextUnblock(audit), /Server recovery packet:/);
  assert.match(renderNextUnblock(audit), /Manual safety:/);
  assert.match(renderNextUnblock(audit), /Real iPhone\/PWA field evidence must be recorded against the expected commit for this run/);
  assert.match(renderNextUnblock(audit), /The server is a GitHub main mirror; do not edit, branch or commit on the server/);
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
    assert.equal(audit.gates[1].fieldScaffoldCommand, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold');
    assert.equal(audit.gates[1].command, 'PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234');
    assert.equal(audit.gates[1].serverVerifyCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
    assert.equal(audit.gates[1].serverRecoveryPacketCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');
    assert.equal(audit.gates[2].command, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
    assert.equal(audit.gates[2].recoveryPacketCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');

    const packet = renderPerformanceGatePacket(audit);
    assert.match(packet, /Command: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
    assert.match(packet, /Field packet: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
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
  assert.match(audit.gates[2].nextAction, /Do not edit server files directly/);
  assert.equal(audit.gates[2].recoveryRunbook, null);
  assert.equal(audit.gates[2].recoveryPacketCommand, null);
  assert.doesNotMatch(renderNextUnblock(audit), /deploy-auth-recovery/);
  assert.match(renderNextUnblock(audit), /standard merge\/deploy flow/);
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
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: false,
    packet: true,
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
    failOnGated: false,
    nextUnblock: true,
    targetUrl: true,
    targetUrls: false,
    packet: false,
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
    failOnGated: false,
    nextUnblock: false,
    targetUrl: false,
    targetUrls: true,
    packet: false,
    json: false,
  });
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
  assert.equal(packageJson.scripts['audit:performance-next'], 'node scripts/performance-gates-audit.mjs --next-unblock');
});
