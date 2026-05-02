// Athlete profile, provenance and coach preference Pulse contracts.
export type PulseProfileMetricKey = 'ftpWatts' | 'maxHrBpm' | 'lthrBpm' | 'vo2max';
export type PulseProfileValueSource = 'manual' | 'garmin_settings' | 'activity_derived' | 'estimated' | 'missing';

export interface PulseProfileMetricProvenance {
  key: PulseProfileMetricKey;
  label: string;
  value: number | null;
  source: PulseProfileValueSource;
  sourceLabel: string;
  updatedAt: string | null;
  warning: string | null;
}

export interface PulseProfileProvenanceView {
  fields: Record<PulseProfileMetricKey, PulseProfileMetricProvenance>;
  warnings: string[];
}
export type PulseCoachCommunicationStyle = 'direct' | 'gentle' | 'data_first';

export interface PulseCoachPreferences {
  timeWindows: string;
  dislikedWorkoutPatterns: string[];
  preferredLongDays: number[];
  injurySensitiveConstraints: string[];
  communicationStyle: PulseCoachCommunicationStyle;
  updatedAt: string | null;
}
