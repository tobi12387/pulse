import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { pulseDailyMetrics, pulseMentalCheckins } from '../../db/pulse-schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { PulsePrognosis } from '@coaching-os/shared/pulse';

const CACHE_TTL_SECONDS = 3600; // 1h

export function computeLinearTrend(values: number[]): number {
  if (values.length < 3) return 0;
  const n = values.length;
  const sumX  = values.reduce((s, _, i) => s + i, 0);
  const sumY  = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

export function buildPrognosis(input: {
  hrv7d:       number[];
  mentalLast5: Array<{ mood: number; energy: number }>;
  tsb:         number;
}): PulsePrognosis {
  const factors: string[] = [];

  // 1. HRV-Trend
  const hrvTrend = computeLinearTrend(input.hrv7d);
  if (hrvTrend < -1.5) factors.push('HRV fällt seit mehreren Tagen');

  // 2. Mentaler Durchschnitt
  if (input.mentalLast5.length >= 3) {
    const avgMental = input.mentalLast5.reduce((s, m) => s + (m.mood + m.energy) / 2, 0) / input.mentalLast5.length;
    if (avgMental < 5.0) factors.push('Mentale Energie und Stimmung unter Baseline');
  }

  // 3. Trainingsbelastung
  if (input.tsb < -15) factors.push('Hohe akkumulierte Trainingsbelastung (TSB negativ)');

  const alert = factors.length >= 2;

  let message = '';
  let horizon_days = 0;
  if (alert) {
    horizon_days = 2 + Math.floor(Math.abs(hrvTrend));
    message = `Muster erkannt: mögliches Leistungstief in ~${horizon_days} Tagen. ` +
      `${factors.join(', ')}. Empfehlung: Intensität reduzieren, Schlaf priorisieren.`;
  }

  return { alert, message, horizon_days, factors };
}

export async function getPrognosis(userId: string): Promise<PulsePrognosis> {
  const cacheKey = `prognosis:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as PulsePrognosis;

  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0]!;

  const [metrics, checkins] = await Promise.all([
    db.select({
      date:      pulseDailyMetrics.date,
      hrvRmssd:  pulseDailyMetrics.hrvRmssd,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since14d)))
      .orderBy(pulseDailyMetrics.date),

    db.select({
      mood:   pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      date:   pulseMentalCheckins.date,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since14d)))
      .orderBy(desc(pulseMentalCheckins.date))
      .limit(5),
  ]);

  // TSB aus Fitness-Load
  const { computeFitnessLoad } = await import('./load-engine.js');
  const today = new Date().toISOString().split('T')[0]!;
  const load  = await computeFitnessLoad(userId, today);

  const hrv7d = metrics
    .slice(-7)
    .map(m => m.hrvRmssd)
    .filter((v): v is number => v !== null);

  const result = buildPrognosis({
    hrv7d,
    mentalLast5: checkins.map(c => ({ mood: c.mood, energy: c.energy })),
    tsb: load.tsb,
  });

  await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  return result;
}
