import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulseGarminExecutionDiffRow } from '../shared/types/pulse/index.ts';
import { buildGarminExecutionChain } from '../frontend/src/features/plan/garmin-execution-chain-model.ts';

function row(overrides: Partial<PulseGarminExecutionDiffRow>): PulseGarminExecutionDiffRow {
  return {
    workoutId: overrides.workoutId ?? 'w1',
    plannedDate: overrides.plannedDate ?? '2026-05-13',
    title: overrides.title ?? 'Rad - Z2 - 75 min',
    status: overrides.status ?? 'ready',
    summary: overrides.summary ?? 'Auf Garmin bereit.',
    local: overrides.local ?? { garminWorkoutId: 'gw-1', garminScheduledId: 'sched-1' },
    remote: overrides.remote ?? { workoutId: 'gw-1', scheduledId: 'sched-1', lastSeenAt: '2026-05-12T08:00:00.000Z' },
    repeatAudit: overrides.repeatAudit ?? null,
    repairActions: overrides.repairActions ?? [],
  };
}

test('builds an all-ready execution chain without proposing a write action', () => {
  const chain = buildGarminExecutionChain([
    row({ workoutId: 'ready', status: 'ready' }),
    row({ workoutId: 'done', status: 'completed' }),
  ]);

  assert.equal(chain.overallState, 'ok');
  assert.equal(chain.nextAction.action, null);
  assert.match(chain.nextAction.title, /bereit/i);
  assert.equal(chain.stages.find(stage => stage.id === 'template')?.state, 'ok');
  assert.equal(chain.stages.find(stage => stage.id === 'calendar')?.state, 'ok');
  assert.equal(chain.stages.find(stage => stage.id === 'execution')?.value, '1/2');
});

test('prioritizes missing templates before calendar and repeat repair', () => {
  const chain = buildGarminExecutionChain([
    row({
      workoutId: 'missing-template',
      title: 'Rad - VO2',
      status: 'missing_template',
      local: { garminWorkoutId: null, garminScheduledId: null },
      remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
      repairActions: ['upload_template'],
    }),
    row({
      workoutId: 'missing-calendar',
      status: 'missing_calendar',
      remote: { workoutId: 'gw-2', scheduledId: null, lastSeenAt: '2026-05-12T08:00:00.000Z' },
      repairActions: ['schedule_calendar'],
    }),
  ]);

  assert.equal(chain.overallState, 'attention');
  assert.equal(chain.nextAction.action, 'upload_template');
  assert.equal(chain.nextAction.workoutId, 'missing-template');
  assert.equal(chain.stages.find(stage => stage.id === 'template')?.state, 'attention');
  assert.equal(chain.stages.find(stage => stage.id === 'calendar')?.state, 'attention');
});

test('surfaces repeat repair as the next action when templates and calendar are present', () => {
  const chain = buildGarminExecutionChain([
    row({
      workoutId: 'repeat',
      status: 'broken_repeat',
      repeatAudit: {
        status: 'repair_needed',
        summary: 'Pulse erwartet 3x, Garmin zeigt 0x.',
        localRepeatGroups: 1,
        localRepeatIterations: 3,
        remoteRepeatGroups: 1,
        remoteRepeatIterations: 0,
        remoteInvalidRepeatGroups: 1,
      },
      repairActions: ['repair_repeat'],
    }),
  ]);

  assert.equal(chain.nextAction.action, 'repair_repeat');
  assert.equal(chain.stages.find(stage => stage.id === 'repeats')?.state, 'attention');
  assert.match(chain.stages.find(stage => stage.id === 'repeats')?.summary ?? '', /Wiederholungen/);
});

test('keeps attention copy when a diff row has no automatic repair action', () => {
  const chain = buildGarminExecutionChain([
    row({
      workoutId: 'stale',
      status: 'stale',
      summary: 'Garmin-Kalendertermin weicht vom Pulse-Plan ab.',
      repairActions: [],
    }),
  ]);

  assert.equal(chain.overallState, 'attention');
  assert.equal(chain.nextAction.action, null);
  assert.equal(chain.nextAction.workoutId, 'stale');
  assert.match(chain.nextAction.title, /prüfen/i);
  assert.doesNotMatch(chain.nextAction.title, /bereit/i);
});
