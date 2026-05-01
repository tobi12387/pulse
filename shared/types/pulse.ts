import type { ColorToken } from './pulse-thresholds.js';

// TypeScript interfaces for Pulse data — no Drizzle dependency.

export const RPE_SORENESS_AREAS = [
  'neck',
  'shoulders',
  'upper_back',
  'lower_back',
  'hip',
  'glutes',
  'quad',
  'hamstring',
  'calf',
  'knee_left',
  'knee_right',
  'achilles',
  'foot',
  'general_fatigue',
] as const;

export type RpeSorenessArea = typeof RPE_SORENESS_AREAS[number];

export interface ActivityFeedbackInput {
  rpe: number;
  rpeNote?: string | null;
  sorenessAreas?: RpeSorenessArea[] | null;
}

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
  stressAvg: number | null;
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
  quality: 'poor' | 'fair' | 'good' | 'excellent' | null;
  source: string;
}

export interface PulseActivity {
  id: string;
  userId: string;
  externalId: string | null;
  source: string;
  startTime: string;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  name: string | null;
  durationSec: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  tss: number | null;
  calories: number | null;
  elevationGainM: number | null;
  trainingEffectAerobic: number | null;
  trainingEffectAnaerobic: number | null;
  vo2maxEstimate: number | null;
  rpe: number | null;
  rpeNote: string | null;
  sorenessAreas: RpeSorenessArea[] | null;
  feedbackLoggedAt: string | null;
}

export interface WorkoutStep {
  type: 'warmup' | 'interval' | 'rest' | 'cooldown' | 'steady';
  durationMin: number;
  zone: number;
  reps?: number;
  restMin?: number;
  description?: string;
  targetHrMinBpm?: number;
  targetHrMaxBpm?: number;
  targetLabel?: string;
}

export interface PulsePlannedWorkout {
  id: string;
  userId: string;
  plannedDate: string;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  zone: number;
  durationMin: number;
  distanceKm: number | null;
  targetTss: number | null;
  description: string | null;
  steps: WorkoutStep[] | null;
  garminWorkoutId: string | null;
  status: 'planned' | 'completed' | 'skipped';
  workoutFeedback: string | null;
  complianceScore: number | null;
  completedActivityId: string | null;
}

export interface PulsePlanDecision {
  selectedDays: number[];
  skippedAvailableDays: number[];
  targetSessionCount: number;
  primaryGoal: string | null;
  reasons: string[];
}

export interface PulseMentalCheckin {
  id: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
  themes: string[] | null;
  source: string;
  coachQuestions: Array<{ question: string; answer: string | null }> | null;
  createdAt: string;
}

export interface PulseMentalThemeOccurrence {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
}

export interface PulseMentalThemeSummary {
  theme: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  weeklyFrequency: Array<{ weekStart: string; count: number }>;
  isResurfacing: boolean;
  isResolved: boolean;
  occurrences: PulseMentalThemeOccurrence[];
}

export interface PulseMentalThemesResponse {
  themes: PulseMentalThemeSummary[];
  totalCheckins: number;
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

export type GoalCategory = 'race' | 'weight' | 'ftp' | 'vo2max' | 'volume';

export type RaceDiscipline =
  | 'run' | 'bike' | 'swim'
  | 'triathlon_sprint' | 'triathlon_olympic' | 'triathlon_70_3' | 'triathlon_140_6'
  | 'duathlon' | 'other';

export type RacePriority = 'A' | 'B' | 'C';

export interface PulseGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  progress: number;
  metrics: Record<string, unknown>;
  category: GoalCategory | null;
  // Race-specific (set when category='race')
  raceDiscipline: RaceDiscipline | null;
  raceDistanceKm: number | null;
  raceTargetTimeSec: number | null;
  racePriority: RacePriority | null;
  raceLocation: string | null;
  raceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeekAvailability {
  weekStart: string;
  availableDays: number[];
  weeklyHours: number;
  notes: string | null;
  isCustom: boolean;
}

export interface PulsePrognosis {
  alert: boolean;
  message: string;
  horizon_days: number;
  factors: string[];
}

export interface PulseCoachMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PulseCoachSession {
  id: string;
  userId: string;
  startedAt: string;
  lastMessageAt: string;
  messages: PulseCoachMessage[];
}

export interface PulseWeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  narrative: string;
  metrics: Record<string, unknown>;
  recommendations: string[];
  createdAt: string;
}

export type RiskSignalSeverity = 'info' | 'warn' | 'critical';
export type RiskSignalStatus = 'active' | 'resolved' | 'snoozed';

export interface PulseRiskSignal {
  id: string;
  ruleId: string;
  severity: RiskSignalSeverity;
  status: RiskSignalStatus;
  title: string;
  description: string;
  recommendation: string;
  metric: Record<string, unknown>;
  triggeredAt: string;
  resolvedAt: string | null;
  snoozedUntil: string | null;
}

export interface PulseReadiness {
  score: number;
  components: {
    sleep: number;
    hrv: number;
    tsb: number;
    battery: number;
    mental: number;
    stress: number;
  };
  label: 'erholen' | 'mäßig' | 'gut' | 'optimal';
  shortLabel: string;
  color: ColorToken;
}

export interface PulseFitnessLoad {
  ctl: number;
  atl: number;
  tsb: number;
  date: string;
}

export interface PulseFitnessLoadPoint extends PulseFitnessLoad {
  tss: number;
}

export interface PulseMentalLoadOverlayPoint extends PulseFitnessLoadPoint {
  mood: number | null;
  energy: number | null;
  stress: number | null;
  motivation: number | null;
}

export interface PulseMentalLoadOverlayResponse {
  days: number;
  points: PulseMentalLoadOverlayPoint[];
  stats: {
    checkins: number;
    avgMood: number | null;
    avgStress: number | null;
    moodTsbCorrelation: number | null;
    lowTsbCheckins: number;
  };
}

export interface PulseStreaks {
  checkinStreakDays: number;
  workoutStreakDays: number;
}

export interface PulseRecoveryMetrics {
  sleepDebt7d:    { hours: number; targetH: number; baselineSource: 'adaptive' | 'fixed_default'; status: 'ok' | 'mild' | 'severe' };
  hrvDeviation7d: { pct: number; recentMs: number | null; baselineMs: number | null; status: 'recovering' | 'stable' | 'declining' };
  rhrDrift7d:     { bpmAboveBaseline: number; recent: number | null; baseline: number | null; status: 'normal' | 'elevated' };
  recoveryScore:  number;
  recommendation: string;
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

export type PushTopic = 'briefing' | 'checkin_reminder' | 'risk_critical';

export type PulsePushTopics = Record<PushTopic, boolean>;

export interface PulsePushSubscription {
  id: string;
  endpoint: string;
  deviceLabel: string | null;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PulsePushSettings {
  configured: boolean;
  publicKey: string | null;
  topics: PulsePushTopics;
  quietHours: {
    start: string;
    end: string;
  };
  subscriptions: PulsePushSubscription[];
}

export type EquipmentCategory =
  | 'chain'
  | 'tire'
  | 'brake_pad'
  | 'cassette'
  | 'running_shoe'
  | 'bike'
  | 'wetsuit'
  | 'other';

export type PulseActivityType = PulseActivity['activityType'];

export interface PulseStrengthSet {
  id: string;
  sessionId: string;
  exercise: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  rpe: number | null;
  e1rmKg: number | null;
}

export interface PulseStrengthSession {
  id: string;
  userId: string;
  plannedWorkoutId: string | null;
  date: string;
  durationMin: number | null;
  notes: string | null;
  createdAt: string | null;
  sets: PulseStrengthSet[];
}

export interface PulseStrengthTrendPoint {
  date: string;
  exercise: string;
  e1rmKg: number;
}

export interface PulseEquipment {
  id: string;
  userId: string;
  name: string;
  category: EquipmentCategory;
  parentEquipmentId: string | null;
  activityTypes: PulseActivityType[];
  installedDate: string;
  initialKm: number | null;
  retirementKm: number | null;
  retirementDate: string | null;
  retiredAt: string | null;
  notes: string | null;
  createdAt: string | null;
  totalKm: number;
  pctConsumed: number | null;
  warning: boolean;
}

export interface PulseEquipmentDefault {
  activityType: PulseActivityType;
  equipmentId: string;
}

export interface PulseHomeScreenData {
  date: string;
  readiness: PulseReadiness;
  todayMetrics: PulseDailyMetrics | null;
  fitnessLoad: PulseFitnessLoad;
  recentActivities: PulseActivity[];
  nextWorkout: PulsePlannedWorkout | null;
  prognosis: PulsePrognosis;
  streaks: PulseStreaks;
  recovery: PulseRecoveryMetrics | null;
  dataStatus: PulseDataStatus;
}
