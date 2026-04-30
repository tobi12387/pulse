import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { pulseDailyMetrics, pulseMentalCheckins, pulseRiskSignals } from '../../db/pulse-schema.js';
import { computeFitnessLoad } from './load-engine.js';
import { sendPushToUser } from '../../lib/push.js';

export type RiskSeverity = 'info' | 'warn' | 'critical';
export type RiskRuleId =
  | 'rhr_drift_7d'
  | 'hrv_trend_decline'
  | 'ctl_ramp_overshoot'
  | 'sleep_debt_5d'
  | 'mental_negative_streak';

export interface RiskSignal {
  ruleId: RiskRuleId;
  severity: RiskSeverity;
  title: string;
  description: string;
  recommendation: string;
  metric: Record<string, unknown>;
}

interface DailyRiskRow {
  date: string;
  restingHr: number | null;
  hrvRmssd: number | null;
  sleepHours: number | null;
}

interface MentalRiskRow {
  date: string;
  mood: number;
  stress: number;
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0]!;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = avg(values)!;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = avg(values)!;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

export function evaluateRiskSignalsFromData(input: {
  today: string;
  daily: DailyRiskRow[];
  mental: MentalRiskRow[];
  ctlNow: number;
  ctl7dAgo: number;
  sleepTargetH?: number;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const dailyAsc = [...input.daily].sort((a, b) => a.date.localeCompare(b.date));
  const dailyDesc = [...dailyAsc].reverse();

  const recent7 = dailyDesc.slice(0, 7);
  const baseline30 = dailyDesc.slice(7, 37);
  const rhrRecent = avg(recent7.map(d => d.restingHr).filter((v): v is number => v != null));
  const rhrBase = avg(baseline30.map(d => d.restingHr).filter((v): v is number => v != null));
  if (rhrRecent != null && rhrBase != null && recent7.length >= 5 && baseline30.length >= 14) {
    const delta = Math.round((rhrRecent - rhrBase) * 10) / 10;
    if (delta >= 4) {
      const severity: RiskSeverity = delta >= 6 ? 'critical' : 'warn';
      signals.push({
        ruleId: 'rhr_drift_7d',
        severity,
        title: `Ruhepuls seit 7 Tagen +${delta.toFixed(1)} bpm`,
        description: `Der 7-Tage-Schnitt liegt ${delta.toFixed(1)} bpm über der vorherigen 30-Tage-Baseline.`,
        recommendation: severity === 'critical'
          ? 'Heute trainingsfrei oder kurzes Z1 unter 30 Minuten; Erholung priorisieren.'
          : 'Heute Z2 reduzieren oder zur Z1 verschieben.',
        metric: { current: rhrRecent, baseline: rhrBase, deltaBpm: delta },
      });
    }
  }

  const hrv14 = dailyAsc.slice(-14).map(d => d.hrvRmssd).filter((v): v is number => v != null);
  const hrv90 = dailyAsc.slice(-90).map(d => d.hrvRmssd).filter((v): v is number => v != null);
  const hrv7 = dailyAsc.slice(-7).map(d => d.hrvRmssd).filter((v): v is number => v != null);
  const hrvBase = avg(hrv90);
  const hrvSigma = stddev(hrv90);
  const hrvRecent = avg(hrv7);
  if (hrv14.length >= 10 && hrv90.length >= 21 && hrvBase != null && hrvSigma != null && hrvRecent != null) {
    const hrvSlope = slope(hrv14);
    const deviation = hrvBase - hrvRecent;
    if (hrvSlope < 0 && deviation >= hrvSigma) {
      const severity: RiskSeverity = deviation >= hrvSigma * 1.5 ? 'critical' : 'warn';
      signals.push({
        ruleId: 'hrv_trend_decline',
        severity,
        title: 'HRV-Trend fällt',
        description: `Die HRV fällt über 14 Tage und liegt ${deviation.toFixed(1)} ms unter der 90-Tage-Baseline.`,
        recommendation: severity === 'critical'
          ? 'Heute keine Intensität; Schlaf, Essen und ruhige Bewegung priorisieren.'
          : 'Intensität zurückstellen und die nächste harte Einheit nur bei gutem Tagesgefühl fahren.',
        metric: { recent: hrvRecent, baseline: hrvBase, sigma: hrvSigma, slope: hrvSlope },
      });
    }
  }

  const ctlRamp = Math.round((input.ctlNow - input.ctl7dAgo) * 10) / 10;
  if (ctlRamp >= 7) {
    const severity: RiskSeverity = ctlRamp >= 9 ? 'critical' : 'warn';
    signals.push({
      ruleId: 'ctl_ramp_overshoot',
      severity,
      title: `CTL-Ramp +${ctlRamp.toFixed(1)} pro Woche`,
      description: `Die Trainingslast steigt schneller als der konservative Grenzwert von +7 CTL/Woche.`,
      recommendation: `Diese Woche TSS reduzieren; keine zusätzliche Intensität einbauen.`,
      metric: { ctlNow: input.ctlNow, ctl7dAgo: input.ctl7dAgo, rampPerWeek: ctlRamp },
    });
  }

  const sleepTargetH = input.sleepTargetH ?? 7.5;
  const sleepDebt = dailyDesc.slice(0, 5).reduce((sum, row) => {
    if (row.sleepHours == null) return sum;
    return sum + Math.max(0, sleepTargetH - row.sleepHours);
  }, 0);
  if (dailyDesc.slice(0, 5).filter(row => row.sleepHours != null).length >= 3 && sleepDebt >= 5) {
    const severity: RiskSeverity = sleepDebt >= 9 ? 'critical' : 'warn';
    signals.push({
      ruleId: 'sleep_debt_5d',
      severity,
      title: `Schlafschuld ${sleepDebt.toFixed(1)} h in 5 Tagen`,
      description: `Gegenüber ${sleepTargetH.toFixed(1)} h Zielschlaf hat sich deutliche Schlafschuld aufgebaut.`,
      recommendation: severity === 'critical'
        ? 'Heute Training stark kürzen oder pausieren und Schlaf nachholen.'
        : 'Heute Umfang reduzieren und frühe Schlafenszeit priorisieren.',
      metric: { sleepDebtH: sleepDebt, targetH: sleepTargetH, days: 5 },
    });
  }

  const mental7 = [...input.mental].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  if (mental7.length >= 3) {
    const moodAvg = avg(mental7.map(m => m.mood))!;
    const stressAvg = avg(mental7.map(m => m.stress))!;
    const lowMood = moodAvg <= 4;
    const highStress = stressAvg >= 7;
    const strongSingle = moodAvg <= 3 || stressAvg >= 8;
    if (lowMood || highStress) {
      signals.push({
        ruleId: 'mental_negative_streak',
        severity: (lowMood && highStress) || strongSingle ? 'warn' : 'info',
        title: 'Mentaler Trend belastet',
        description: `Die letzten ${mental7.length} Check-ins zeigen Stimmung Ø ${moodAvg.toFixed(1)}/10 und Stress Ø ${stressAvg.toFixed(1)}/10.`,
        recommendation: 'Heute Druck aus dem Plan nehmen und Check-in/Reflexion ernst nehmen.',
        metric: { moodAvg, stressAvg, entries: mental7.length },
      });
    }
  }

  return signals;
}

export function shouldSendRiskCriticalPush(
  signal: RiskSignal,
  current: unknown,
): boolean {
  return signal.severity === 'critical' && current == null;
}

async function sendRiskCriticalPush(userId: string, signal: RiskSignal): Promise<void> {
  try {
    await sendPushToUser(userId, {
      topic: 'risk_critical',
      title: signal.title,
      body: signal.recommendation,
      url: '/',
      tag: `risk-${signal.ruleId}`,
    });
  } catch (err) {
    console.warn(`[risk-engine] Critical push failed for ${userId}/${signal.ruleId}:`, err);
  }
}

export async function evaluateRiskSignals(userId: string, today = new Date().toISOString().split('T')[0]!): Promise<RiskSignal[]> {
  const since90 = daysBefore(today, 89);
  const sinceMental = daysBefore(today, 14);
  const [daily, mental, loadNow, load7dAgo] = await Promise.all([
    db.select({
      date: pulseDailyMetrics.date,
      restingHr: pulseDailyMetrics.restingHr,
      hrvRmssd: pulseDailyMetrics.hrvRmssd,
      sleepHours: pulseDailyMetrics.sleepHours,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since90))),
    db.select({
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      stress: pulseMentalCheckins.stress,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, sinceMental)))
      .orderBy(desc(pulseMentalCheckins.date)),
    computeFitnessLoad(userId, today),
    computeFitnessLoad(userId, daysBefore(today, 7)),
  ]);

  return evaluateRiskSignalsFromData({
    today,
    daily,
    mental,
    ctlNow: loadNow.ctl,
    ctl7dAgo: load7dAgo.ctl,
  });
}

export async function evaluateAndPersistRiskSignals(userId: string, today?: string): Promise<RiskSignal[]> {
  const signals = await evaluateRiskSignals(userId, today);
  const now = new Date();
  const activeRuleIds = signals.map(s => s.ruleId);

  const existing = await db.select().from(pulseRiskSignals)
    .where(and(
      eq(pulseRiskSignals.userId, userId),
      inArray(pulseRiskSignals.status, ['active', 'snoozed']),
    ));

  for (const signal of signals) {
    const current = existing.find(row => row.ruleId === signal.ruleId);
    if (current?.status === 'snoozed' && current.snoozedUntil && current.snoozedUntil > now) continue;
    const shouldPushCritical = shouldSendRiskCriticalPush(signal, current);

    const values = {
      severity: signal.severity,
      status: 'active',
      title: signal.title,
      description: signal.description,
      recommendation: signal.recommendation,
      metricSnapshot: signal.metric,
      resolvedAt: null,
      snoozedUntil: null,
      updatedAt: now,
    };

    if (current) {
      await db.update(pulseRiskSignals)
        .set(values)
        .where(eq(pulseRiskSignals.id, current.id));
    } else {
      await db.insert(pulseRiskSignals).values({
        userId,
        ruleId: signal.ruleId,
        ...values,
        triggeredAt: now,
        createdAt: now,
      });
    }

    if (shouldPushCritical) {
      await sendRiskCriticalPush(userId, signal);
    }
  }

  const toResolve = existing.filter(row => !activeRuleIds.includes(row.ruleId as RiskRuleId));
  for (const row of toResolve) {
    await db.update(pulseRiskSignals)
      .set({ status: 'resolved', resolvedAt: now, updatedAt: now })
      .where(eq(pulseRiskSignals.id, row.id));
  }

  return signals;
}

export async function getActiveRiskSignals(userId: string) {
  const now = new Date();
  return db.select().from(pulseRiskSignals)
    .where(and(
      eq(pulseRiskSignals.userId, userId),
      eq(pulseRiskSignals.status, 'active'),
      lt(pulseRiskSignals.triggeredAt, new Date(now.getTime() + 1000)),
    ))
    .orderBy(desc(pulseRiskSignals.triggeredAt));
}
