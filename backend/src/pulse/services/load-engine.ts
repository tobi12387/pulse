import { db } from '../../lib/db.js';
import { pulseActivities, pulseUserProfile } from '../../db/pulse-schema.js';
import { eq, gte, and } from 'drizzle-orm';
import type { PulseReadiness, PulseFitnessLoad, PulseFitnessLoadPoint } from '@coaching-os/shared/pulse';
import { HRV_STATUS_MAP, READINESS_BUCKETS, bucketize } from '@coaching-os/shared/pulse-thresholds';

// ─── TSS Computation ──────────────────────────────────────────────────────────

export interface TssInput {
  activityType: string;
  durationSec: number | null;
  normalizedPowerW: number | null;
  avgPowerW: number | null;
  avgHr: number | null;
  ftpWatts: number;
  maxHrBpm: number;
}

export function computeTss(input: TssInput): number {
  const { activityType, durationSec, normalizedPowerW, avgPowerW, avgHr, ftpWatts, maxHrBpm } = input;
  if (!durationSec || durationSec <= 0) return 0;

  const durationH = durationSec / 3600;

  if (activityType === 'bike') {
    const np = normalizedPowerW ?? avgPowerW;
    if (!np || !ftpWatts) return 0;
    const ifFactor = np / ftpWatts;
    return Math.round(durationH * ifFactor * ifFactor * 100);
  }

  if (activityType === 'run') {
    if (!avgHr || !maxHrBpm) return Math.round(durationH * 50);
    const lthr = maxHrBpm * 0.88;
    const hrRatio = avgHr / lthr;
    return Math.round(durationH * hrRatio * hrRatio * 100 * 1.5);
  }

  // swim, strength, hike, other — rough estimate
  return Math.round(durationH * 40);
}

// ─── EMA (Exponential Moving Average) ────────────────────────────────────────

export function applyEma(values: number[], tau: number): number[] {
  const alpha = 1 / tau;
  const result: number[] = [];
  let ema = values[0] ?? 0;
  for (const v of values) {
    ema = ema + alpha * (v - ema);
    result.push(ema);
  }
  return result;
}

// ─── Fitness Load (CTL/ATL/TSB) ───────────────────────────────────────────────

function dateStr(daysAgo: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0]!;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildFitnessLoadSeriesFromDailyTss(dailyTss: Array<{ date: string; tss: number }>): PulseFitnessLoadPoint[] {
  const values = dailyTss.map((day) => day.tss);
  const ctlSeries = applyEma(values, 42);
  const atlSeries = applyEma(values, 7);

  return dailyTss.map((day, index) => {
    const ctl = round1(ctlSeries[index] ?? 0);
    const atl = round1(atlSeries[index] ?? 0);
    return {
      date: day.date,
      tss: round1(day.tss),
      ctl,
      atl,
      tsb: round1(ctl - atl),
    };
  });
}

export async function computeFitnessLoadSeries(userId: string, referenceDate: string, days = 56): Promise<PulseFitnessLoadPoint[]> {
  const [profile] = await db.select({
    ftpWatts: pulseUserProfile.ftpWatts,
    maxHrBpm: pulseUserProfile.maxHrBpm,
  }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

  const ftpWatts = profile?.ftpWatts ?? 200;
  const maxHrBpm = profile?.maxHrBpm ?? 185;

  const refDate = new Date(referenceDate);
  const visibleDays = Math.min(180, Math.max(1, days));
  const warmupDays = 59;
  const totalDays = visibleDays + warmupDays;
  const since = dateStr(totalDays - 1, refDate);

  const activities = await db.select({
    startTime: pulseActivities.startTime,
    activityType: pulseActivities.activityType,
    durationSec: pulseActivities.durationSec,
    normalizedPowerW: pulseActivities.normalizedPowerW,
    avgPowerW: pulseActivities.avgPowerW,
    avgHr: pulseActivities.avgHr,
    tss: pulseActivities.tss,
  }).from(pulseActivities)
    .where(and(
      eq(pulseActivities.userId, userId),
      gte(pulseActivities.startTime, new Date(since)),
    ));

  // Build daily TSS map for last 60 days
  const tssPerDay: Record<string, number> = {};
  for (const act of activities) {
    const day = act.startTime.toISOString().split('T')[0]!;
    const tss = act.tss ?? computeTss({
      activityType: act.activityType,
      durationSec: act.durationSec,
      normalizedPowerW: act.normalizedPowerW,
      avgPowerW: act.avgPowerW,
      avgHr: act.avgHr,
      ftpWatts,
      maxHrBpm,
    });
    tssPerDay[day] = (tssPerDay[day] ?? 0) + tss;
  }

  // Fill oldest first with enough warm-up history for stable CTL/ATL.
  const dailyTss: Array<{ date: string; tss: number }> = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const day = dateStr(i, refDate);
    dailyTss.push({ date: day, tss: tssPerDay[day] ?? 0 });
  }

  return buildFitnessLoadSeriesFromDailyTss(dailyTss).slice(-visibleDays);
}

export async function computeFitnessLoad(userId: string, referenceDate: string): Promise<PulseFitnessLoad> {
  const latest = (await computeFitnessLoadSeries(userId, referenceDate, 1)).at(-1);
  const ctl = latest?.ctl ?? 0;
  const atl = latest?.atl ?? 0;
  const tsb = latest?.tsb ?? 0;

  return { ctl, atl, tsb, date: referenceDate };
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

export interface ReadinessInput {
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  mentalScore: number | null; // 0-100, pre-computed avg of mood/energy/motivation
  tsb: number;
}

export function computeReadinessScore(input: ReadinessInput): PulseReadiness {
  const sleep = input.sleepHours != null
    ? Math.min(input.sleepHours / 8, 1) * 100
    : 60;

  const hrv = HRV_STATUS_MAP[input.hrvStatus ?? '']?.score ?? 60;

  const tsb = Math.max(0, Math.min(100, (input.tsb + 30) / 60 * 100));

  const battery = input.bodyBatteryMax ?? 60;

  const mental = input.mentalScore ?? 60;

  const stress = input.stressAvg != null
    ? Math.max(0, 100 - input.stressAvg)
    : 60;

  const score = Math.round(
    sleep   * 0.25 +
    hrv     * 0.25 +
    tsb     * 0.20 +
    battery * 0.15 +
    mental  * 0.10 +
    stress  * 0.05,
  );

  const bucket = bucketize(score, READINESS_BUCKETS);

  return {
    score,
    components: { sleep, hrv, tsb, battery, mental, stress },
    label: bucket.label as PulseReadiness['label'],
    shortLabel: bucket.shortLabel ?? bucket.label.toUpperCase(),
    color: bucket.color,
  };
}
