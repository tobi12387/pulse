import { describe, it, expect, vi } from 'vitest';
import { generateScientificWeekPlan, generateWeekWorkouts, adaptIntensityForReadiness, decidePlanDays } from './plan-engine.js';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('[]'),
  SMART_MODEL: 'test-model',
}));

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
