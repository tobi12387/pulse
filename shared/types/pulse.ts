import type { ColorToken } from './pulse-thresholds.js';

// TypeScript interfaces for Pulse data — no Drizzle dependency.

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
}

export interface WorkoutStep {
  type: 'warmup' | 'interval' | 'rest' | 'cooldown' | 'steady';
  durationMin: number;
  zone: number;
  reps?: number;
  restMin?: number;
  description?: string;
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
