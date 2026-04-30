import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { hashPassword } from '../../lib/auth.js';
import { users } from '../../db/schema.js';
import { pulseDailyMetrics, pulseRiskSignals } from '../../db/pulse-schema.js';
import { sendPushToUser } from '../../lib/push.js';
import {
  evaluateAndPersistRiskSignals,
  shouldSendRiskCriticalPush,
  type RiskSignal,
} from './risk-engine.js';

const pushMocks = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
}));

vi.mock('../../lib/push.js', () => ({
  sendPushToUser: pushMocks.sendPushToUser,
}));

vi.mock('./load-engine.js', () => ({
  computeFitnessLoad: vi.fn().mockResolvedValue({ ctl: 0, atl: 0, tsb: 0, date: '2026-04-06' }),
}));

function dailyRow(i: number, restingHr: number) {
  const d = new Date('2026-03-01T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return {
    date: d.toISOString().split('T')[0]!,
    restingHr,
    hrvRmssd: 60,
    sleepHours: 7.5,
  };
}

async function seedRhrSeries(userId: string, recentRestingHr: number): Promise<void> {
  const rows = [
    ...Array.from({ length: 30 }, (_, i) => dailyRow(i, 48)),
    ...Array.from({ length: 7 }, (_, i) => dailyRow(30 + i, recentRestingHr)),
  ].map(row => ({ userId, ...row }));
  await db.insert(pulseDailyMetrics).values(rows);
}

const criticalSignal = {
  ruleId: 'rhr_drift_7d',
  severity: 'critical',
  title: 'Critical',
  description: 'Critical description',
  recommendation: 'Rest today.',
  metric: {},
} satisfies RiskSignal;

let userId: string;

beforeAll(async () => {
  await db.delete(users).where(eq(users.email, 'risk-push@coaching.os'));
  const [user] = await db.insert(users).values({
    email: 'risk-push@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Risk Push Test',
  }).returning({ id: users.id });
  userId = user!.id;
});

afterAll(async () => {
  if (userId) {
    await db.delete(pulseRiskSignals).where(eq(pulseRiskSignals.userId, userId));
    await db.delete(pulseDailyMetrics).where(eq(pulseDailyMetrics.userId, userId));
  }
  await db.delete(users).where(eq(users.email, 'risk-push@coaching.os'));
});

beforeEach(async () => {
  await db.delete(pulseRiskSignals).where(eq(pulseRiskSignals.userId, userId));
  await db.delete(pulseDailyMetrics).where(eq(pulseDailyMetrics.userId, userId));
  vi.mocked(sendPushToUser).mockReset().mockResolvedValue({ sent: 1, failed: 0, gone: 0, skipped: 0 });
});

describe('shouldSendRiskCriticalPush', () => {
  it('only allows newly inserted critical signals', () => {
    expect(shouldSendRiskCriticalPush(criticalSignal, null)).toBe(true);
    expect(shouldSendRiskCriticalPush(criticalSignal, { severity: 'warn' })).toBe(false);
    expect(shouldSendRiskCriticalPush({ ...criticalSignal, severity: 'warn' }, null)).toBe(false);
  });
});

describe('evaluateAndPersistRiskSignals push trigger', () => {
  it('sends one risk push for a newly inserted critical signal and none on repeated updates', async () => {
    await seedRhrSeries(userId, 55);

    await evaluateAndPersistRiskSignals(userId, '2026-04-06');
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
      topic: 'risk_critical',
      tag: 'risk-rhr_drift_7d',
    }));

    await evaluateAndPersistRiskSignals(userId, '2026-04-06');
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it('does not send a risk push for newly inserted warning signals', async () => {
    await seedRhrSeries(userId, 52);

    await evaluateAndPersistRiskSignals(userId, '2026-04-06');

    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('does not send a risk push when an existing warning is upgraded in place', async () => {
    await seedRhrSeries(userId, 55);
    const now = new Date('2026-04-06T12:00:00Z');
    await db.insert(pulseRiskSignals).values({
      userId,
      ruleId: 'rhr_drift_7d',
      severity: 'warn',
      status: 'active',
      title: 'Previous warning',
      description: 'Previous warning description',
      recommendation: 'Reduce volume.',
      metricSnapshot: {},
      triggeredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await evaluateAndPersistRiskSignals(userId, '2026-04-06');

    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
