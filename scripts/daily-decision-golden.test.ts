import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseActivity,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjectionResponse,
  PulseHomeScreenData,
  PulsePlannedWorkout,
} from '../shared/types/pulse/index.ts';
import { deriveDailyDecision, type DailyDecision } from '../frontend/src/pulse/daily-decision.ts';

const TODAY = '2026-05-01';

type HomeRecovery = NonNullable<PulseHomeScreenData['recovery']>;

function recovery(overrides: Partial<HomeRecovery> = {}): HomeRecovery {
  return {
    sleepDebt7d: { hours: 1.2, targetH: 7.5, baselineSource: 'fixed_default', status: 'ok' },
    hrvDeviation7d: { pct: 2, recentMs: 51, baselineMs: 50, status: 'stable' },
    rhrDrift7d: { bpmAboveBaseline: 1, recent: 49, baseline: 48, status: 'normal' },
    recoveryScore: 78,
    recommendation: 'Normale Belastung ist vertretbar.',
    ...overrides,
  };
}

function home(overrides: Partial<PulseHomeScreenData> = {}): PulseHomeScreenData {
  return {
    date: TODAY,
    readiness: {
      score: 78,
      label: 'gut',
      shortLabel: 'gut',
      color: 'green',
      components: {
        sleep: 80,
        hrv: 74,
        tsb: 76,
        battery: 72,
        mental: 82,
        stress: 78,
      },
    },
    todayMetrics: null,
    fitnessLoad: {
      date: TODAY,
      ctl: 42.4,
      atl: 48.1,
      tsb: -5.7,
    },
    todayWorkout: null,
    todayActivities: [],
    recentActivities: [],
    nextWorkout: null,
    prognosis: {
      alert: false,
      message: 'Stabiler Trainingstag.',
      horizon_days: 3,
      factors: ['HRV stabil', 'Schlaf solide'],
    },
    streaks: {
      checkinStreakDays: 4,
      workoutStreakDays: 2,
    },
    recovery: recovery(),
    dataStatus: {
      userReady: true,
      profileReady: true,
      garmin: {
        status: 'ready',
        lastMetricDate: TODAY,
        lastMetricSyncAt: `${TODAY}T05:00:00.000Z`,
        lastActivityAt: `${TODAY}T06:00:00.000Z`,
        metricsDays14: 14,
        activitiesDays14: 5,
        issues: [],
      },
    },
    nextBestActions: [],
    ...overrides,
  };
}

function activity(overrides: Partial<PulseActivity> = {}): PulseActivity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    externalId: 'garmin-activity-1',
    source: 'garmin',
    startTime: `${TODAY}T08:00:00.000Z`,
    activityType: 'bike',
    name: 'Rennrad Tour',
    durationSec: 60 * 60,
    distanceM: 28000,
    avgHr: 136,
    maxHr: 162,
    avgPowerW: 172,
    normalizedPowerW: 184,
    tss: 55,
    calories: 720,
    elevationGainM: 220,
    trainingEffectAerobic: 2.8,
    trainingEffectAnaerobic: 0.1,
    vo2maxEstimate: null,
    rpe: null,
    rpeNote: null,
    sorenessAreas: null,
    feedbackLoggedAt: null,
    plannedWorkoutId: 'planned-1',
    ...overrides,
  };
}

function workout(overrides: Partial<PulsePlannedWorkout> = {}): PulsePlannedWorkout {
  return {
    id: 'planned-1',
    userId: 'user-1',
    plannedDate: TODAY,
    activityType: 'bike',
    zone: 2,
    durationMin: 60,
    distanceKm: null,
    targetTss: 55,
    archetypeId: 'endurance_steady',
    difficultyLevel: 3.1,
    difficultyEnergySystem: 'endurance',
    capabilityFit: 'productive',
    description: 'Ruhige Ausdauer.',
    steps: null,
    garminWorkoutId: 'garmin-workout-1',
    garminScheduledId: 'garmin-scheduled-1',
    garminSyncContract: null,
    status: 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: null,
    executionStatus: 'garmin_scheduled',
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: null,
    ...overrides,
  };
}

function fuelingBaseline(activityId: string): PulseFuelingOutcomeBaseline {
  return {
    status: 'insufficient_data',
    label: 'Fueling-Baseline offen',
    summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Vertraeglichkeit als Baseline.',
    latestLogDate: null,
    observedCarbsPerHour: null,
    targetCarbsPerHour: null,
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    evidence: ['Lange Einheiten nachtraeglich mit Carbs, Flaschen, Pulver und GI-Komfort loggen.'],
    learningReadiness: {
      comparableCompleteLogs: 1,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: [
        'Noch zwei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.',
        'GI-Komfort fehlt strukturiert fuer mindestens einen langen During-Log.',
      ],
      nextAction: {
        kind: 'complete_gi_comfort',
        label: 'GI-Komfort ergänzen',
        detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen, damit der vorhandene Carb-Log fuer die Fueling-Baseline zählt.',
        activityId,
      },
    },
  };
}

function goalProjection(): PulseGoalProjectionResponse {
  return {
    generatedAt: `${TODAY}T08:00:00.000Z`,
    horizonDays: 180,
    headline: '70.3 Kraichgau braucht Fueling-Praxis.',
    projections: [{
      goalId: 'goal-703',
      title: '70.3 Kraichgau',
      category: 'race',
      targetDate: '2026-06-14',
      daysUntil: 44,
      probabilityPct: 48,
      status: 'at_risk',
      confidence: 'medium',
      summary: 'Long-Endurance und Fueling sind noch nicht belastbar genug.',
      limiterRisk: {
        status: 'blocked',
        label: 'Fueling-Limiter',
        summary: 'GI- und During-Logs fehlen fuer lange Einheiten.',
        evidence: ['1/3 vergleichbare Logs'],
      },
      nextBestIntervention: {
        kind: 'fueling_practice',
        title: 'Fueling-Praxis absichern',
        summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
        actionLabel: 'Plan prüfen',
        targetPath: '/plan?tab=training#goal-projection',
        evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
      },
      evidence: ['Ziel in 44 Tagen'],
      missingEvidence: ['Fueling-Vertraeglichkeit offen'],
    }],
    missingEvidence: [],
  };
}

function decisionFor(data: PulseHomeScreenData, context: Parameters<typeof deriveDailyDecision>[1] = {}): DailyDecision {
  const decision = deriveDailyDecision(data, context);
  assert.ok(decision);
  return decision;
}

function assertSignalBefore(decision: DailyDecision, first: string, second: string) {
  const labels = decision.contract.signals.map(signal => signal.label);
  const firstIndex = labels.indexOf(first);
  const secondIndex = labels.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} should be present in ${labels.join(', ')}`);
  assert.notEqual(secondIndex, -1, `${second} should be present in ${labels.join(', ')}`);
  assert.ok(firstIndex < secondIndex, `${first} should come before ${second}: ${labels.join(', ')}`);
}

test('completed planned workouts route missing feedback before the day can close', () => {
  const completed = activity({ id: 'activity-feedback-open', plannedWorkoutId: 'planned-feedback-open' });
  const planned = workout({
    id: 'planned-feedback-open',
    status: 'completed',
    completedActivityId: completed.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: `${TODAY}T09:05:00.000Z`,
    executionMatchConfidence: 0.95,
  });

  const decision = decisionFor(home({
    todayWorkout: planned,
    todayActivities: [completed],
    recentActivities: [completed],
  }));

  assert.equal(decision.cta, 'Feedback erfassen');
  assert.equal(decision.targetPath, '/plan/activity/activity-feedback-open');
  assert.match(decision.resultPreview ?? '', /Feedback verbessert die nächste Planentscheidung/);
  assert.match(decision.contract.leadingFactor, /^Feedback: RPE fehlt/);
  assert.match(decision.contract.safestAlternative, /Feedback zuerst erfassen/);
  assert.match(decision.contract.goalImpact, /Feedback macht die naechste Planung genauer/);
  assert.match(decision.contract.garminExecution, /geplante Einheit erledigt/);
  assert.equal(decision.steps?.find(step => step.status === 'open')?.label, 'Feedback erfassen');
});

test('completed long workouts close fueling learning before generic feedback', () => {
  const completed = activity({
    id: 'activity-post-fueling',
    durationSec: 3 * 3600,
    distanceM: 78000,
    tss: 168,
    plannedWorkoutId: 'planned-post-fueling',
  });
  const planned = workout({
    id: 'planned-post-fueling',
    status: 'completed',
    durationMin: 180,
    targetTss: 155,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyEnergySystem: 'long_endurance',
    description: 'Lange Ausfahrt mit bewusstem Fueling als Lernziel.',
    completedActivityId: completed.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: `${TODAY}T12:05:00.000Z`,
    executionMatchConfidence: 0.94,
  });

  const decision = decisionFor(home({
    todayWorkout: planned,
    todayActivities: [completed],
    recentActivities: [completed],
  }), {
    fuelingOutcomeBaseline: fuelingBaseline(completed.id),
  });

  assert.equal(decision.cta, 'GI-Komfort ergänzen');
  assert.equal(decision.targetPath, '/plan/activity/activity-post-fueling#activity-fueling-log');
  assert.match(decision.resultPreview ?? '', /Fueling-Log/);
  assert.match(decision.contract.leadingFactor, /^Fueling-Lernen:/);
  assert.match(decision.contract.safestAlternative, /Fueling-Evidence zuerst schließen: GI-Komfort ergänzen/);
  assert.match(decision.contract.safestAlternative, /Feedback danach kurz erfassen/);
  assertSignalBefore(decision, 'Fueling-Lernen', 'Feedback');
});

test('recovery pressure outranks a normal productive workout and owns the safe option', () => {
  const planned = workout({ id: 'planned-recovery-pressure' });
  const decision = decisionFor(home({
    todayWorkout: planned,
    recovery: recovery({
      sleepDebt7d: { hours: 3.2, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'severe' },
      hrvDeviation7d: { pct: -9, recentMs: 42, baselineMs: 50, status: 'declining' },
      rhrDrift7d: { bpmAboveBaseline: 5, recent: 54, baseline: 49, status: 'elevated' },
      recoveryScore: 38,
      recommendation: 'Heute nur sehr locker bewegen.',
    }),
  }));

  assert.match(decision.contract.leadingFactor, /^Recovery:/);
  assert.equal(decision.cta, 'Recovery ansehen');
  assert.equal(decision.targetPath, '/data?tab=trends#data-recovery');
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(decision.contract.safestAlternative, /Recovery schützen: Schlafdefizit schwer/);
  assert.match(decision.contract.goalImpact, /produktiver Trainingsreiz/);
  assertSignalBefore(decision, 'Recovery', 'Training');
});

test('at-risk goals can become the primary intervention when no stronger blocker exists', () => {
  const planned = workout({ id: 'planned-goal-risk' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    goalProjection: goalProjection(),
  });

  assert.match(decision.contract.leadingFactor, /^Ziel: 70\.3 Kraichgau: 48% · Fueling-Praxis absichern/);
  assert.equal(decision.cta, 'Plan prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training#goal-projection');
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Zielintervention: Fueling-Praxis absichern/);
  assert.match(decision.contract.goalImpact, /70\.3 Kraichgau: 48% · Fueling-Praxis absichern/);
  assertSignalBefore(decision, 'Ziel', 'Training');
});

test('blocked Garmin execution beats normal training without creating a hidden write', () => {
  const planned = workout({
    id: 'planned-garmin-blocked',
    garminWorkoutId: null,
    garminScheduledId: null,
    executionStatus: 'local_planned',
    garminSyncContract: {
      version: 1,
      status: 'blocked',
      payloadReady: false,
      checkedAt: `${TODAY}T07:00:00.000Z`,
      summary: 'Repeat-Gruppen blockiert; Vorlage muss zuerst geprüft werden.',
      issues: [{
        code: 'repeat_iterations_invalid',
        severity: 'error',
        message: 'Repeat-Gruppe kann nicht sicher nach Garmin geschrieben werden.',
      }],
    },
  });

  const decision = decisionFor(home({ todayWorkout: planned }));

  assert.match(decision.contract.leadingFactor, /^Garmin: Sync blockiert: Repeat-Gruppen blockiert/);
  assert.equal(decision.cta, 'Garmin prüfen');
  assert.equal(decision.targetPath, '/plan?tab=execution&source=daily-garmin&workoutId=planned-garmin-blocked');
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Garmin zuerst schließen/);
  assert.match(decision.contract.garminExecution, /kein automatischer Geraete-Write/);
  assertSignalBefore(decision, 'Garmin', 'Training');
});
