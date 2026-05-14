import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { pulseApi } from './api-client.js';
import type { EquipmentInput, NutritionLogInput, PlanWorkoutInput, StrengthSessionInput } from './api-client.js';
import type { PulseActivityType } from '@coaching-os/shared/pulse';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const pulseKeys = {
  all:          ['pulse'] as const,
  home:         ['pulse', 'home'] as const,
  readiness:   ['pulse', 'readiness'] as const,
  load:        ['pulse', 'load'] as const,
  sleep:        (limit: number) => ['pulse', 'sleep', limit] as const,
  activities:   (limit: number) => ['pulse', 'activities', limit] as const,
  activityDetail: (id: string) => ['pulse', 'activity-detail', id] as const,
  plan:         ['pulse', 'plan'] as const,
  planRefreshPreview: (weekStart: string) => ['pulse', 'plan', 'refresh-preview', weekStart] as const,
  planScenarioPreview: ['pulse', 'plan', 'scenario-preview'] as const,
  planTrace:    (weekStart: string) => ['pulse', 'plan', 'trace', weekStart] as const,
  adaptationEvents: ['pulse', 'plan', 'adaptation-events'] as const,
  availability: ['pulse', 'availability'] as const,
  goals:        ['pulse', 'goals'] as const,
  review:       ['pulse', 'review', 'latest'] as const,
  coachHistory: ['pulse', 'coach', 'history'] as const,
  checkinToday:    ['pulse', 'checkin', 'today'] as const,
  checkinGuidance: ['pulse', 'checkin', 'guidance'] as const,
  checkinHistory:  (days: number) => ['pulse', 'checkin', 'history', days] as const,
  mentalThemes:    (days: number) => ['pulse', 'mental', 'themes', days] as const,
  mentalLoadOverlay: (days: number) => ['pulse', 'mental', 'load-overlay', days] as const,
  resilienceRadar: (days: number) => ['pulse', 'mental', 'resilience-radar', days] as const,
  metrics:      (days: number) => ['pulse', 'metrics', days] as const,
  weight:       (days: number) => ['pulse', 'weight', days] as const,
  profile:      ['pulse', 'profile'] as const,
  coachPreferences: ['pulse', 'coach', 'preferences'] as const,
  briefing:     ['pulse', 'briefing'] as const,
  actions:      ['pulse', 'actions'] as const,
  dailyOutcomes: (days: number) => ['pulse', 'outcomes', 'daily', days] as const,
  dailyDelta: (days: number) => ['pulse', 'daily-delta', days] as const,
  decisionQuality: (days: number) => ['pulse', 'decisions', 'quality', days] as const,
  personalResponse: (days: number) => ['pulse', 'personal-response', days] as const,
  goalProjection: (horizonDays: number) => ['pulse', 'goal-projection', horizonDays] as const,
  risk:         ['pulse', 'risk'] as const,
  insight:      (domain: string, days: number) => ['pulse', 'insight', domain, days] as const,
  correlations:      (days: number)  => ['pulse', 'correlations', days] as const,
  trainingAnalytics: (weeks: number) => ['pulse', 'training-analytics', weeks] as const,
  trainingCapabilities: (days: number) => ['pulse', 'training-capabilities', days] as const,
  healthState:      ['pulse', 'health-state'] as const,
  todayOptions:     ['pulse', 'today-options'] as const,
  todayProposal:    ['pulse', 'today-proposal'] as const,
  races:            ['pulse', 'races'] as const,
  raceCommand:      ['pulse', 'race-command'] as const,
  seasonStrategy:   ['pulse', 'season-strategy'] as const,
  syncStatus:       ['pulse', 'sync-status'] as const,
  dataCoverage:     (scope: string) => ['pulse', 'data-coverage', scope] as const,
  garminCoverage:   (days: number) => ['pulse', 'garmin-coverage', days] as const,
  garminSignalUsefulness: (days: number) => ['pulse', 'garmin-signal-usefulness', days] as const,
  garminExecutionLedger: (workoutId: string | null) => ['pulse', 'garmin-execution-ledger', workoutId] as const,
  garminExecutionDiff: (days: number) => ['pulse', 'garmin-execution-diff', days] as const,
  pushSettings:     ['pulse', 'push', 'settings'] as const,
  strengthSessions: (days: number, exercise: string | null) =>
    ['pulse', 'strength', 'sessions', days, exercise] as const,
  equipment:        ['pulse', 'equipment'] as const,
  nutrition: (workoutId: string | null, activityId: string | null) =>
    ['pulse', 'nutrition', workoutId, activityId] as const,
  fuelingRecoveryGuidance: (workoutId: string | null) =>
    ['pulse', 'fueling-recovery', 'guidance', workoutId] as const,
  fuelingDebt: ['pulse', 'fueling-recovery', 'debt'] as const,
};

export function invalidatePulseContextQueries(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: pulseKeys.home });
  void qc.invalidateQueries({ queryKey: pulseKeys.readiness });
  void qc.invalidateQueries({ queryKey: pulseKeys.load });
  void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
}

function invalidatePulsePlanContextQueries(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: pulseKeys.plan });
  void qc.invalidateQueries({ queryKey: ['pulse', 'plan', 'refresh-preview'] });
  void qc.invalidateQueries({ queryKey: ['pulse', 'plan', 'trace'] });
  void qc.invalidateQueries({ queryKey: pulseKeys.adaptationEvents });
  void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
  void qc.invalidateQueries({ queryKey: pulseKeys.seasonStrategy });
  void qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
  void qc.invalidateQueries({ queryKey: ['pulse', 'outcomes', 'daily'] });
  void qc.invalidateQueries({ queryKey: ['pulse', 'decisions', 'quality'] });
  void qc.invalidateQueries({ queryKey: ['pulse', 'personal-response'] });
  void qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
  void qc.invalidateQueries({ queryKey: pulseKeys.home });
  void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePulseHome() {
  return useQuery({
    queryKey: pulseKeys.home,
    queryFn: pulseApi.home.get,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePulseActions(options: { includeHistory?: boolean } = {}) {
  return useQuery({
    queryKey: options.includeHistory ? [...pulseKeys.actions, 'history'] : pulseKeys.actions,
    queryFn: () => pulseApi.actions.list(options),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useDailyOutcomeLearning(days = 7) {
  return useQuery({
    queryKey: pulseKeys.dailyOutcomes(days),
    queryFn: () => pulseApi.outcomes.daily(days),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useDailyDelta(days = 7) {
  return useQuery({
    queryKey: pulseKeys.dailyDelta(days),
    queryFn: () => pulseApi.dailyDelta(days),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useDailyDecisionQuality(days = 14) {
  return useQuery({
    queryKey: pulseKeys.decisionQuality(days),
    queryFn: () => pulseApi.decisions.quality(days),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function usePersonalResponse(days = 42) {
  return useQuery({
    queryKey: pulseKeys.personalResponse(days),
    queryFn: () => pulseApi.personalResponse(days),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useGoalProjection(horizonDays = 180) {
  return useQuery({
    queryKey: pulseKeys.goalProjection(horizonDays),
    queryFn: () => pulseApi.goalProjection(horizonDays),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useUpdatePulseAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'completed' | 'deferred' | 'dismissed'; reason?: string }) =>
      pulseApi.actions.update(id, { status, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.actions });
      void qc.invalidateQueries({ queryKey: ['pulse', 'outcomes', 'daily'] });
      void qc.invalidateQueries({ queryKey: ['pulse', 'decisions', 'quality'] });
      void qc.invalidateQueries({ queryKey: ['pulse', 'personal-response'] });
      void qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useCoachPreferences() {
  return useQuery({
    queryKey: pulseKeys.coachPreferences,
    queryFn: pulseApi.coachPreferences.get,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCoachPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.coachPreferences.update,
    onSuccess: (data) => {
      qc.setQueryData(pulseKeys.coachPreferences, data);
      void qc.invalidateQueries({ queryKey: pulseKeys.coachHistory });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: pulseKeys.readiness,
    queryFn: pulseApi.readiness,
    staleTime: 5 * 60_000,
  });
}

export function useFitnessLoad() {
  return useQuery({
    queryKey: pulseKeys.load,
    queryFn: pulseApi.fitnessLoad,
    staleTime: 10 * 60_000,
  });
}

export function usePulseSleep(limit = 7) {
  return useQuery({
    queryKey: pulseKeys.sleep(limit),
    queryFn: () => pulseApi.sleep.list(limit),
    staleTime: 5 * 60_000,
  });
}

export function usePulseActivities(limit = 10) {
  return useQuery({
    queryKey: pulseKeys.activities(limit),
    queryFn: () => pulseApi.activities.list(limit),
    staleTime: 5 * 60_000,
  });
}

export function useFuelingRecoveryGuidance(workoutId: string | null | undefined) {
  return useQuery({
    queryKey: pulseKeys.fuelingRecoveryGuidance(workoutId ?? null),
    queryFn: () => pulseApi.fuelingRecovery.guidance(workoutId!),
    enabled: Boolean(workoutId),
    staleTime: 10 * 60_000,
  });
}

export function useFuelingDebt() {
  return useQuery({
    queryKey: pulseKeys.fuelingDebt,
    queryFn: pulseApi.fuelingRecovery.debt,
    staleTime: 2 * 60_000,
  });
}

export function useRiskSignals() {
  return useQuery({
    queryKey: pulseKeys.risk,
    queryFn: pulseApi.risk.list,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useSnoozeRiskSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hours = 24 }: { id: string; hours?: number }) => pulseApi.risk.snooze(id, hours),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.risk });
      void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useResolveRiskSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.risk.resolve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.risk });
      void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useActivityFeedback(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof pulseApi.activities.updateFeedback>[1]) =>
      pulseApi.activities.updateFeedback(activityId, data),
    onSuccess: (data) => {
      qc.setQueryData<{ activity: typeof data.activity & { equipmentIds?: string[] } }>(
        pulseKeys.activityDetail(activityId),
        (current) => current
          ? { ...current, activity: { ...data.activity, equipmentIds: current.activity.equipmentIds ?? [] } }
          : current,
      );
      qc.invalidateQueries({ queryKey: ['pulse', 'activities'] });
      qc.invalidateQueries({ queryKey: pulseKeys.home });
      qc.invalidateQueries({ queryKey: pulseKeys.briefing });
      qc.invalidateQueries({ queryKey: pulseKeys.adaptationEvents });
    },
  });
}

export function useAssignActivityEquipment(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (equipmentIds: string[]) => pulseApi.activities.assignEquipment(activityId, equipmentIds),
    onSuccess: (data) => {
      qc.setQueryData<{ activity: { equipmentIds: string[] } }>(
        pulseKeys.activityDetail(activityId),
        (current) => current ? { ...current, activity: { ...current.activity, equipmentIds: data.equipmentIds } } : current,
      );
      void qc.invalidateQueries({ queryKey: pulseKeys.equipment });
      void qc.invalidateQueries({ queryKey: pulseKeys.home });
      void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function usePulsePlan() {
  return useQuery({
    queryKey: pulseKeys.plan,
    queryFn: pulseApi.plan.list,
    staleTime: 30 * 60_000,
  });
}

export function usePlanTrace(weekStart: string) {
  return useQuery({
    queryKey: pulseKeys.planTrace(weekStart),
    queryFn: () => pulseApi.plan.trace(weekStart),
    staleTime: 30 * 60_000,
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(weekStart),
  });
}

export function usePlanRefreshPreview(weekStart: string) {
  return useQuery({
    queryKey: pulseKeys.planRefreshPreview(weekStart),
    queryFn: () => pulseApi.plan.refreshPreview(weekStart),
    staleTime: 30_000,
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(weekStart),
  });
}

export function useAdaptationEvents() {
  return useQuery({
    queryKey: pulseKeys.adaptationEvents,
    queryFn: pulseApi.plan.adaptationEvents,
    staleTime: 30_000,
  });
}

export function usePulseGoals() {
  return useQuery({
    queryKey: pulseKeys.goals,
    queryFn: pulseApi.goals.list,
    staleTime: 10 * 60_000,
  });
}

export function useWeekAvailability() {
  return useQuery({
    queryKey: pulseKeys.availability,
    queryFn: pulseApi.availability.list,
    staleTime: 60_000,
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekStart, data }: { weekStart: string; data: { availableDays: number[]; weeklyHours: number; notes?: string } }) =>
      pulseApi.availability.save(weekStart, data),
    onSuccess: (data) => {
      if (data.planTrace) {
        qc.setQueryData(pulseKeys.planTrace(data.planTrace.weekStart), { trace: data.planTrace });
      }
      qc.invalidateQueries({ queryKey: pulseKeys.availability });
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function usePulseReview() {
  return useQuery({
    queryKey: pulseKeys.review,
    queryFn: pulseApi.review.latest,
    staleTime: 60 * 60_000,
  });
}

export function useCheckinToday() {
  return useQuery({
    queryKey: pulseKeys.checkinToday,
    queryFn: pulseApi.checkin.today,
    staleTime: 60_000,
  });
}

export function useCheckinGuidance() {
  return useQuery({
    queryKey: pulseKeys.checkinGuidance,
    queryFn: pulseApi.checkin.guidance,
    staleTime: 60_000,
  });
}

export function useCheckinHistory(days = 30) {
  return useQuery({
    queryKey: pulseKeys.checkinHistory(days),
    queryFn: () => pulseApi.checkin.history(days),
    staleTime: 10 * 60_000,
  });
}

export function useMentalThemes(days = 90) {
  return useQuery({
    queryKey: pulseKeys.mentalThemes(days),
    queryFn: () => pulseApi.checkin.themes(days),
    staleTime: 10 * 60_000,
  });
}

export function useMentalLoadOverlay(days = 56) {
  return useQuery({
    queryKey: pulseKeys.mentalLoadOverlay(days),
    queryFn: () => pulseApi.checkin.loadOverlay(days),
    staleTime: 15 * 60_000,
  });
}

export function useResilienceRadar(days = 14) {
  return useQuery({
    queryKey: pulseKeys.resilienceRadar(days),
    queryFn: () => pulseApi.checkin.resilienceRadar(days),
    staleTime: 5 * 60_000,
  });
}

export function useCoachSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => pulseApi.coach.send(message),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pulseKeys.coachHistory }),
  });
}

export function useCoachHistory() {
  return useQuery({
    queryKey: pulseKeys.coachHistory,
    queryFn: pulseApi.coach.history,
    staleTime: 30_000,
  });
}

export function useClearCoachHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.coach.deleteHistory,
    onSuccess: () => void qc.invalidateQueries({ queryKey: pulseKeys.coachHistory }),
  });
}

export function usePulseCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.checkin.submit,
    onSuccess: () => {
      invalidatePulseContextQueries(qc);
      qc.invalidateQueries({ queryKey: pulseKeys.checkinToday });
      qc.invalidateQueries({ queryKey: pulseKeys.checkinGuidance });
      qc.invalidateQueries({ queryKey: ['pulse', 'outcomes', 'daily'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'decisions', 'quality'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'personal-response'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      qc.invalidateQueries({ queryKey: pulseKeys.actions });
      qc.invalidateQueries({ queryKey: ['pulse', 'checkin', 'history'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'mental', 'themes'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'mental', 'load-overlay'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'mental', 'resilience-radar'] });
      qc.invalidateQueries({ queryKey: pulseKeys.adaptationEvents });
    },
  });
}

export function usePulseCheckinTextPreview() {
  return useMutation({
    mutationFn: pulseApi.checkin.text,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.goals.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.goals });
      void qc.invalidateQueries({ queryKey: pulseKeys.races });
      void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      void qc.invalidateQueries({ queryKey: pulseKeys.seasonStrategy });
      void qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      void qc.invalidateQueries({ queryKey: pulseKeys.home });
      void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof pulseApi.goals.update>[1] }) =>
      pulseApi.goals.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.goals });
      void qc.invalidateQueries({ queryKey: pulseKeys.races });
      void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      void qc.invalidateQueries({ queryKey: pulseKeys.seasonStrategy });
      void qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      void qc.invalidateQueries({ queryKey: pulseKeys.home });
      void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.goals.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.goals });
      void qc.invalidateQueries({ queryKey: pulseKeys.races });
      void qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      void qc.invalidateQueries({ queryKey: pulseKeys.seasonStrategy });
      void qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      void qc.invalidateQueries({ queryKey: pulseKeys.home });
      void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useGarminSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.garmin.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pulse'] }),
  });
}

export function useGarminStatus() {
  return useQuery({
    queryKey: pulseKeys.syncStatus,
    queryFn: pulseApi.garmin.status,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useDataCoverage(params: { days?: number; year?: number } = { days: 30 }) {
  const scope = params.year != null ? `year-${params.year}` : `days-${params.days ?? 30}`;
  return useQuery({
    queryKey: pulseKeys.dataCoverage(scope),
    queryFn: () => pulseApi.garmin.coverage(params),
    staleTime: 5 * 60_000,
  });
}

export function useGarminCoverage(days = 30) {
  return useQuery({
    queryKey: pulseKeys.garminCoverage(days),
    queryFn: () => pulseApi.garmin.domainCoverage(days),
    staleTime: 5 * 60_000,
  });
}

export function useGarminSignalUsefulness(days = 30) {
  return useQuery({
    queryKey: pulseKeys.garminSignalUsefulness(days),
    queryFn: () => pulseApi.garmin.signalUsefulness(days),
    staleTime: 5 * 60_000,
  });
}

export function useGarminBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.garmin.backfill,
    onSuccess: (_data, variables) => {
      if (!variables.dryRun) {
        void qc.invalidateQueries({ queryKey: pulseKeys.all });
        void qc.invalidateQueries({ queryKey: ['pulse', 'garmin-signal-usefulness'] });
      }
    },
  });
}

export function useGarminCalendarSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.garmin.calendarSync,
    onSuccess: () => {
      invalidatePulsePlanContextQueries(qc);
      void qc.invalidateQueries({ queryKey: ['pulse', 'garmin-coverage'] });
      void qc.invalidateQueries({ queryKey: ['pulse', 'garmin-execution-diff'] });
    },
  });
}

export function useGarminExecutionDiff(days = 15) {
  return useQuery({
    queryKey: pulseKeys.garminExecutionDiff(days),
    queryFn: () => pulseApi.garmin.executionDiff(days),
    staleTime: 30_000,
  });
}

export function useSyncWorkoutToGarmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: string) => pulseApi.plan.syncGarmin(workoutId),
    onSuccess: (_data, workoutId) => {
      invalidatePulsePlanContextQueries(qc);
      void qc.invalidateQueries({ queryKey: pulseKeys.garminExecutionLedger(workoutId) });
      void qc.invalidateQueries({ queryKey: ['pulse', 'garmin-execution-diff'] });
    },
  });
}

export function useGarminExecutionLedger(workoutId: string | null | undefined) {
  return useQuery({
    queryKey: pulseKeys.garminExecutionLedger(workoutId ?? null),
    queryFn: () => pulseApi.garmin.executionLedger(workoutId!),
    enabled: Boolean(workoutId),
    staleTime: 30_000,
  });
}

export function usePushSettings() {
  return useQuery({
    queryKey: pulseKeys.pushSettings,
    queryFn: pulseApi.push.settings,
    staleTime: 30_000,
  });
}

export function usePushSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.push.subscribe,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.pushSettings });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function usePushUnsubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.push.unsubscribe,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.pushSettings });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useUpdatePushTopics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.push.updateTopics,
    onSuccess: () => void qc.invalidateQueries({ queryKey: pulseKeys.pushSettings }),
  });
}

export function useUpdatePushQuietHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.push.updateQuietHours,
    onSuccess: () => void qc.invalidateQueries({ queryKey: pulseKeys.pushSettings }),
  });
}

export function useSendTestPush() {
  return useMutation({
    mutationFn: pulseApi.push.test,
  });
}

export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.review.generate,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.review }),
  });
}

export function useUpdateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof pulseApi.plan.updateWorkout>[1] }) =>
      pulseApi.plan.updateWorkout(id, data),
    onSuccess: () => invalidatePulsePlanContextQueries(qc),
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlanWorkoutInput) => pulseApi.plan.createWorkout(data),
    onSuccess: () => invalidatePulsePlanContextQueries(qc),
  });
}

export function usePlanScenarioPreview() {
  return useMutation({
    mutationFn: pulseApi.plan.previewScenario,
  });
}

export function useStrengthSessions(days = 90, exercise: string | null = null) {
  return useQuery({
    queryKey: pulseKeys.strengthSessions(days, exercise),
    queryFn: () => pulseApi.strength.list(days, exercise ?? undefined),
    staleTime: 5 * 60_000,
  });
}

export function useCreateStrengthSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StrengthSessionInput) => pulseApi.strength.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pulse', 'strength', 'sessions'] });
      void qc.invalidateQueries({ queryKey: pulseKeys.trainingAnalytics(12) });
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function useUpdateStrengthSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StrengthSessionInput> }) =>
      pulseApi.strength.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pulse', 'strength', 'sessions'] });
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function useDeleteStrengthSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.strength.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pulse', 'strength', 'sessions'] });
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function useEquipment(includeRetired = false) {
  return useQuery({
    queryKey: includeRetired ? [...pulseKeys.equipment, 'retired'] as const : pulseKeys.equipment,
    queryFn: () => pulseApi.equipment.list(includeRetired),
    staleTime: 60_000,
  });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EquipmentInput) => pulseApi.equipment.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.equipment });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EquipmentInput> }) =>
      pulseApi.equipment.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.equipment });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useRetireEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, retirementDate }: { id: string; retirementDate?: string }) =>
      pulseApi.equipment.retire(id, retirementDate),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.equipment });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useSetEquipmentDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activityType, equipmentId }: { activityType: PulseActivityType; equipmentId: string }) =>
      pulseApi.equipment.setDefault(activityType, equipmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.equipment });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.plan.generate,
    onSuccess: (data) => {
      if (data.planTrace) {
        qc.setQueryData(pulseKeys.planTrace(data.planTrace.weekStart), { trace: data.planTrace });
      }
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function usePulseMetrics(days = 14) {
  return useQuery({
    queryKey: pulseKeys.metrics(days),
    queryFn: () => pulseApi.metrics.list(days),
    staleTime: 5 * 60_000,
  });
}

export function usePulseWeight(days = 90) {
  return useQuery({
    queryKey: pulseKeys.weight(days),
    queryFn: () => pulseApi.weight.list(days),
    staleTime: 5 * 60_000,
  });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.weight.log,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pulse', 'weight'] });
      void qc.invalidateQueries({ queryKey: pulseKeys.home });
      void qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function usePulseProfile() {
  return useQuery({
    queryKey: pulseKeys.profile,
    queryFn: pulseApi.profile.get,
    staleTime: 10 * 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.profile.update,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pulseKeys.profile });
      invalidatePulseContextQueries(qc);
    },
  });
}

export function usePulseBriefing() {
  return useQuery({
    queryKey: pulseKeys.briefing,
    queryFn: pulseApi.briefing.get,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useTrainingAnalytics(weeks = 12) {
  return useQuery({
    queryKey: pulseKeys.trainingAnalytics(weeks),
    queryFn: () => pulseApi.trainingAnalytics.get(weeks),
    staleTime: 15 * 60_000,
  });
}

export function useTrainingCapabilities(days = 90) {
  return useQuery({
    queryKey: pulseKeys.trainingCapabilities(days),
    queryFn: () => pulseApi.trainingCapabilities.get(days),
    staleTime: 15 * 60_000,
  });
}

export function useCorrelations(days = 30) {
  return useQuery({
    queryKey: pulseKeys.correlations(days),
    queryFn: () => pulseApi.correlations.get(days),
    staleTime: 15 * 60_000,
  });
}

export function useDeepInsight(domain: string, days = 30, enabled = true) {
  return useQuery({
    queryKey: pulseKeys.insight(domain, days),
    queryFn: () => pulseApi.insights.get(domain, days),
    staleTime: 60 * 60_000,
    retry: false,
    enabled: !!domain && enabled,
  });
}

export function useRefreshInsight(domain: string, days = 30) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pulseApi.insights.get(domain, days, true),
    onSuccess: (data) => qc.setQueryData(pulseKeys.insight(domain, days), data),
  });
}

// ─── Phase 6: Health States & Today-Adjust ───────────────────────────────────

export function useHealthStates() {
  return useQuery({
    queryKey: pulseKeys.healthState,
    queryFn: pulseApi.healthState.list,
    staleTime: 60_000,
  });
}

export function useCreateHealthState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.healthState.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pulseKeys.healthState });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      qc.invalidateQueries({ queryKey: pulseKeys.todayProposal });
      qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      qc.invalidateQueries({ queryKey: pulseKeys.home });
      qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useResolveHealthState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.healthState.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pulseKeys.healthState });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      qc.invalidateQueries({ queryKey: pulseKeys.todayProposal });
      qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      qc.invalidateQueries({ queryKey: pulseKeys.home });
      qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useDeleteHealthState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.healthState.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pulseKeys.healthState });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      qc.invalidateQueries({ queryKey: pulseKeys.todayProposal });
      qc.invalidateQueries({ queryKey: pulseKeys.raceCommand });
      qc.invalidateQueries({ queryKey: pulseKeys.home });
      qc.invalidateQueries({ queryKey: pulseKeys.briefing });
    },
  });
}

export function useTodayProposal() {
  return useQuery({
    queryKey: pulseKeys.todayProposal,
    queryFn: pulseApi.todayAdjust.proposal,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useTodayOptions() {
  return useQuery({
    queryKey: pulseKeys.todayOptions,
    queryFn: pulseApi.todayOptions.get,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useAcceptTodayAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: string) => pulseApi.todayAdjust.accept(workoutId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pulseKeys.todayProposal });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      invalidatePulsePlanContextQueries(qc);
    },
  });
}

export function useRaces() {
  return useQuery({
    queryKey: pulseKeys.races,
    queryFn: pulseApi.races.list,
    staleTime: 10 * 60_000,
  });
}

export function useRaceCommand() {
  return useQuery({
    queryKey: pulseKeys.raceCommand,
    queryFn: pulseApi.raceCommand.get,
    staleTime: 5 * 60_000,
  });
}

export function useSeasonStrategy() {
  return useQuery({
    queryKey: pulseKeys.seasonStrategy,
    queryFn: pulseApi.seasonStrategy.get,
    staleTime: 10 * 60_000,
  });
}

// ─── Phase 9: Nutrition hooks ────────────────────────────────────────────────

export function useNutritionLogs(workoutId: string | null, activityId: string | null) {
  return useQuery({
    queryKey: pulseKeys.nutrition(workoutId, activityId),
    queryFn: () => pulseApi.nutrition.list(
      workoutId ?? undefined,
      activityId ?? undefined,
    ),
    staleTime: 2 * 60_000,
    enabled: !!(workoutId || activityId),
  });
}

export function useCreateNutritionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NutritionLogInput) => pulseApi.nutrition.create(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pulse', 'nutrition'] });
      qc.invalidateQueries({ queryKey: pulseKeys.fuelingDebt });
      qc.invalidateQueries({ queryKey: ['pulse', 'personal-response'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      if (variables.workoutId) {
        qc.invalidateQueries({ queryKey: pulseKeys.home });
        qc.invalidateQueries({ queryKey: pulseKeys.plan });
      }
      if (variables.activityId) {
        qc.invalidateQueries({ queryKey: pulseKeys.home });
        qc.invalidateQueries({ queryKey: pulseKeys.plan });
      }
      qc.invalidateQueries({ queryKey: pulseKeys.adaptationEvents });
    },
  });
}

export function useDeleteNutritionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.nutrition.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pulse', 'nutrition'] });
      qc.invalidateQueries({ queryKey: pulseKeys.fuelingDebt });
      qc.invalidateQueries({ queryKey: ['pulse', 'personal-response'] });
      qc.invalidateQueries({ queryKey: ['pulse', 'goal-projection'] });
      qc.invalidateQueries({ queryKey: pulseKeys.todayOptions });
      qc.invalidateQueries({ queryKey: pulseKeys.home });
      qc.invalidateQueries({ queryKey: pulseKeys.plan });
      qc.invalidateQueries({ queryKey: pulseKeys.adaptationEvents });
    },
  });
}
