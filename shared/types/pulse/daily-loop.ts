import type { ColorToken } from '../pulse-thresholds.js';
import type { PulseActivity } from './activity.js';
import type { PulseDailyMetrics, PulseDataStatus } from './garmin.js';
import type { PulsePlannedWorkout } from './plan.js';

// Daily loop, readiness, coach, actions and Home screen Pulse contracts.
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

export type PulseDailyDeltaStatus = 'matched' | 'replaced' | 'missed' | 'off_plan';

export interface PulseDailyDeltaItem {
  date: string;
  status: PulseDailyDeltaStatus;
  title: string;
  summary: string;
  score: number | null;
  loadDeltaTss: number | null;
  recoveryDelta: string | null;
  nextPlanEffect: string;
  evidence: string[];
  targetPath: string;
}

export interface PulseDailyDeltaResponse {
  items: PulseDailyDeltaItem[];
}

export type PulseDailyDecisionQualityStatus =
  | 'helpful'
  | 'watch'
  | 'stale'
  | 'needs_strategy_change'
  | 'insufficient_evidence';

export type PulseDailyDecisionQualityThemeStatus =
  | 'useful_repetition'
  | 'watch'
  | 'stale';

export interface PulseDailyDecisionQualityTheme {
  theme: string;
  count: number;
  lastSeen: string | null;
  status: PulseDailyDecisionQualityThemeStatus;
  evidence: string[];
}

export interface PulseDailyDecisionQualityEvidence {
  label: string;
  detail: string;
  source: 'action_decision' | 'outcome_learning' | 'checkin' | 'garmin' | 'plan_trace';
  tone: 'positive' | 'neutral' | 'negative' | 'missing';
  date: string | null;
  targetRoute?: '/data' | '/plan' | '/coach' | '/insights';
}

export interface PulseDailyDecisionQualityResponse {
  range: {
    from: string;
    to: string;
    days: number;
  };
  qualityScore: number;
  status: PulseDailyDecisionQualityStatus;
  statusLabel: string;
  repeatedThemes: PulseDailyDecisionQualityTheme[];
  bestEvidence: string[];
  evidence: PulseDailyDecisionQualityEvidence[];
  suggestedAdjustment: string;
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

export interface PulseHomeScreenData {
  date: string;
  readiness: PulseReadiness;
  todayMetrics: PulseDailyMetrics | null;
  fitnessLoad: PulseFitnessLoad;
  todayWorkout: PulsePlannedWorkout | null;
  todayActivities?: PulseActivity[];
  recentActivities: PulseActivity[];
  nextWorkout: PulsePlannedWorkout | null;
  prognosis: PulsePrognosis;
  streaks: PulseStreaks;
  recovery: PulseRecoveryMetrics | null;
  dataStatus: PulseDataStatus;
  nextBestActions: PulseNextBestAction[];
}
