import type { FastifyInstance } from 'fastify';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';
import {
  pulseActivities,
  pulseNutritionLogs,
  pulsePlannedWorkouts,
  pulseUserProfile,
} from '../../db/pulse-schema.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from './workout-reconciliation.js';

interface NutritionContext {
  carbsG: number;
  gelsCount: number;
  drinksMl: number;
  sodiumMg: number;
  hadAnyLog: boolean;
}

function buildNutritionContext(logs: Array<{
  context: string | null; carbsG: number | null; gelsCount: number | null;
  drinksMl: number | null; sodiumMg: number | null;
}>): NutritionContext {
  const relevant = logs.filter(l => l.context === 'during' || l.context === 'post' || l.context == null);
  const sum = (k: keyof typeof relevant[0]) =>
    relevant.reduce((s, l) => s + (typeof l[k] === 'number' ? (l[k] as number) : 0), 0);
  return {
    carbsG:    sum('carbsG'),
    gelsCount: sum('gelsCount'),
    drinksMl:  sum('drinksMl'),
    sodiumMg:  sum('sodiumMg'),
    hadAnyLog: logs.length > 0,
  };
}

function recommendedCarbsPerHour(activityType: string, durationMin: number): number {
  if (activityType === 'bike') {
    if (durationMin < 60)  return 30;
    if (durationMin < 120) return 60;
    return 80;
  }
  if (activityType === 'run') {
    if (durationMin < 75)  return 20;
    return 50;
  }
  return 30;
}

async function generateWorkoutFeedback(
  planned: { activityType: string; zone: number; durationMin: number; description: string | null },
  actual: { durationSec: number | null; avgHr: number | null; maxHr: number | null; avgPowerW: number | null; normalizedPowerW: number | null; tss: number | null },
  profile: { maxHrBpm: number | null; ftpWatts: number | null } | undefined,
  nutrition?: NutritionContext,
): Promise<{ feedback: string; complianceScore: number }> {
  const maxHr = profile?.maxHrBpm ?? 185;
  const ftp = profile?.ftpWatts ?? 250;

  const zoneHrRanges: Record<number, string> = {
    1: `<${Math.round(maxHr * 0.68)} bpm`,
    2: `${Math.round(maxHr * 0.68)}–${Math.round(maxHr * 0.78)} bpm`,
    3: `${Math.round(maxHr * 0.78)}–${Math.round(maxHr * 0.88)} bpm`,
    4: `${Math.round(maxHr * 0.88)}–${Math.round(maxHr * 0.95)} bpm`,
    5: `>${Math.round(maxHr * 0.95)} bpm`,
  };
  const zonePowerRanges: Record<number, string> = {
    1: `<${Math.round(ftp * 0.56)} W`,
    2: `${Math.round(ftp * 0.56)}–${Math.round(ftp * 0.75)} W`,
    3: `${Math.round(ftp * 0.75)}–${Math.round(ftp * 0.90)} W`,
    4: `${Math.round(ftp * 0.90)}–${Math.round(ftp * 1.05)} W`,
    5: `>${Math.round(ftp * 1.05)} W`,
  };

  const actualDurMin = actual.durationSec != null ? Math.round(actual.durationSec / 60) : null;
  const isBike = planned.activityType === 'bike';
  const zoneRef = isBike
    ? `${zoneHrRanges[planned.zone]} (Power sekundär: ${zonePowerRanges[planned.zone] ?? '?'})`
    : zoneHrRanges[planned.zone];
  const actualIntensity = isBike
    ? `Avg HR ${actual.avgHr ?? '?'} bpm, Max HR ${actual.maxHr ?? '?'} bpm${actual.normalizedPowerW != null ? `, NP ${actual.normalizedPowerW} W` : ''}${actual.avgPowerW != null ? `, Avg ${actual.avgPowerW} W` : ''}`
    : `Avg HR ${actual.avgHr ?? '?'} bpm, Max HR ${actual.maxHr ?? '?'} bpm`;

  let nutritionBlock = '';
  if (nutrition) {
    const dur = actualDurMin ?? planned.durationMin;
    const recCarbs = recommendedCarbsPerHour(planned.activityType, dur);
    const expectedCarbs = Math.round((dur / 60) * recCarbs);
    if (nutrition.hadAnyLog) {
      const carbsPerH = dur > 0 ? Math.round(nutrition.carbsG / (dur / 60)) : 0;
      nutritionBlock = `\nFUELING:\n- Carbs: ${nutrition.carbsG}g (${carbsPerH}g/h, Empfehlung ${recCarbs}g/h)\n- Gels: ${nutrition.gelsCount} | Trinken: ${nutrition.drinksMl}ml | Sodium: ${nutrition.sodiumMg}mg\n- Erwartung für ${dur}min: ~${expectedCarbs}g Carbs`;
    } else if (dur >= 60) {
      nutritionBlock = `\nFUELING:\n- Kein Fueling-Log erfasst (Empfehlung für ${dur}min: ~${expectedCarbs}g Carbs, ${Math.round(dur * 8)}ml)`;
    }
  }

  const prompt = `Du bist ein Ausdauer-Coach. Analysiere dieses Workout kurz und prägnant auf Deutsch.

GEPLANT:
- Typ: ${planned.activityType} | Zone ${planned.zone} (${zoneRef ?? '?'}) | ${planned.durationMin} min
- Beschreibung: ${planned.description ?? '–'}

ABSOLVIERT:
- Dauer: ${actualDurMin ?? '?'} min
- Intensität: ${actualIntensity}
- TSS: ${actual.tss ?? '?'}${nutritionBlock}

Antworte NUR mit einem JSON-Objekt, kein Markdown, kein Text davor/danach:
{
  "feedback": "2-3 Sätze Feedback: Was lief gut, was war anders als geplant, eine konkrete Empfehlung für das nächste Training. Wenn Fueling unter Empfehlung lag, nenne das als möglichen Grund für schwache Performance — nicht als Plan-Abweichung.",
  "complianceScore": 0.0-1.0
}

complianceScore beurteilt NUR Pace/HR/Dauer-Treue zum Plan, nicht das Fueling: 1.0 = perfekt, 0.8 = leichte Abweichungen, 0.6 = deutliche Abweichungen, 0.4 = stark abgewichen.`;

  const raw = await llmComplete('Du bist Ausdauer-Coach. Antworte nur mit validem JSON.', prompt, SMART_MODEL);
  const parsed = JSON.parse(raw.trim().replace(/^```json\n?|```$/g, ''));
  return {
    feedback: parsed.feedback ?? '',
    complianceScore: Math.max(0, Math.min(1, parsed.complianceScore ?? 0.7)),
  };
}

export async function matchActivityToWorkout(
  userId: string,
  activityId: string,
  date: string,
  activityType: string,
  app?: FastifyInstance,
): Promise<void> {
  const [activityForMatch] = await db.select({
    id: pulseActivities.id,
    startTime: pulseActivities.startTime,
    activityType: pulseActivities.activityType,
    durationSec: pulseActivities.durationSec,
  }).from(pulseActivities).where(eq(pulseActivities.id, activityId));

  if (!activityForMatch) return;

  const plannedWorkouts = await db.select()
    .from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, date),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

  if (plannedWorkouts.length === 0) return;

  const ranked = plannedWorkouts
    .map(workout => ({
      workout,
      score: scoreActivityWorkoutMatch(workout, activityForMatch),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return;

  const state = deriveWorkoutExecutionState(
    best.workout,
    null,
    activityForMatch,
    new Date(),
  );

  if (best.score < 0.6 || state.status === 'replaced_or_off_plan') {
    await db.update(pulsePlannedWorkouts)
      .set({
        executionStatus: 'replaced_or_off_plan',
        executionMatchedAt: new Date(),
        executionMatchConfidence: best.score,
        executionNotes: `Am Plantag wurde eine andere Aktivität (${activityType}) gefunden.`,
      })
      .where(eq(pulsePlannedWorkouts.id, best.workout.id));
    return;
  }

  const planned = best.workout;

  await db.update(pulsePlannedWorkouts)
    .set({
      status: 'completed',
      completedActivityId: activityId,
      executionStatus: 'completed_matched',
      executionMatchedAt: new Date(),
      executionMatchConfidence: best.score,
      executionNotes: `Mit Garmin-Aktivität ${activityId} abgeglichen.`,
    })
    .where(eq(pulsePlannedWorkouts.id, planned.id));

  void (async () => {
    try {
      const [activity] = await db.select({
        durationSec: pulseActivities.durationSec,
        avgHr: pulseActivities.avgHr,
        maxHr: pulseActivities.maxHr,
        avgPowerW: pulseActivities.avgPowerW,
        normalizedPowerW: pulseActivities.normalizedPowerW,
        tss: pulseActivities.tss,
      }).from(pulseActivities).where(eq(pulseActivities.id, activityId));

      const [profile] = await db.select({ maxHrBpm: pulseUserProfile.maxHrBpm, ftpWatts: pulseUserProfile.ftpWatts })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

      if (!activity) return;

      const nutritionLogs = await db.select({
        context: pulseNutritionLogs.context,
        carbsG:  pulseNutritionLogs.carbsG,
        gelsCount: pulseNutritionLogs.gelsCount,
        drinksMl:  pulseNutritionLogs.drinksMl,
        sodiumMg:  pulseNutritionLogs.sodiumMg,
      }).from(pulseNutritionLogs)
        .where(and(
          eq(pulseNutritionLogs.userId, userId),
          or(
            eq(pulseNutritionLogs.workoutId,  planned.id),
            eq(pulseNutritionLogs.activityId, activityId),
          ),
        ));
      const nutrition = nutritionLogs.length > 0
        ? buildNutritionContext(nutritionLogs.map(l => ({
            context:    l.context,
            carbsG:     l.carbsG,
            gelsCount:  l.gelsCount,
            drinksMl:   l.drinksMl,
            sodiumMg:   l.sodiumMg,
          })))
        : { carbsG: 0, gelsCount: 0, drinksMl: 0, sodiumMg: 0, hadAnyLog: false };

      const { feedback, complianceScore } = await generateWorkoutFeedback(planned, activity, profile ?? undefined, nutrition);
      await db.update(pulsePlannedWorkouts)
        .set({ workoutFeedback: feedback, complianceScore })
        .where(eq(pulsePlannedWorkouts.id, planned.id));
      app?.log.info(`[workout-feedback] ${planned.plannedDate} score=${complianceScore.toFixed(2)}`);
    } catch (err) {
      app?.log.warn(`[workout-feedback] generation failed: ${err}`);
    }
  })();
}
