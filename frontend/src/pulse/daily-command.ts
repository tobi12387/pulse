import type { PulseHomeScreenData, PulseTodayOptionsResponse } from '@coaching-os/shared/pulse';

type HomeActivity = PulseHomeScreenData['recentActivities'][number];

export type DailyCommandKind =
  | 'completed_planned'
  | 'completed_off_plan'
  | 'planned'
  | 'recovery'
  | 'free_trainable'
  | 'free_rest';

function todayActivityCandidates(home: PulseHomeScreenData): HomeActivity[] {
  const todayActivities = home.todayActivities ?? [];
  if (todayActivities.length > 0) return todayActivities;
  return home.recentActivities.filter(activity => activity.startTime.slice(0, 10) === home.date);
}

function hasCompletedPlannedWorkout(home: PulseHomeScreenData): boolean {
  const workout = home.todayWorkout;
  if (!workout || workout.plannedDate !== home.date) return false;
  return workout.status === 'completed'
    || Boolean(workout.completedActivityId)
    || workout.executionStatus === 'completed_matched';
}

function hasOffPlanActivity(home: PulseHomeScreenData): boolean {
  if (home.todayWorkout?.plannedDate === home.date) return false;
  return todayActivityCandidates(home).some(activity => (activity.durationSec ?? 0) >= 10 * 60);
}

export function resolveDailyCommand(
  home: PulseHomeScreenData | null | undefined,
  options: PulseTodayOptionsResponse | null | undefined,
): DailyCommandKind {
  if (home) {
    if (hasCompletedPlannedWorkout(home)) return 'completed_planned';
    if (hasOffPlanActivity(home)) return 'completed_off_plan';
    if (home.todayWorkout?.plannedDate === home.date) return 'planned';
  }

  if (options?.state === 'recovery_protect') return 'recovery';
  if (options?.state === 'unplanned_trainable') return 'free_trainable';
  return 'free_rest';
}

export function dailyCommandAllowsTodayOptions(kind: DailyCommandKind | null | undefined): boolean {
  return kind == null || kind === 'planned' || kind === 'free_trainable';
}
