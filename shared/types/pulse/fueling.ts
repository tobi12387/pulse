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

export interface PulseFuelingRecoveryGuidanceResponse {
  shouldShow: boolean;
  preferenceStatus: 'ready' | 'disabled';
  fuelingDebt: PulseFuelingDebtSummary;
  before: PulseFuelingRecoveryGuidanceItem[];
  during: PulseFuelingRecoveryGuidanceItem[];
  after: PulseFuelingRecoveryGuidanceItem[];
  recoveryCautions: string[];
  evidence: PulseFuelingRecoveryEvidence[];
}
