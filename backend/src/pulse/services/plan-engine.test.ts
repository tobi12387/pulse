import { describe, it, expect, vi } from 'vitest';
import { generateScientificWeekPlan, generateWeekWorkouts, adaptIntensityForReadiness, decidePlanDays } from './plan-engine.js';
import type { PulsePlanLearningSnapshot, PulsePlanLearningWeek, PulseSeasonStrategy } from '@coaching-os/shared/pulse';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('[]'),
  SMART_MODEL: 'test-model',
}));

function planLearning(overrides: Partial<PulsePlanLearningWeek> = {}, flags: PulsePlanLearningSnapshot['flags'] = []): PulsePlanLearningSnapshot {
  const previousWeek = {
    weekStart: '2026-04-27',
    plannedSessions: 4,
    completedSessions: 4,
    skippedSessions: 0,
    completionRate: 1,
    avgComplianceScore: 0.9,
    avgRpe: 6,
    sportMix: { bike: { sessions: 3, totalMinutes: 210, totalTss: 180 } },
    hardDays: [{ date: '2026-04-28', activityType: 'bike', zone: 4, durationMin: 55 }],
    skippedAvailableDays: [],
    ...overrides,
  };

  return {
    lookbackWeeks: 6,
    weeks: [previousWeek],
    previousWeek,
    learnedFromLastWeek: ['Vorwoche stabil.'],
    variationComparedToLastWeek: [],
    flags,
  };
}

function seasonStrategy(overrides: Partial<PulseSeasonStrategy['guardrails']> = {}): PulseSeasonStrategy {
  return {
    horizonWeeks: 12,
    primaryGoal: { id: 'race-1', title: '70.3', category: 'race', targetDate: '2026-07-11', priority: 'A' },
    currentBlock: { kind: 'build', label: 'Build', startWeek: '2026-05-04', endWeek: '2026-06-01', focus: 'Build' },
    upcomingBlocks: [],
    guardrails: {
      targetSessions: 3,
      maxHardDays: 1,
      deload: false,
      freeDayRationale: 'Pulse nutzt nicht alle verfügbaren Tage.',
      rationale: ['Saisonlinie begrenzt Dichte.'],
      nextBoundary: { label: 'Taper', date: '2026-06-29' },
      ...overrides,
    },
    evidence: [],
  };
}

describe('generateWeekWorkouts', () => {
  it('generates workouts for the week', () => {
    const workouts = generateWeekWorkouts({
      weekStart: '2026-04-28',
      phase: 'base',
      weeklyHoursTarget: 8,
      availableDays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    });
    expect(workouts.length).toBeGreaterThan(0);
    expect(workouts.every((w) => w.durationMin > 0)).toBe(true);
    expect(workouts.every((w) => w.zone >= 1 && w.zone <= 5)).toBe(true);
  });
});

describe('adaptIntensityForReadiness', () => {
  it('reduces duration for low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 35);
    expect(adapted.durationMin).toBeLessThan(90);
  });

  it('keeps duration for high readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 85);
    expect(adapted.durationMin).toBe(90);
  });

  it('drops zone for critically low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 25);
    expect(adapted.zone).toBeLessThan(4);
  });
});

describe('decidePlanDays', () => {
  it('treats availability as candidate days for weight goals', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 4, 5, 6],
      weeklyHoursTarget: 5,
      tsb: 0,
      phase: 'base',
      mesocycleWeek: 1,
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
    });

    expect(decision.selectedDays).toHaveLength(3);
    expect(decision.skippedAvailableDays.length).toBeGreaterThan(0);
    expect(decision.reasons.join(' ')).toContain('Gewichtsziel');
  });

  it('reduces frequency when fatigue is high', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 2, 3, 4],
      weeklyHoursTarget: 8,
      tsb: -18,
      phase: 'base',
      mesocycleWeek: 2,
      goals: [],
    });

    expect(decision.selectedDays.length).toBeLessThan(5);
    expect(decision.reasons.join(' ')).toContain('TSB negativ');
  });

  it('reduces frequency when critical risk signals are active', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 2, 3, 4],
      weeklyHoursTarget: 8,
      tsb: 5,
      phase: 'base',
      mesocycleWeek: 1,
      goals: [],
      riskSignals: [{
        ruleId: 'rhr_drift_7d',
        severity: 'critical',
        title: 'Ruhepuls erhöht',
        recommendation: 'Pause',
      }],
    });

    expect(decision.selectedDays).toHaveLength(2);
    expect(decision.reasons.join(' ')).toContain('Kritisches Risk-Signal');
  });

  it('explains repeated sport mix learning without reducing density', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 2, 3, 5],
      weeklyHoursTarget: 7,
      tsb: 0,
      phase: 'base',
      mesocycleWeek: 1,
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
      planLearning: planLearning({}, ['repeated_sport_mix']),
    });

    expect(decision.selectedDays).toHaveLength(4);
    expect(decision.reasons.join(' ')).toContain('Sportmix');
  });
});

describe('generateScientificWeekPlan', () => {
  it('does not fill every available day for weight-focused low-volume weeks', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'base',
      weeklyHoursTarget: 5,
      availableDays: [0, 1, 4, 5, 6],
      ctl: 15,
      atl: 18,
      tsb: 0,
      ftpWatts: 171,
      maxHrBpm: 175,
      recentActivities: [],
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
    });

    expect(workouts).toHaveLength(3);
    expect(workouts.every(w => w.zone <= 2)).toBe(true);
    expect(workouts.some(w => w.activityType === 'strength')).toBe(false);
  });

  it('removes hard sessions while recovery risk signals are active', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'base',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 4],
      ctl: 30,
      atl: 28,
      tsb: 5,
      ftpWatts: 171,
      maxHrBpm: 175,
      recentActivities: [],
      goals: [],
      riskSignals: [{
        ruleId: 'sleep_debt_5d',
        severity: 'warn',
        title: 'Schlafschuld',
        recommendation: 'Umfang reduzieren',
      }],
    });

    expect(workouts.length).toBeLessThan(5);
    expect(workouts.every(w => w.zone <= 2)).toBe(true);
  });

  it('biases FTP goals toward bike quality instead of generic rotation', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      lthrBpm: 170,
      recentActivities: [],
      goals: [{
        title: 'FTP: 280 W',
        targetDate: '2026-08-01',
        category: 'ftp',
        metrics: { targetFtp: 280 },
      }],
    });

    const bikes = workouts.filter(w => w.activityType === 'bike');
    const runs = workouts.filter(w => w.activityType === 'run');
    expect(bikes.length).toBeGreaterThan(runs.length);
    expect(workouts.filter(w => w.zone >= 4).every(w => w.activityType === 'bike')).toBe(true);
  });

  it('uses triathlon race goals to include swim, bike, and run specificity', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 9,
      availableDays: [0, 1, 2, 3, 4, 5],
      ctl: 42,
      atl: 38,
      tsb: 6,
      ftpWatts: 240,
      maxHrBpm: 182,
      recentActivities: [],
      goals: [{
        title: 'Ironman 70.3',
        targetDate: '2026-09-06',
        category: 'race',
        raceDiscipline: 'triathlon_70_3',
        raceDistanceKm: 113,
        racePriority: 'A',
      }],
    });

    expect([...new Set(workouts.map(w => w.activityType))]).toEqual(expect.arrayContaining(['swim', 'bike', 'run']));
  });

  it('treats high RPE on easy work as a safety signal for the next plan', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [{
        date: '2026-05-01',
        activityType: 'bike',
        durationMin: 60,
        tss: 40,
        rpe: 8,
        plannedZone: 2,
      }],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
    });

    expect(workouts.length).toBeLessThan(4);
    expect(workouts.every(w => w.zone <= 2)).toBe(true);
    expect(workouts.map(w => w.description).join(' ')).toContain('Subjektive Ermüdung');
  });

  it('uses low compliance learning to reduce plan density', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      planLearning: planLearning({
        completedSessions: 2,
        completionRate: 0.5,
        avgComplianceScore: 0.58,
      }, ['low_compliance', 'low_completion']),
    });

    expect(workouts).toHaveLength(3);
  });

  it('moves hard days when previous weeks had the same hard-day pattern', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      planLearning: planLearning({}, ['repeated_hard_pattern']),
    });

    const hardDates = workouts.filter(w => w.zone >= 4).map(w => w.plannedDate);
    expect(hardDates.length).toBeGreaterThan(0);
    expect(hardDates).not.toContain('2026-05-05');
  });

  it('varies repeated sport mix deterministically without changing session count', async () => {
    const input = {
      weekStart: '2026-05-04',
      phase: 'base' as const,
      weeklyHoursTarget: 7,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 25,
      atl: 24,
      tsb: 0,
      ftpWatts: 210,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
    };
    const baseline = await generateScientificWeekPlan({
      ...input,
      planLearning: planLearning({}, []),
    });
    const varied = await generateScientificWeekPlan({
      ...input,
      planLearning: planLearning({
        sportMix: {
          bike: { sessions: 3, totalMinutes: 210, totalTss: 150 },
          run: { sessions: 1, totalMinutes: 45, totalTss: 35 },
        },
      }, ['repeated_sport_mix']),
    });
    const repeated = await generateScientificWeekPlan({
      ...input,
      planLearning: planLearning({
        sportMix: {
          bike: { sessions: 3, totalMinutes: 210, totalTss: 150 },
          run: { sessions: 1, totalMinutes: 45, totalTss: 35 },
        },
      }, ['repeated_sport_mix']),
    });

    expect(varied).toHaveLength(baseline.length);
    expect(varied.map(w => w.activityType)).toEqual(repeated.map(w => w.activityType));
    expect(varied.map(w => w.activityType)).not.toEqual(baseline.map(w => w.activityType));
  });

  it('makes repeated-week variation visible through archetypes and description notes', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-11',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      planLearning: planLearning({
        weekStart: '2026-05-04',
        sportMix: {
          bike: { sessions: 3, totalMinutes: 315, totalTss: 287 },
          run: { sessions: 1, totalMinutes: 45, totalTss: 35 },
        },
        hardDays: [{ date: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 75 }],
      }, ['repeated_sport_mix', 'repeated_hard_pattern']),
    });

    const descriptions = workouts.map(w => w.description).join(' ');
    expect(descriptions).toContain('Archetyp');
    expect(descriptions).toContain('Variation zur Vorwoche');
    expect(workouts.filter(w => w.zone >= 4).map(w => w.description).join(' ')).toContain('Threshold Intervals');
  });

  it('does not reduce density when learning has history but no actual issue flag', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      planLearning: planLearning({ plannedSessions: 0, completedSessions: 0, completionRate: null }, []),
    });

    expect(workouts).toHaveLength(4);
  });

  it('relocates hard days and reduces density when execution review shows a missed hard session plus weak recovery', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 35,
      atl: 30,
      tsb: 8,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      executionReview: {
        signals: ['missed', 'protect_recovery'],
        learnedFromLastWeek: ['Eine harte Einheit wurde verpasst.'],
        variationComparedToLastWeek: ['Harten Reiz nicht am gleichen Wochentag wiederholen.'],
        restDayRationale: [],
        recommendedHardDayAvoidance: [1],
        intents: ['repeat', 'rest'],
      },
    } as Parameters<typeof generateScientificWeekPlan>[0] & { executionReview: unknown });

    const hardDates = workouts.filter(w => w.zone >= 4).map(w => w.plannedDate);
    expect(workouts).toHaveLength(3);
    expect(hardDates).not.toContain('2026-05-05');
    expect(workouts.map(w => w.description).join(' ')).toContain('Ausführung');
  });

  it('protects recovery after a very long recent ride instead of repeating a hard week', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-11',
      phase: 'build',
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3, 5],
      ctl: 45,
      atl: 55,
      tsb: -6,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [{
        date: '2026-05-10',
        activityType: 'bike',
        durationMin: 430,
        tss: 310,
        rpe: 7,
        plannedZone: null,
      }],
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
    });

    expect(workouts.length).toBeLessThanOrEqual(3);
    expect(workouts.every(workout => workout.zone <= 2)).toBe(true);
    expect(workouts.map(workout => workout.description).join(' ')).toContain('lange reale Einheit');
  });

  it('uses GI fueling tolerance history to cap the next long endurance dose', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-11',
      phase: 'build',
      weeklyHoursTarget: 12,
      availableDays: [0, 1, 2, 3, 4, 5],
      ctl: 52,
      atl: 47,
      tsb: 5,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: '155 km Rennrad sicher und gut verpflegen', targetDate: '2026-08-01', category: 'volume' }],
      fuelingHistory: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 430,
        carbsG: 300,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'mild_issue',
        notes: 'Nach 100 km Magenprobleme, Mars half.',
      }],
    });

    expect(Math.max(...workouts.map(workout => workout.durationMin))).toBeLessThanOrEqual(165);
    expect(workouts.map(workout => workout.description).join(' ')).toContain('Fueling-Toleranz');
  });

  it('keeps stable execution weeks dense enough while explaining the stability', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 2, 3, 5],
      weeklyHoursTarget: 8,
      tsb: 8,
      phase: 'build',
      mesocycleWeek: 2,
      goals: [{ title: 'FTP: 280 W', targetDate: '2026-08-01', category: 'ftp' }],
      executionReview: {
        signals: ['matched', 'maintain_structure'],
        learnedFromLastWeek: ['Alle geplanten Einheiten wurden abgeglichen.'],
        variationComparedToLastWeek: ['Planstruktur bleibt bewusst ähnlich.'],
        restDayRationale: [{ date: '2026-05-08', reason: 'Bewusster freier Tag.' }],
        recommendedHardDayAvoidance: [],
        intents: ['stable'],
      },
    } as Parameters<typeof decidePlanDays>[0] & { executionReview: unknown });

    expect(decision.selectedDays).toHaveLength(4);
    expect(decision.reasons.join(' ')).toContain('Ausführung stabil');
  });

  it('uses season guardrails to cap session density and hard days', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'build',
      weeklyHoursTarget: 10,
      availableDays: [0, 1, 2, 3, 4, 5],
      ctl: 42,
      atl: 38,
      tsb: 6,
      ftpWatts: 250,
      maxHrBpm: 185,
      recentActivities: [],
      goals: [{ title: '70.3', targetDate: '2026-07-11', category: 'race', racePriority: 'A', raceDiscipline: 'triathlon_70_3' }],
      seasonStrategy: seasonStrategy({ targetSessions: 3, maxHardDays: 1 }),
    });

    expect(workouts).toHaveLength(3);
    expect(workouts.filter(workout => workout.zone >= 4)).toHaveLength(1);
  });

  it('keeps HR-first descriptions when LLM enrichment returns no items', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'base',
      weeklyHoursTarget: 5,
      availableDays: [0, 2, 5],
      ctl: 20,
      atl: 18,
      tsb: 3,
      ftpWatts: 200,
      maxHrBpm: 185,
      lthrBpm: 170,
      recentActivities: [],
      goals: [],
    });

    expect(workouts.length).toBeGreaterThan(0);
    expect(workouts.every(w => w.description.includes('bpm'))).toBe(true);
    expect(workouts.every(w => w.description.includes('primär über Puls'))).toBe(true);
  });
});
