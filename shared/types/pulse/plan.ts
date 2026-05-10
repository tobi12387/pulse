import type { PulseFitnessLoad } from './daily-loop.js';
import type { PulseActivityType } from './activity.js';
import type { PulseProfileProvenanceView } from './profile.js';
import type { PulseCapabilityConfidence, PulseTrainingCapabilitySummary, PulseTrainingEnergySystem, PulseWorkoutFitLabel } from './training.js';

// Training plan, race, season strategy and review Pulse contracts.
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

export type PulseGarminSyncContractStatus = 'ready' | 'degraded' | 'blocked';
export type PulseGarminSyncContractSeverity = 'info' | 'warning' | 'error';
export type PulseGarminSyncContractIssueCode =
  | 'repeat_iterations_invalid'
  | 'repeat_group_missing'
  | 'unsupported_hr_target'
  | 'empty_steps'
  | 'invalid_step_duration'
  | 'remote_repeat_repair';

export interface PulseGarminSyncContractIssue {
  code: PulseGarminSyncContractIssueCode;
  severity: PulseGarminSyncContractSeverity;
  message: string;
  stepIndex?: number;
}

export interface PulseGarminSyncContract {
  version: 1;
  status: PulseGarminSyncContractStatus;
  payloadReady: boolean;
  checkedAt: string;
  summary: string;
  issues: PulseGarminSyncContractIssue[];
}

export type PulseGarminExecutionOperation =
  | 'create'
  | 'update'
  | 'manual_resync'
  | 'calendar_repair'
  | 'delete';

export type PulseGarminExecutionOutcome =
  | 'ready'
  | 'degraded'
  | 'blocked'
  | 'failed'
  | 'deleted';

export interface PulseGarminPayloadSnapshot {
  workoutId: string | null;
  scheduledId: string | null;
  stepCount: number;
  repeatGroupCount: number;
  invalidRepeatCount: number;
  hrTargetStepCount: number;
  durationSec: number | null;
  checkedAt: string;
}

export interface PulseGarminExecutionLedgerEntry {
  id: string;
  plannedWorkoutId: string;
  attemptedAt: string;
  operation: PulseGarminExecutionOperation;
  outcome: PulseGarminExecutionOutcome;
  summary: string;
  payloadSnapshot: PulseGarminPayloadSnapshot | null;
  issues: PulseGarminSyncContractIssue[];
  errorMessage: string | null;
}

export type PulseAdaptationEventKind =
  | 'activity_completed'
  | 'planned_workout_missed'
  | 'workout_replaced'
  | 'high_rpe'
  | 'mental_load'
  | 'fueling_limiter'
  | 'sync_debt'
  | 'recovery_risk';

export type PulseAdaptationRecommendation =
  | 'keep_plan'
  | 'reduce_intensity'
  | 'reduce_volume'
  | 'protect_recovery'
  | 'move_workout'
  | 'regenerate_week'
  | 'sync_garmin'
  | 'log_feedback';

export interface PulseAdaptationEvent {
  id: string;
  userId: string;
  eventDate: string;
  kind: PulseAdaptationEventKind;
  sourceId: string | null;
  severity: 'info' | 'watch' | 'action';
  recommendation: PulseAdaptationRecommendation;
  summary: string;
  evidence: string[];
  resolvedAt: string | null;
  createdAt: string;
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
  archetypeId: string | null;
  difficultyLevel: number | null;
  difficultyEnergySystem: PulseTrainingEnergySystem | null;
  capabilityFit: PulseWorkoutFitLabel | null;
  description: string | null;
  steps: WorkoutStep[] | null;
  garminWorkoutId: string | null;
  garminScheduledId: string | null;
  garminSyncContract: PulseGarminSyncContract | null;
  status: 'planned' | 'completed' | 'skipped';
  workoutFeedback: string | null;
  complianceScore: number | null;
  origin: 'generated' | 'user' | 'adjusted' | string;
  userLocked: boolean;
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

export type PulseTodayOptionsState =
  | 'completed_activity'
  | 'planned_workout'
  | 'unplanned_trainable'
  | 'recovery_protect';

export type PulseTodayOptionKind =
  | 'workout'
  | 'rest'
  | 'recovery'
  | 'fueling'
  | 'feedback'
  | 'skills';

export interface PulseTodayOption {
  id: string;
  kind: PulseTodayOptionKind;
  priority: 'primary' | 'secondary' | 'support';
  title: string;
  detail: string;
  cta: string;
  targetPath: string;
  evidence: string[];
  activityType?: PulseActivityType;
  zone?: number;
  durationMin?: number;
  archetypeId?: string | null;
  capabilityFit?: PulseWorkoutFitLabel | null;
}

export interface PulseTodayOptionsResponse {
  date: string;
  state: PulseTodayOptionsState;
  summary: string;
  options: PulseTodayOption[];
  signature: string;
}

export type PulsePlanScenarioType =
  | 'add_custom_tour'
  | 'move_workout'
  | 'reduce_volume'
  | 'change_availability'
  | 'add_event';

export type PulsePlanScenarioRequest =
  | {
      type: 'add_custom_tour';
      workout: {
        plannedDate: string;
        activityType: PulseActivityType;
        zone?: number;
        durationMin?: number;
        distanceKm?: number | null;
        expectedSpeedKmh?: number | null;
        description?: string | null;
        archetypeId?: string | null;
      };
    }
  | { type: 'move_workout'; workoutId: string; targetDate: string }
  | { type: 'reduce_volume'; factor: number }
  | { type: 'change_availability'; weekStart: string; availableDays: number[]; weeklyHours?: number | null }
  | { type: 'add_event'; title: string; eventDate: string; priority?: RacePriority | null };

export interface PulsePlanScenarioProjectedWorkout {
  id: string;
  plannedDate: string;
  activityType: PulseActivityType;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  userLocked: boolean;
  status: string;
  synthetic?: boolean;
  description?: string | null;
  distanceKm?: number | null;
  expectedSpeedKmh?: number | null;
  archetypeId?: string | null;
}

export interface PulsePlanScenarioChangedDay {
  date: string;
  before: { sessions: number; durationMin: number; tss: number };
  after: { sessions: number; durationMin: number; tss: number };
  label: string;
}

export interface PulsePlanScenarioPreview {
  type: PulsePlanScenarioType;
  summary: string;
  projectedWorkouts: PulsePlanScenarioProjectedWorkout[];
  changedDays: PulsePlanScenarioChangedDay[];
  loadImpact: {
    tssDelta: number;
    durationDeltaMin: number;
    nextDayRecoveryDate: string | null;
  };
  reasons: string[];
  warnings: string[];
  applySupported: boolean;
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

export type PulseGoalLimiterKind =
  | 'long_endurance_fueling'
  | 'threshold_vo2'
  | 'durability'
  | 'anaerobic_repeatability';

export interface PulseGoalLimiter {
  kind: PulseGoalLimiterKind;
  label: string;
  confidence: PulseCapabilityConfidence;
  evidence: string[];
  planBias: string;
  workoutFocus: PulseTrainingEnergySystem[];
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
    trainingCapabilities?: PulseTrainingCapabilitySummary | null;
    goalLimiter?: PulseGoalLimiter | null;
  };
  planDecision: PulsePlanDecision;
  sportMix: Record<string, PulsePlanSportMixEntry>;
  hardDays: Array<{ date: string; activityType: string; zone: number; durationMin: number }>;
  generatedSummary: string[];
  adaptation?: PulsePlanTraceAdaptation | null;
  restDayRationale?: PulseTrainingExecutionReview['restDayRationale'];
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

export type PulseSeasonLoadWeekKind =
  | 'base'
  | 'build'
  | 'peak'
  | 'deload'
  | 'taper'
  | 'race_week'
  | 'maintenance'
  | 'recovery';

export interface PulseSeasonLoadWeek {
  weekStart: string;
  kind: PulseSeasonLoadWeekKind;
  targetHours: number;
  targetTss: number;
  ctlTarget: number;
  rampPct: number;
  note: string;
}

export interface PulseSeasonLoadModel {
  method: 'weekly_hours_tss_ctl';
  rampRateCapPct: number;
  deloadEveryWeeks: number;
  taperWeeks: number;
  annualTargetHours: number | null;
  annualTargetTss: number | null;
  eventPriorityBias: 'a_event' | 'b_event' | 'c_event' | 'maintenance';
  missedLoadCompensation: {
    missedTssLast14d: number;
    compensationTssNext14d: number;
    capReason: string;
  };
  currentWeek: PulseSeasonLoadWeek;
  forecast: PulseSeasonLoadWeek[];
  warnings: string[];
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
  loadModel: PulseSeasonLoadModel;
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
