import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildPerformanceGateAudit,
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
        label: 'GI-Komfort ergaenzen',
        detail: 'Add structured GI comfort to an existing long carb log.',
        targetPath: '/plan/activity/activity-a#activity-fueling-log',
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
    { label: 'Warning-free certificate trust', status: 'needs_followup' },
    { label: 'Push activation and test push', status: 'partial' },
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
  assert.match(rendered, /Fueling learning/);
  assert.match(rendered, /0\/3 comparable complete logs/);
  assert.match(rendered, /activity-a#activity-fueling-log, \/plan\/activity\/activity-b#activity-fueling-log/);
  assert.match(rendered, /iPhone\/PWA field/);
  assert.match(rendered, /2 open gaps/);
  assert.match(rendered, /Server deploy mirror/);
  assert.match(rendered, /PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(rendered, /deploy-auth-recovery\.md/);
});

test('performance gate audit reports ready when all required gates are ready', () => {
  const audit = buildPerformanceGateAudit({ today: '2026-05-21' }, makeRunner({
    fueling: READY_FUELING,
    iphone: READY_IPHONE,
    server: commandResult(0, '==> server verification complete: abc1234\n'),
  }));

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.openGates, 0);
  assert.deepEqual(audit.gates.map(gate => gate.gate), ['ready', 'ready', 'ready']);
  assert.match(renderPerformanceGateAudit(audit), /Gate: ready/);
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
  assert.match(renderPerformanceGateAudit(audit), /Skipped by --skip-server/);
  assert.match(renderPerformanceGateAudit(audit), /Gate: gated/);
});

test('package exposes performance gate audit as the standard command', () => {
  assert.equal(packageJson.scripts['audit:performance-gates'], 'node scripts/performance-gates-audit.mjs');
});
