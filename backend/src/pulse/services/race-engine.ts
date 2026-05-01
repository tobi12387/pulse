// Phase 7: Race Mode — derives race phase, predicts race time, surfaces race context.

import { db } from '../../lib/db.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { pulseGoals, pulseActivities } from '../../db/pulse-schema.js';
import { computeFitnessLoad } from './load-engine.js';

export type RacePhase = 'base' | 'build' | 'peak' | 'taper' | 'race_week' | 'race_day' | 'past';

export interface RaceContext {
  goalId: string;
  title: string;
  date: string;
  daysUntil: number;
  phase: RacePhase;
  discipline: string | null;
  distanceKm: number | null;
  targetTimeSec: number | null;
  priority: 'A' | 'B' | 'C';
  predictedTimeSec: number | null;
  predictionConfidence: 'low' | 'medium' | 'high' | null;
  location: string | null;
  notes: string | null;
}

export function deriveRacePhase(daysUntil: number, priority: 'A'|'B'|'C'): RacePhase {
  if (daysUntil < 0) return 'past';
  if (daysUntil === 0) return 'race_day';
  if (daysUntil <= 6) return 'race_week';
  if (priority === 'A') {
    if (daysUntil <= 14) return 'taper';
    if (daysUntil <= 28) return 'peak';
    if (daysUntil <= 84) return 'build';
    return 'base';
  }
  if (priority === 'B') {
    if (daysUntil <= 7)  return 'taper';
    if (daysUntil <= 21) return 'peak';
    if (daysUntil <= 56) return 'build';
    return 'base';
  }
  // C: keep training normal
  return 'base';
}

// ─── Riegel race-time prediction ──────────────────────────────────────────────
// T2 = T1 * (D2 / D1) ^ 1.06 — empirical endurance scaling.

export interface RecentRun {
  distanceKm: number;
  timeSec: number;
  date: string;
}

export interface PredictionResult {
  timeSec: number;
  confidence: 'low' | 'medium' | 'high';
  basis: string;     // human-readable description of input used
}

export interface RacePredictionLoad {
  ctl: number;
  ctlBaseline?: number | undefined;
}

export function predictRaceTime(args: {
  discipline: string | null;
  distanceKm: number;
  recentRuns: RecentRun[];
  ctl: number;
  ctlBaseline?: number | undefined;
}): PredictionResult | null {
  const { distanceKm, recentRuns, ctl } = args;
  if (recentRuns.length === 0) return null;

  // Pick best (fastest pace) reference run with distance ≥ 3km
  const candidates = recentRuns.filter(r => r.distanceKm >= 3 && r.timeSec > 0);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.timeSec / a.distanceKm) - (b.timeSec / b.distanceKm));
  const ref = candidates[0]!;

  // Riegel formula
  const exp = 1.06;
  let predicted = ref.timeSec * Math.pow(distanceKm / ref.distanceKm, exp);

  // CTL fitness adjust: higher CTL than baseline → faster (capped at -5%)
  const baseline = args.ctlBaseline ?? Math.max(20, ref.distanceKm * 4); // very rough baseline if unknown
  const ctlAdj = Math.max(0.95, 1 - (ctl - baseline) / 200);
  predicted *= ctlAdj;

  // Confidence
  const sameZone = recentRuns.filter(r => r.distanceKm >= distanceKm * 0.5).length;
  let confidence: PredictionResult['confidence'];
  if (sameZone >= 3) confidence = 'high';
  else if (sameZone >= 1 && distanceKm <= ref.distanceKm * 2) confidence = 'medium';
  else confidence = 'low';

  return {
    timeSec: Math.round(predicted),
    confidence,
    basis: `${ref.distanceKm.toFixed(1)}km in ${formatTime(ref.timeSec)} (${ref.date})`,
  };
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Active races for user ────────────────────────────────────────────────────

function shouldPredictRace(row: typeof pulseGoals.$inferSelect): boolean {
  return Boolean(row.raceDistanceKm && (row.raceDiscipline === 'run' || (row.raceDiscipline ?? '').includes('triathlon')));
}

function daysBefore(referenceDate: string, days: number): Date {
  const date = new Date(`${referenceDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export async function getActiveRaces(
  userId: string,
  today: string,
  predictionLoad?: RacePredictionLoad,
): Promise<RaceContext[]> {
  const rows = await db.select().from(pulseGoals)
    .where(and(
      eq(pulseGoals.userId, userId),
      eq(pulseGoals.status, 'active'),
      eq(pulseGoals.category, 'race'),
    ))
    .orderBy(pulseGoals.targetDate);

  if (rows.length === 0) return [];

  const needsPrediction = rows.some(shouldPredictRace);
  const getPredictionLoad = (): Promise<RacePredictionLoad> => predictionLoad
    ? Promise.resolve(predictionLoad)
    : computeFitnessLoad(userId, today).then((load): RacePredictionLoad => ({ ctl: load.ctl }));
  const predictionData = needsPrediction
    ? await Promise.all([
        db.select({
          startTime:  pulseActivities.startTime,
          activityType: pulseActivities.activityType,
          distanceM:  pulseActivities.distanceM,
          durationSec: pulseActivities.durationSec,
        }).from(pulseActivities)
          .where(and(
            eq(pulseActivities.userId, userId),
            gte(pulseActivities.startTime, daysBefore(today, 59)),
          ))
          .orderBy(desc(pulseActivities.startTime))
          .limit(80),
        getPredictionLoad(),
      ])
    : null;
  const runs = predictionData?.[0] ?? [];
  const loadForPrediction = predictionData?.[1] ?? null;

  const runRefs: RecentRun[] = runs
    .filter(r => r.activityType === 'run' && r.distanceM != null && r.durationSec != null)
    .map(r => ({
      distanceKm: r.distanceM! / 1000,
      timeSec:    r.durationSec!,
      date:       r.startTime.toISOString().split('T')[0]!,
    }));

  const result: RaceContext[] = [];
  for (const r of rows) {
    if (!r.targetDate) continue;
    const daysUntil = Math.round(
      (new Date(r.targetDate + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86_400_000
    );
    const priority = (r.racePriority ?? 'A') as 'A'|'B'|'C';
    const phase = deriveRacePhase(daysUntil, priority);

    // Skip races that ended >7 days ago to avoid clutter
    if (daysUntil < -7) continue;

    let predicted: PredictionResult | null = null;
    if (shouldPredictRace(r) && loadForPrediction) {
      // For triathlons we predict run leg only — bike pacing is power-based, swim is pool-dependent.
      // For now, single-discipline running prediction; mixed disciplines are 'low' confidence.
      predicted = predictRaceTime({
        discipline:  r.raceDiscipline,
        distanceKm:  r.raceDiscipline === 'run' ? r.raceDistanceKm! : 21.1, // assume HM run for 70.3
        recentRuns:  runRefs,
        ctl:         loadForPrediction.ctl,
        ctlBaseline: loadForPrediction.ctlBaseline,
      });
    }

    result.push({
      goalId:                r.id,
      title:                 r.title,
      date:                  r.targetDate,
      daysUntil,
      phase,
      discipline:            r.raceDiscipline,
      distanceKm:            r.raceDistanceKm,
      targetTimeSec:         r.raceTargetTimeSec,
      priority,
      predictedTimeSec:      predicted?.timeSec ?? null,
      predictionConfidence:  predicted?.confidence ?? null,
      location:              r.raceLocation,
      notes:                 r.raceNotes,
    });
  }

  return result;
}

// ─── Phase mapping for plan-engine ────────────────────────────────────────────

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';

export function mapToTrainingPhase(rp: RacePhase): TrainingPhase {
  if (rp === 'past' || rp === 'base') return 'base';
  if (rp === 'build') return 'build';
  if (rp === 'peak') return 'peak';
  // taper, race_week, race_day → taper
  return 'taper';
}
