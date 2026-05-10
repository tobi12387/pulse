import { describe, expect, it } from 'vitest';
import type {
  PulseGarminExecutionLedgerEntry,
  PulseGarminSyncContract,
  PulsePlannedWorkout,
} from '@coaching-os/shared/pulse';
import { buildGarminExecutionDiff, type NormalizedGarminCalendarWorkout } from './garmin-execution-diff.js';

function contract(status: PulseGarminSyncContract['status'], issueCode?: PulseGarminSyncContract['issues'][number]['code']): PulseGarminSyncContract {
  return {
    version: 1,
    status,
    payloadReady: status !== 'blocked',
    checkedAt: '2026-05-10T08:00:00.000Z',
    summary: status === 'ready' ? 'Garmin-Payload bereit.' : 'Garmin nur eingeschraenkt.',
    issues: issueCode
      ? [{ code: issueCode, severity: status === 'blocked' ? 'error' : 'warning', message: issueCode }]
      : [],
  };
}

function workout(overrides: Partial<PulsePlannedWorkout>): PulsePlannedWorkout {
  return {
    id: overrides.id ?? 'workout-1',
    userId: 'user-1',
    plannedDate: overrides.plannedDate ?? '2026-05-11',
    activityType: overrides.activityType ?? 'bike',
    zone: overrides.zone ?? 2,
    durationMin: overrides.durationMin ?? 60,
    distanceKm: null,
    targetTss: 50,
    archetypeId: null,
    difficultyLevel: null,
    difficultyEnergySystem: null,
    capabilityFit: null,
    description: null,
    steps: overrides.steps ?? [{ type: 'steady', durationMin: 60, zone: 2 }],
    garminWorkoutId: overrides.garminWorkoutId ?? 'remote-workout-1',
    garminScheduledId: overrides.garminScheduledId ?? 'remote-schedule-1',
    garminSyncContract: overrides.garminSyncContract ?? contract('ready'),
    status: overrides.status ?? 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: overrides.completedActivityId ?? null,
    executionStatus: overrides.executionStatus ?? 'garmin_scheduled',
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: null,
    ...overrides,
  };
}

function remote(overrides: Partial<NormalizedGarminCalendarWorkout> = {}): NormalizedGarminCalendarWorkout {
  return {
    id: overrides.id ?? 'remote-schedule-1',
    workoutId: overrides.workoutId ?? 'remote-workout-1',
    date: overrides.date ?? '2026-05-11',
    workout: overrides.workout ?? {
      workoutSegments: [{
        workoutSteps: [
          { type: 'ExecutableStepDTO' },
        ],
      }],
    },
    lastSeenAt: overrides.lastSeenAt ?? '2026-05-10T08:30:00.000Z',
  };
}

function ledger(overrides: Partial<PulseGarminExecutionLedgerEntry>): PulseGarminExecutionLedgerEntry {
  return {
    id: 'ledger-1',
    plannedWorkoutId: 'workout-1',
    attemptedAt: '2026-05-10T08:20:00.000Z',
    operation: 'calendar_repair',
    outcome: 'ready',
    summary: 'Garmin bereit.',
    payloadSnapshot: null,
    issues: [],
    errorMessage: null,
    ...overrides,
  };
}

describe('buildGarminExecutionDiff', () => {
  it('marks a local workout as ready when the remote calendar contains the same scheduled item', () => {
    const response = buildGarminExecutionDiff({
      localWorkouts: [workout({})],
      remoteWorkouts: [remote()],
      ledgerEntries: [],
      today: '2026-05-10',
      generatedAt: '2026-05-10T09:00:00.000Z',
    });

    expect(response.rows[0]).toMatchObject({
      workoutId: 'workout-1',
      status: 'ready',
      local: { garminWorkoutId: 'remote-workout-1', garminScheduledId: 'remote-schedule-1' },
      remote: { workoutId: 'remote-workout-1', scheduledId: 'remote-schedule-1' },
      repairActions: [],
    });
  });

  it('flags a workout with a local template but no remote calendar item as missing calendar', () => {
    const response = buildGarminExecutionDiff({
      localWorkouts: [workout({})],
      remoteWorkouts: [],
      ledgerEntries: [],
      today: '2026-05-10',
    });

    expect(response.rows[0]).toMatchObject({
      status: 'missing_calendar',
      repairActions: ['schedule_calendar'],
    });
  });

  it('flags a remote repeat with missing iteration metadata as repairable', () => {
    const response = buildGarminExecutionDiff({
      localWorkouts: [workout({
        steps: [{ type: 'interval', durationMin: 5, zone: 4, reps: 3, restMin: 3 }],
      })],
      remoteWorkouts: [remote({
        workout: {
          workoutSegments: [{
            workoutSteps: [{
              type: 'RepeatGroupDTO',
              numberOfIterations: null,
              endConditionValue: null,
              endCondition: { conditionTypeKey: 'lap.button' },
            }],
          }],
        },
      })],
      ledgerEntries: [],
      today: '2026-05-10',
    });

    expect(response.rows[0]).toMatchObject({
      status: 'broken_repeat',
      repairActions: ['repair_repeat'],
    });
  });

  it('keeps strength support as an expected degraded handoff instead of a repair error', () => {
    const response = buildGarminExecutionDiff({
      localWorkouts: [workout({
        activityType: 'strength',
        garminWorkoutId: null,
        garminScheduledId: null,
        garminSyncContract: contract('degraded', 'strength_notes_only'),
        executionStatus: 'local_planned',
      })],
      remoteWorkouts: [],
      ledgerEntries: [],
      today: '2026-05-10',
    });

    expect(response.rows[0]).toMatchObject({
      status: 'degraded_expected',
      repairActions: [],
    });
    expect(response.rows[0]!.summary).toContain('Support-Blockliste');
  });

  it('marks completed planned workouts as completed from local execution evidence', () => {
    const response = buildGarminExecutionDiff({
      localWorkouts: [workout({
        status: 'completed',
        completedActivityId: 'activity-1',
        executionStatus: 'completed_matched',
        plannedDate: '2026-05-09',
      })],
      remoteWorkouts: [],
      ledgerEntries: [ledger({ outcome: 'ready' })],
      today: '2026-05-10',
    });

    expect(response.rows[0]).toMatchObject({
      status: 'completed',
      repairActions: [],
    });
  });
});
