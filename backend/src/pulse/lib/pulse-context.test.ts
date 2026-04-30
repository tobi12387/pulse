import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../lib/db.js';
import { users } from '../../db/schema.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulseHealthState,
  pulseMentalCheckins,
  pulsePlannedWorkouts,
  pulseRiskSignals,
  pulseUserProfile,
} from '../../db/pulse-schema.js';
import { hashPassword } from '../../lib/auth.js';
import { buildPulseContextFor, mapPulseContextToCoachContext } from './pulse-context.js';

let userId: string;

beforeAll(async () => {
  await db.delete(pulseHealthState);
  await db.delete(pulseRiskSignals);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  await db.delete(pulseUserProfile);
  await db.delete(users);

  const [user] = await db.insert(users).values({
    email: 'pulse-context@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Pulse Context Test',
  }).returning({ id: users.id });
  userId = user!.id;
});

afterAll(async () => {
  await db.delete(pulseHealthState);
  await db.delete(pulseRiskSignals);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  await db.delete(pulseUserProfile);
  await db.delete(users);
});

beforeEach(async () => {
  await db.delete(pulseHealthState);
  await db.delete(pulseRiskSignals);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  await db.delete(pulseUserProfile);
});

describe('buildPulseContextFor', () => {
  it('builds a shared context from Pulse schema tables and maps it to coach context', async () => {
    const date = '2026-04-29';

    await db.insert(pulseDailyMetrics).values({
      userId,
      date,
      sleepHours: 7.4,
      sleepScore: 82,
      hrvRmssd: 61,
      hrvStatus: 'balanced',
      restingHr: 49,
      bodyBatteryMax: 78,
      stressAvg: 18,
      steps: 9200,
    });
    await db.insert(pulseMentalCheckins).values({
      userId,
      date,
      mood: 8,
      energy: 7,
      stress: 3,
      motivation: 8,
      notes: 'Guter Schlaf',
    });
    await db.insert(pulseUserProfile).values({
      userId,
      ftpWatts: 260,
      maxHrBpm: 186,
      vo2max: 52,
      trainingPhase: 'base',
    });
    await db.insert(pulseHealthState).values({
      userId,
      type: 'injury',
      severity: 'mild',
      bodyPart: 'knee',
      startDate: date,
      notes: 'leichtes Ziehen',
    });
    await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: date,
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      description: 'Grundlage',
    });
    await db.insert(pulseActivities).values({
      userId,
      startTime: new Date(`${date}T08:00:00.000Z`),
      activityType: 'bike',
      durationSec: 3600,
      tss: 45,
      normalizedPowerW: 190,
      avgHr: 132,
    });
    await db.insert(pulseRiskSignals).values({
      userId,
      ruleId: 'rhr_drift_7d',
      severity: 'warn',
      status: 'active',
      title: 'Ruhepuls seit 7 Tagen +4.5 bpm',
      description: 'RHR liegt über Baseline.',
      recommendation: 'Heute Z2 reduzieren.',
      metricSnapshot: { deltaBpm: 4.5 },
    });

    const ctx = await buildPulseContextFor(userId, date);
    expect(ctx.todayMetrics?.sleepHours).toBeCloseTo(7.4);
    expect(ctx.todayCheckin?.energy).toBe(7);
    expect(ctx.activeHealthStates).toHaveLength(1);
    expect(ctx.activeRiskSignals[0]).toMatchObject({
      ruleId: 'rhr_drift_7d',
      severity: 'warn',
      recommendation: 'Heute Z2 reduzieren.',
    });
    expect(ctx.upcomingWorkouts[0]?.activityType).toBe('bike');
    expect(ctx.fitnessLoad).toHaveProperty('ctl');
    expect(ctx.readiness.score).toBeGreaterThan(0);

    const coachCtx = mapPulseContextToCoachContext(ctx);
    expect(coachCtx.load).toEqual({
      ctl: ctx.fitnessLoad.ctl,
      atl: ctx.fitnessLoad.atl,
      tsb: ctx.fitnessLoad.tsb,
    });
    expect(coachCtx.activeHealthStates?.[0]).toMatchObject({
      type: 'injury',
      severity: 'mild',
      bodyPart: 'knee',
    });
    expect(coachCtx.activeRiskSignals?.[0]?.ruleId).toBe('rhr_drift_7d');
  });
});
