import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pulseApi } from './api-client.js';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const pulseKeys = {
  home:       ['pulse', 'home'] as const,
  sleep:      (limit: number) => ['pulse', 'sleep', limit] as const,
  activities: (limit: number) => ['pulse', 'activities', limit] as const,
  plan:       ['pulse', 'plan'] as const,
  goals:      ['pulse', 'goals'] as const,
  review:     ['pulse', 'review', 'latest'] as const,
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

export function usePulseReview() {
  return useQuery({
    queryKey: pulseKeys.review,
    queryFn: pulseApi.review.latest,
    staleTime: 60 * 60_000,
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
