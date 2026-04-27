import type {
  PulseHomeScreenData, PulseSleepSession, PulseActivity,
  PulsePlannedWorkout, PulseMentalCheckin, PulseGoal,
  PulseWeeklyReview, PulseWeightEntry,
} from '@coaching-os/shared/pulse';

const BASE = '/api/pulse';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('coaching-os-auth');
    if (!stored) return null;
    return (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Fehler' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const pulseApi = {
  home: {
    get: (): Promise<PulseHomeScreenData> =>
      request('/home'),
  },

  coach: {
    send: (message: string): Promise<{ reply: string }> =>
      request('/coach', { method: 'POST', body: JSON.stringify({ message }) }),
  },

  checkin: {
    submit: (data: {
      mood: number; energy: number; stress: number; motivation: number; notes?: string;
    }): Promise<PulseMentalCheckin> =>
      request('/checkin', { method: 'POST', body: JSON.stringify(data) }),
    voice: (audio: string, mimeType: string): Promise<{
      transcript: string; reply: string; isCheckin: boolean; followUpQuestions: string[]; checkinId: string | null;
      extraction: { mood: number; energy: number; stress: number; motivation: number; themes: string[] } | null;
    }> =>
      request('/checkin/voice', { method: 'POST', body: JSON.stringify({ audio, mimeType }) }),
    today: (): Promise<{ checkin: { id: string; date: string } | null }> =>
      request('/checkin/today'),
  },

  sleep: {
    list: (limit = 7): Promise<{ sessions: PulseSleepSession[] }> =>
      request(`/sleep?limit=${limit}`),
  },

  activities: {
    list: (limit = 10): Promise<{ activities: PulseActivity[] }> =>
      request(`/activities?limit=${limit}`),
    detail: (id: string): Promise<{
      activity: PulseActivity & { externalId: string | null };
      laps: Array<{
        index: number; distanceM: number | null; durationSec: number | null;
        avgHr: number | null; maxHr: number | null; avgPowerW: number | null;
        avgSpeedMs: number | null; elevationGainM: number | null;
      }>;
      hrZones: Array<{ zone: number; secsInZone: number; zoneLowBoundary: number }>;
    }> =>
      request(`/activities/${id}`),
  },

  plan: {
    list: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan'),
    generate: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan/generate', { method: 'POST' }),
  },

  goals: {
    list: (): Promise<{ goals: PulseGoal[] }> =>
      request('/goals'),
    create: (data: { title: string; description?: string; targetDate?: string }): Promise<PulseGoal> =>
      request('/goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ status: string; progress: number }>): Promise<PulseGoal> =>
      request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  review: {
    latest: (): Promise<PulseWeeklyReview | null> =>
      request('/review/latest'),
    generate: (): Promise<PulseWeeklyReview> =>
      request('/review/generate', { method: 'POST' }),
  },

  garmin: {
    sync: (): Promise<{ status: string }> =>
      request('/garmin/sync', { method: 'POST' }),
    backfillWeight: (days = 90): Promise<{ synced: number; errors: string[] }> =>
      request('/garmin/backfill-weight', { method: 'POST', body: JSON.stringify({ days }) }),
    syncProfile: (): Promise<{ synced: { vo2max: number | null; maxHrBpm: number | null; lactateThresholdHr: number | null } }> =>
      request('/garmin/sync-profile', { method: 'POST' }),
  },

  profile: {
    get: (): Promise<{
      userId: string; ftpWatts: number | null; maxHrBpm: number | null;
      restingHrBpm: number | null; weeklyHoursTarget: number | null;
      trainingPhase: string | null; vo2max: number | null;
    }> => request('/profile'),
    update: (data: {
      ftpWatts?: number; maxHrBpm?: number; restingHrBpm?: number;
      weeklyHoursTarget?: number; trainingPhase?: string; vo2max?: number;
    }): Promise<unknown> => request('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  metrics: {
    list: (days = 14): Promise<{ metrics: Array<{
      date: string; hrvRmssd: number | null; restingHr: number | null;
      sleepHours: number | null; sleepScore: number | null;
      bodyBatteryMax: number | null; stressAvg: number | null; steps: number | null;
    }> }> =>
      request(`/metrics?days=${days}`),
  },

  weight: {
    list: (days = 90): Promise<{ entries: PulseWeightEntry[] }> =>
      request(`/weight?days=${days}`),
    log: (data: { weightKg: number; date?: string; notes?: string }): Promise<PulseWeightEntry> =>
      request('/weight', { method: 'POST', body: JSON.stringify(data) }),
  },
};
