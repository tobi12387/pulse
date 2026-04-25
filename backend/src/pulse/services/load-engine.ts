import { db } from '../../lib/db.js';
import { pulseActivities, pulseUserProfile } from '../../db/pulse-schema.js';
import { eq, gte, and } from 'drizzle-orm';
import type { PulseReadiness, PulseFitnessLoad } from '@coaching-os/shared/pulse';

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

export async function computeFitnessLoad(userId: string, referenceDate: string): Promise<PulseFitnessLoad> {
  const [profile] = await db.select({
    ftpWatts: pulseUserProfile.ftpWatts,
    maxHrBpm: pulseUserProfile.maxHrBpm,
  }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

  const ftpWatts = profile?.ftpWatts ?? 200;
  const maxHrBpm = profile?.maxHrBpm ?? 185;

  const refDate = new Date(referenceDate);
  const since = dateStr(60, refDate);

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

  // Fill 60-day array (oldest first)
  const dailyTss: number[] = [];
  for (let i = 59; i >= 0; i--) {
    const day = dateStr(i, refDate);
    dailyTss.push(tssPerDay[day] ?? 0);
  }

  const ctlSeries = applyEma(dailyTss, 42);
  const atlSeries = applyEma(dailyTss, 7);

  const ctl = Math.round((ctlSeries.at(-1) ?? 0) * 10) / 10;
  const atl = Math.round((atlSeries.at(-1) ?? 0) * 10) / 10;
  const tsb = Math.round((ctl - atl) * 10) / 10;

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

  const hrv = ({
    above_normal: 100,
    balanced: 80,
    normal: 80,
    below_normal: 50,
    poor: 25,
  }[input.hrvStatus ?? ''] ?? 60);

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

  const label: PulseReadiness['label'] =
    score >= 80 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'moderate' : 'low';

  return {
    score,
    components: { sleep, hrv, tsb, battery, mental, stress },
    label,
  };
}
