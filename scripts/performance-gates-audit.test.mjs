import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildPerformanceGateAudit,
  exitCodeForAudit,
  renderNextUnblock,
  renderPerformanceGateAudit,
} from './performance-gates-audit.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function commandResult(status, stdout = '', stderr = '') {
  return { status, stdout, stderr };
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
        detail: 'Add structured GI comfort to an existing long carb log.',
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
    action: 'GI-Komfort ergaenzen - Add structured GI comfort to an existing long carb log. - Path: /plan/activity/activity-a#activity-fueling-log',
    detail: '0/3 comparable complete logs; 2 existing logs completable now: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h) -> /plan/activity/activity-a#activity-fueling-log, 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs (23 g/h) -> /plan/activity/activity-b#activity-fueling-log; 1 new complete long-session log still needed after candidates.',
    metadata: {
      kind: 'complete_gi_comfort',
      targetPath: '/plan/activity/activity-a#activity-fueling-log',
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
    },
  });
  assert.equal(audit.gates[0].nextAction, 'GI-Komfort ergaenzen - Add structured GI comfort to an existing long carb log. - Path: /plan/activity/activity-a#activity-fueling-log');
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
  ]);
  assert.equal(audit.gates[2].expectedCommit, 'abc1234');
  assert.equal(audit.gates[2].recoveryRunbook, 'docs/ai/checklists/deploy-auth-recovery.md');
  assert.equal(audit.gates[2].recoveryPacketCommand, 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');

  const rendered = renderPerformanceGateAudit(audit);
  assert.match(rendered, /# Performance-OS Gate Audit/);
  assert.match(rendered, /Open gates: 3/);
  assert.match(rendered, /Next unblock: Fueling learning/);
  assert.match(rendered, /Next action: GI-Komfort ergaenzen/);
  assert.match(rendered, /Next target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(rendered, /Fueling learning/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(rendered, /Evidence packet: `npm run audit:fueling-gate -- --today 2026-05-21 --packet`/);
  assert.match(rendered, /0\/3 comparable complete logs/);
  assert.match(rendered, /Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\) -> \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(rendered, /Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> \/plan\/activity\/activity-b#activity-fueling-log/);
  assert.match(rendered, /iPhone\/PWA field/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(rendered, /Field packet: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet`/);
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
  assert.match(nextRendered, /Target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(nextRendered, /Target path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(nextRendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(nextRendered, /Evidence packet: npm run audit:fueling-gate -- --today 2026-05-21 --packet/);
  assert.match(nextRendered, /Options: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(nextRendered, /Completion candidates:/);
  assert.match(nextRendered, /- 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\) -> \/plan\/activity\/activity-a#activity-fueling-log \(missing: GI comfort\)/);
  assert.match(nextRendered, /- 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\) -> \/plan\/activity\/activity-b#activity-fueling-log \(missing: GI comfort\)/);
  assert.doesNotMatch(nextRendered, /## iPhone\/PWA field/);
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
});

test('performance gate audit exposes structured next-unblock metadata for iPhone field gates', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: GATED_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(audit.gate, 'gated');
  assert.deepEqual(audit.nextUnblock, {
    key: 'iphone_pwa',
    label: 'iPhone/PWA field',
    command: 'npm run audit:iphone-pwa-gate',
    action: 'Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234.',
    detail: '3 open gaps: Current main field evidence: stale, Warning-free certificate trust: needs_followup, Push activation and test push: partial',
    metadata: {
      evidenceChecklist: 'docs/ai/checklists/iphone-pwa-qa.md',
      evidenceFile: 'docs/qa/field.md',
      expectedCommit: 'abc1234',
      commitStatus: 'stale',
      serverCommitUnderTest: '9e05189',
      fieldPacketCommand: 'npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet',
      serverVerifyCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server',
      serverRecoveryPacketCommand: 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet',
      firstGap: {
        kind: 'current_commit_evidence',
        label: 'Current main field evidence',
        status: 'stale',
        nextAction: 'Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234.',
      },
    },
  });
  assert.match(renderNextUnblock(audit), /Evidence checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(renderNextUnblock(audit), /Field packet: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --packet/);
  assert.match(renderNextUnblock(audit), /Server recovery packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
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
