import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pulseApi } from './api-client.js';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const pulseKeys = {
  home:         ['pulse', 'home'] as const,
  sleep:        (limit: number) => ['pulse', 'sleep', limit] as const,
  activities:   (limit: number) => ['pulse', 'activities', limit] as const,
  plan:         ['pulse', 'plan'] as const,
  availability: ['pulse', 'availability'] as const,
  goals:        ['pulse', 'goals'] as const,
  review:       ['pulse', 'review', 'latest'] as const,
  checkinToday:    ['pulse', 'checkin', 'today'] as const,
  checkinHistory:  (days: number) => ['pulse', 'checkin', 'history', days] as const,
  metrics:      (days: number) => ['pulse', 'metrics', days] as const,
  weight:       (days: number) => ['pulse', 'weight', days] as const,
  profile:      ['pulse', 'profile'] as const,
  briefing:     ['pulse', 'briefing'] as const,
  insight:      (domain: string, days: number) => ['pulse', 'insight', domain, days] as const,
  correlations:      (days: number)  => ['pulse', 'correlations', days] as const,
  trainingAnalytics: (weeks: number) => ['pulse', 'training-analytics', weeks] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePulseHome() {
  return useQuery({
    queryKey: pulseKeys.home,
    queryFn: pulseApi.home.get,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
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

export function usePulsePlan() {
  return useQuery({
    queryKey: pulseKeys.plan,
    queryFn: pulseApi.plan.list,
    staleTime: 30 * 60_000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pulseKeys.availability });
      qc.invalidateQueries({ queryKey: pulseKeys.plan });
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

export function useCheckinHistory(days = 30) {
  return useQuery({
    queryKey: pulseKeys.checkinHistory(days),
    queryFn: () => pulseApi.checkin.history(days),
    staleTime: 10 * 60_000,
  });
}

export function useCoachSend() {
  return useMutation({
    mutationFn: (message: string) => pulseApi.coach.send(message),
  });
}

export function usePulseCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.checkin.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.home }),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.goals.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.goals }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof pulseApi.goals.update>[1] }) =>
      pulseApi.goals.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.goals }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pulseApi.goals.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.goals }),
  });
}

export function useGarminSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.garmin.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pulse'] }),
  });
}

export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.review.generate,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.review }),
  });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.plan.generate,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.plan }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pulse', 'weight'] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: pulseKeys.profile }),
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

export function useCorrelations(days = 30) {
  return useQuery({
    queryKey: pulseKeys.correlations(days),
    queryFn: () => pulseApi.correlations.get(days),
    staleTime: 15 * 60_000,
  });
}

export function useDeepInsight(domain: string, days = 30) {
  return useQuery({
    queryKey: pulseKeys.insight(domain, days),
    queryFn: () => pulseApi.insights.get(domain, days),
    staleTime: 60 * 60_000,
    retry: false,
    enabled: !!domain,
  });
}

export function useRefreshInsight(domain: string, days = 30) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pulseApi.insights.get(domain, days, true),
    onSuccess: (data) => qc.setQueryData(pulseKeys.insight(domain, days), data),
  });
}
