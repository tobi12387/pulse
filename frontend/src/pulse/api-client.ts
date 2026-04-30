import type {
  PulseHomeScreenData, PulseSleepSession, PulseActivity,
  PulsePlannedWorkout, PulseMentalCheckin, PulseGoal,
  PulseWeeklyReview, PulseWeightEntry, WeekAvailability, GoalCategory,
  RaceDiscipline, RacePriority,
  PulseDataStatus, PulseFitnessLoad, PulseReadiness,
  ActivityFeedbackInput, PulseRiskSignal,
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

async function requestAt<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Fehler' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestAt(BASE, path, options);
}

export const pulseApi = {
  home: {
    get: (): Promise<PulseHomeScreenData> =>
      request('/home'),
  },

  readiness: (): Promise<PulseReadiness & { date: string; cached: boolean }> =>
    request('/readiness'),

  fitnessLoad: (): Promise<PulseFitnessLoad & { cached: boolean }> =>
    request('/load'),

  nutrition: {
    list: (workoutId?: string, activityId?: string, days = 14): Promise<{ logs: NutritionLog[] }> =>
      request(`/nutrition?${workoutId ? `workoutId=${workoutId}&` : ''}${activityId ? `activityId=${activityId}&` : ''}days=${days}`),
    create: (data: NutritionLogInput): Promise<NutritionLog> =>
      request('/nutrition', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      request(`/nutrition/${id}`, { method: 'DELETE' }),
  },

  coach: {
    send: (message: string): Promise<{ reply: string }> =>
      request('/coach', { method: 'POST', body: JSON.stringify({ message }) }),
  },

  risk: {
    list: (): Promise<{ signals: PulseRiskSignal[] }> =>
      request('/risk'),
    snooze: (id: string, hours = 24): Promise<{ ok: boolean; snoozedUntil: string }> =>
      request(`/risk/${id}/snooze`, { method: 'POST', body: JSON.stringify({ hours }) }),
    resolve: (id: string): Promise<{ ok: boolean }> =>
      request(`/risk/${id}/resolve`, { method: 'POST', body: '{}' }),
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
    history: (days = 30): Promise<{ checkins: Array<{
      id: string; date: string; mood: number; energy: number; stress: number; motivation: number;
    }> }> =>
      request(`/checkin/history?days=${days}`),
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
      analytics: ActivityAnalytics | null;
    }> =>
      request(`/activities/${id}`),
    updateFeedback: (id: string, data: ActivityFeedbackInput): Promise<{ activity: PulseActivity & { externalId: string | null } }> =>
      request(`/activities/${id}/feedback`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  plan: {
    list: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan'),
    generate: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan/generate', { method: 'POST', body: '{}' }),
    getWorkout: (id: string): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}`),
    updateWorkout: (id: string, data: { activityType?: string; zone?: number; durationMin?: number }): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    generateDetail: (id: string): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}/detail`, { method: 'POST', body: '{}' }),
    syncGarmin: (id: string): Promise<{ garminWorkoutId: string; date: string }> =>
      request(`/plan/workout/${id}/sync-garmin`, { method: 'POST', body: '{}' }),
  },

  availability: {
    list: (): Promise<{ weeks: WeekAvailability[] }> =>
      request('/plan/availability'),
    save: (weekStart: string, data: { availableDays: number[]; weeklyHours: number; notes?: string }): Promise<{ ok: boolean; workouts?: PulsePlannedWorkout[] }> =>
      request(`/plan/availability/${weekStart}`, { method: 'PUT', body: JSON.stringify({ ...data, regenerate: true }) }),
  },

  goals: {
    list: (): Promise<{ goals: PulseGoal[] }> =>
      request('/goals'),
    create: (data: {
      title: string; description?: string; targetDate?: string;
      category?: GoalCategory; metrics?: Record<string, unknown>;
      raceDiscipline?: RaceDiscipline; raceDistanceKm?: number;
      raceTargetTimeSec?: number; racePriority?: RacePriority;
      raceLocation?: string; raceNotes?: string;
    }): Promise<PulseGoal> =>
      request('/goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{
      status: string; progress: number; title: string;
      description: string | null; targetDate: string | null;
      category: string | null; metrics: Record<string, unknown>;
      raceDiscipline: RaceDiscipline | null; raceDistanceKm: number | null;
      raceTargetTimeSec: number | null; racePriority: RacePriority | null;
      raceLocation: string | null; raceNotes: string | null;
    }>): Promise<PulseGoal> =>
      request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      request(`/goals/${id}`, { method: 'DELETE' }),
  },

  races: {
    list: (): Promise<{ races: RaceContext[] }> =>
      request('/races'),
  },

  review: {
    latest: (): Promise<PulseWeeklyReview | null> =>
      request('/review/latest'),
    generate: (): Promise<PulseWeeklyReview> =>
      request('/review/generate', { method: 'POST', body: '{}' }),
  },

  garmin: {
    status: (): Promise<PulseDataStatus> =>
      request('/sync/status'),
    sync: (): Promise<{ status: string; days?: number; dates?: string[]; activities?: number }> =>
      request('/garmin/sync', { method: 'POST', body: '{}' }),
    syncProfile: (): Promise<{ synced: { vo2max: number | null; maxHrBpm: number | null; lactateThresholdHr: number | null; ftpWatts: number | null } }> =>
      request('/garmin/sync-profile', { method: 'POST', body: '{}' }),
    calendarSync: (): Promise<{ uploaded: number; removed: number; errors?: string[] }> =>
      request('/garmin/calendar/sync', { method: 'POST', body: '{}' }),
  },

  briefing: {
    get: (): Promise<{ briefing: string; date: string; cached: boolean }> =>
      request('/briefing'),
  },

  trainingAnalytics: {
    get: (weeks = 12): Promise<{
      weeks: number;
      tssHeatmap: Array<{ date: string; tss: number }>;
      zoneDistribution: Array<{
        weekStart: string; totalH: number;
        zones: { z1: number; z2: number; z3: number; z4: number; z5: number };
      }>;
      vo2maxTrend: Array<{ date: string; vo2max: number }>;
      rpeByZone: {
        totalRated: number;
        zones: Array<{ zone: number; avgRpe: number | null; count: number; previousAvgRpe: number | null; drift: number | null }>;
      };
    }> =>
      request(`/training-analytics?weeks=${weeks}`),
  },

  correlations: {
    get: (days = 30): Promise<{ correlations: Array<{
      id: string; labelX: string; labelY: string; r: number; n: number;
      points: Array<{ date: string; x: number; y: number }>;
    }> }> =>
      request(`/correlations?days=${days}`),
  },

  insights: {
    get: (domain: string, days = 30, refresh = false): Promise<{
      domain: string; analysis: string; stats: Record<string, number | string | null>;
      date: string; cached: boolean;
    }> => request(`/insights?domain=${domain}&days=${days}&refresh=${refresh}`),
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

  healthState: {
    list: (): Promise<{ active: HealthState[]; recent: HealthState[] }> =>
      request('/health-state'),
    create: (data: {
      type: 'illness'|'injury'|'fatigue'|'travel';
      severity: 'mild'|'moderate'|'severe';
      bodyPart?: string;
      notes?: string;
      durationDays: number;
      startDate?: string;
    }): Promise<HealthState> =>
      request('/health-state', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { severity?: 'mild'|'moderate'|'severe'; notes?: string|null; endDate?: string|null }): Promise<HealthState> =>
      request(`/health-state/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resolve: (id: string): Promise<HealthState> =>
      request(`/health-state/${id}/resolve`, { method: 'POST', body: '{}' }),
    delete: (id: string): Promise<void> =>
      request(`/health-state/${id}`, { method: 'DELETE' }),
  },

  todayAdjust: {
    proposal: (): Promise<{ proposal: AdjustProposal | null }> =>
      request('/plan/today/proposal'),
    accept: (workoutId: string): Promise<{ ok: boolean; workout: unknown; proposal: AdjustProposal }> =>
      request('/plan/today/accept', { method: 'POST', body: JSON.stringify({ workoutId }) }),
  },
};

// ─── Phase 9: Nutrition types ────────────────────────────────────────────────
export interface NutritionLog {
  id: string; userId: string; date: string;
  workoutId: string | null; activityId: string | null;
  context: 'pre' | 'during' | 'post' | 'daily' | null;
  mealType: string | null; description: string | null;
  calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
  gelsCount: number | null; drinksMl: number | null; sodiumMg: number | null;
  notes: string | null; createdAt: string;
}
export interface NutritionLogInput {
  date?: string; workoutId?: string; activityId?: string;
  context?: 'pre' | 'during' | 'post' | 'daily';
  carbsG?: number; gelsCount?: number; drinksMl?: number; sodiumMg?: number;
  calories?: number; proteinG?: number; fatG?: number;
  description?: string; notes?: string;
}

// ─── Phase 6 types ───────────────────────────────────────────────────────────
export interface HealthState {
  id: string;
  userId: string;
  type: 'illness' | 'injury' | 'fatigue' | 'travel';
  severity: 'mild' | 'moderate' | 'severe';
  bodyPart: string | null;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AdjustProposal {
  workoutId: string;
  date: string;
  original: { activityType: string; zone: number; durationMin: number };
  proposed: { activityType: string; zone: number; durationMin: number; description: string };
  reason: 'low_readiness' | 'illness' | 'injury' | 'fatigue' | 'travel';
  rationale: string;
  readinessScore: number;
}

// ─── Activity Analytics ──────────────────────────────────────────────────────
export interface ActivityAnalytics {
  ef: { ef: number; unit: 'sec/km/bpm' | 'W/bpm' } | null;
  decoupling: {
    firstHalfRatio: number;
    secondHalfRatio: number;
    decouplingPct: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
  } | null;
  hrDriftBpm: number | null;
  weather: {
    tempC: number;
    feelsC: number;
    humidityPct: number;
    windKmh: number;
    windDir: number;
    conditions: string;
    precipMm: number;
  } | null;
  comparable: {
    countLast30d: number;
    avgEf: number | null;
    avgDecouplingPct: number | null;
  } | null;
}

// ─── Phase 7: Race types ─────────────────────────────────────────────────────
export type RacePhase = 'base' | 'build' | 'peak' | 'taper' | 'race_week' | 'race_day' | 'past';

export interface RaceContext {
  goalId: string;
  title: string;
  date: string;
  daysUntil: number;
  phase: RacePhase;
  discipline: string | null;
  distanceKm: number | null;
  targetTimeSec: number | null;
  priority: 'A' | 'B' | 'C';
  predictedTimeSec: number | null;
  predictionConfidence: 'low' | 'medium' | 'high' | null;
  location: string | null;
  notes: string | null;
}
