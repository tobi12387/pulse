import type { PulseActivityType, PulseDailyDeltaItem, PulseDailyDeltaResponse } from '@coaching-os/shared/pulse';
import { scoreActivityWorkoutMatch } from './workout-reconciliation.js';

export interface DailyDeltaPlannedWorkout {
  id: string;
  plannedDate: string;
  activityType: PulseActivityType;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  status: string;
  completedActivityId: string | null;
  complianceScore: number | null;
}

export interface DailyDeltaActivity {
  id: string;
  startTime: string | Date;
  activityType: PulseActivityType;
  durationSec: number | null;
  tss: number | null;
  rpe: number | null;
}

export interface DailyDeltaMetric {
  date: string;
  sleepHours: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
}

export interface BuildDailyDeltaInput {
  today: string;
  days: number;
  plannedWorkouts: DailyDeltaPlannedWorkout[];
  activities: DailyDeltaActivity[];
  dailyMetrics: DailyDeltaMetric[];
}

const ACTIVITY_LABEL: Record<PulseActivityType, string> = {
  bike: 'Radfahren',
  run: 'Laufen',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Wandern',
  other: 'Sonstiges',
};

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function cutoffDate(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - Math.max(1, days));
  return date.toISOString().slice(0, 10);
}

function durationMinFromSec(seconds: number | null): number | null {
  return seconds == null ? null : Math.round(seconds / 60);
}

function formatPlanned(workout: DailyDeltaPlannedWorkout): string {
  return `${ACTIVITY_LABEL[workout.activityType]} · Z${workout.zone} · ${workout.durationMin} min`;
}

function formatActivity(activity: DailyDeltaActivity): string {
  const parts = [
    ACTIVITY_LABEL[activity.activityType],
    durationMinFromSec(activity.durationSec) != null ? `${durationMinFromSec(activity.durationSec)} min` : null,
    activity.tss != null ? `TSS ${Math.round(activity.tss)}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function signedNumber(value: number, digits = 0): string {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function buildRecoveryDelta(metricsByDate: Map<string, DailyDeltaMetric>, date: string): string | null {
  const today = metricsByDate.get(date);
  if (!today) return null;
  const previousDate = new Date(`${date}T00:00:00.000Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previous = metricsByDate.get(previousDate.toISOString().slice(0, 10));
  if (!previous) return null;

  const deltas = [
    today.sleepHours != null && previous.sleepHours != null
      ? `Schlaf ${signedNumber(today.sleepHours - previous.sleepHours, 1)} h`
      : null,
    today.bodyBatteryMax != null && previous.bodyBatteryMax != null
      ? `Body Battery ${signedNumber(today.bodyBatteryMax - previous.bodyBatteryMax)}`
      : null,
    today.stressAvg != null && previous.stressAvg != null
      ? `Stress ${signedNumber(today.stressAvg - previous.stressAvg)}`
      : null,
  ].filter(Boolean);

  return deltas.length > 0 ? `Recovery seit Vortag: ${deltas.join(' · ')}` : null;
}

function loadDelta(planned: DailyDeltaPlannedWorkout | null, activity: DailyDeltaActivity | null): number | null {
  if (planned?.targetTss == null || activity?.tss == null) return null;
  return Math.round(activity.tss - planned.targetTss);
}

function scoreMatched(planned: DailyDeltaPlannedWorkout, activity: DailyDeltaActivity | null): number {
  if (planned.complianceScore != null) return Math.round(Math.max(0, Math.min(1, planned.complianceScore)) * 100);
  if (!activity) return 80;
  const matchScore = scoreActivityWorkoutMatch(planned, activity);
  return Math.round(Math.max(0.6, Math.min(1, matchScore)) * 100);
}

function strongestActivity(activities: DailyDeltaActivity[]): DailyDeltaActivity | null {
  return [...activities].sort((a, b) => (b.tss ?? 0) - (a.tss ?? 0))[0] ?? null;
}

function bestActivityForWorkout(workout: DailyDeltaPlannedWorkout, activities: DailyDeltaActivity[]): DailyDeltaActivity | null {
  const explicit = workout.completedActivityId
    ? activities.find(activity => activity.id === workout.completedActivityId) ?? null
    : null;
  if (explicit) return explicit;

  return activities
    .map(activity => ({ activity, score: scoreActivityWorkoutMatch(workout, activity) }))
    .filter(match => match.score >= 0.6)
    .sort((a, b) => b.score - a.score)[0]?.activity ?? null;
}

function itemForDate(
  date: string,
  workout: DailyDeltaPlannedWorkout | null,
  activities: DailyDeltaActivity[],
  recoveryDelta: string | null,
  today: string,
): PulseDailyDeltaItem | null {
  const bestActivity = workout ? bestActivityForWorkout(workout, activities) : strongestActivity(activities);
  const anyActivity = bestActivity ?? strongestActivity(activities);
  const evidence: string[] = [];
  if (workout) evidence.push(`Geplant: ${formatPlanned(workout)}`);
  if (anyActivity) evidence.push(`Garmin: ${formatActivity(anyActivity)}`);
  if (recoveryDelta) evidence.push(recoveryDelta);

  if (workout && bestActivity) {
    const delta = loadDelta(workout, bestActivity);
    return {
      date,
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      summary: delta == null
        ? 'Die geplante Einheit wurde mit Garmin-Ausführung abgeglichen.'
        : `Die echte Belastung lag ${signedNumber(delta)} TSS zum Plan.`,
      score: scoreMatched(workout, bestActivity),
      loadDeltaTss: delta,
      recoveryDelta,
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln und die nächste Empfehlung darauf aufbauen.',
      evidence,
      targetPath: `/activity/${bestActivity.id}`,
    };
  }

  if (workout && anyActivity) {
    const delta = loadDelta(workout, anyActivity);
    return {
      date,
      status: 'replaced',
      title: 'Anders ausgeführt als geplant',
      summary: delta == null
        ? 'Garmin zeigt eine Aktivität, aber sie passt nicht sauber zur geplanten Einheit.'
        : `Garmin zeigt eine andere Ausführung mit ${signedNumber(delta)} TSS zum Plan.`,
      score: 45,
      loadDeltaTss: delta,
      recoveryDelta,
      nextPlanEffect: 'Nächste Empfehlung sollte echte Belastung und Sportmix höher gewichten als den alten Plan.',
      evidence,
      targetPath: `/activity/${anyActivity.id}`,
    };
  }

  if (workout && date < today) {
    return {
      date,
      status: 'missed',
      title: 'Geplante Einheit ohne Ausführung',
      summary: 'Für diese geplante Einheit wurde keine passende Garmin-Aktivität gefunden.',
      score: 0,
      loadDeltaTss: workout.targetTss == null ? null : -Math.round(workout.targetTss),
      recoveryDelta,
      nextPlanEffect: 'Reiz nicht blind nachholen; erst Load, Recovery und Verfügbarkeit prüfen.',
      evidence,
      targetPath: '/plan?tab=training',
    };
  }

  if (!workout && anyActivity) {
    return {
      date,
      status: 'off_plan',
      title: 'Echte Aktivität ohne Plan',
      summary: 'Garmin hat Training erfasst, obwohl Pulse keine Einheit geplant hatte.',
      score: null,
      loadDeltaTss: null,
      recoveryDelta,
      nextPlanEffect: 'Pulse sollte die echte Belastung in den nächsten Plan einrechnen.',
      evidence,
      targetPath: `/activity/${anyActivity.id}`,
    };
  }

  return null;
}

export function buildDailyDelta(input: BuildDailyDeltaInput): PulseDailyDeltaResponse {
  const cutoff = cutoffDate(input.today, input.days);
  const workoutsByDate = new Map<string, DailyDeltaPlannedWorkout[]>();
  const activitiesByDate = new Map<string, DailyDeltaActivity[]>();
  const metricsByDate = new Map(input.dailyMetrics.map(metric => [metric.date, metric]));
  const dates = new Set<string>();

  for (const workout of input.plannedWorkouts) {
    if (workout.plannedDate < cutoff || workout.plannedDate > input.today) continue;
    workoutsByDate.set(workout.plannedDate, [...(workoutsByDate.get(workout.plannedDate) ?? []), workout]);
    dates.add(workout.plannedDate);
  }
  for (const activity of input.activities) {
    const date = dateOnly(activity.startTime);
    if (date < cutoff || date > input.today) continue;
    activitiesByDate.set(date, [...(activitiesByDate.get(date) ?? []), activity]);
    dates.add(date);
  }

  const items = [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const workouts = workoutsByDate.get(date) ?? [];
      const activities = activitiesByDate.get(date) ?? [];
      const workout = [...workouts].sort((a, b) => (b.targetTss ?? 0) - (a.targetTss ?? 0))[0] ?? null;
      return itemForDate(date, workout, activities, buildRecoveryDelta(metricsByDate, date), input.today);
    })
    .filter((item): item is PulseDailyDeltaItem => item != null)
    .slice(0, Math.max(1, input.days));

  return { items };
}
