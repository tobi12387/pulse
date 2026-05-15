export interface PulseFuelingRecoveryGuidanceItem {
  id: string;
  text: string;
}

export interface PulseFuelingRecoveryEvidence {
  label: string;
  value: string;
  status: 'supporting' | 'caution' | 'limited';
}

export type PulseFuelingDebtStatus =
  | 'open_gi_issue'
  | 'controlled_practice_planned'
  | 'tolerated_follow_up'
  | 'resolved';

export interface PulseFuelingDebtSummary {
  status: PulseFuelingDebtStatus;
  hasOpenDebt: boolean;
  label: string;
  summary: string;
  closureCondition: string;
  evidence: string[];
  openIssueDate: string | null;
  controlledWorkoutId: string | null;
  followUpActivityId: string | null;
  updatedAt: string;
}

export type PulseFuelingOutcomeBaselineStatus =
  | 'insufficient_data'
  | 'learning'
  | 'stable'
  | 'caution';

export interface PulseFuelingCarbRange {
  min: number;
  max: number;
}

export interface PulseFuelingLearningReadiness {
  comparableCompleteLogs: number;
  requiredComparableCompleteLogs: number;
  readyForTrendSummary: boolean;
  missingEvidence: string[];
}

export interface PulseFuelingOutcomeBaseline {
  status: PulseFuelingOutcomeBaselineStatus;
  label: string;
  summary: string;
  latestLogDate: string | null;
  observedCarbsPerHour: number | null;
  targetCarbsPerHour: PulseFuelingCarbRange | null;
  bottles750Ml: number | null;
  powderG: number | null;
  fluidMlPerHour: number | null;
  sodiumMgPerHour: number | null;
  hydrationContextSummary?: string | null;
  hydrationEvidenceGaps?: string[];
  trendSummary?: string | null;
  evidence: string[];
  learningReadiness?: PulseFuelingLearningReadiness;
}

export interface PulseFuelingRecoveryGuidanceResponse {
  shouldShow: boolean;
  preferenceStatus: 'ready' | 'disabled';
  fuelingDebt: PulseFuelingDebtSummary;
  outcomeBaseline: PulseFuelingOutcomeBaseline;
  before: PulseFuelingRecoveryGuidanceItem[];
  during: PulseFuelingRecoveryGuidanceItem[];
  after: PulseFuelingRecoveryGuidanceItem[];
  recoveryCautions: string[];
  evidence: PulseFuelingRecoveryEvidence[];
}
