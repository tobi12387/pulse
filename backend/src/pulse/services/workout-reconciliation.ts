import type { PulseActivityType, WorkoutExecutionStatus } from '@coaching-os/shared/pulse';

export interface ReconciliationWorkout {
  id: string;
  plannedDate: string;
  activityType: PulseActivityType;
  status: string;
  garminWorkoutId: string | null;
  garminScheduledId?: string | null;
  completedActivityId?: string | null;
  durationMin: number;
}

export interface ReconciliationActivity {
  id: string;
  startTime: string | Date;
  activityType: PulseActivityType;
  durationSec: number | null;
}

export interface ReconciliationCalendarItem {
  id: string;
  workoutId: string;
  date: string;
}

export interface WorkoutExecutionState {
  status: WorkoutExecutionStatus;
  matchedActivityId: string | null;
  confidence: number | null;
  notes: string;
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function normalizedActivityType(type: PulseActivityType): PulseActivityType {
  return type === 'hike' ? 'run' : type;
}

export function scoreActivityWorkoutMatch(
  workout: Pick<ReconciliationWorkout, 'plannedDate' | 'activityType' | 'durationMin'>,
  activity: Pick<ReconciliationActivity, 'startTime' | 'activityType' | 'durationSec'>,
): number {
  let score = 0;
  if (dateOnly(activity.startTime) === workout.plannedDate) score += 0.35;
  if (normalizedActivityType(activity.activityType) === normalizedActivityType(workout.activityType)) score += 0.45;

  if (activity.durationSec != null && workout.durationMin > 0) {
    const ratio = activity.durationSec / 60 / workout.durationMin;
    if (ratio >= 0.75 && ratio <= 1.25) score += 0.2;
    else if (ratio >= 0.5 && ratio <= 1.5) score += 0.1;
  }

  return Math.min(1, Number(score.toFixed(2)));
}

export function deriveWorkoutExecutionState(
  workout: ReconciliationWorkout,
  calendarItem: ReconciliationCalendarItem | null = null,
  activity: ReconciliationActivity | null = null,
  now = new Date(),
): WorkoutExecutionState {
  if (activity) {
    const confidence = scoreActivityWorkoutMatch(workout, activity);
    if (workout.completedActivityId === activity.id || confidence >= 0.6) {
      return {
        status: 'completed_matched',
        matchedActivityId: activity.id,
        confidence,
        notes: `Mit Garmin-Aktivität ${activity.id} abgeglichen.`,
      };
    }
    return {
      status: 'replaced_or_off_plan',
      matchedActivityId: activity.id,
      confidence,
      notes: `Am Plantag wurde eine andere Aktivität (${activity.activityType}) gefunden.`,
    };
  }

  if (workout.plannedDate < dateOnly(now) && workout.status === 'planned') {
    return {
      status: 'missed',
      matchedActivityId: null,
      confidence: null,
      notes: 'Plantag ist vorbei und keine passende Garmin-Aktivität ist zugeordnet.',
    };
  }

  if (workout.garminScheduledId || calendarItem) {
    return {
      status: 'garmin_scheduled',
      matchedActivityId: null,
      confidence: null,
      notes: 'Workout ist auf Garmin im Kalender geplant.',
    };
  }

  if (workout.garminWorkoutId) {
    return {
      status: 'garmin_template',
      matchedActivityId: null,
      confidence: null,
      notes: 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.',
    };
  }

  return {
    status: 'local_planned',
    matchedActivityId: null,
    confidence: null,
    notes: 'Workout ist nur lokal in Pulse geplant.',
  };
}

export function summarizeExecutionState(status: WorkoutExecutionStatus): string {
  const labels: Record<WorkoutExecutionStatus, string> = {
    local_planned: 'Lokal',
    garmin_template: 'Garmin',
    garmin_scheduled: 'Kalender',
    completed_matched: 'Erledigt',
    missed: 'Verpasst',
    replaced_or_off_plan: 'Ersetzt',
  };
  return labels[status];
}
