import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import type {
  PulsePlanLearningFlag,
  PulsePlanLearningSnapshot,
  PulsePlanLearningWeek,
  PulsePlanSportMixEntry,
} from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { pulseActivities, pulsePlanGenerations, pulsePlannedWorkouts } from '../../db/pulse-schema.js';

type SportMix = Record<string, PulsePlanSportMixEntry>;

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return isoDate(d);
}

function roundNullable(value: number | null, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferZoneFromTss(durationMin: number, tss: number): number | null {
  if (durationMin <= 0 || tss <= 0) return null;
  const tssPerHour = tss / (durationMin / 60);
  if (tssPerHour < 35) return 1;
  if (tssPerHour < 70) return 2;
  if (tssPerHour < 92) return 3;
  if (tssPerHour < 120) return 4;
  return 5;
}

function addSport(mix: SportMix, activityType: string, durationMin: number, targetTss: number): void {
  const current = mix[activityType] ?? { sessions: 0, totalMinutes: 0, totalTss: 0 };
  mix[activityType] = {
    sessions: current.sessions + 1,
    totalMinutes: current.totalMinutes + durationMin,
    totalTss: Math.round((current.totalTss + targetTss) * 10) / 10,
  };
}

function emptyWeek(weekStart: string): PulsePlanLearningWeek {
  return {
    weekStart,
    plannedSessions: 0,
    completedSessions: 0,
    skippedSessions: 0,
    completionRate: null,
    avgComplianceScore: null,
    avgRpe: null,
    sportMix: {},
    hardDays: [],
    skippedAvailableDays: [],
  };
}

function dayOffsetFromWeekStart(weekStart: string, date: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function hardPattern(week: PulsePlanLearningWeek | null): string {
  if (!week) return '';
  return week.hardDays
    .map(day => {
      const offset = dayOffsetFromWeekStart(week.weekStart, day.date);
      return `${offset ?? '?'}:${day.activityType}:Z${day.zone}`;
    })
    .sort()
    .join('|');
}

function sportMixPattern(week: PulsePlanLearningWeek | null): string {
  if (!week) return '';
  return Object.entries(week.sportMix)
    .filter(([, mix]) => mix.sessions > 0)
    .map(([sport, mix]) => `${sport}:${mix.sessions}`)
    .sort()
    .join('|');
}

function deriveMessages(week: PulsePlanLearningWeek | null, flags: PulsePlanLearningFlag[]): string[] {
  if (!week) return ['Noch keine Vorwoche mit Plan-Trace im Lernfenster.'];

  const messages: string[] = [];
  if (week.completionRate != null && week.completionRate < 0.7) {
    messages.push(`Nur ${Math.round(week.completionRate * 100)}% der geplanten Einheiten abgeschlossen.`);
  }
  if (week.avgComplianceScore != null && week.avgComplianceScore < 0.7) {
    messages.push(`Compliance lag bei ${Math.round(week.avgComplianceScore * 100)}%; diese Woche weniger dicht planen.`);
  }
  if (week.avgRpe != null && week.avgRpe >= 8) {
    messages.push(`Subjektive Belastung war hoch (Ø RPE ${week.avgRpe.toFixed(1)}).`);
  }
  if (flags.includes('high_rpe_easy')) {
    messages.push('Lockere Einheiten fühlten sich zuletzt zu hart an.');
  }
  if (flags.includes('repeated_sport_mix')) {
    messages.push('Sportmix wiederholte sich; diese Woche werden leichte Einheiten bewusst rotiert.');
  }
  if (week.skippedAvailableDays.length > 0) {
    messages.push(`${week.skippedAvailableDays.length} verfügbare Tag(e) blieben bewusst frei.`);
  }

  return messages.length > 0
    ? messages.slice(0, 4)
    : ['Vorwoche stabil: Planstruktur kann behutsam variiert werden.'];
}

export async function buildPlanLearningSnapshot(
  userId: string,
  weekStart: string,
  lookbackWeeks = 6,
): Promise<PulsePlanLearningSnapshot> {
  const since = shiftDate(weekStart, -lookbackWeeks * 7);
  const today = isoDate(new Date());
  const completedUntil = weekStart < today ? weekStart : today;
  const sinceDate = new Date(`${since}T00:00:00Z`);
  const untilDate = new Date(`${weekStart}T00:00:00Z`);

  const [traceRows, workoutRows, activityRows] = await Promise.all([
    db.select()
      .from(pulsePlanGenerations)
      .where(and(
        eq(pulsePlanGenerations.userId, userId),
        gte(pulsePlanGenerations.weekStart, since),
        lt(pulsePlanGenerations.weekStart, weekStart),
      ))
      .orderBy(desc(pulsePlanGenerations.createdAt)),
    db.select({
      plannedDate: pulsePlannedWorkouts.plannedDate,
      activityType: pulsePlannedWorkouts.activityType,
      zone: pulsePlannedWorkouts.zone,
      durationMin: pulsePlannedWorkouts.durationMin,
      targetTss: pulsePlannedWorkouts.targetTss,
      status: pulsePlannedWorkouts.status,
      completedActivityId: pulsePlannedWorkouts.completedActivityId,
      complianceScore: pulsePlannedWorkouts.complianceScore,
    }).from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        gte(pulsePlannedWorkouts.plannedDate, since),
        lt(pulsePlannedWorkouts.plannedDate, weekStart),
        inArray(pulsePlannedWorkouts.status, ['planned', 'completed', 'skipped']),
      )),
    db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      rpe: pulseActivities.rpe,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, sinceDate),
        lt(pulseActivities.startTime, untilDate),
      )),
  ]);

  const latestTraceByWeek = new Map<string, typeof traceRows[number]>();
  for (const row of traceRows) {
    if (!latestTraceByWeek.has(row.weekStart)) latestTraceByWeek.set(row.weekStart, row);
  }

  const weeks = new Map<string, PulsePlanLearningWeek>();
  for (const row of workoutRows) {
    const key = weekStartOf(row.plannedDate);
    const week = weeks.get(key) ?? emptyWeek(key);
    if (row.plannedDate < completedUntil || row.status !== 'planned') {
      week.plannedSessions++;
    }
    if (row.status === 'completed') week.completedSessions++;
    if (row.status === 'skipped') week.skippedSessions++;
    addSport(week.sportMix, row.activityType, row.durationMin, row.targetTss ?? 0);
    if (row.zone >= 4) {
      week.hardDays.push({
        date: row.plannedDate,
        activityType: row.activityType,
        zone: row.zone,
        durationMin: row.durationMin,
      });
    }
    weeks.set(key, week);
  }

  const complianceByWeek = new Map<string, number[]>();
  for (const row of workoutRows) {
    if (row.complianceScore == null) continue;
    const key = weekStartOf(row.plannedDate);
    complianceByWeek.set(key, [...(complianceByWeek.get(key) ?? []), row.complianceScore]);
  }

  const plannedZoneByActivityId = new Map<string, number>();
  for (const row of workoutRows) {
    if (row.completedActivityId != null) {
      plannedZoneByActivityId.set(row.completedActivityId, row.zone);
    }
  }
  const rpeByWeek = new Map<string, number[]>();
  let highEasyRpe = false;
  for (const activity of activityRows) {
    if (activity.rpe == null) continue;
    const date = isoDate(activity.startTime);
    const key = weekStartOf(date);
    rpeByWeek.set(key, [...(rpeByWeek.get(key) ?? []), activity.rpe]);
    const durationMin = Math.round((activity.durationSec ?? 0) / 60);
    const plannedZone = plannedZoneByActivityId.get(activity.id) ?? inferZoneFromTss(durationMin, activity.tss ?? 0);
    if (plannedZone != null && plannedZone <= 2 && activity.rpe >= 8) highEasyRpe = true;
  }

  for (const [weekStartKey, trace] of latestTraceByWeek) {
    const week = weeks.get(weekStartKey) ?? emptyWeek(weekStartKey);
    week.sportMix = Object.keys(week.sportMix).length > 0 ? week.sportMix : trace.sportMix;
    week.hardDays = week.hardDays.length > 0 ? week.hardDays : trace.hardDays;
    week.skippedAvailableDays = trace.planDecision.skippedAvailableDays ?? [];
    weeks.set(weekStartKey, week);
  }

  for (const [weekStartKey, week] of weeks) {
    week.completionRate = week.plannedSessions > 0
      ? roundNullable(week.completedSessions / week.plannedSessions)
      : null;
    week.avgComplianceScore = roundNullable(avg(complianceByWeek.get(weekStartKey) ?? []));
    week.avgRpe = roundNullable(avg(rpeByWeek.get(weekStartKey) ?? []), 1);
  }

  const orderedWeeks = [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const previousWeekStart = shiftDate(weekStart, -7);
  const previousWeek = orderedWeeks.find(week => week.weekStart === previousWeekStart) ?? null;

  const flags: PulsePlanLearningFlag[] = [];
  if (!previousWeek) flags.push('missing_history');
  if (previousWeek?.avgComplianceScore != null && previousWeek.avgComplianceScore < 0.7) flags.push('low_compliance');
  if (previousWeek?.completionRate != null && previousWeek.completionRate < 0.7) flags.push('low_completion');
  if (highEasyRpe) flags.push('high_rpe_easy');

  const lastTwo = orderedWeeks.slice(-2);
  if (lastTwo.length === 2 && hardPattern(lastTwo[0]!) === hardPattern(lastTwo[1]!) && hardPattern(lastTwo[1]!) !== '') {
    flags.push('repeated_hard_pattern');
  }
  if (lastTwo.length === 2 && sportMixPattern(lastTwo[0]!) === sportMixPattern(lastTwo[1]!) && sportMixPattern(lastTwo[1]!) !== '') {
    flags.push('repeated_sport_mix');
  }

  return {
    lookbackWeeks,
    weeks: orderedWeeks,
    previousWeek,
    learnedFromLastWeek: deriveMessages(previousWeek, flags),
    variationComparedToLastWeek: [],
    flags: [...new Set(flags)],
  };
}
