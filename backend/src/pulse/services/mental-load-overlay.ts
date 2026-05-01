import { and, eq, gte } from 'drizzle-orm';
import type { PulseMentalLoadOverlayResponse } from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { pulseMentalCheckins } from '../../db/pulse-schema.js';
import { computeFitnessLoadSeries } from './load-engine.js';

const DAY_MS = 86_400_000;

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().split('T')[0]!;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pearson(pairs: Array<{ x: number; y: number }>): number | null {
  if (pairs.length < 3) return null;
  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (const pair of pairs) {
    const dx = pair.x - meanX;
    const dy = pair.y - meanY;
    numerator += dx * dy;
    denomX += dx ** 2;
    denomY += dy ** 2;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return round1(numerator / denom);
}

export async function getMentalLoadOverlay(userId: string, days: number): Promise<PulseMentalLoadOverlayResponse> {
  const clampedDays = Math.min(90, Math.max(28, days));
  const today = new Date().toISOString().split('T')[0]!;
  const since = dateDaysAgo(clampedDays - 1);
  const loadPoints = await computeFitnessLoadSeries(userId, today, clampedDays);
  const checkins = await db.select({
    date: pulseMentalCheckins.date,
    mood: pulseMentalCheckins.mood,
    energy: pulseMentalCheckins.energy,
    stress: pulseMentalCheckins.stress,
    motivation: pulseMentalCheckins.motivation,
  }).from(pulseMentalCheckins)
    .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since)))
    .orderBy(pulseMentalCheckins.date);

  const checkinsByDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));
  const points = loadPoints.map((load) => {
    const checkin = checkinsByDate.get(load.date);
    return {
      ...load,
      mood: checkin?.mood ?? null,
      energy: checkin?.energy ?? null,
      stress: checkin?.stress ?? null,
      motivation: checkin?.motivation ?? null,
    };
  });

  const moodValues = points
    .map((point) => point.mood)
    .filter((value): value is number => value != null);
  const stressValues = points
    .map((point) => point.stress)
    .filter((value): value is number => value != null);
  const moodTsbPairs = points
    .filter((point): point is typeof point & { mood: number } => point.mood != null)
    .map((point) => ({ x: point.tsb, y: point.mood }));

  return {
    days: clampedDays,
    points,
    stats: {
      checkins: moodValues.length,
      avgMood: moodValues.length > 0 ? round1(moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length) : null,
      avgStress: stressValues.length > 0 ? round1(stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length) : null,
      moodTsbCorrelation: pearson(moodTsbPairs),
      lowTsbCheckins: points.filter((point) => point.mood != null && point.tsb < -10).length,
    },
  };
}
