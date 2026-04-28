// Phase 6: Adaptive daily workout adjustment.
// Pure deterministic logic — proposes (does not commit) a swap when readiness is low
// or an active health-state covers today. Acceptance is a separate explicit step.

import { db } from '../../lib/db.js';
import { eq, and, gte, isNull, or, lte, desc } from 'drizzle-orm';
import {
  pulseDailyMetrics, pulseMentalCheckins, pulsePlannedWorkouts, pulseHealthState,
} from '../../db/pulse-schema.js';
import { computeFitnessLoad, computeReadinessScore } from './load-engine.js';
import type { ActiveHealthState } from './plan-engine.js';

export interface AdjustProposal {
  workoutId: string;
  date: string;
  original: { activityType: string; zone: number; durationMin: number };
  proposed: { activityType: string; zone: number; durationMin: number; description: string };
  reason: 'low_readiness' | 'illness' | 'injury' | 'fatigue' | 'travel';
  rationale: string;
  readinessScore: number;
}

function reasonFromHealth(s: ActiveHealthState): AdjustProposal['reason'] {
  return s.type;
}

function describeAdjustment(
  reason: AdjustProposal['reason'],
  proposed: { activityType: string; zone: number; durationMin: number },
): string {
  const z = proposed.zone;
  const d = proposed.durationMin;
  const sport = proposed.activityType;
  if (reason === 'illness') {
    if (d === 0) return 'Komplett-Pause: Bei Krankheit erholt sich der Organismus, Training verzögert das nur.';
    return `Lockerer Z${z}-${sport.toUpperCase()} ${d} min — minimal halten, Symptome im Auge behalten.`;
  }
  if (reason === 'injury') {
    return `${sport.toUpperCase()} Z${z} ${d} min — alternative Sportart bis Heilung.`;
  }
  if (reason === 'fatigue') {
    return `Z${z} ${sport.toUpperCase()} ${d} min — Belastung deutlich reduzieren bis Erholung sichtbar.`;
  }
  if (reason === 'travel') {
    return `${sport.toUpperCase()} Z${z} ${d} min — kurz und ortsunabhängig.`;
  }
  return `Z${z} ${sport.toUpperCase()} ${d} min statt Originalplan — heutige Tagesform spricht für reduzierte Intensität.`;
}

export async function proposeTodayAdjustment(userId: string, date: string): Promise<AdjustProposal | null> {
  // 1. Heutiger geplanter Workout (planned, nicht abgeschlossen/skipped)
  const [workout] = await db.select().from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, date),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ))
    .limit(1);
  if (!workout) return null;

  // Bereits angepasst? Nicht erneut vorschlagen
  if (workout.adjustedReason) return null;

  // 2. Aktive Health-States für heute
  const activeStates = await db.select().from(pulseHealthState)
    .where(and(
      eq(pulseHealthState.userId, userId),
      isNull(pulseHealthState.resolvedAt),
      lte(pulseHealthState.startDate, date),
      or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, date)),
    ));

  // 3. Readiness berechnen (gleiche Logik wie /home)
  const [[metrics], [mental], fitnessLoad] = await Promise.all([
    db.select().from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, date))),
    db.select().from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, date))),
    computeFitnessLoad(userId, date),
  ]);
  const mentalScore = mental ? ((mental.mood + mental.energy + mental.motivation) / 3) * 10 : null;
  const readiness = computeReadinessScore({
    sleepHours:     metrics?.sleepHours ?? null,
    hrvStatus:      metrics?.hrvStatus ?? null,
    bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
    stressAvg:      metrics?.stressAvg ?? null,
    mentalScore,
    tsb:            fitnessLoad.tsb,
  });

  // 4. Trigger-Bedingungen
  //    - aktiver Health-State (immer Anpassung)
  //    - oder: Readiness < 50 UND Zone >= 3 (lohnt sich nur bei harten Tagen)
  const blockingState = activeStates[0];
  const lowReadinessHard = readiness.score < 50 && workout.zone >= 3;

  if (!blockingState && !lowReadinessHard) return null;

  // 5. Vorschlag berechnen
  let proposed: { activityType: string; zone: number; durationMin: number };
  let reason: AdjustProposal['reason'];

  if (blockingState) {
    reason = reasonFromHealth({
      type:      blockingState.type as ActiveHealthState['type'],
      severity:  blockingState.severity as ActiveHealthState['severity'],
      bodyPart:  blockingState.bodyPart,
      startDate: blockingState.startDate,
      endDate:   blockingState.endDate,
      notes:     blockingState.notes,
    });

    if (blockingState.type === 'illness') {
      if (blockingState.severity === 'severe') {
        proposed = { activityType: workout.activityType, zone: 1, durationMin: 0 };
      } else if (blockingState.severity === 'moderate') {
        proposed = { activityType: workout.activityType, zone: 1, durationMin: 30 };
      } else {
        proposed = { activityType: workout.activityType, zone: 2, durationMin: Math.min(workout.durationMin, 45) };
      }
    } else if (blockingState.type === 'injury') {
      const part = (blockingState.bodyPart ?? '').toLowerCase();
      let activityType = workout.activityType;
      if (/knee|foot|ankle|achilles|shin|calf|hamstring/.test(part) && workout.activityType === 'run') {
        activityType = 'bike';
      } else if (/wrist|hand|shoulder/.test(part) && workout.activityType === 'bike') {
        activityType = 'run';
      }
      const cap = blockingState.severity === 'severe' ? 45 : workout.durationMin;
      proposed = { activityType, zone: Math.min(workout.zone, 2), durationMin: Math.min(workout.durationMin, cap) };
    } else if (blockingState.type === 'fatigue') {
      const cap = blockingState.severity === 'severe' ? 30 : 60;
      proposed = { activityType: workout.activityType, zone: blockingState.severity === 'severe' ? 1 : 2, durationMin: Math.min(workout.durationMin, cap) };
    } else {
      // travel
      proposed = {
        activityType: workout.activityType === 'bike' ? 'run' : workout.activityType,
        zone: Math.min(workout.zone, 2),
        durationMin: Math.min(workout.durationMin, 45),
      };
    }
  } else {
    // lowReadinessHard: Z3+ → Z2; Z4+ stark gedeckelt
    reason = 'low_readiness';
    const newZone = workout.zone >= 4 ? 2 : 2;
    const newDur  = workout.zone >= 4 ? Math.min(workout.durationMin, 45) : Math.round(workout.durationMin * 0.7);
    proposed = { activityType: workout.activityType, zone: newZone, durationMin: newDur };
  }

  // 6. Rationale (deterministisch, kein LLM für die Entscheidung)
  const rationaleParts: string[] = [];
  if (reason === 'low_readiness') {
    if (metrics?.hrvRmssd != null && metrics.hrvStatus === 'below_normal') {
      rationaleParts.push(`HRV ${Math.round(metrics.hrvRmssd)} ms (below_normal)`);
    }
    if (metrics?.sleepHours != null && metrics.sleepHours < 6.5) {
      rationaleParts.push(`Schlaf ${metrics.sleepHours.toFixed(1)}h`);
    }
    if (metrics?.bodyBatteryMax != null && metrics.bodyBatteryMax < 50) {
      rationaleParts.push(`Body Battery ${metrics.bodyBatteryMax}%`);
    }
    rationaleParts.push(`Readiness ${readiness.score}/100`);
  } else if (blockingState) {
    rationaleParts.push(`${blockingState.type}/${blockingState.severity}`);
    if (blockingState.bodyPart) rationaleParts.push(blockingState.bodyPart);
  }

  return {
    workoutId: workout.id,
    date: workout.plannedDate,
    original: {
      activityType: workout.activityType,
      zone:         workout.zone,
      durationMin:  workout.durationMin,
    },
    proposed: {
      ...proposed,
      description:  describeAdjustment(reason, proposed),
    },
    reason,
    rationale: rationaleParts.join(' · '),
    readinessScore: readiness.score,
  };
}

// ─── Auto-Phase-Progression (Phase 6 Task 5) ─────────────────────────────────

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';

export function derivePhase(nextRaceDate: string | null, today: string): TrainingPhase {
  if (!nextRaceDate) return 'base';
  const tDate = new Date(today + 'T00:00:00Z');
  const rDate = new Date(nextRaceDate + 'T00:00:00Z');
  const days = Math.round((rDate.getTime() - tDate.getTime()) / 86_400_000);
  if (days < 0)   return 'base';            // Race vorbei
  if (days <= 14) return 'taper';
  if (days <= 28) return 'peak';
  if (days <= 84) return 'build';
  return 'base';
}

export async function deriveCurrentPhase(userId: string, today: string): Promise<TrainingPhase> {
  // Find the next future "race" goal (active, has targetDate)
  // Lazy import to avoid circular deps; only one query.
  const { pulseGoals } = await import('../../db/pulse-schema.js');
  const races = await db.select().from(pulseGoals)
    .where(and(
      eq(pulseGoals.userId, userId),
      eq(pulseGoals.status, 'active'),
      eq(pulseGoals.category, 'race'),
      gte(pulseGoals.targetDate, today),
    ))
    .orderBy(pulseGoals.targetDate)
    .limit(1);

  if (races.length === 0 || !races[0]?.targetDate) return 'base';
  return derivePhase(races[0].targetDate, today);
}
