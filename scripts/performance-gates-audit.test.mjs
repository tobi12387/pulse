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
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-a#activity-fueling-log',
          missing: ['GI comfort'],
        },
        {
          date: '2026-05-04',
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
  gate: 'gated',
  scope: { serverCommit: '9e05189' },
  gaps: [
    {
      kind: 'certificate_trust',
      label: 'Warning-free certificate trust',
      status: 'needs_followup',
      nextAction: 'Install and trust only frontend/certs/rootCA.pem on the iPhone.',
    },
    { kind: 'push_activation', label: 'Push activation and test push', status: 'partial' },
  ],
  nextAction: 'Install and trust only frontend/certs/rootCA.pem on the iPhone.',
}));

const READY_IPHONE = commandResult(0, JSON.stringify({
  evidenceFile: 'docs/qa/field.md',
  gate: 'ready',
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
    detail: '0/3 comparable complete logs; 2 existing logs completable now: /plan/activity/activity-a#activity-fueling-log, /plan/activity/activity-b#activity-fueling-log; 1 new complete long-session log still needed after candidates.',
    metadata: {
      kind: 'complete_gi_comfort',
      targetPath: '/plan/activity/activity-a#activity-fueling-log',
      date: '2026-05-09',
      options: [
        { value: 'ok', label: 'Magen ok' },
        { value: 'mild_issue', label: 'Magen leicht unruhig' },
        { value: 'issue', label: 'Magenprobleme' },
      ],
      completionCandidates: [
        {
          date: '2026-05-09',
          status: 'can count after GI comfort',
          targetPath: '/plan/activity/activity-a#activity-fueling-log',
          missing: ['GI comfort'],
        },
        {
          date: '2026-05-04',
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
      status: 'can count after GI comfort',
      targetPath: '/plan/activity/activity-a#activity-fueling-log',
      missing: ['GI comfort'],
    },
    {
      date: '2026-05-04',
      status: 'can count after GI comfort',
      targetPath: '/plan/activity/activity-b#activity-fueling-log',
      missing: ['GI comfort'],
    },
  ]);
  assert.equal(audit.gates[2].expectedCommit, 'abc1234');
  assert.equal(audit.gates[2].recoveryRunbook, 'docs/ai/checklists/deploy-auth-recovery.md');

  const rendered = renderPerformanceGateAudit(audit);
  assert.match(rendered, /# Performance-OS Gate Audit/);
  assert.match(rendered, /Open gates: 3/);
  assert.match(rendered, /Next unblock: Fueling learning/);
  assert.match(rendered, /Next action: GI-Komfort ergaenzen/);
  assert.match(rendered, /Fueling learning/);
  assert.match(rendered, /0\/3 comparable complete logs/);
  assert.match(rendered, /activity-a#activity-fueling-log, \/plan\/activity\/activity-b#activity-fueling-log/);
  assert.match(rendered, /iPhone\/PWA field/);
  assert.match(rendered, /2 open gaps/);
  assert.match(rendered, /Server deploy mirror/);
  assert.match(rendered, /PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(rendered, /deploy-auth-recovery\.md/);

  const nextRendered = renderNextUnblock(audit);
  assert.match(nextRendered, /# Performance-OS Next Unblock/);
  assert.match(nextRendered, /Next unblock: Fueling learning/);
  assert.match(nextRendered, /Command: npm run audit:fueling-gate -- --today 2026-05-21/);
  assert.match(nextRendered, /Target path: \/plan\/activity\/activity-a#activity-fueling-log/);
  assert.match(nextRendered, /Options: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
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
    action: 'Install and trust only frontend/certs/rootCA.pem on the iPhone.',
    detail: '2 open gaps: Warning-free certificate trust: needs_followup, Push activation and test push: partial',
    metadata: {
      evidenceFile: 'docs/qa/field.md',
      serverCommitUnderTest: '9e05189',
      firstGap: {
        kind: 'certificate_trust',
        label: 'Warning-free certificate trust',
        status: 'needs_followup',
        nextAction: 'Install and trust only frontend/certs/rootCA.pem on the iPhone.',
      },
    },
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
  });
  assert.match(renderNextUnblock(audit), /Recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
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
