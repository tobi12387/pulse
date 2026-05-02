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

export type WorkoutExecutionStatus =
  | 'local_planned'
  | 'garmin_template'
  | 'garmin_scheduled'
  | 'completed_matched'
  | 'missed'
  | 'replaced_or_off_plan';

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
  garminScheduledId: string | null;
  status: 'planned' | 'completed' | 'skipped';
  workoutFeedback: string | null;
  complianceScore: number | null;
  completedActivityId: string | null;
  executionStatus: WorkoutExecutionStatus | null;
  executionMatchedAt: string | null;
  executionMatchConfidence: number | null;
  executionNotes: string | null;
}

export interface PulsePlanDecision {
  selectedDays: number[];
  skippedAvailableDays: number[];
  targetSessionCount: number;
  primaryGoal: string | null;
  reasons: string[];
}

export interface PulsePlanSportMixEntry {
  sessions: number;
  totalMinutes: number;
  totalTss: number;
}

export type PulsePlanLearningFlag =
  | 'low_compliance'
  | 'low_completion'
  | 'high_rpe_easy'
  | 'repeated_hard_pattern'
  | 'repeated_sport_mix'
  | 'missing_history';

export interface PulsePlanLearningWeek {
  weekStart: string;
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  completionRate: number | null;
  avgComplianceScore: number | null;
  avgRpe: number | null;
  sportMix: Record<string, PulsePlanSportMixEntry>;
  hardDays: Array<{ date: string; activityType: string; zone: number; durationMin: number }>;
  skippedAvailableDays: number[];
}

export interface PulsePlanLearningSnapshot {
  lookbackWeeks: number;
  weeks: PulsePlanLearningWeek[];
  previousWeek: PulsePlanLearningWeek | null;
  learnedFromLastWeek: string[];
  variationComparedToLastWeek: string[];
  flags: PulsePlanLearningFlag[];
  executionReview?: PulseTrainingExecutionReview | null;
}

export type PulseTrainingExecutionReviewSignal =
  | 'matched'
  | 'missed'
  | 'replaced'
  | 'reduce_next_intensity'
  | 'maintain_structure'
  | 'protect_recovery';

export type PulseTrainingExecutionReviewIntent = 'repeat' | 'reduce' | 'rotate' | 'rest' | 'stable';

export interface PulseTrainingExecutionReview {
  signals: PulseTrainingExecutionReviewSignal[];
  learnedFromLastWeek: string[];
  variationComparedToLastWeek: string[];
  restDayRationale: Array<{ date: string; reason: string }>;
  recommendedHardDayAvoidance: number[];
  intents: PulseTrainingExecutionReviewIntent[];
}

export interface PulsePlanTraceAdaptation {
  learnedFromExecution: string[];
  variationRationale: string[];
  signals?: PulseTrainingExecutionReviewSignal[];
}

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

export interface PulsePlanTrace {
  id: string;
  userId: string;
  weekStart: string;
  createdAt: string;
  inputSnapshot: {
    phase: string;
    mesocycleWeek: number;
    weeklyHoursTarget: number;
    availableDays: number[];
    load: PulseFitnessLoad;
    profile: {
      ftpWatts: number | null;
      maxHrBpm: number | null;
      lthrBpm: number | null;
      provenance?: PulseProfileProvenanceView;
    };
    goals: Array<{
      title: string;
      category: string | null;
      targetDate: string | null;
      raceDiscipline: string | null;
      raceDistanceKm: number | null;
      racePriority: string | null;
    }>;
    riskSignals: Array<{ ruleId: string; severity: string; title: string }>;
    healthStates: Array<{ type: string; severity: string; bodyPart: string | null; startDate: string; endDate: string | null }>;
    recentRpe: Array<{ date: string; activityType: string; plannedZone: number | null; rpe: number; durationMin: number; tss: number }>;
    rpeReasons: string[];
    dataWarnings: string[];
    recentSportMix: Record<string, PulsePlanSportMixEntry>;
    learningSnapshot?: PulsePlanLearningSnapshot | null;
    adaptation?: PulsePlanTraceAdaptation | null;
    restDayRationale?: PulseTrainingExecutionReview['restDayRationale'];
    seasonStrategy?: PulseSeasonStrategy | null;
  };
  planDecision: PulsePlanDecision;
  sportMix: Record<string, PulsePlanSportMixEntry>;
  hardDays: Array<{ date: string; activityType: string; zone: number; durationMin: number }>;
  generatedSummary: string[];
  adaptation?: PulsePlanTraceAdaptation | null;
  restDayRationale?: PulseTrainingExecutionReview['restDayRationale'];
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

export interface PulseGuidedCheckinQuestion {
  id: string;
  label: string;
  rationale: string;
  answerMode: 'scale' | 'short_text' | 'choice';
}

export interface PulseGuidedMentalAction {
  id: string;
  label: string;
  rationale: string;
  targetRoute: '/coach' | '/data' | '/plan';
  closureKind: 'reflection' | 'boundary' | 'recovery' | 'movement' | 'support';
}

export interface PulseGuidedCheckinResponse {
  date: string;
  questions: PulseGuidedCheckinQuestion[];
  action: PulseGuidedMentalAction | null;
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
  priority: RacePriority;
  predictedTimeSec: number | null;
  predictionConfidence: 'low' | 'medium' | 'high' | null;
  location: string | null;
  notes: string | null;
}

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

export type PulseRaceCommandReadinessStatus = 'ready' | 'watch' | 'compromised';
export type PulseRaceCommandRiskStatus = 'clear' | 'watch' | 'blocked';

export interface PulseRaceCommandWorkout {
  id: string;
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  description: string | null;
  reason: string;
}

export interface PulseRaceCommandSummary {
  race: RaceContext;
  phase: {
    key: RacePhase;
    label: string;
    daysUntil: number;
    description: string;
  };
  readinessStatus: PulseRaceCommandReadinessStatus;
  readinessLabel: string;
  nextKeyWorkout: PulseRaceCommandWorkout | null;
  recoveryBoundary: {
    label: string;
    detail: string;
    severity: 'normal' | 'caution' | 'hard_stop';
  };
  riskImpact: {
    status: PulseRaceCommandRiskStatus;
    label: string;
    reasons: string[];
  };
  evidence: string[];
}

export interface PulseRaceCommandResponse {
  command: PulseRaceCommandSummary | null;
}

export type PulseDailyOutcomeLearningStatus =
  | 'reinforced'
  | 'superseded_by_data'
  | 'stale_pattern'
  | 'insufficient_evidence';

export interface PulseDailyOutcomeLearningItem {
  date: string;
  actionId: string;
  actionTitle: string;
  actionStatus: PulseActionDecisionStatus;
  status: PulseDailyOutcomeLearningStatus;
  title: string;
  reason: string;
  evidence: string[];
  suggestedAdjustment: string;
}

export interface PulseDailyOutcomeLearningResponse {
  items: PulseDailyOutcomeLearningItem[];
}

export type PulseSeasonStrategyBlockKind =
  | 'base'
  | 'build'
  | 'peak'
  | 'taper'
  | 'race_week'
  | 'maintenance'
  | 'consolidation';

export interface PulseSeasonStrategyBlock {
  kind: PulseSeasonStrategyBlockKind;
  label: string;
  startWeek: string;
  endWeek: string;
  focus: string;
}

export interface PulseSeasonStrategyGuardrails {
  targetSessions: number;
  maxHardDays: number;
  deload: boolean;
  freeDayRationale: string;
  rationale: string[];
  nextBoundary: { label: string; date: string } | null;
}

export interface PulseSeasonStrategy {
  horizonWeeks: number;
  primaryGoal: {
    id: string | null;
    title: string;
    category: string | null;
    targetDate: string | null;
    priority: RacePriority | null;
  } | null;
  currentBlock: PulseSeasonStrategyBlock;
  upcomingBlocks: PulseSeasonStrategyBlock[];
  guardrails: PulseSeasonStrategyGuardrails;
  evidence: string[];
}

export interface PulseSeasonStrategyResponse {
  strategy: PulseSeasonStrategy;
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
  sleepDebt7d:    { hours: number; targetH: number; baselineSource: 'adaptive' | 'fixed_default' | 'garmin_sleep_need'; status: 'ok' | 'mild' | 'severe' };
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

export type PulseNextBestActionPriority = 'critical' | 'high' | 'normal';
export type PulseNextBestActionSource = 'risk' | 'checkin' | 'rpe' | 'plan' | 'push' | 'equipment' | 'mental';

export interface PulseNextBestAction {
  id: string;
  source: PulseNextBestActionSource;
  priority: PulseNextBestActionPriority;
  title: string;
  reason: string;
  cta: string;
  targetPath: string;
  openedAt?: string | null;
  resolvedBy?: string;
  evidence?: string[];
}

export type PulseActionDecisionStatus = 'open' | 'completed' | 'deferred' | 'dismissed' | 'superseded';
export type PulseSuppressedActionReason =
  | 'already_completed_today'
  | 'deferred'
  | 'dismissed'
  | 'resolved_by_activity'
  | 'stale';

export interface PulseActionState extends PulseNextBestAction {
  decisionId: string;
  status: PulseActionDecisionStatus;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

export interface PulseSuppressedActionState extends PulseNextBestAction {
  decisionId: string | null;
  status: PulseActionDecisionStatus | 'auto_suppressed';
  suppressedReason: PulseSuppressedActionReason;
  suppressedUntil: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

export interface PulseRecentActionDecision {
  decisionId: string;
  source: string;
  kind: string;
  title: string;
  status: PulseActionDecisionStatus;
  targetRoute: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

export interface PulseActionsResponse {
  actions: PulseActionState[];
  suppressed?: PulseSuppressedActionState[];
  recentDecisions?: PulseRecentActionDecision[];
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
  nextBestActions: PulseNextBestAction[];
}
