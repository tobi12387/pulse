import type {
  PulseHomeScreenData, PulseSleepSession, PulseActivity,
  PulsePlannedWorkout, PulseMentalCheckin, PulseGoal,
  PulseWeeklyReview, PulseWeightEntry, WeekAvailability, GoalCategory,
  RaceDiscipline, RacePriority,
  PulseDataStatus, PulseFitnessLoad, PulseReadiness,
  ActivityFeedbackInput, PulsePlanDecision, PulseRiskSignal, PulseCoachMessage,
  PulseDailyDecisionQualityResponse, PulseDailyOutcomeLearningResponse, PulseDataCoverageResponse, PulseGarminBackfillRequest, PulseGarminBackfillResponse, PulseGarminCoverageResponse, PulseGarminSignalUsefulnessResponse,
  PulsePlanTrace, PulsePushSettings, PulsePushTopics, PulseRaceCommandResponse, PulseSeasonStrategyResponse, RaceContext,
  PulseProfileMetricKey, PulseProfileProvenanceView, PulseProfileValueSource,
  EquipmentCategory, PulseActivityType, PulseEquipment, PulseEquipmentDefault,
  PulseStrengthSession, PulseStrengthTrendPoint, PulseMentalThemesResponse,
  PulseMentalLoadOverlayResponse, PulseGuidedCheckinResponse, PulseActionState, PulseActionsResponse, PulseCoachPreferences,
  PulseFuelingPreferences, PulseFuelingRecoveryGuidanceResponse,
} from '@coaching-os/shared/pulse';

const BASE = '/api/pulse';

export class PulseApiError extends Error {
  code: string | null;
  retryable: boolean;
  action: string | null;

  constructor(message: string, options: { code?: string | null; retryable?: boolean; action?: string | null } = {}) {
    super(message);
    this.name = 'PulseApiError';
    this.code = options.code ?? null;
    this.retryable = options.retryable ?? true;
    this.action = options.action ?? null;
  }
}

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
    const err = await res.json().catch(() => ({ error: 'Fehler' })) as {
      error?: string;
      code?: string | null;
      retryable?: boolean;
      action?: string | null;
    };
    throw new PulseApiError(err.error ?? `HTTP ${res.status}`, {
      code: err.code ?? null,
      retryable: err.retryable ?? res.status >= 500,
      action: err.action ?? null,
    });
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

  fuelingRecovery: {
    guidance: (workoutId: string): Promise<PulseFuelingRecoveryGuidanceResponse> =>
      request(`/fueling-recovery/guidance?workoutId=${encodeURIComponent(workoutId)}`),
  },

  coach: {
    history: (): Promise<{ messages: PulseCoachMessage[] }> =>
      request('/coach/history'),
    send: (message: string): Promise<{ reply: string }> =>
      request('/coach', { method: 'POST', body: JSON.stringify({ message }) }),
    deleteHistory: (): Promise<void> =>
      request('/coach/history', { method: 'DELETE' }),
  },

  coachPreferences: {
    get: (): Promise<{ preferences: PulseCoachPreferences }> =>
      request('/coach/preferences'),
    update: (data: Partial<Omit<PulseCoachPreferences, 'updatedAt'>>): Promise<{ preferences: PulseCoachPreferences }> =>
      request('/coach/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  risk: {
    list: (): Promise<{ signals: PulseRiskSignal[] }> =>
      request('/risk'),
    snooze: (id: string, hours = 24): Promise<{ ok: boolean; snoozedUntil: string }> =>
      request(`/risk/${id}/snooze`, { method: 'POST', body: JSON.stringify({ hours }) }),
    resolve: (id: string): Promise<{ ok: boolean }> =>
      request(`/risk/${id}/resolve`, { method: 'POST', body: '{}' }),
  },

  actions: {
    list: (options: { includeHistory?: boolean } = {}): Promise<PulseActionsResponse> =>
      request(options.includeHistory ? '/actions?includeHistory=true' : '/actions'),
    update: (id: string, data: { status: 'completed' | 'deferred' | 'dismissed'; reason?: string }): Promise<{
      decision: {
        id: string;
        status: PulseActionState['status'];
        resolvedAt: string | null;
        resolutionReason: string | null;
      };
    }> =>
      request(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  outcomes: {
    daily: (days = 14): Promise<PulseDailyOutcomeLearningResponse> =>
      request(`/outcomes/daily?days=${encodeURIComponent(String(days))}`),
  },

  decisions: {
    quality: (days = 14): Promise<PulseDailyDecisionQualityResponse> =>
      request(`/decisions/quality?days=${encodeURIComponent(String(days))}`),
  },

  push: {
    settings: (): Promise<PulsePushSettings> =>
      request('/push/settings'),
    subscribe: (data: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      deviceLabel?: string;
    }): Promise<{ subscription: PulsePushSettings['subscriptions'][number] }> =>
      request('/push/subscribe', { method: 'POST', body: JSON.stringify(data) }),
    unsubscribe: (endpoint: string): Promise<void> =>
      request('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
    updateTopics: (topics: Partial<PulsePushTopics>): Promise<PulsePushTopics> =>
      request('/push/topics', { method: 'PATCH', body: JSON.stringify(topics) }),
    updateQuietHours: (data: { start: string; end: string }): Promise<{ start: string; end: string }> =>
      request('/push/quiet-hours', { method: 'PATCH', body: JSON.stringify(data) }),
    test: (): Promise<{ ok: boolean; result: { sent: number; failed: number; gone: number; skipped: number } }> =>
      request('/push/test', { method: 'POST', body: '{}' }),
  },

  checkin: {
    submit: (data: {
      mood: number; energy: number; stress: number; motivation: number; notes?: string;
    }): Promise<PulseMentalCheckin> =>
      request('/checkin', { method: 'POST', body: JSON.stringify(data) }),
    text: (text: string): Promise<PulseCheckinTextPreview> =>
      request('/checkin/text', { method: 'POST', body: JSON.stringify({ text }) }),
    voice: (audio: string, mimeType: string): Promise<{
      transcript: string; reply: string; isCheckin: boolean; followUpQuestions: string[]; checkinId: string | null;
      extraction: { mood: number; energy: number; stress: number; motivation: number; themes: string[] } | null;
    }> =>
      request('/checkin/voice', { method: 'POST', body: JSON.stringify({ audio, mimeType }) }),
    today: (): Promise<{ checkin: { id: string; date: string } | null }> =>
      request('/checkin/today'),
    guidance: (): Promise<PulseGuidedCheckinResponse> =>
      request('/checkin/guidance'),
    history: (days = 30): Promise<{ checkins: Array<{
      id: string; date: string; mood: number; energy: number; stress: number; motivation: number;
    }> }> =>
      request(`/checkin/history?days=${days}`),
    themes: (days = 90): Promise<PulseMentalThemesResponse> =>
      request(`/mental/themes?days=${days}`),
    loadOverlay: (days = 56): Promise<PulseMentalLoadOverlayResponse> =>
      request(`/mental/load-overlay?days=${days}`),
  },

  sleep: {
    list: (limit = 7): Promise<{ sessions: PulseSleepSession[] }> =>
      request(`/sleep?limit=${limit}`),
  },

  activities: {
    list: (limit = 10): Promise<{ activities: PulseActivity[] }> =>
      request(`/activities?limit=${limit}`),
    detail: (id: string): Promise<{
      activity: PulseActivity & { externalId: string | null; equipmentIds: string[] };
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
    assignEquipment: (id: string, equipmentIds: string[]): Promise<{ activityId: string; equipmentIds: string[]; kmAdded: number }> =>
      request(`/activities/${id}/equipment`, { method: 'PUT', body: JSON.stringify({ equipmentIds }) }),
  },

  strength: {
    list: (days = 90, exercise?: string): Promise<{ sessions: PulseStrengthSession[]; trends: PulseStrengthTrendPoint[] }> =>
      request(`/strength/sessions?days=${days}${exercise ? `&exercise=${encodeURIComponent(exercise)}` : ''}`),
    create: (data: StrengthSessionInput): Promise<PulseStrengthSession> =>
      request('/strength/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<StrengthSessionInput>): Promise<PulseStrengthSession> =>
      request(`/strength/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      request(`/strength/sessions/${id}`, { method: 'DELETE' }),
  },

  equipment: {
    list: (includeRetired = false): Promise<{ equipment: PulseEquipment[]; defaults: PulseEquipmentDefault[] }> =>
      request(`/equipment?includeRetired=${includeRetired}`),
    create: (data: EquipmentInput): Promise<PulseEquipment> =>
      request('/equipment', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<EquipmentInput>): Promise<PulseEquipment> =>
      request(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    retire: (id: string, retirementDate?: string): Promise<PulseEquipment> =>
      request(`/equipment/${id}/retire`, { method: 'POST', body: JSON.stringify(retirementDate ? { retirementDate } : {}) }),
    setDefault: (activityType: PulseActivityType, equipmentId: string): Promise<PulseEquipmentDefault> =>
      request(`/equipment/defaults/${activityType}`, { method: 'PUT', body: JSON.stringify({ equipmentId }) }),
  },

  plan: {
    list: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan'),
    generate: (): Promise<{ workouts: PulsePlannedWorkout[]; planDecision?: PulsePlanDecision; planTrace?: PulsePlanTrace | null }> =>
      request('/plan/generate', { method: 'POST', body: '{}' }),
    trace: (weekStart: string): Promise<{ trace: PulsePlanTrace | null }> =>
      request(`/plan/trace/${weekStart}`),
    getWorkout: (id: string): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}`),
    createWorkout: (data: PlanWorkoutInput): Promise<{ workout: PulsePlannedWorkout; garminSync: { status: 'skipped' | 'synced' | 'failed'; error?: string } }> =>
      request('/plan/workout', { method: 'POST', body: JSON.stringify(data) }),
    updateWorkout: (id: string, data: {
      activityType?: string;
      zone?: number;
      durationMin?: number;
      plannedDate?: string;
      status?: 'planned' | 'skipped';
      description?: string | null;
    }): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    generateDetail: (id: string): Promise<{ workout: PulsePlannedWorkout }> =>
      request(`/plan/workout/${id}/detail`, { method: 'POST', body: '{}' }),
    syncGarmin: (id: string): Promise<{ garminWorkoutId: string; garminScheduledId: string | null; date: string; workout: PulsePlannedWorkout | null }> =>
      request(`/plan/workout/${id}/sync-garmin`, { method: 'POST', body: '{}' }),
  },

  availability: {
    list: (): Promise<{ weeks: WeekAvailability[] }> =>
      request('/plan/availability'),
    save: (weekStart: string, data: { availableDays: number[]; weeklyHours: number; notes?: string }): Promise<{ ok: boolean; workouts?: PulsePlannedWorkout[]; planDecision?: PulsePlanDecision; planTrace?: PulsePlanTrace | null }> =>
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

  raceCommand: {
    get: (): Promise<PulseRaceCommandResponse> =>
      request('/race-command'),
  },

  seasonStrategy: {
    get: (): Promise<PulseSeasonStrategyResponse> =>
      request('/season-strategy'),
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
    coverage: (params: { days?: number; year?: number } = {}): Promise<PulseDataCoverageResponse> => {
      const qs = new URLSearchParams();
      if (params.year != null) qs.set('year', String(params.year));
      else qs.set('days', String(params.days ?? 30));
      return request(`/data-coverage?${qs.toString()}`);
    },
    domainCoverage: (days = 30): Promise<PulseGarminCoverageResponse> =>
      request(`/garmin/coverage?days=${encodeURIComponent(String(days))}`),
    signalUsefulness: (days = 30): Promise<PulseGarminSignalUsefulnessResponse> =>
      request(`/garmin/signal-usefulness?days=${encodeURIComponent(String(days))}`),
    backfill: (data: PulseGarminBackfillRequest): Promise<PulseGarminBackfillResponse> =>
      request('/garmin/backfill', { method: 'POST', body: JSON.stringify(data) }),
    sync: (): Promise<{ status: string; days?: number; dates?: string[]; activities?: number }> =>
      request('/garmin/sync', { method: 'POST', body: '{}' }),
    syncProfile: (params?: { overrideManualFields?: PulseProfileMetricKey[] }): Promise<{
      synced: Record<PulseProfileMetricKey, {
        field: PulseProfileMetricKey;
        value: number | null;
        source: PulseProfileValueSource;
        status: 'updated' | 'kept_manual' | 'unavailable';
        label: string;
      }>;
      diagnostics: { garminSettings: 'ok' | 'unavailable'; activityRows: number };
      profile: {
        userId: string; ftpWatts: number | null; maxHrBpm: number | null;
        lthrBpm: number | null; restingHrBpm: number | null; weeklyHoursTarget: number | null;
        trainingPhase: string | null; vo2max: number | null;
        provenance: PulseProfileProvenanceView;
      } & PulseFuelingPreferences;
    }> =>
      request('/garmin/sync-profile', { method: 'POST', body: JSON.stringify(params ?? {}) }),
    calendarSync: (): Promise<{ uploaded: number; repaired?: number; removed: number; errors?: string[] }> =>
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
      date: string; cached: boolean; status?: 'ok' | 'data_missing'; action?: string | null; retryable?: boolean;
      evidence?: Array<{ label: string; value: string; window: string; status: 'available' | 'limited' | 'missing'; targetRoute?: '/data' | '/data?tab=analysen' | '/plan' | '/insights' | `/activities/${number}`; targetLabel?: string }>;
      missingData?: Array<{ label: string; reason: string; action?: string }>;
    }> => request(`/insights?domain=${domain}&days=${days}&refresh=${refresh}`),
  },

  profile: {
    get: (): Promise<{
      userId: string; ftpWatts: number | null; maxHrBpm: number | null;
      lthrBpm: number | null;
      restingHrBpm: number | null; weeklyHoursTarget: number | null;
      trainingPhase: string | null; vo2max: number | null;
      provenance: PulseProfileProvenanceView;
    } & PulseFuelingPreferences> => request('/profile'),
    update: (data: {
      ftpWatts?: number; maxHrBpm?: number; lthrBpm?: number; restingHrBpm?: number;
      weeklyHoursTarget?: number; trainingPhase?: string; vo2max?: number;
      fuelingEnabled?: boolean; dietaryConstraints?: string[]; preferredFuelingProducts?: string;
      carbGuidanceStyle?: PulseFuelingPreferences['carbGuidanceStyle'];
      sodiumGuidanceStyle?: PulseFuelingPreferences['sodiumGuidanceStyle'];
      bodyWeightGuidanceEnabled?: boolean;
    }): Promise<unknown> => request('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  metrics: {
    list: (days = 14): Promise<{ metrics: Array<{
      date: string; hrvRmssd: number | null; restingHr: number | null;
      sleepHours: number | null; sleepScore: number | null;
      bodyBatteryMax: number | null; bodyBatteryAtWake: number | null;
      bodyBatteryCharged: number | null; bodyBatteryDrained: number | null;
      bodyBatteryHighest: number | null; bodyBatteryLowest: number | null;
      stressAvg: number | null; maxStress: number | null;
      lowStressSec: number | null; mediumStressSec: number | null; highStressSec: number | null;
      moderateIntensityMin: number | null; vigorousIntensityMin: number | null;
      avgWakingRespiration: number | null; latestSpo2: number | null;
      steps: number | null;
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
  bottles750Ml: number | null; powderG: number | null; fuelingProducts: string[]; giComfort: 'ok' | 'mild_issue' | 'issue' | null;
  notes: string | null; createdAt: string;
}
export interface NutritionLogInput {
  date?: string; workoutId?: string; activityId?: string;
  context?: 'pre' | 'during' | 'post' | 'daily';
  carbsG?: number; gelsCount?: number; drinksMl?: number; sodiumMg?: number;
  bottles750Ml?: number; powderG?: number; fuelingProducts?: string[]; giComfort?: 'ok' | 'mild_issue' | 'issue';
  calories?: number; proteinG?: number; fatG?: number;
  description?: string; notes?: string;
}

export interface PlanWorkoutInput {
  plannedDate: string;
  activityType: PulseActivityType;
  zone?: number;
  durationMin?: number;
  distanceKm?: number;
  expectedSpeedKmh?: number;
  description?: string;
  syncGarmin?: boolean;
  userLocked?: boolean;
}

// ─── Phase 10: Strength + Equipment inputs ──────────────────────────────────
export interface StrengthSetInput {
  exercise: string;
  setNumber?: number;
  reps: number;
  weightKg?: number | null;
  rpe?: number | null;
}

export interface StrengthSessionInput {
  date?: string;
  plannedWorkoutId?: string | null;
  durationMin?: number | null;
  notes?: string | null;
  sets: StrengthSetInput[];
}

export interface EquipmentInput {
  name: string;
  category: EquipmentCategory;
  parentEquipmentId?: string | null;
  activityTypes: PulseActivityType[];
  installedDate: string;
  initialKm?: number | null;
  retirementKm?: number | null;
  retirementDate?: string | null;
  notes?: string | null;
}

export interface PulseCheckinTextPreview {
  text: string;
  reply: string;
  isCheckin: boolean;
  followUpQuestions: string[];
  extraction: {
    mood: number;
    energy: number;
    stress: number;
    motivation: number;
    themes: string[];
  } | null;
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
