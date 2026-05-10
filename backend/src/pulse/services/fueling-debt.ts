import type { PulseFuelingDebtSummary } from '@coaching-os/shared/pulse';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { pulseActivities, pulseNutritionLogs, pulsePlannedWorkouts } from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';

type FuelingActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';

export interface FuelingDebtLogInput {
  id?: string | null;
  date: string;
  context?: string | null;
  activityId?: string | null;
  activityType?: FuelingActivityType | string | null;
  durationMin?: number | null;
  carbsG?: number | null;
  bottles750Ml?: number | null;
  powderG?: number | null;
  giComfort?: string | null;
  notes?: string | null;
}

export interface FuelingDebtPlannedWorkoutInput {
  id: string;
  plannedDate: string;
  activityType: FuelingActivityType | string;
  zone: number;
  durationMin: number;
  archetypeId?: string | null;
  description?: string | null;
  status?: string | null;
}

export interface BuildFuelingDebtInput {
  today: string;
  logs?: FuelingDebtLogInput[];
  plannedWorkouts?: FuelingDebtPlannedWorkoutInput[];
  generatedAt?: string;
}

function shiftIsoDate(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().split('T')[0]!;
}

function isEnduranceFuelingSport(activityType: string | null | undefined): boolean {
  return activityType === 'bike' || activityType === 'run' || activityType === 'hike';
}

function isGiIssue(log: FuelingDebtLogInput): boolean {
  return log.giComfort === 'mild_issue' || log.giComfort === 'issue';
}

function carbsPerHour(log: FuelingDebtLogInput): number | null {
  if (log.carbsG == null || log.durationMin == null || log.durationMin <= 0) return null;
  return Math.round(log.carbsG / (log.durationMin / 60));
}

function fuelingBasis(log: FuelingDebtLogInput): string {
  const parts = [
    carbsPerHour(log) != null ? `${carbsPerHour(log)} g/h` : null,
    log.bottles750Ml != null && log.bottles750Ml > 0 ? `${log.bottles750Ml}x750 ml` : null,
    log.powderG != null && log.powderG > 0 ? `${Math.round(log.powderG)}g Pulver` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function isControlledFuelingFollowUp(log: FuelingDebtLogInput): boolean {
  if (log.giComfort !== 'ok') return false;
  const hasFuelingSignal = (log.carbsG ?? 0) > 0 || (log.bottles750Ml ?? 0) > 0 || (log.powderG ?? 0) > 0;
  if (!hasFuelingSignal) return false;
  if (!isEnduranceFuelingSport(log.activityType)) return false;
  return (log.durationMin ?? 0) >= 75;
}

function isControlledFuelingWorkout(workout: FuelingDebtPlannedWorkoutInput): boolean {
  if (workout.status != null && workout.status !== 'planned') return false;
  if (!isEnduranceFuelingSport(workout.activityType)) return false;
  if (workout.zone > 2) return false;
  if (workout.durationMin < 75) return false;
  if (workout.archetypeId === 'long_endurance_fueling_practice') return true;
  if (/fueling|verpflegung|magen|gi/i.test(workout.description ?? '')) return true;
  return workout.durationMin >= 90;
}

function latestRelevantLogs(logs: FuelingDebtLogInput[]): FuelingDebtLogInput[] {
  return logs
    .filter(log => log.context === 'during' || log.context == null)
    .filter(log =>
      isGiIssue(log)
      || log.giComfort === 'ok'
      || (log.carbsG ?? 0) > 0
      || (log.bottles750Ml ?? 0) > 0
      || (log.powderG ?? 0) > 0,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

function resolvedSummary(today: string, updatedAt: string, latestOk: FuelingDebtLogInput | null): PulseFuelingDebtSummary {
  return {
    status: 'resolved',
    hasOpenDebt: false,
    label: 'Fueling frei',
    summary: latestOk
      ? `Letzter relevanter Fueling-Log war verträglich am ${latestOk.date}${fuelingBasis(latestOk)}.`
      : 'Kein offener GI-/Fueling-Blocker in den letzten 120 Tagen.',
    closureCondition: 'Weiterhin lange oder harte Einheiten mit Fueling-Log schließen.',
    evidence: latestOk ? [`Verträglich: ${latestOk.date}${fuelingBasis(latestOk)}`] : [`Stand ${today}: kein offener GI-Hinweis`],
    openIssueDate: null,
    controlledWorkoutId: null,
    followUpActivityId: latestOk?.activityId ?? latestOk?.id ?? null,
    updatedAt,
  };
}

export function summarizeFuelingDebt(input: BuildFuelingDebtInput): PulseFuelingDebtSummary {
  const updatedAt = input.generatedAt ?? new Date().toISOString();
  const relevant = latestRelevantLogs(input.logs ?? []);
  const latestIssue = relevant.find(isGiIssue) ?? null;
  const latestOk = relevant.find(log => log.giComfort === 'ok') ?? null;

  if (!latestIssue) {
    return resolvedSummary(input.today, updatedAt, latestOk);
  }

  const followUp = relevant
    .filter(log => log.date > latestIssue.date)
    .find(isControlledFuelingFollowUp) ?? null;
  if (followUp) {
    return {
      status: 'tolerated_follow_up',
      hasOpenDebt: false,
      label: 'Toleranz bestätigt',
      summary: `GI-Hinweis vom ${latestIssue.date} ist durch eine kontrollierte verträgliche Folgeeinheit am ${followUp.date} geschlossen.`,
      closureCondition: 'Blocker geschlossen: nächste Steigerung weiter mit Fueling-Log absichern.',
      evidence: [
        `GI-Hinweis: ${latestIssue.date}${fuelingBasis(latestIssue)}`,
        `Follow-up ok: ${followUp.date}${fuelingBasis(followUp)}`,
      ],
      openIssueDate: latestIssue.date,
      controlledWorkoutId: null,
      followUpActivityId: followUp.activityId ?? followUp.id ?? null,
      updatedAt,
    };
  }

  const controlledWorkout = (input.plannedWorkouts ?? [])
    .filter(workout => workout.plannedDate >= input.today && workout.plannedDate > latestIssue.date)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .find(isControlledFuelingWorkout) ?? null;
  if (controlledWorkout) {
    return {
      status: 'controlled_practice_planned',
      hasOpenDebt: true,
      label: 'Fueling-Test geplant',
      summary: `GI-Hinweis vom ${latestIssue.date} bleibt offen, aber ${controlledWorkout.plannedDate} ist als kontrollierte Fueling-Praxis geeignet.`,
      closureCondition: 'Nach der Einheit Fueling loggen und GI-Komfort als "Magen ok" erfassen.',
      evidence: [
        `GI-Hinweis: ${latestIssue.date}${fuelingBasis(latestIssue)}`,
        `Kontrollierte Einheit: ${controlledWorkout.plannedDate}, Z${controlledWorkout.zone}, ${controlledWorkout.durationMin} min`,
      ],
      openIssueDate: latestIssue.date,
      controlledWorkoutId: controlledWorkout.id,
      followUpActivityId: null,
      updatedAt,
    };
  }

  return {
    status: 'open_gi_issue',
    hasOpenDebt: true,
    label: 'GI-Schutz offen',
    summary: `GI-/Magenhinweis vom ${latestIssue.date}${fuelingBasis(latestIssue)} ist noch nicht durch eine kontrollierte Folgeeinheit geschlossen.`,
    closureCondition: 'Schließen: 75-120 min locker mit frühem, gleichmäßigem Fueling absolvieren und danach GI-Komfort "Magen ok" loggen.',
    evidence: [`GI-Hinweis: ${latestIssue.date}${fuelingBasis(latestIssue)}`],
    openIssueDate: latestIssue.date,
    controlledWorkoutId: null,
    followUpActivityId: null,
    updatedAt,
  };
}

export async function loadFuelingDebtSummary(userId: string, today: string): Promise<PulseFuelingDebtSummary> {
  const since = shiftIsoDate(today, -120);
  const until = shiftIsoDate(today, 30);
  const logs = await db.select({
    id: pulseNutritionLogs.id,
    date: pulseNutritionLogs.date,
    context: pulseNutritionLogs.context,
    activityId: pulseNutritionLogs.activityId,
    carbsG: pulseNutritionLogs.carbsG,
    bottles750Ml: pulseNutritionLogs.bottles750Ml,
    powderG: pulseNutritionLogs.powderG,
    giComfort: pulseNutritionLogs.giComfort,
    notes: pulseNutritionLogs.notes,
  }).from(pulseNutritionLogs)
    .where(and(eq(pulseNutritionLogs.userId, userId), gte(pulseNutritionLogs.date, since)))
    .orderBy(desc(pulseNutritionLogs.date), desc(pulseNutritionLogs.createdAt))
    .limit(40);

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
  const plannedWorkouts = await db.select({
    id: pulsePlannedWorkouts.id,
    plannedDate: pulsePlannedWorkouts.plannedDate,
    activityType: pulsePlannedWorkouts.activityType,
    zone: pulsePlannedWorkouts.zone,
    durationMin: pulsePlannedWorkouts.durationMin,
    archetypeId: pulsePlannedWorkouts.archetypeId,
    description: pulsePlannedWorkouts.description,
    status: pulsePlannedWorkouts.status,
  }).from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, today),
    ))
    .orderBy(pulsePlannedWorkouts.plannedDate)
    .limit(30);

  return summarizeFuelingDebt({
    today,
    logs: logs.map(log => {
      const activity = log.activityId ? activityById.get(log.activityId) : null;
      return {
        ...log,
        activityType: activity?.activityType ?? null,
        durationMin: activity?.durationSec != null ? Math.round(activity.durationSec / 60) : null,
      };
    }),
    plannedWorkouts: plannedWorkouts.filter(workout => workout.plannedDate <= until),
  });
}
