import type { PulseProfileProvenanceView } from './profile.js';

// Garmin health, recovery, coverage, quality and backfill Pulse contracts.
export interface PulseDailyMetrics {
  id: string;
  userId: string;
  date: string;
  hrvRmssd: number | null;
  hrvStatus: 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  bodyBatteryHighest: number | null;
  bodyBatteryLowest: number | null;
  bodyBatteryAtWake: number | null;
  stressAvg: number | null;
  maxStress: number | null;
  lowStressSec: number | null;
  mediumStressSec: number | null;
  highStressSec: number | null;
  moderateIntensityMin: number | null;
  vigorousIntensityMin: number | null;
  avgWakingRespiration: number | null;
  latestSpo2: number | null;
  steps: number | null;
  caloriesActive: number | null;
  source: string;
  syncedAt: string;
}

export interface PulseSleepSession {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationH: number | null;
  deepSleepH: number | null;
  remSleepH: number | null;
  lightSleepH: number | null;
  awakeH: number | null;
  sleepScore: number | null;
  sleepNeedMin: number | null;
  sleepActualMin: number | null;
  avgSleepStress: number | null;
  avgSleepHr: number | null;
  avgRespiration: number | null;
  restlessMoments: number | null;
  bodyBatteryChange: number | null;
  breathingDisruptionIndex: number | null;
  quality: 'poor' | 'fair' | 'good' | 'excellent' | null;
  source: string;
}
export interface PulseWeightEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  bmi: number | null;
  source: string | null;
  notes: string | null;
}
export interface PulseDataStatus {
  userReady: boolean;
  profileReady: boolean;
  garmin: {
    status: 'ready' | 'empty' | 'stale' | 'partial';
    lastMetricDate: string | null;
    lastMetricSyncAt: string | null;
    lastActivityAt: string | null;
    metricsDays14: number;
    activitiesDays14: number;
    issues: string[];
  };
}

export type PulseDataCoverageReason =
  | 'present'
  | 'partial'
  | 'not_synced'
  | 'not_synced_yet'
  | 'not_recorded'
  | 'garmin_unavailable';

export interface PulseDataCoverageDomain {
  status: 'present' | 'partial' | 'missing';
  reason: PulseDataCoverageReason;
  count?: number;
  missingFields?: string[];
}

export interface PulseDataCoverageDay {
  date: string;
  dailyMetrics: PulseDataCoverageDomain & { syncedAt: string | null };
  sleep: PulseDataCoverageDomain & { durationH: number | null; hasStages: boolean };
  activities: PulseDataCoverageDomain & { count: number; weatherCount: number; missingWeatherCount: number };
  weight: PulseDataCoverageDomain & { hasBodyComposition: boolean };
}

export interface PulseDataCoverageResponse {
  range: {
    from: string;
    to: string;
    days: number;
    year: number | null;
  };
  summary: {
    dailyMetricsDays: number;
    sleepDays: number;
    activityDays: number;
    activities: number;
    weatherActivities: number;
    weightDays: number;
    completeDays: number;
  };
  profile: {
    updatedAt: string | null;
    ftpWatts: number | null;
    maxHrBpm: number | null;
    lthrBpm: number | null;
    vo2max: number | null;
    provenance?: PulseProfileProvenanceView;
    missing: Array<'ftpWatts' | 'maxHrBpm' | 'lthrBpm' | 'vo2max'>;
  };
  days: PulseDataCoverageDay[];
}

export type PulseGarminBackfillDomain = 'dailyMetrics' | 'sleep' | 'activities' | 'weather' | 'weight';

export type PulseGarminCoverageDomain =
  | 'activities'
  | 'daily_metrics'
  | 'sleep'
  | 'hrv'
  | 'body_composition'
  | 'planned_workouts'
  | 'calendar';

export type PulseGarminCoverageStatus = 'fresh' | 'partial' | 'missing' | 'stale' | 'blocked';

export type PulseGarminSignalUsefulnessStatus = 'used' | 'underused' | 'missing_or_sparse';

export type PulseGarminSignalUseCase =
  | 'daily_decision'
  | 'plan_generation'
  | 'recovery_note'
  | 'race_readiness'
  | 'mental_load'
  | 'data_quality';

export interface PulseGarminSignalUsefulnessItem {
  signalKey: string;
  label: string;
  status: PulseGarminSignalUsefulnessStatus;
  coverageDays: number;
  sampleDays: string[];
  currentConsumers: string[];
  recommendedNextConsumer: PulseGarminSignalUseCase | null;
  whyItMatters: string;
  evidence: string[];
}

export interface PulseGarminSignalUsefulnessResponse {
  range: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    used: number;
    underused: number;
    missingOrSparse: number;
  };
  items: PulseGarminSignalUsefulnessItem[];
  topUnderused: PulseGarminSignalUsefulnessItem[];
  recommendedUseCases: PulseGarminSignalUseCase[];
}

export interface PulseGarminCoverageRepairAction {
  type: 'backfill' | 'calendar_sync' | 'plan';
  label: string;
  route: string;
  domains?: PulseGarminBackfillDomain[];
  candidateDays?: string[];
}

export interface PulseGarminCoverageCircuitState {
  status: 'ok' | 'open' | 'unknown';
  failures: number | null;
  reason: string | null;
}

export interface PulseGarminCoverageDomainState {
  domain: PulseGarminCoverageDomain;
  label: string;
  status: PulseGarminCoverageStatus;
  reason: string;
  lastFreshAt: string | null;
  lastFreshDate: string | null;
  missingDays: number;
  partialDays: number;
  repairableDays: number;
  repairAction: PulseGarminCoverageRepairAction | null;
  evidence: string[];
}

export interface PulseGarminCoverageResponse {
  range: {
    from: string;
    to: string;
    days: number;
  };
  generatedAt: string;
  circuit: PulseGarminCoverageCircuitState;
  domains: PulseGarminCoverageDomainState[];
}

export type PulseGarminBackfillDayStatus = 'planned' | 'synced' | 'skipped' | 'failed';

export interface PulseGarminBackfillDayResult {
  date: string;
  status: PulseGarminBackfillDayStatus;
  dailyMetrics: boolean;
  activities: number;
  weight: boolean;
  reason: string | null;
  error: string | null;
}

export interface PulseGarminBackfillRequest {
  from: string;
  to: string;
  domains?: PulseGarminBackfillDomain[];
  dryRun?: boolean;
}

export interface PulseGarminBackfillResponse {
  dryRun: boolean;
  range: {
    from: string;
    to: string;
    days: number;
  };
  domains: PulseGarminBackfillDomain[];
  limitDays: number;
  summary: {
    planned: number;
    synced: number;
    skipped: number;
    failed: number;
    activities: number;
    weightDays: number;
  };
  days: PulseGarminBackfillDayResult[];
}
