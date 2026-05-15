import type {
  PulseFuelingCarbRange,
  PulseFuelingLearningReadiness,
  PulseFuelingOutcomeBaseline,
} from '@coaching-os/shared/pulse';
import { and, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { pulseActivities, pulseNutritionLogs } from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';

type FuelingActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
const REQUIRED_COMPARABLE_COMPLETE_LOGS = 3;

export interface FuelingOutcomeBaselineLogInput {
  date: string;
  context?: string | null;
  activityId?: string | null;
  activityType?: FuelingActivityType | string | null;
  durationMin?: number | null;
  carbsG?: number | null;
  drinksMl?: number | null;
  bottles750Ml?: number | null;
  powderG?: number | null;
  sodiumMg?: number | null;
  ambientTempC?: number | null;
  sweatRateLPerHour?: number | null;
  giComfort?: 'ok' | 'mild_issue' | 'issue' | string | null;
  notes?: string | null;
}

export interface BuildFuelingOutcomeBaselineInput {
  logs?: FuelingOutcomeBaselineLogInput[];
}

function shiftIsoDate(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().split('T')[0]!;
}

function isEnduranceFuelingSport(activityType: string | null | undefined): boolean {
  return activityType === 'bike' || activityType === 'run' || activityType === 'hike';
}

function isGiIssue(log: FuelingOutcomeBaselineLogInput): boolean {
  return log.giComfort === 'mild_issue' || log.giComfort === 'issue';
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function perHour(value: number | null | undefined, durationMin: number | null | undefined): number | null {
  if (value == null || durationMin == null || durationMin <= 0) return null;
  return Math.round(value / (durationMin / 60));
}

function carbsPerHour(log: FuelingOutcomeBaselineLogInput): number | null {
  return perHour(log.carbsG, log.durationMin);
}

function fluidMl(log: FuelingOutcomeBaselineLogInput): number | null {
  if (log.drinksMl != null && log.drinksMl > 0) return log.drinksMl;
  if (log.bottles750Ml != null && log.bottles750Ml > 0) return Math.round(log.bottles750Ml * 750);
  return null;
}

function targetRange(log: FuelingOutcomeBaselineLogInput, observedCarbsPerHour: number | null): PulseFuelingCarbRange | null {
  if (isGiIssue(log)) {
    return observedCarbsPerHour != null && observedCarbsPerHour < 50
      ? { min: 50, max: 70 }
      : { min: 50, max: 70 };
  }
  if (log.giComfort === 'ok' && observedCarbsPerHour != null) {
    const min = clamp(roundToFive(observedCarbsPerHour), 40, 75);
    return { min, max: Math.min(90, min + 15) };
  }
  return observedCarbsPerHour != null ? { min: clamp(roundToFive(observedCarbsPerHour), 40, 70), max: 75 } : null;
}

function relevantLogs(logs: FuelingOutcomeBaselineLogInput[]): FuelingOutcomeBaselineLogInput[] {
  return logs
    .filter(log => log.context === 'during' || log.context == null)
    .filter(log => isEnduranceFuelingSport(log.activityType))
    .filter(log =>
      (log.durationMin ?? 0) >= 75
      || isGiIssue(log)
      || (log.carbsG ?? 0) > 0
      || (log.powderG ?? 0) > 0
      || (log.bottles750Ml ?? 0) > 0,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

function comparableLearningLogs(logs: FuelingOutcomeBaselineLogInput[]): FuelingOutcomeBaselineLogInput[] {
  return logs
    .filter(log => log.context === 'during' || log.context == null)
    .filter(log => isEnduranceFuelingSport(log.activityType))
    .filter(log => (log.durationMin ?? 0) >= 75)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function isComparableCompleteLearningLog(log: FuelingOutcomeBaselineLogInput): boolean {
  return log.carbsG != null && log.giComfort != null;
}

function summarizeLearningReadiness(logs: FuelingOutcomeBaselineLogInput[]): PulseFuelingLearningReadiness {
  const comparableLogs = comparableLearningLogs(logs);
  const completeLogs = comparableLogs.filter(isComparableCompleteLearningLog);
  const readyForTrendSummary = completeLogs.length >= REQUIRED_COMPARABLE_COMPLETE_LOGS;
  if (readyForTrendSummary) {
    return {
      comparableCompleteLogs: completeLogs.length,
      requiredComparableCompleteLogs: REQUIRED_COMPARABLE_COMPLETE_LOGS,
      readyForTrendSummary,
      missingEvidence: [],
    };
  }

  const missingEvidence = [
    `Noch ${completeLogs.length === 0 ? 'drei' : REQUIRED_COMPARABLE_COMPLETE_LOGS - completeLogs.length} vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.`,
    comparableLogs.some(log => log.giComfort == null)
      ? 'GI-Komfort fehlt strukturiert fuer mindestens einen langen During-Log.'
      : null,
    comparableLogs.some(log => log.carbsG == null)
      ? 'Carbs fehlen strukturiert fuer mindestens einen langen During-Log.'
      : null,
  ].filter((item): item is string => item != null);

  return {
    comparableCompleteLogs: completeLogs.length,
    requiredComparableCompleteLogs: REQUIRED_COMPARABLE_COMPLETE_LOGS,
    readyForTrendSummary,
    missingEvidence,
  };
}

function hydrationEvidenceGaps(logs: FuelingOutcomeBaselineLogInput[]): string[] {
  const candidates = comparableLearningLogs(logs);
  const relevant = candidates.length > 0 ? candidates : relevantLogs(logs);
  const hasSodium = relevant.some(log => log.sodiumMg != null);
  const hasMeasuredHeatAndSweat = relevant.some(log => log.ambientTempC != null && log.sweatRateLPerHour != null);

  return [
    hasSodium ? null : 'Sodium nicht strukturiert geloggt.',
    hasMeasuredHeatAndSweat ? null : 'Hitze und Schweißrate nicht gemessen.',
  ].filter((item): item is string => item != null);
}

function formatObserved(log: FuelingOutcomeBaselineLogInput, observedCarbsPerHour: number | null): string {
  const parts = [
    observedCarbsPerHour != null ? `${observedCarbsPerHour} g/h` : null,
    log.bottles750Ml != null && log.bottles750Ml > 0 ? `${log.bottles750Ml} x 750 ml` : null,
    log.powderG != null && log.powderG > 0 ? `${Math.round(log.powderG)} g Pulver` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Fueling unvollstaendig geloggt';
}

function rangeText(range: PulseFuelingCarbRange | null): string | null {
  return range ? `${range.min}-${range.max} g/h` : null;
}

function hydrationContextText(log: FuelingOutcomeBaselineLogInput): string | null {
  if (log.ambientTempC == null && log.sweatRateLPerHour == null) return null;
  const parts = [
    log.ambientTempC != null ? `${Math.round(log.ambientTempC)}°C` : null,
    log.sweatRateLPerHour != null ? `Schweißrate ${log.sweatRateLPerHour.toFixed(1)} l/h` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Hydration-Kontext: ${parts.join(', ')}` : null;
}

function hydrationContextSummary(log: FuelingOutcomeBaselineLogInput, sodiumMgPerHour: number | null): string | null {
  const parts = [
    sodiumMgPerHour != null ? `Sodium ca. ${sodiumMgPerHour} mg/h` : null,
    log.ambientTempC != null ? `${Math.round(log.ambientTempC)}°C` : null,
    log.sweatRateLPerHour != null ? `Schweißrate ${log.sweatRateLPerHour.toFixed(1)} l/h` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Hydration-Kontext gemessen: ${parts.join(', ')}` : null;
}

export function summarizeFuelingOutcomeBaseline(input: BuildFuelingOutcomeBaselineInput): PulseFuelingOutcomeBaseline {
  const logs = input.logs ?? [];
  const learningReadiness = summarizeLearningReadiness(logs);
  const hydrationGaps = hydrationEvidenceGaps(logs);
  const latest = relevantLogs(logs)[0] ?? null;
  if (!latest) {
    return {
      status: 'insufficient_data',
      label: 'Fueling-Baseline offen',
      summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Verträglichkeit als Baseline.',
      latestLogDate: null,
      observedCarbsPerHour: null,
      targetCarbsPerHour: null,
      bottles750Ml: null,
      powderG: null,
      fluidMlPerHour: null,
      sodiumMgPerHour: null,
      hydrationContextSummary: null,
      hydrationEvidenceGaps: hydrationGaps,
      evidence: ['Lange Einheiten nachtraeglich mit Carbs, Flaschen, Pulver und GI-Komfort loggen.'],
      learningReadiness,
    };
  }

  const observedCarbsPerHour = carbsPerHour(latest);
  const targetCarbsPerHour = targetRange(latest, observedCarbsPerHour);
  const fluidMlPerHour = perHour(fluidMl(latest), latest.durationMin);
  const sodiumMgPerHour = perHour(latest.sodiumMg, latest.durationMin);
  const measuredHydrationContext = hydrationContextSummary(latest, sodiumMgPerHour);
  const observed = formatObserved(latest, observedCarbsPerHour);
  const target = rangeText(targetCarbsPerHour);
  const evidence = [
    `Letzter Log: ${latest.date}, ${observed}`,
    fluidMlPerHour != null ? `Fluid ca. ${fluidMlPerHour} ml/h` : 'Fluid nicht geloggt',
    sodiumMgPerHour != null ? `Sodium ca. ${sodiumMgPerHour} mg/h` : 'Sodium nicht geloggt',
    hydrationContextText(latest),
  ].filter((item): item is string => item != null);

  if (isGiIssue(latest)) {
    return {
      status: 'learning',
      label: 'Fueling-Baseline lernen',
      summary: `Letzter langer Log: ${observed}; naechste Teststufe ${target ?? 'kontrolliert steigern'}.`,
      latestLogDate: latest.date,
      observedCarbsPerHour,
      targetCarbsPerHour,
      bottles750Ml: latest.bottles750Ml ?? null,
      powderG: latest.powderG ?? null,
      fluidMlPerHour,
      sodiumMgPerHour,
      hydrationContextSummary: measuredHydrationContext,
      hydrationEvidenceGaps: hydrationGaps,
      evidence,
      learningReadiness,
    };
  }

  if (latest.giComfort === 'ok') {
    return {
      status: 'stable',
      label: 'Fueling-Baseline vertraeglich',
      summary: `Letzter vertraeglicher Log: ${observed}; naechste kleine Stufe ${target ?? 'nur leicht veraendern'}.`,
      latestLogDate: latest.date,
      observedCarbsPerHour,
      targetCarbsPerHour,
      bottles750Ml: latest.bottles750Ml ?? null,
      powderG: latest.powderG ?? null,
      fluidMlPerHour,
      sodiumMgPerHour,
      hydrationContextSummary: measuredHydrationContext,
      hydrationEvidenceGaps: hydrationGaps,
      evidence,
      learningReadiness,
    };
  }

  return {
    status: 'caution',
    label: 'Fueling-Baseline unvollstaendig',
    summary: `Letzter langer Log: ${observed}; Verträglichkeit fehlt, deshalb nur vorsichtig veraendern.`,
    latestLogDate: latest.date,
    observedCarbsPerHour,
    targetCarbsPerHour,
    bottles750Ml: latest.bottles750Ml ?? null,
    powderG: latest.powderG ?? null,
    fluidMlPerHour,
    sodiumMgPerHour,
    hydrationContextSummary: measuredHydrationContext,
    hydrationEvidenceGaps: hydrationGaps,
    evidence,
    learningReadiness,
  };
}

export async function loadFuelingOutcomeBaseline(userId: string, today: string): Promise<PulseFuelingOutcomeBaseline> {
  const since = shiftIsoDate(today, -120);
  const logs = await db.select({
    date: pulseNutritionLogs.date,
    context: pulseNutritionLogs.context,
    activityId: pulseNutritionLogs.activityId,
    carbsG: pulseNutritionLogs.carbsG,
    drinksMl: pulseNutritionLogs.drinksMl,
    bottles750Ml: pulseNutritionLogs.bottles750Ml,
    powderG: pulseNutritionLogs.powderG,
    sodiumMg: pulseNutritionLogs.sodiumMg,
    ambientTempC: pulseNutritionLogs.ambientTempC,
    sweatRateLPerHour: pulseNutritionLogs.sweatRateLPerHour,
    giComfort: pulseNutritionLogs.giComfort,
    notes: pulseNutritionLogs.notes,
  }).from(pulseNutritionLogs)
    .where(and(
      eq(pulseNutritionLogs.userId, userId),
      gte(pulseNutritionLogs.date, since),
      or(eq(pulseNutritionLogs.context, 'during'), isNull(pulseNutritionLogs.context)),
    ))
    .orderBy(desc(pulseNutritionLogs.date), desc(pulseNutritionLogs.createdAt))
    .limit(20);

  const activityIds = logs
    .map(log => log.activityId)
    .filter((id): id is string => id != null);
  const activities = activityIds.length > 0
    ? await db.select({
        id: pulseActivities.id,
        activityType: pulseActivities.activityType,
        durationSec: pulseActivities.durationSec,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), inArray(pulseActivities.id, activityIds)))
    : [];
  const activityById = new Map(activities.map(activity => [activity.id, activity]));

  return summarizeFuelingOutcomeBaseline({
    logs: logs.map(log => {
      const activity = log.activityId ? activityById.get(log.activityId) : null;
      return {
        date: log.date,
        context: log.context,
        activityId: log.activityId,
        activityType: activity?.activityType ?? null,
        durationMin: activity?.durationSec != null ? Math.round(activity.durationSec / 60) : null,
        carbsG: log.carbsG,
        drinksMl: log.drinksMl,
        bottles750Ml: log.bottles750Ml,
        powderG: log.powderG,
        sodiumMg: log.sodiumMg,
        ambientTempC: log.ambientTempC,
        sweatRateLPerHour: log.sweatRateLPerHour,
        giComfort: log.giComfort,
        notes: log.notes,
      };
    }),
  });
}
