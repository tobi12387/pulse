export type PulseTrainingEnergySystem =
  | 'recovery'
  | 'endurance'
  | 'long_endurance'
  | 'tempo'
  | 'threshold'
  | 'vo2'
  | 'anaerobic'
  | 'strength';

export type PulseCapabilityConfidence = 'low' | 'medium' | 'high';

export type PulseTrainingProgressionSignal =
  | 'quality_progress'
  | 'reduce_next_intensity'
  | 'long_off_plan_load'
  | 'protect_recovery'
  | 'missing_history';

export type PulseWorkoutFitLabel =
  | 'recovery'
  | 'maintenance'
  | 'productive'
  | 'stretch'
  | 'too_hard_today';

export interface PulseWorkoutCapabilityFit {
  energySystem: PulseTrainingEnergySystem;
  workoutLevel: number;
  capabilityLevel: number;
  label: PulseWorkoutFitLabel;
  displayLabel: string;
  message: string;
  recommendation: string;
  confidence: PulseCapabilityConfidence;
}

export interface PulseTrainingCapabilityLevel {
  energySystem: PulseTrainingEnergySystem;
  label: string;
  level: number;
  confidence: PulseCapabilityConfidence;
  evidence: string[];
  updatedAt: string | null;
}

export interface PulseTrainingCapabilitySummary {
  generatedAt: string;
  lookbackDays: number;
  levels: PulseTrainingCapabilityLevel[];
  signals: PulseTrainingProgressionSignal[];
  recommendations: string[];
  fitLegend: Record<PulseWorkoutFitLabel, string>;
}

export type PulsePowerDataQualitySource = 'stream' | 'lap_approximation' | 'unavailable';
export type PulsePowerDataQualityStatus = 'trusted' | 'usable_with_caution' | 'blocked';
export type PulseDurabilityRating = 'strong' | 'watch' | 'limited';

export interface PulsePowerDataQualitySummary {
  source: PulsePowerDataQualitySource;
  status: PulsePowerDataQualityStatus;
  coveragePct: number;
  spikeCount: number;
  limitations: string[];
  updatedAt: string | null;
}

export interface PulsePowerDurationBestEffort {
  durationSec: number;
  avgPowerW: number;
  startSec: number | null;
  activityId: string;
  activityDate: string;
  source: Extract<PulsePowerDataQualitySource, 'stream' | 'lap_approximation'>;
  qualityStatus: Extract<PulsePowerDataQualityStatus, 'trusted' | 'usable_with_caution'>;
}

export interface PulseDurabilitySummary {
  rating: PulseDurabilityRating;
  powerDropPct: number;
  hrDriftBpm: number;
  evidence: string[];
  activityId: string;
  activityDate: string;
  qualitySource: Extract<PulsePowerDataQualitySource, 'stream' | 'lap_approximation'>;
  qualityStatus: Extract<PulsePowerDataQualityStatus, 'trusted' | 'usable_with_caution'>;
}

export interface PulsePowerDurationSummary {
  bestEfforts: PulsePowerDurationBestEffort[];
  durability: PulseDurabilitySummary | null;
  bestEffortLine: string;
  durabilityLine: string;
  updatedAt: string | null;
}

export interface PulseTrainingAnalyticsResponse {
  weeks: number;
  tssHeatmap: Array<{ date: string; tss: number }>;
  zoneDistribution: Array<{
    weekStart: string;
    totalH: number;
    zones: { z1: number; z2: number; z3: number; z4: number; z5: number };
  }>;
  vo2maxTrend: Array<{ date: string; vo2max: number }>;
  rpeByZone: {
    totalRated: number;
    zones: Array<{
      zone: number;
      avgRpe: number | null;
      count: number;
      previousAvgRpe: number | null;
      drift: number | null;
    }>;
  };
  capabilitySummary: PulseTrainingCapabilitySummary;
  powerDataQuality: PulsePowerDataQualitySummary;
  powerDuration: PulsePowerDurationSummary | null;
}
